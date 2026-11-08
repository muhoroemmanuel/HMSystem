import { Router } from "express";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { one, query } from "../db";
import { asyncHandler, validate } from "../middleware/validate";
import { badRequest, conflict, notFound } from "../lib/errors";
import { audit } from "../lib/audit";
import { mapUser } from "../lib/mappers";
import { requirePermission, revokeAllForUser } from "../middleware/auth";

const router = Router();

const ROLES = ["admin", "doctor", "receptionist", "billing", "pharmacist", "patient"] as const;

const createSchema = z.object({
  name: z.string().min(2, "Enter a full name").max(120),
  email: z.string().email("Enter a valid email").max(200),
  password: z.string().min(10, "Use at least 10 characters").max(200),
  phone: z.string().max(30).default(""),
  role: z.enum(ROLES),
});

const patchSchema = z.object({
  name: z.string().min(2).max(120).optional(),
  phone: z.string().max(30).optional(),
  role: z.enum(ROLES).optional(),
  status: z.enum(["active", "suspended"]).optional(),
  password: z.string().min(10).max(200).optional(),
});

router.get(
  "/",
  requirePermission("settings", "users"),
  asyncHandler(async (_req, res) => {
    const rows = await query(
      `SELECT u.*, r.name AS role FROM users u JOIN roles r ON r.id = u.role_id
        ORDER BY r.name, u.name`,
    );
    return res.json({ users: rows.map(mapUser) });
  }),
);

router.get(
  "/roles",
  requirePermission("settings", "users"),
  asyncHandler(async (_req, res) => {
    const rows = await query(`SELECT * FROM roles ORDER BY is_system DESC, name`);
    return res.json({
      roles: rows.map((r) => ({
        id: r.id,
        name: r.name,
        description: r.description,
        permissions: r.permissions ?? [],
        isSystem: r.is_system,
      })),
    });
  }),
);

router.post(
  "/",
  requirePermission("settings", "users"),
  validate(createSchema),
  asyncHandler(async (req, res) => {
    const b = req.body as z.infer<typeof createSchema>;

    const role = await one<{ id: string }>(`SELECT id FROM roles WHERE name = $1`, [b.role]);
    if (!role) throw badRequest("That role does not exist");
    const existing = await one(`SELECT id FROM users WHERE lower(email) = lower($1)`, [b.email]);
    if (existing) throw conflict("An account with that email already exists");

    const hash = await bcrypt.hash(b.password, 12);
    const row = await one(
      `INSERT INTO users (name, email, password_hash, phone, role_id, must_change_password)
       VALUES ($1,$2,$3,$4,$5,true) RETURNING *`,
      [b.name.trim(), b.email.trim().toLowerCase(), hash, b.phone, role.id],
    );
    await audit(req, "create", "user", row!.id, { email: b.email, role: b.role });
    return res.status(201).json({ user: mapUser({ ...row, role: b.role }) });
  }),
);

router.patch(
  "/:id",
  requirePermission("settings", "users"),
  validate(patchSchema),
  asyncHandler(async (req, res) => {
    const b = req.body as z.infer<typeof patchSchema>;
    const existing = await one(
      `SELECT u.*, r.name AS role FROM users u JOIN roles r ON r.id = u.role_id WHERE u.id = $1`,
      [req.params.id],
    );
    if (!existing) throw notFound("User");

    if (req.params.id === req.user?.id && b.status === "suspended") {
      throw badRequest("You cannot suspend your own account");
    }

    let roleId = existing.role_id;
    if (b.role && b.role !== existing.role) {
      const role = await one<{ id: string }>(`SELECT id FROM roles WHERE name = $1`, [b.role]);
      if (!role) throw badRequest("That role does not exist");
      roleId = role.id;
    }

    const hash = b.password ? await bcrypt.hash(b.password, 12) : existing.password_hash;

    const row = await one(
      `UPDATE users SET name=$1, phone=$2, role_id=$3, status=$4, password_hash=$5,
         must_change_password = CASE WHEN $6 THEN true ELSE must_change_password END,
         token_version = token_version + CASE WHEN $6 OR $4 <> 'active' THEN 1 ELSE 0 END
       WHERE id=$7 RETURNING *`,
      [
        b.name ?? existing.name,
        b.phone ?? existing.phone,
        roleId,
        b.status ?? existing.status,
        hash,
        Boolean(b.password),
        req.params.id,
      ],
    );

    if (b.password) await revokeAllForUser(String(req.params.id));
    await audit(req, "update", "user", req.params.id, { fields: Object.keys(b) });
    return res.json({ user: mapUser({ ...row!, role: b.role ?? existing.role }) });
  }),
);

router.get(
  "/audit",
  requirePermission("settings", "audit"),
  asyncHandler(async (req, res) => {
    const limit = Math.min(Number(req.query.limit) || 100, 500);
    const rows = await query(
      `SELECT a.*, u.name AS user_name FROM audit_log a
         LEFT JOIN users u ON u.id = a.user_id
        ORDER BY a.created_at DESC LIMIT $1`,
      [limit],
    );
    return res.json({
      entries: rows.map((r) => ({
        id: r.id,
        userName: r.user_name ?? "system",
        action: r.action,
        entity: r.entity,
        entityId: r.entity_id,
        detail: r.detail,
        ip: r.ip,
        createdAt: r.created_at,
      })),
    });
  }),
);

export default router;
