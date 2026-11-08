import type { Request } from "express";
import { query } from "../db";

/**
 * Append-only audit trail. Every mutation in the API writes one row so a
 * clinic can answer "who changed this patient's record, and when".
 */
export async function audit(
  req: Request,
  action: string,
  entity: string,
  entityId?: string | null,
  detail: Record<string, unknown> = {},
): Promise<void> {
  try {
    await query(
      `INSERT INTO audit_log (user_id, action, entity, entity_id, detail, ip)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [
        req.user?.id ?? null,
        action,
        entity,
        entityId ?? null,
        JSON.stringify(detail),
        req.ip ?? null,
      ],
    );
  } catch (err) {
    // Auditing must never break a clinical workflow.
    console.error("[audit] failed to write entry", (err as Error).message);
  }
}
