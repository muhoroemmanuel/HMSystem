import readline from "node:readline/promises";
import { randomBytes } from "node:crypto";
import bcrypt from "bcryptjs";
import { envFileMissing, loadEnv, missingEnvFileHint } from "../env";

loadEnv();

import { closeDatabase, initDatabase, one, query } from "../db";

/**
 * Sets up a *production clean* database:
 *   - the six system roles with sensible permissions
 *   - one administrator account
 *   - clinic settings (name/location come from .env)
 *   - the service catalogue the public site advertises
 *
 * It deliberately creates no patients, appointments, invoices, drugs or sales.
 * Only the administrator is real; everything else is a blank ledger.
 */

const ROLES: { name: string; description: string; permissions: string[] }[] = [
  {
    name: "admin",
    description: "Full access to every module, user management and settings",
    permissions: ["*"],
  },
  {
    name: "doctor",
    description: "Clinical: patients, appointments, prescriptions, analytics",
    permissions: ["patients", "patients.write", "appointments", "appointments.write", "analytics", "pharmacy"],
  },
  {
    name: "receptionist",
    description: "Front desk: register patients and manage the appointment book",
    permissions: ["patients", "patients.write", "appointments", "appointments.write"],
  },
  {
    name: "billing",
    description: "Finance: invoices, payments and patient balances",
    permissions: ["billing", "billing.write", "patients"],
  },
  {
    name: "pharmacist",
    description: "Pharmacy: inventory, dispensing and point of sale",
    permissions: ["pharmacy", "pharmacy.write", "patients"],
  },
  {
    name: "patient",
    description: "Patient portal access to own appointments and invoices",
    permissions: [],
  },
];

const SERVICES: {
  slug: string;
  name: string;
  summary: string;
  description: string;
  category: string;
  price: number;
  duration: number;
  icon: string;
  order: number;
}[] = [
  {
    slug: "general-consultation",
    name: "General Consultation",
    summary: "See a doctor about any new or ongoing concern.",
    description:
      "A 30 minute appointment with one of our clinicians. We take your history, examine you, and agree a plan. If you need tests or medication, we arrange them the same day.",
    category: "Primary Care",
    price: 1500,
    duration: 30,
    icon: "🩺",
    order: 1,
  },
  {
    slug: "follow-up-visit",
    name: "Follow-up Visit",
    summary: "Review your progress and adjust treatment.",
    description:
      "For patients already under our care. Bring your medication and any results from other facilities so we can review everything together.",
    category: "Primary Care",
    price: 1000,
    duration: 20,
    icon: "🔁",
    order: 2,
  },
  {
    slug: "child-health",
    name: "Child Health & Immunisation",
    summary: "Growth checks, vaccinations and childhood illness.",
    description:
      "Well-baby visits, growth monitoring, immunisation schedules and treatment for common childhood illnesses, delivered by our paediatric team.",
    category: "Family",
    price: 1200,
    duration: 30,
    icon: "🧒",
    order: 3,
  },
  {
    slug: "maternal-health",
    name: "Maternal & Antenatal Care",
    summary: "Antenatal checks, postnatal review and family planning.",
    description:
      "Routine antenatal monitoring, nutrition and birth planning, postnatal reviews and contraception counselling in a private setting.",
    category: "Family",
    price: 1500,
    duration: 30,
    icon: "🤰",
    order: 4,
  },
  {
    slug: "chronic-care",
    name: "Chronic Disease Clinic",
    summary: "Structured care for diabetes, hypertension and asthma.",
    description:
      "Ongoing review with blood pressure, sugar and medication checks. We keep a single record so every clinician sees the same history.",
    category: "Specialist",
    price: 1800,
    duration: 40,
    icon: "❤️",
    order: 5,
  },
  {
    slug: "laboratory",
    name: "Laboratory Tests",
    summary: "Blood, urine and rapid diagnostic tests on site.",
    description:
      "Same-day results for routine tests including full blood count, malaria, HbA1c, renal function and lipid profiles. Results are reviewed by your clinician.",
    category: "Diagnostics",
    price: 800,
    duration: 15,
    icon: "🧪",
    order: 6,
  },
  {
    slug: "pharmacy",
    name: "Pharmacy",
    summary: "Dispensing, refills and medication reviews.",
    description:
      "Our pharmacy dispenses prescriptions issued in the clinic and offers advice on how to take your medicines safely.",
    category: "Support",
    price: 0,
    duration: 10,
    icon: "💊",
    order: 7,
  },
  {
    slug: "home-visit",
    name: "Home Visit",
    summary: "A clinician comes to you.",
    description:
      "For patients who cannot travel to the clinic. Available within the local area, booked at least 24 hours in advance.",
    category: "Outreach",
    price: 3500,
    duration: 60,
    icon: "🏠",
    order: 8,
  },
];

