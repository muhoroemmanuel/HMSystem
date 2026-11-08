import { loadEnv } from "../env";

loadEnv();

import { closeDatabase, initDatabase, one, query, transaction } from "../db";
import { addDaysISO, todayISO } from "../lib/time";

/**
 * OPTIONAL sample data for a local walkthrough.
 *
 * This is the *only* place in the codebase that creates fake clinical records.
 * It refuses to run in production and refuses to run if real patients already
 * exist, so it can never contaminate a live clinic database.
 *
 *   npm run db:demo          # add sample data
 *   npm run db:demo -- --reset   # remove it again
 *
 * Everything it creates is tagged so it can be removed cleanly.
 */

const TAG = "[demo]";

async function reset() {
  // Order matters: several foreign keys are RESTRICT on purpose (a drug that
  // has been sold must stay in the sales history), so child rows go first.
  const demoPatients = await query<{ id: string }>(
    `SELECT id FROM patients WHERE notes LIKE $1 OR reference LIKE 'MC-DEMO-%'`,
    [`%${TAG}%`],
  );
  const ids = demoPatients.map((p) => p.id);

  const demoDoctors = await query<{ id: string }>(
    `SELECT id FROM doctors WHERE phone = 'DEMO'`,
  );
  const doctorIds = demoDoctors.map((d) => d.id);

  const demoDrugs = await query<{ id: string }>(
    `SELECT id FROM drugs WHERE supplier = 'Demo Supplier'`,
  );
  const drugIds = demoDrugs.map((d) => d.id);

  await transaction(async (client) => {
    // Sales and prescriptions that reference sample drugs/patients.
    await client.query(`DELETE FROM sales WHERE reference LIKE 'SAL-DEMO-%'`);
    await client.query(`DELETE FROM prescriptions WHERE reference LIKE 'RX-DEMO-%'`);

    if (ids.length) {
      await client.query(`DELETE FROM appointments WHERE patient_id = ANY($1::uuid[])`, [ids]);
      await client.query(`DELETE FROM invoices WHERE patient_id = ANY($1::uuid[])`, [ids]);
      await client.query(`DELETE FROM patients WHERE id = ANY($1::uuid[])`, [ids]);
    }
    await client.query(`DELETE FROM appointments WHERE reference LIKE 'APT-DEMO-%'`);
    await client.query(`DELETE FROM invoices WHERE reference LIKE 'INV-DEMO-%'`);

    if (doctorIds.length) {
      await client.query(`DELETE FROM doctors WHERE id = ANY($1::uuid[])`, [doctorIds]);
    }
    if (drugIds.length) {
      await client.query(`DELETE FROM drugs WHERE id = ANY($1::uuid[])`, [drugIds]);
    }
    await client.query(`DELETE FROM users WHERE email IN ('reception@demo.clinic','billing@demo.clinic','pharmacy@demo.clinic')`);
  });

  const remaining = await one<{ n: number }>(
    `SELECT (SELECT count(*) FROM patients) + (SELECT count(*) FROM doctors) +
            (SELECT count(*) FROM drugs) + (SELECT count(*) FROM invoices) +
            (SELECT count(*) FROM appointments) AS n`,
  );
  console.log(`[demo] removed sample records. Remaining clinical rows: ${remaining?.n ?? 0}`);
}

function minutesAgo(minutes: number): string {
  const d = new Date(Date.now() - minutes * 60_000);
  return d.toISOString();
}

