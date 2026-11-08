-- ===========================================================================
-- MedCore HMS - PostgreSQL schema
-- ---------------------------------------------------------------------------
-- This file is the single source of truth for the database. It is plain,
-- standard PostgreSQL so the *same* tables exist whether you host them on
-- Supabase, Neon, RDS or a server you run yourself.
--
--   npm run db:migrate        # applies this file (idempotent)
--   npm run db:seed           # creates the first admin + clinic services
--
-- Everything the app shows on screen comes from these tables - there is no
-- demo/mock data anywhere in the application code.
-- ===========================================================================

-- NOTE: gen_random_uuid() is part of PostgreSQL 13+ core, so no extension is
-- required. If you are on PostgreSQL 12 or older, run:
--   CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION set_updated_at() RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ---------------------------------------------------------------------------
-- Roles & users
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS roles (
  id          text PRIMARY KEY,
  name        text NOT NULL UNIQUE,
  description text NOT NULL DEFAULT '',
  permissions text[] NOT NULL DEFAULT '{}',
  is_system   boolean NOT NULL DEFAULT false,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS users (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email          text NOT NULL UNIQUE,
  password_hash  text NOT NULL,
  name           text NOT NULL,
  phone          text,
  role_id        text NOT NULL REFERENCES roles(id) ON DELETE RESTRICT,
  status         text NOT NULL DEFAULT 'active'
                 CHECK (status IN ('active', 'suspended')),
  must_change_password boolean NOT NULL DEFAULT false,
  last_login_at  timestamptz,
  token_version  integer NOT NULL DEFAULT 0,
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS users_role_idx ON users (role_id);

-- Server-side sessions. Lets an admin revoke access instantly.
CREATE TABLE IF NOT EXISTS refresh_tokens (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash  text NOT NULL UNIQUE,
  user_agent  text,
  ip          text,
  expires_at  timestamptz NOT NULL,
  revoked_at  timestamptz,
  -- Set when a token is rotated. The token that replaced it, so a client that
  -- replays the old cookie (a second browser tab refreshing at the same moment)
  -- can be handed the same successor instead of being treated as an attacker.
  replaced_by uuid REFERENCES refresh_tokens(id) ON DELETE SET NULL,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS refresh_tokens_user_idx ON refresh_tokens (user_id);

-- ---------------------------------------------------------------------------
-- Facility settings (single row)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS settings (
  id                  integer PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  clinic_name         text NOT NULL DEFAULT 'Your Clinic',
  tagline             text NOT NULL DEFAULT 'Compassionate care, close to home',
  about               text NOT NULL DEFAULT '',
  location            text NOT NULL DEFAULT '',
  address             text NOT NULL DEFAULT '',
  phone               text NOT NULL DEFAULT '',
  emergency_phone     text NOT NULL DEFAULT '',
  email               text NOT NULL DEFAULT '',
  currency            text NOT NULL DEFAULT 'KES',
  vat_rate            numeric(5, 4) NOT NULL DEFAULT 0.16,
  default_slot_minutes integer NOT NULL DEFAULT 30 CHECK (default_slot_minutes BETWEEN 5 AND 240),
  timezone            text NOT NULL DEFAULT 'Africa/Nairobi',
  mpesa_paybill       text NOT NULL DEFAULT '',
  opening_hours       jsonb NOT NULL DEFAULT '{}'::jsonb,
  booking_lead_days   integer NOT NULL DEFAULT 30,
  updated_at          timestamptz NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------------------
-- Public service catalogue (what the marketing site advertises)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS services (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug             text NOT NULL UNIQUE,
  name             text NOT NULL,
  summary          text NOT NULL DEFAULT '',
  description      text NOT NULL DEFAULT '',
  category         text NOT NULL DEFAULT 'General',
  price            numeric(12, 2) NOT NULL DEFAULT 0,
  duration_minutes integer NOT NULL DEFAULT 30 CHECK (duration_minutes BETWEEN 5 AND 480),
  icon             text NOT NULL DEFAULT '🩺',
  is_active        boolean NOT NULL DEFAULT true,
  sort_order       integer NOT NULL DEFAULT 0,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------------------
-- Clinical staff
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS doctors (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           uuid UNIQUE REFERENCES users(id) ON DELETE SET NULL,
  name              text NOT NULL,
  specialty         text NOT NULL,
  qualifications    text NOT NULL DEFAULT '',
  bio               text NOT NULL DEFAULT '',
  phone             text NOT NULL DEFAULT '',
  email             text NOT NULL DEFAULT '',
  experience_years  integer NOT NULL DEFAULT 0 CHECK (experience_years >= 0),
  consultation_fee  numeric(12, 2) NOT NULL DEFAULT 0,
  status            text NOT NULL DEFAULT 'active'
                    CHECK (status IN ('active', 'inactive')),
  is_public         boolean NOT NULL DEFAULT true,
  color             text NOT NULL DEFAULT '#185FA5',
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now()
);

-- Recurring weekly availability, in the clinic timezone.
-- weekday: 0 = Sunday ... 6 = Saturday (matches JavaScript getDay()).
CREATE TABLE IF NOT EXISTS doctor_windows (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  doctor_id   uuid NOT NULL REFERENCES doctors(id) ON DELETE CASCADE,
  weekday     smallint NOT NULL CHECK (weekday BETWEEN 0 AND 6),
  start_time  time NOT NULL,
  end_time    time NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now(),
  CHECK (end_time > start_time)
);

CREATE INDEX IF NOT EXISTS doctor_windows_doctor_idx ON doctor_windows (doctor_id, weekday);

-- ---------------------------------------------------------------------------
-- Patients
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS patients (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id            uuid UNIQUE REFERENCES users(id) ON DELETE SET NULL,
  reference          text NOT NULL UNIQUE,
  first_name         text NOT NULL,
  last_name          text NOT NULL,
  gender             text NOT NULL CHECK (gender IN ('Male', 'Female', 'Other')),
  birth_date         date,
  phone              text NOT NULL,
  email              text,
  blood_group        text NOT NULL DEFAULT 'Unknown',
  primary_condition  text NOT NULL DEFAULT '',
  allergies          text NOT NULL DEFAULT '',
  address            text NOT NULL DEFAULT '',
  notes              text NOT NULL DEFAULT '',
  status             text NOT NULL DEFAULT 'Active'
                     CHECK (status IN ('Active', 'Inactive')),
  assigned_doctor_id uuid REFERENCES doctors(id) ON DELETE SET NULL,
  last_visit_at      timestamptz,
  created_at         timestamptz NOT NULL DEFAULT now(),
  updated_at         timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS patients_name_idx ON patients (lower(last_name), lower(first_name));
CREATE INDEX IF NOT EXISTS patients_phone_idx ON patients (phone);
CREATE INDEX IF NOT EXISTS patients_doctor_idx ON patients (assigned_doctor_id);

-- ---------------------------------------------------------------------------
-- Appointments
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS appointments (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reference        text NOT NULL UNIQUE,
  patient_id       uuid NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  doctor_id        uuid NOT NULL REFERENCES doctors(id) ON DELETE RESTRICT,
  service_id       uuid REFERENCES services(id) ON DELETE SET NULL,
  slot_at          timestamptz NOT NULL,
  duration_minutes integer NOT NULL DEFAULT 30,
  type             text NOT NULL DEFAULT 'Consultation',
  status           text NOT NULL DEFAULT 'Pending'
                   CHECK (status IN ('Pending', 'Confirmed', 'Completed', 'Cancelled', 'NoShow')),
  source           text NOT NULL DEFAULT 'staff'
                   CHECK (source IN ('staff', 'public')),
  reason           text NOT NULL DEFAULT '',
  notes            text NOT NULL DEFAULT '',
  fee              numeric(12, 2) NOT NULL DEFAULT 0,
  -- public bookings keep the visitor's phone for confirmation calls
  contact_phone    text,
  cancelled_reason text,
  created_by       uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now()
);

-- One active booking per doctor per slot, and per patient per slot.
CREATE UNIQUE INDEX IF NOT EXISTS appointments_doctor_slot_uidx
  ON appointments (doctor_id, slot_at) WHERE status <> 'Cancelled';
CREATE UNIQUE INDEX IF NOT EXISTS appointments_patient_slot_uidx
  ON appointments (patient_id, slot_at) WHERE status <> 'Cancelled';

CREATE INDEX IF NOT EXISTS appointments_slot_idx ON appointments (slot_at);
CREATE INDEX IF NOT EXISTS appointments_patient_idx ON appointments (patient_id);
CREATE INDEX IF NOT EXISTS appointments_status_idx ON appointments (status);

-- ---------------------------------------------------------------------------
-- Billing
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS invoices (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reference      text NOT NULL UNIQUE,
  patient_id     uuid NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  appointment_id uuid REFERENCES appointments(id) ON DELETE SET NULL,
  status         text NOT NULL DEFAULT 'Unpaid'
                 CHECK (status IN ('Unpaid', 'Partial', 'Paid', 'Void')),
  subtotal       numeric(12, 2) NOT NULL DEFAULT 0,
  vat_amount     numeric(12, 2) NOT NULL DEFAULT 0,
  total          numeric(12, 2) NOT NULL DEFAULT 0,
  amount_paid    numeric(12, 2) NOT NULL DEFAULT 0,
  notes          text NOT NULL DEFAULT '',
  issued_at      timestamptz NOT NULL DEFAULT now(),
  due_at         timestamptz,
  created_by     uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now(),
  CHECK (amount_paid >= 0),
  CHECK (total >= 0)
);

CREATE INDEX IF NOT EXISTS invoices_patient_idx ON invoices (patient_id);
CREATE INDEX IF NOT EXISTS invoices_status_idx ON invoices (status);

CREATE TABLE IF NOT EXISTS invoice_items (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id  uuid NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
  description text NOT NULL,
  quantity    numeric(10, 2) NOT NULL DEFAULT 1 CHECK (quantity > 0),
  unit_price  numeric(12, 2) NOT NULL DEFAULT 0 CHECK (unit_price >= 0),
  subtotal    numeric(12, 2) NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS invoice_items_invoice_idx ON invoice_items (invoice_id);

CREATE TABLE IF NOT EXISTS payments (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id     uuid NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
  amount         numeric(12, 2) NOT NULL CHECK (amount > 0),
  method         text NOT NULL CHECK (method IN ('M-Pesa', 'Card', 'Cash', 'Insurance', 'Bank')),
  reference      text NOT NULL DEFAULT '',
  received_by    uuid REFERENCES users(id) ON DELETE SET NULL,
  received_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS payments_invoice_idx ON payments (invoice_id);

-- ---------------------------------------------------------------------------
-- Pharmacy
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS drugs (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name                  text NOT NULL,
  generic_name          text NOT NULL DEFAULT '',
  category              text NOT NULL DEFAULT 'General',
  form                  text NOT NULL DEFAULT 'Tablet',
  strength              text NOT NULL DEFAULT '',
  price                 numeric(12, 2) NOT NULL DEFAULT 0 CHECK (price >= 0),
  stock                 integer NOT NULL DEFAULT 0 CHECK (stock >= 0),
  min_stock             integer NOT NULL DEFAULT 0 CHECK (min_stock >= 0),
  supplier              text NOT NULL DEFAULT '',
  expiry_date           date,
  prescription_required boolean NOT NULL DEFAULT false,
  barcode               text UNIQUE,
  is_active             boolean NOT NULL DEFAULT true,
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS drugs_name_idx ON drugs (lower(name));
CREATE INDEX IF NOT EXISTS drugs_low_stock_idx ON drugs (stock, min_stock);

CREATE TABLE IF NOT EXISTS prescriptions (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reference   text NOT NULL UNIQUE,
  patient_id  uuid NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  doctor_id   uuid NOT NULL REFERENCES doctors(id) ON DELETE RESTRICT,
  notes       text NOT NULL DEFAULT '',
  status      text NOT NULL DEFAULT 'Pending'
              CHECK (status IN ('Pending', 'Dispensed', 'Cancelled')),
  issued_at   timestamptz NOT NULL DEFAULT now(),
  dispensed_at timestamptz,
  dispensed_by uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS prescriptions_patient_idx ON prescriptions (patient_id);
CREATE INDEX IF NOT EXISTS prescriptions_status_idx ON prescriptions (status);

CREATE TABLE IF NOT EXISTS prescription_items (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  prescription_id uuid NOT NULL REFERENCES prescriptions(id) ON DELETE CASCADE,
  drug_id         uuid NOT NULL REFERENCES drugs(id) ON DELETE RESTRICT,
  quantity        integer NOT NULL CHECK (quantity > 0),
  dosage          text NOT NULL DEFAULT ''
);

CREATE INDEX IF NOT EXISTS prescription_items_rx_idx ON prescription_items (prescription_id);

CREATE TABLE IF NOT EXISTS sales (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reference      text NOT NULL UNIQUE,
  patient_id     uuid REFERENCES patients(id) ON DELETE SET NULL,
  customer_name  text NOT NULL DEFAULT 'Walk-in',
  subtotal       numeric(12, 2) NOT NULL DEFAULT 0,
  discount       numeric(12, 2) NOT NULL DEFAULT 0,
  vat_amount     numeric(12, 2) NOT NULL DEFAULT 0,
  total          numeric(12, 2) NOT NULL DEFAULT 0,
  payment_method text NOT NULL CHECK (payment_method IN ('M-Pesa', 'Card', 'Cash', 'Insurance', 'Bank')),
  prescription_required boolean NOT NULL DEFAULT false,
  sold_by        uuid REFERENCES users(id) ON DELETE SET NULL,
  sold_at        timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS sales_sold_at_idx ON sales (sold_at);

CREATE TABLE IF NOT EXISTS sale_items (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sale_id    uuid NOT NULL REFERENCES sales(id) ON DELETE CASCADE,
  drug_id    uuid NOT NULL REFERENCES drugs(id) ON DELETE RESTRICT,
  drug_name  text NOT NULL,
  quantity   integer NOT NULL CHECK (quantity > 0),
  unit_price numeric(12, 2) NOT NULL,
  subtotal   numeric(12, 2) NOT NULL
);

CREATE INDEX IF NOT EXISTS sale_items_sale_idx ON sale_items (sale_id);

-- ---------------------------------------------------------------------------
-- Audit trail (who changed what, when) - essential for a medical system
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS audit_log (
  id          bigserial PRIMARY KEY,
  user_id     uuid REFERENCES users(id) ON DELETE SET NULL,
  action      text NOT NULL,
  entity      text NOT NULL,
  entity_id   text,
  detail      jsonb NOT NULL DEFAULT '{}'::jsonb,
  ip          text,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS audit_log_created_idx ON audit_log (created_at DESC);
CREATE INDEX IF NOT EXISTS audit_log_entity_idx ON audit_log (entity, entity_id);

-- ---------------------------------------------------------------------------
-- updated_at triggers
-- ---------------------------------------------------------------------------
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'roles', 'users', 'services', 'doctors', 'patients', 'appointments',
    'invoices', 'drugs', 'prescriptions'
  ] LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS %I_updated_at ON %I', t, t);
    EXECUTE format(
      'CREATE TRIGGER %I_updated_at BEFORE UPDATE ON %I
         FOR EACH ROW EXECUTE FUNCTION set_updated_at()', t, t);
  END LOOP;
END;
$$;