function generatePassword(): string {
  // Readable but strong: 4 groups of 4 base32-ish characters.
  const alphabet = "abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const bytes = randomBytes(24);
  let out = "";
  for (let i = 0; i < 24; i += 1) {
    out += alphabet[bytes[i]! % alphabet.length];
    if ((i + 1) % 6 === 0) out += "-";
  }
  return out.replace(/-$/, "");
}

async function main() {
  await initDatabase();

  const interactive = process.stdin.isTTY && !process.env.CI;

  for (const role of ROLES) {
    await query(
      `INSERT INTO roles (id, name, description, permissions, is_system)
       VALUES ($1,$2,$3,$4,true)
       ON CONFLICT (name) DO UPDATE
         SET description = EXCLUDED.description,
             permissions = EXCLUDED.permissions,
             is_system = true`,
      [role.name, role.name, role.description, role.permissions],
    );
  }
  console.log(`[seed] ${ROLES.length} roles ready`);

  const adminEmail = (process.env.ADMIN_EMAIL || "").trim().toLowerCase();
  if (!adminEmail) {
    if (envFileMissing) {
      throw new Error(missingEnvFileHint());
    }
    throw new Error(
      "ADMIN_EMAIL is not set in backend/.env, so no administrator can be created.\n" +
        '      Add a line such as: ADMIN_EMAIL="admin@yourclinic.co.ke"',
    );
  }

  let password = (process.env.ADMIN_PASSWORD || "").trim();
  if (!password && interactive) {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    password = (await rl.question(`Password for ${adminEmail} (leave blank to generate): `)).trim();
    await rl.close();
  }
  let generated = false;
  if (!password) {
    password = generatePassword();
    generated = true;
  }
  if (password.length < 10) throw new Error("ADMIN_PASSWORD must be at least 10 characters");

  const existing = await one<{ id: string }>(`SELECT id FROM users WHERE lower(email) = $1`, [adminEmail]);
  const roleRow = await one<{ id: string }>(`SELECT id FROM roles WHERE name = 'admin'`);

  if (!existing) {
    const hash = await bcrypt.hash(password, 12);
    await query(
      `INSERT INTO users (name, email, password_hash, role_id, must_change_password)
       VALUES ($1,$2,$3,$4,true)`,
      [process.env.ADMIN_NAME || "Administrator", adminEmail, hash, roleRow!.id],
    );
    console.log(`[seed] administrator created: ${adminEmail}`);
  } else {
    console.log(`[seed] administrator already exists: ${adminEmail} (password untouched)`);
  }

  const settings = await one(`SELECT id FROM settings WHERE id = 1`);
  if (!settings) {
    await query(
      `INSERT INTO settings (id, clinic_name, location, currency, address, phone, email)
       VALUES (1,$1,$2,$3,$4,$5,$6)`,
      [
        process.env.CLINIC_NAME || "Your Clinic",
        process.env.CLINIC_LOCATION || "",
        process.env.CLINIC_CURRENCY || "KES",
        "",
        "",
        adminEmail,
      ],
    );
    console.log("[seed] clinic settings created - edit them in Settings");
  } else {
    console.log("[seed] clinic settings already exist (left untouched)");
  }

  const serviceCount = await one<{ count: string }>(`SELECT count(*) FROM services`);
  if (Number(serviceCount?.count || 0) === 0) {
    for (const s of SERVICES) {
      await query(
        `INSERT INTO services (slug, name, summary, description, category, price, duration_minutes, icon, sort_order)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) ON CONFLICT (slug) DO NOTHING`,
        [s.slug, s.name, s.summary, s.description, s.category, s.price, s.duration, s.icon, s.order],
      );
    }
    console.log(`[seed] ${SERVICES.length} clinic services added (editable in Settings)`);
  } else {
    console.log("[seed] services already configured (left untouched)");
  }

  console.log("\n[seed] done. Sign in with:");
  console.log(`  email:    ${adminEmail}`);
  if (generated) {
    console.log(`  password: ${password}`);
    console.log("\n  Save this now - it is not stored anywhere and will not be shown again.");
  } else {
    console.log("  password: (the one you supplied)");
  }

  await closeDatabase();
}

main().catch(async (err) => {
  console.error("[seed] failed:", err.message);
  await closeDatabase().catch(() => undefined);
  process.exit(1);
});