async function main() {
  const isReset = process.argv.includes("--reset");

  if (process.env.NODE_ENV === "production") {
    throw new Error("Refusing to load demo data with NODE_ENV=production.");
  }

  await initDatabase();

  if (isReset) {
    await reset();
    await closeDatabase();
    return;
  }

  const existing = await one<{ n: number }>(`SELECT count(*) AS n FROM patients`);
  if (Number(existing?.n || 0) > 0) {
    throw new Error(
      "This database already has patient records. Demo data is only loaded into an empty database " +
        "so it cannot mix with real data. Start from a fresh database, or run `npm run db:demo -- --reset` first.",
    );
  }

  const zone = (await one<{ timezone: string }>(`SELECT timezone FROM settings WHERE id = 1`))?.timezone || "Africa/Nairobi";
  void zone;

  // ------------------------------------------------------------------ staff
  const clinicians = [
    {
      name: "Dr. Amina Wanjiru",
      specialty: "Internal Medicine",
      qualifications: "MBChB, MMed (Internal Medicine)",
      bio: "Twelve years in internal medicine with a focus on hypertension and diabetes care.",
      years: 12,
      fee: 1500,
      days: [1, 2, 4, 5],
      phone: "DEMO",
      email: "amina@demo.clinic",
    },
    {
      name: "Dr. Brian Kiptoo",
      specialty: "Paediatrics",
      qualifications: "MBChB, MMed (Paediatrics)",
      bio: "Child health, growth monitoring and immunisation.",
      years: 8,
      fee: 1200,
      days: [1, 3, 5],
      phone: "DEMO",
      email: "brian@demo.clinic",
    },
    {
      name: "Dr. Faith Njoki",
      specialty: "Family Medicine",
      qualifications: "MBChB, Dip. Family Medicine",
      bio: "Family medicine with an interest in maternal health.",
      years: 6,
      fee: 1000,
      days: [2, 3, 4],
      phone: "DEMO",
      email: "faith@demo.clinic",
    },
  ];

  const doctorIds: string[] = [];
  for (const c of clinicians) {
    const row = await one<{ id: string }>(
      `INSERT INTO doctors (name, specialty, qualifications, bio, phone, email, experience_years,
                            consultation_fee, status, is_public)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,'active',true) RETURNING id`,
      [c.name, c.specialty, c.qualifications, c.bio, c.phone, c.email, c.years, c.fee],
    );
    doctorIds.push(row!.id);
    for (const day of c.days) {
      await query(
        `INSERT INTO doctor_windows (doctor_id, weekday, start_time, end_time) VALUES ($1,$2,'09:00','16:00')`,
        [row!.id, day],
      );
    }
  }
  console.log(`[demo] ${clinicians.length} clinicians with weekly availability`);

  // --------------------------------------------------------------- patients
  const people = [
    { first: "Grace", last: "Wairimu", gender: "Female", birth: "1965-03-14", phone: "+254712000111", blood: "O+", condition: "Hypertension", allergies: "Penicillin" },
    { first: "Peter", last: "Otieno", gender: "Male", birth: "1978-11-02", phone: "+254722000222", blood: "A+", condition: "Type 2 Diabetes", allergies: "" },
    { first: "Mercy", last: "Chebet", gender: "Female", birth: "1994-06-21", phone: "+254733000333", blood: "B+", condition: "Antenatal care", allergies: "" },
    { first: "Samuel", last: "Mwangi", gender: "Male", birth: "2018-01-09", phone: "+254700000444", blood: "O-", condition: "Asthma", allergies: "Dust" },
    { first: "Halima", last: "Adan", gender: "Female", birth: "2001-09-30", phone: "+254711000555", blood: "AB+", condition: "Migraine", allergies: "" },
    { first: "Joseph", last: "Kimani", gender: "Male", birth: "1957-02-17", phone: "+254720000666", blood: "A-", condition: "Osteoarthritis", allergies: "Sulfa drugs" },
  ];

  const year = new Date().getFullYear();
  const patientIds: string[] = [];
  let seq = 1;
  for (const p of people) {
    const reference = `MC-DEMO-${String(seq++).padStart(5, "0")}`;
    const row = await one<{ id: string }>(
      `INSERT INTO patients (reference, first_name, last_name, gender, birth_date, phone, email,
                             blood_group, primary_condition, allergies, status, assigned_doctor_id, notes)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,'Active',$11,$12) RETURNING id`,
      [
        reference,
        p.first,
        p.last,
        p.gender,
        p.birth,
        p.phone,
        `${p.first.toLowerCase()}@example.com`,
        p.blood,
        p.condition,
        p.allergies,
        doctorIds[seq % doctorIds.length],
        `${TAG} sample patient for local walkthrough`,
      ],
    );
    patientIds.push(row!.id);
  }
  console.log(`[demo] ${patientIds.length} patients (tagged ${TAG})`);

  // ----------------------------------------------------------- appointments
  const today = todayISO();
  const statuses = ["Completed", "Completed", "Confirmed", "Pending", "Cancelled", "Confirmed"];
  let aptSeq = 1;
  for (let i = 0; i < patientIds.length; i += 1) {
    const dayOffset = i < 3 ? 0 : i < 5 ? 1 : -3;
    const date = addDaysISO(today, dayOffset);
    const weekday = new Date(`${date}T00:00:00Z`).getUTCDay();
    const doctorIndex = i % doctorIds.length;
    const doctorDays = clinicians[doctorIndex]!.days;
    const useDate = doctorDays.includes(weekday) ? date : addDaysISO(today, 2 + i);
    const time = ["09:00", "10:00", "11:30", "14:00", "15:30", "09:30"][i]!;
    const reference = `APT-DEMO-${String(aptSeq++).padStart(5, "0")}`;
    const past = dayOffset < 0;

    await query(
      `INSERT INTO appointments (reference, patient_id, doctor_id, slot_at, duration_minutes, type,
                                 status, source, reason, fee)
       VALUES ($1,$2,$3, (($4::date + $5::time) AT TIME ZONE $6), 30, $7, $8, $9, $10, 1500)`,
      [
        reference,
        patientIds[i],
        doctorIds[doctorIndex],
        useDate,
        time,
        zone,
        ["Consultation", "Follow-up", "Check-up", "Consultation", "Consultation", "Follow-up"][i],
        past ? "Completed" : statuses[i],
        i % 3 === 0 ? "public" : "staff",
        ["Blood pressure review", "Sugar levels check", "Antenatal visit", "Inhaler review", "Headache review", "Joint pain"][i],
      ],
    );
  }
  console.log(`[demo] appointments around ${today}`);

  // ---------------------------------------------------------------- billing
  const invoiceData = [
    { patient: 0, items: [["Consultation", 1, 1500], ["Full blood count", 1, 800]], paid: 2300 },
    { patient: 1, items: [["Consultation", 1, 1500], ["HbA1c test", 1, 1200]], paid: 1000 },
    { patient: 2, items: [["Antenatal package", 1, 4000]], paid: 0 },
    { patient: 4, items: [["Consultation", 1, 1000], ["Pain relief", 2, 150]], paid: 0 },
  ];
  let invSeq = 1;
  for (const inv of invoiceData) {
    const reference = `INV-DEMO-${String(invSeq++).padStart(5, "0")}`;
    const subtotal = inv.items.reduce((s, [, qty, price]) => s + (qty as number) * (price as number), 0);
    const vat = Math.round(subtotal * 0.16 * 100) / 100;
    const total = Math.round((subtotal + vat) * 100) / 100;
    const row = await one<{ id: string }>(
      `INSERT INTO invoices (reference, patient_id, subtotal, vat_amount, total, amount_paid, status, issued_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING id`,
      [
        reference,
        patientIds[inv.patient],
        subtotal,
        vat,
        total,
        inv.paid,
        inv.paid >= total ? "Paid" : inv.paid > 0 ? "Partial" : "Unpaid",
        minutesAgo(60 * 24 * 3),
      ],
    );
    for (const [desc, qty, price] of inv.items) {
      await query(
        `INSERT INTO invoice_items (invoice_id, description, quantity, unit_price, subtotal)
         VALUES ($1,$2,$3,$4,$5)`,
        [row!.id, desc, qty, price, (qty as number) * (price as number)],
      );
    }
    if (inv.paid > 0) {
      await query(
        `INSERT INTO payments (invoice_id, amount, method, reference, received_at)
         VALUES ($1,$2,$3,$4,$5)`,
        [row!.id, inv.paid, "M-Pesa", `QK${Math.random().toString(36).slice(2, 8).toUpperCase()}`, minutesAgo(60 * 24 * 2)],
      );
    }
  }
  console.log(`[demo] ${invoiceData.length} invoices (mixed paid/partial/unpaid)`);

  // --------------------------------------------------------------- pharmacy
  const drugs = [
    { name: "Amlodipine 5mg", generic: "Amlodipine", cat: "Antihypertensives", form: "Tablet", strength: "5mg", price: 45, stock: 240, min: 60, exp: "2027-06-30", rx: true },
    { name: "Metformin 500mg", generic: "Metformin HCl", cat: "Antidiabetics", form: "Tablet", strength: "500mg", price: 28, stock: 38, min: 60, exp: "2027-02-28", rx: true },
    { name: "Amoxicillin 250mg", generic: "Amoxicillin", cat: "Antibiotics", form: "Capsule", strength: "250mg", price: 22, stock: 380, min: 100, exp: "2026-12-31", rx: true },
    { name: "Salbutamol Inhaler", generic: "Salbutamol", cat: "Respiratory", form: "Inhaler", strength: "100mcg", price: 420, stock: 12, min: 20, exp: "2027-01-31", rx: true },
    { name: "Paracetamol 500mg", generic: "Acetaminophen", cat: "Analgesics", form: "Tablet", strength: "500mg", price: 12, stock: 950, min: 200, exp: "2028-03-31", rx: false },
    { name: "Vitamin C 1000mg", generic: "Ascorbic Acid", cat: "Vitamins", form: "Tablet", strength: "1000mg", price: 18, stock: 8, min: 100, exp: "2026-12-15", rx: false },
  ];
  const drugIds: string[] = [];
  for (const d of drugs) {
    const row = await one<{ id: string }>(
      `INSERT INTO drugs (name, generic_name, category, form, strength, price, stock, min_stock,
                          supplier, expiry_date, prescription_required)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,'Demo Supplier',$9,$10) RETURNING id`,
      [d.name, d.generic, d.cat, d.form, d.strength, d.price, d.stock, d.min, d.exp, d.rx],
    );
    drugIds.push(row!.id);
  }
  console.log(`[demo] ${drugs.length} pharmacy products`);

  // A couple of sales so the sales screen is not empty
  for (let i = 0; i < 3; i += 1) {
    const reference = `SAL-DEMO-${String(i + 1).padStart(5, "0")}`;
    const qty = i + 1;
    const price = 45;
    const subtotal = qty * price;
    const vat = Math.round(subtotal * 0.16 * 100) / 100;
    const total = Math.round((subtotal + vat) * 100) / 100;
    const sale = await one<{ id: string }>(
      `INSERT INTO sales (reference, customer_name, subtotal, discount, vat_amount, total,
                          payment_method, sold_at)
       VALUES ($1,$2,$3,0,$4,$5,$6,$7) RETURNING id`,
      [reference, i === 0 ? "Walk-in" : `${people[i]!.first} ${people[i]!.last}`, subtotal, vat, total, ["M-Pesa", "Cash", "Card"][i], minutesAgo(60 * (6 + i))],
    );
    await query(
      `INSERT INTO sale_items (sale_id, drug_id, drug_name, quantity, unit_price, subtotal)
       VALUES ($1,$2,$3,$4,$5,$6)`,
      [sale!.id, drugIds[0], drugs[0]!.name, qty, price, subtotal],
    );
  }

  // A pending prescription to dispense
  const rx = await one<{ id: string }>(
    `INSERT INTO prescriptions (reference, patient_id, doctor_id, notes, status)
     VALUES ($1,$2,$3,$4,'Pending') RETURNING id`,
    [`RX-DEMO-00001`, patientIds[0], doctorIds[0], "Review in two weeks"],
  );
  await query(
    `INSERT INTO prescription_items (prescription_id, drug_id, quantity, dosage)
     VALUES ($1,$2,$3,$4)`,
    [rx!.id, drugIds[0], 30, "1 tablet daily"],
  );
  await query(
    `INSERT INTO prescription_items (prescription_id, drug_id, quantity, dosage)
     VALUES ($1,$2,$3,$4)`,
    [rx!.id, drugIds[2], 21, "1 capsule three times a day"],
  );
  console.log("[demo] sales and a pending prescription");

  // -------------------------------------------------------------- staff logins
  const staff = [
    { name: "Reception Desk", email: "reception@demo.clinic", role: "receptionist" },
    { name: "Billing Clerk", email: "billing@demo.clinic", role: "billing" },
    { name: "Pharmacy Desk", email: "pharmacy@demo.clinic", role: "pharmacist" },
  ];
  const bcrypt = (await import("bcryptjs")).default;
  const hash = await bcrypt.hash("DemoStaff2026", 12);
  for (const s of staff) {
    const role = await one<{ id: string }>(`SELECT id FROM roles WHERE name = $1`, [s.role]);
    await query(
      `INSERT INTO users (name, email, password_hash, role_id)
       VALUES ($1,$2,$3,$4) ON CONFLICT (email) DO NOTHING`,
      [s.name, s.email, hash, role!.id],
    );
  }
  console.log("[demo] 3 extra staff accounts (password: DemoStaff2026)");

  console.log(`\n[demo] done. ${year} sample data loaded.`);
  console.log("       Remove it any time with: npm run db:demo -- --reset");

  await closeDatabase();
}

main().catch(async (err) => {
  console.error("[demo] failed:", err.message);
  await closeDatabase().catch(() => undefined);
  process.exit(1);
});
