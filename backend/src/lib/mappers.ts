import { num } from "../lib/helpers";
import { fromInstant } from "../lib/time";

/** Row -> API shape mappers. Keeps SQL out of the frontend. */

type Row = Record<string, any>;

export const mapSettings = (r: Row) => ({
  id: r.id,
  clinicName: r.clinic_name,
  tagline: r.tagline,
  about: r.about,
  location: r.location,
  address: r.address,
  phone: r.phone,
  emergencyPhone: r.emergency_phone,
  email: r.email,
  currency: r.currency,
  vatRate: num(r.vat_rate),
  defaultSlotMinutes: r.default_slot_minutes,
  timezone: r.timezone,
  mpesaPaybill: r.mpesa_paybill,
  openingHours: r.opening_hours ?? {},
  bookingLeadDays: r.booking_lead_days,
  updatedAt: r.updated_at,
});

export const mapService = (r: Row) => ({
  id: r.id,
  slug: r.slug,
  name: r.name,
  summary: r.summary,
  description: r.description,
  category: r.category,
  price: num(r.price),
  durationMinutes: r.duration_minutes,
  icon: r.icon,
  isActive: r.is_active,
  sortOrder: r.sort_order,
});

export const mapDoctor = (r: Row) => ({
  id: r.id,
  userId: r.user_id,
  name: r.name,
  specialty: r.specialty,
  qualifications: r.qualifications,
  bio: r.bio,
  phone: r.phone,
  email: r.email,
  experienceYears: r.experience_years,
  consultationFee: num(r.consultation_fee),
  status: r.status,
  isPublic: r.is_public,
  color: r.color,
  patientCount: r.patient_count === undefined ? undefined : num(r.patient_count),
  windows: r.windows ?? undefined,
});

export const mapPatient = (r: Row) => ({
  id: r.id,
  reference: r.reference,
  userId: r.user_id,
  firstName: r.first_name,
  lastName: r.last_name,
  name: `${r.first_name} ${r.last_name}`.trim(),
  gender: r.gender,
  birthDate: r.birth_date ? String(r.birth_date).slice(0, 10) : null,
  age: r.age === undefined ? null : r.age,
  phone: r.phone,
  email: r.email,
  bloodGroup: r.blood_group,
  primaryCondition: r.primary_condition,
  allergies: r.allergies,
  address: r.address,
  notes: r.notes,
  status: r.status,
  assignedDoctorId: r.assigned_doctor_id,
  assignedDoctorName: r.assigned_doctor_name ?? null,
  lastVisitAt: r.last_visit_at,
  createdAt: r.created_at,
  // aggregates when joined
  appointmentCount: r.appointment_count === undefined ? undefined : num(r.appointment_count),
  outstandingBalance: r.outstanding_balance === undefined ? undefined : num(r.outstanding_balance),
});

const slotInfo = (slotAt: unknown) => {
  if (!slotAt) return { date: null as string | null, time: null as string | null };
  const d = new Date(slotAt as string);
  const local = fromInstant(d);
  return { date: local.date, time: local.time };
};

export const mapAppointment = (r: Row) => ({
  id: r.id,
  reference: r.reference,
  patientId: r.patient_id,
  patientName: r.patient_name ?? `${r.first_name ?? ""} ${r.last_name ?? ""}`.trim(),
  patientReference: r.patient_reference ?? null,
  patientPhone: r.patient_phone ?? null,
  doctorId: r.doctor_id,
  doctorName: r.doctor_name ?? null,
  doctorSpecialty: r.doctor_specialty ?? null,
  serviceId: r.service_id,
  serviceName: r.service_name ?? null,
  slotAt: r.slot_at,
  ...slotInfo(r.slot_at),
  durationMinutes: r.duration_minutes,
  type: r.type,
  status: r.status,
  source: r.source,
  reason: r.reason,
  notes: r.notes,
  fee: num(r.fee),
  contactPhone: r.contact_phone,
  cancelledReason: r.cancelled_reason,
  createdAt: r.created_at,
});

export const mapInvoice = (r: Row) => ({
  id: r.id,
  reference: r.reference,
  patientId: r.patient_id,
  patientName: r.patient_name ?? null,
  patientReference: r.patient_reference ?? null,
  appointmentId: r.appointment_id,
  status: r.status,
  subtotal: num(r.subtotal),
  vatAmount: num(r.vat_amount),
  total: num(r.total),
  amountPaid: num(r.amount_paid),
  balance: num(r.total) - num(r.amount_paid),
  notes: r.notes,
  issuedAt: r.issued_at,
  dueAt: r.due_at,
  createdAt: r.created_at,
  items: Array.isArray(r.items)
    ? r.items.map((i: Row) => ({
        id: i.id,
        description: i.description,
        quantity: num(i.quantity),
        unitPrice: num(i.unit_price),
        subtotal: num(i.subtotal),
      }))
    : undefined,
  payments: Array.isArray(r.payments)
    ? r.payments.map((p: Row) => ({
        id: p.id,
        amount: num(p.amount),
        method: p.method,
        reference: p.reference,
        receivedAt: p.received_at,
        receivedByName: p.received_by_name ?? null,
      }))
    : undefined,
});

export const mapDrug = (r: Row) => ({
  id: r.id,
  name: r.name,
  genericName: r.generic_name,
  category: r.category,
  form: r.form,
  strength: r.strength,
  price: num(r.price),
  stock: r.stock,
  minStock: r.min_stock,
  supplier: r.supplier,
  expiryDate: r.expiry_date ? String(r.expiry_date).slice(0, 10) : null,
  prescriptionRequired: r.prescription_required,
  barcode: r.barcode,
  isActive: r.is_active,
  lowStock: r.stock <= r.min_stock,
});

export const mapPrescription = (r: Row) => ({
  id: r.id,
  reference: r.reference,
  patientId: r.patient_id,
  patientName: r.patient_name ?? null,
  doctorId: r.doctor_id,
  doctorName: r.doctor_name ?? null,
  notes: r.notes,
  status: r.status,
  issuedAt: r.issued_at,
  dispensedAt: r.dispensed_at,
  items: Array.isArray(r.items) ? r.items : [],
});

export const mapSale = (r: Row) => ({
  id: r.id,
  reference: r.reference,
  patientId: r.patient_id,
  customerName: r.customer_name,
  subtotal: num(r.subtotal),
  discount: num(r.discount),
  vatAmount: num(r.vat_amount),
  total: num(r.total),
  paymentMethod: r.payment_method,
  prescriptionRequired: r.prescription_required,
  soldAt: r.sold_at,
  soldByName: r.sold_by_name ?? null,
  items: Array.isArray(r.items) ? r.items : undefined,
});

export const mapUser = (r: Row) => ({
  id: r.id,
  name: r.name,
  email: r.email,
  phone: r.phone,
  role: r.role,
  roleId: r.role_id,
  status: r.status,
  mustChangePassword: r.must_change_password,
  lastLoginAt: r.last_login_at,
  createdAt: r.created_at,
});
