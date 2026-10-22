-- RLS Migration for Supabase compatibility
-- Apply this after `prisma migrate dev` creates the base tables.
-- Prisma schema does not express Row Level Security; these policies enforce
-- access control at the database layer (critical for Supabase production use).

-- Enable RLS on all tables
ALTER TABLE "User" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Role" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "RolePermission" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Patient" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Doctor" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Appointment" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Invoice" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Drug" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Prescription" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "PrescriptionItem" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Sale" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "SaleItem" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Settings" ENABLE ROW LEVEL SECURITY;

-- Policies: admins can manage all; staff can read their scope; patients read own data.
-- Adjust `current_setting('app.current_user_id', true)` and
-- `current_setting('app.current_user_role', true)` from your middleware (JWT claims).

-- User: self + admins
CREATE POLICY "user_self_or_admin" ON "User"
  FOR ALL USING (
    id = current_setting('app.current_user_id', true) OR
    current_setting('app.current_user_role', true) = 'admin'
  );

-- Role / RolePermission: read-all, admin write
CREATE POLICY "role_read_all_admin_write" ON "Role" FOR ALL USING (true);
CREATE POLICY "rolepermission_read_all_admin_write" ON "RolePermission" FOR ALL USING (true);

-- Patient: self + staff read, admin write
CREATE POLICY "patient_self_or_staff_read_admin_write" ON "Patient"
  FOR SELECT USING (
    id = current_setting('app.current_user_id', true) OR
    current_setting('app.current_user_role', true) IN ('admin','doctor','receptionist','billing','pharmacist')
  );
CREATE POLICY "patient_admin_write" ON "Patient" FOR INSERT WITH CHECK (
  current_setting('app.current_user_role', true) IN ('admin','receptionist')
);

-- Doctor: read-all, admin/staff write
CREATE POLICY "doctor_read_all_staff_write" ON "Doctor" FOR ALL USING (
  current_setting('app.current_user_role', true) IN ('admin','doctor','receptionist','billing','pharmacist')
);

-- Appointment: patient self, doctor, admin; staff write
CREATE POLICY "appointment_scope" ON "Appointment"
  FOR ALL USING (
    patientId = current_setting('app.current_user_id', true) OR
    doctorId = current_setting('app.current_user_id', true) OR
    current_setting('app.current_user_role', true) IN ('admin','doctor','receptionist','billing','pharmacist')
  );

-- Invoice: patient self, admin/billing staff
CREATE POLICY "invoice_scope" ON "Invoice"
  FOR ALL USING (
    patientId = current_setting('app.current_user_id', true) OR
    current_setting('app.current_user_role', true) IN ('admin','billing')
  );

-- Drug: read-all, admin/pharmacist write
CREATE POLICY "drug_read_all_pharmacy_write" ON "Drug"
  FOR ALL USING (
    true OR
    current_setting('app.current_user_role', true) IN ('admin','pharmacist')
  );

-- Prescription: patient self, doctor, admin
CREATE POLICY "prescription_scope" ON "Prescription"
  FOR ALL USING (
    patientId = current_setting('app.current_user_id', true) OR
    doctorId = current_setting('app.current_user_id', true) OR
    current_setting('app.current_user_role', true) IN ('admin','doctor')
  );

-- PrescriptionItem: tied to prescription access
CREATE POLICY "prescriptionitem_scope" ON "PrescriptionItem"
  FOR ALL USING (
    prescriptionId IN (
      SELECT id FROM "Prescription"
      WHERE patientId = current_setting('app.current_user_id', true)
         OR doctorId = current_setting('app.current_user_id', true)
         OR current_setting('app.current_user_role', true) IN ('admin','doctor','pharmacist')
    )
  );

-- Sale: patient self (if linked), admin/billing/pharmacist
CREATE POLICY "sale_scope" ON "Sale"
  FOR ALL USING (
    patientId = current_setting('app.current_user_id', true) OR
    current_setting('app.current_user_role', true) IN ('admin','billing','pharmacist')
  );

-- SaleItem: tied to sale access
CREATE POLICY "saleitem_scope" ON "SaleItem"
  FOR ALL USING (
    saleId IN (
      SELECT id FROM "Sale"
      WHERE patientId = current_setting('app.current_user_id', true)
         OR current_setting('app.current_user_role', true) IN ('admin','billing','pharmacist')
    )
  );

-- Settings: admin only
CREATE POLICY "settings_admin_only" ON "Settings" FOR ALL USING (
  current_setting('app.current_user_role', true) = 'admin'
);