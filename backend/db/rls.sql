-- ===========================================================================
-- MedCore HMS - Row Level Security for Supabase
-- ---------------------------------------------------------------------------
-- RUN THIS ONLY IF you plan to reach the database directly from the browser
-- (Supabase JS client). If all traffic goes through this API (the default and
-- recommended setup) it is still worth running: it blocks anon-key access to
-- patient records if the anon key ever leaks.
--
-- The API connects as a database superuser/owner, which bypasses RLS, so this
-- file does not change API behaviour.
--
--   psql "$DATABASE_URL" -f db/rls.sql
--   (or paste into the Supabase SQL editor)
-- ===========================================================================

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'roles', 'users', 'refresh_tokens', 'settings', 'services', 'doctors',
    'doctor_windows', 'patients', 'appointments', 'invoices', 'invoice_items',
    'payments', 'drugs', 'prescriptions', 'prescription_items', 'sales',
    'sale_items', 'audit_log'
  ] LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
  END LOOP;
END;
$$;

-- Public (anon) visitors may read the marketing catalogue only.
DROP POLICY IF EXISTS anon_read_services ON services;
CREATE POLICY anon_read_services ON services FOR SELECT USING (is_active);

DROP POLICY IF EXISTS anon_read_doctors ON doctors;
CREATE POLICY anon_read_doctors ON doctors FOR SELECT USING (is_public AND status = 'active');

DROP POLICY IF EXISTS anon_read_settings ON settings;
CREATE POLICY anon_read_settings ON settings FOR SELECT USING (true);

DROP POLICY IF EXISTS anon_read_windows ON doctor_windows;
CREATE POLICY anon_read_windows ON doctor_windows FOR SELECT USING (true);

-- A logged-in patient may read their own record and bookings.
DROP POLICY IF EXISTS patient_self ON patients;
CREATE POLICY patient_self ON patients FOR SELECT USING (
  user_id = current_setting('request.jwt.claims', true)::jsonb ->> 'sub'
);

DROP POLICY IF EXISTS patient_own_appointments ON appointments;
CREATE POLICY patient_own_appointments ON appointments FOR SELECT USING (
  patient_id IN (
    SELECT id FROM patients
    WHERE user_id = current_setting('request.jwt.claims', true)::jsonb ->> 'sub'
  )
);

-- Everything else (users, invoices, payments, prescriptions, audit log) is
-- service-role only: no policy is created, so anon/authenticated keys get
-- nothing back. The API is the only path to that data.
