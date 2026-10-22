import { useState, useEffect, useCallback, type FormEvent } from "react";

const ROLES = { ADMIN: "admin", DOCTOR: "doctor", RECEPTIONIST: "receptionist", BILLING: "billing", PHARMACIST: "pharmacist" };

const PERMISSIONS = {
  [ROLES.ADMIN]: ["patients", "appointments", "doctors", "billing", "analytics", "settings", "pharmacy"],
  [ROLES.DOCTOR]: ["patients", "appointments", "analytics", "pharmacy"],
  [ROLES.RECEPTIONIST]: ["patients", "appointments"],
  [ROLES.BILLING]: ["billing", "patients"],
  [ROLES.PHARMACIST]: ["pharmacy", "patients"],
};

const DRUG_CATEGORIES = ["Analgesics", "Antibiotics", "Antihypertensives", "Antidiabetics", "Respiratory", "Cardiac", "Vitamins", "Antihistamines"];

const SAMPLE_DRUGS = [
  { id: "RX001", name: "Amlodipine 5mg", generic: "Amlodipine Besylate", category: "Antihypertensives", form: "Tablet", strength: "5mg", price: 45, stock: 240, minStock: 50, supplier: "Cosmos Pharma", expiry: "2026-03", prescription: true, barcode: "5901234123457" },
  { id: "RX002", name: "Metformin 500mg", generic: "Metformin HCl", category: "Antidiabetics", form: "Tablet", strength: "500mg", price: 28, stock: 18, minStock: 60, supplier: "Beta Healthcare", expiry: "2025-11", prescription: true, barcode: "5901234123458" },
  { id: "RX003", name: "Amoxicillin 250mg", generic: "Amoxicillin Trihydrate", category: "Antibiotics", form: "Capsule", strength: "250mg", price: 22, stock: 380, minStock: 100, supplier: "Dawa Ltd", expiry: "2026-06", prescription: true, barcode: "5901234123459" },
  { id: "RX004", name: "Salbutamol Inhaler", generic: "Salbutamol Sulfate", category: "Respiratory", form: "Inhaler", strength: "100mcg", price: 420, stock: 64, minStock: 20, supplier: "GlaxoSmithKline", expiry: "2025-09", prescription: true, barcode: "5901234123460" },
  { id: "RX005", name: "Paracetamol 500mg", generic: "Acetaminophen", category: "Analgesics", form: "Tablet", strength: "500mg", price: 12, stock: 950, minStock: 200, supplier: "Dawa Ltd", expiry: "2026-12", prescription: false, barcode: "5901234123461" },
  { id: "RX006", name: "Atorvastatin 20mg", generic: "Atorvastatin Calcium", category: "Cardiac", form: "Tablet", strength: "20mg", price: 85, stock: 130, minStock: 40, supplier: "Pfizer Kenya", expiry: "2026-04", prescription: true, barcode: "5901234123462" },
  { id: "RX007", name: "Loratadine 10mg", generic: "Loratadine", category: "Antihistamines", form: "Tablet", strength: "10mg", price: 35, stock: 210, minStock: 60, supplier: "Cosmos Pharma", expiry: "2026-08", prescription: false, barcode: "5901234123463" },
  { id: "RX008", name: "Vitamin C 1000mg", generic: "Ascorbic Acid", category: "Vitamins", form: "Tablet", strength: "1000mg", price: 18, stock: 8, minStock: 100, supplier: "Beta Healthcare", expiry: "2025-07", prescription: false, barcode: "5901234123464" },
  { id: "RX009", name: "Omeprazole 20mg", generic: "Omeprazole", category: "Analgesics", form: "Capsule", strength: "20mg", price: 55, stock: 175, minStock: 50, supplier: "Dawa Ltd", expiry: "2026-02", prescription: false, barcode: "5901234123465" },
  { id: "RX010", name: "Lisinopril 10mg", generic: "Lisinopril", category: "Antihypertensives", form: "Tablet", strength: "10mg", price: 62, stock: 90, minStock: 40, supplier: "Pfizer Kenya", expiry: "2026-05", prescription: true, barcode: "5901234123466" },
  { id: "RX011", name: "Glibenclamide 5mg", generic: "Glibenclamide", category: "Antidiabetics", form: "Tablet", strength: "5mg", price: 32, stock: 155, minStock: 50, supplier: "Beta Healthcare", expiry: "2026-03", prescription: true, barcode: "5901234123467" },
  { id: "RX012", name: "Ibuprofen 400mg", generic: "Ibuprofen", category: "Analgesics", form: "Tablet", strength: "400mg", price: 15, stock: 620, minStock: 150, supplier: "Cosmos Pharma", expiry: "2026-10", prescription: false, barcode: "5901234123468" },
];

const SAMPLE_PRESCRIPTIONS = [
  { id: "PR001", patient: "Amara Okonkwo", doctor: "Dr. Kiprotich", date: "2024-12-18", status: "Pending", drugs: [{ drugId: "RX001", qty: 30 }, { drugId: "RX006", qty: 30 }] },
  { id: "PR002", patient: "James Mwangi", doctor: "Dr. Njeri", date: "2024-12-18", status: "Pending", drugs: [{ drugId: "RX002", qty: 60 }, { drugId: "RX011", qty: 30 }] },
  { id: "PR003", patient: "David Otieno", doctor: "Dr. Achieng", date: "2024-12-17", status: "Dispensed", drugs: [{ drugId: "RX001", qty: 30 }, { drugId: "RX010", qty: 30 }] },
];

const SAMPLE_SALES = [
  { id: "S001", ref: "TXN-2412-001", patient: "Walk-in", items: 3, total: 1250, method: "M-Pesa", time: "08:45", prescription: false },
  { id: "S002", ref: "TXN-2412-002", patient: "Amara Okonkwo", items: 2, total: 3900, method: "Card", time: "09:20", prescription: true },
  { id: "S003", ref: "TXN-2412-003", patient: "Walk-in", items: 1, total: 420, method: "Cash", time: "10:05", prescription: false },
];

const COLORS = {
  blue: "#185FA5", blueSoft: "#E6F1FB", blueText: "#0C447C",
  teal: "#0F6E56", tealSoft: "#E1F5EE", tealText: "#085041",
  amber: "#854F0B", amberSoft: "#FAEEDA", amberText: "#633806",
  red: "#A32D2D", redSoft: "#FCEBEB", redText: "#791F1F",
  purple: "#534AB7", purpleSoft: "#EEEDFE", purpleText: "#3C3489",
  gray: "#5F5E5A", graySoft: "#F1EFE8", grayText: "#444441",
  coral: "#993C1D", coralSoft: "#FAECE7", coralText: "#712B13",
};

const SAMPLE_PATIENTS = [
  { id: "P001", name: "Amara Okonkwo", age: 34, gender: "Female", phone: "+254 712 345 678", email: "amara@email.com", blood: "O+", status: "Active", condition: "Hypertension", lastVisit: "2024-12-10", doctor: "Dr. Kiprotich", createdAt: 1733011200000 },
  { id: "P002", name: "James Mwangi", age: 52, gender: "Male", phone: "+254 722 987 654", email: "james@email.com", blood: "A-", status: "Active", condition: "Diabetes Type II", lastVisit: "2024-12-08", doctor: "Dr. Njeri", createdAt: 1733032800000 },
  { id: "P003", name: "Fatuma Wanjiku", age: 28, gender: "Female", phone: "+254 733 111 222", email: "fatuma@email.com", blood: "B+", status: "Inactive", condition: "Asthma", lastVisit: "2024-11-22", doctor: "Dr. Kiprotich", createdAt: 1733054400000 },
  { id: "P004", name: "David Otieno", age: 45, gender: "Male", phone: "+254 700 333 444", email: "david@email.com", blood: "AB+", status: "Active", condition: "Cardiac Arrhythmia", lastVisit: "2024-12-12", doctor: "Dr. Achieng", createdAt: 1733076000000 },
  { id: "P005", name: "Grace Kamau", age: 61, gender: "Female", phone: "+254 711 555 666", email: "grace@email.com", blood: "O-", status: "Active", condition: "Osteoporosis", lastVisit: "2024-12-05", doctor: "Dr. Njeri", createdAt: 1733097600000 },
  { id: "P006", name: "Hassan Musa", age: 39, gender: "Male", phone: "+254 720 777 888", email: "hassan@email.com", blood: "A+", status: "Active", condition: "Migraine", lastVisit: "2024-12-01", doctor: "Dr. Achieng", createdAt: 1733119200000 },
];

const SAMPLE_DOCTORS = [
  { id: "D001", name: "Dr. Samuel Kiprotich", specialty: "Internal Medicine", phone: "+254 712 111 000", email: "s.kiprotich@hospital.ke", patients: 142, rating: 4.8, status: "On Duty", experience: 12, schedule: ["Mon", "Tue", "Thu", "Fri"] },
  { id: "D002", name: "Dr. Nancy Njeri", specialty: "Endocrinology", phone: "+254 722 222 111", email: "n.njeri@hospital.ke", patients: 98, rating: 4.9, status: "On Duty", experience: 9, schedule: ["Mon", "Wed", "Fri"] },
  { id: "D003", name: "Dr. Felix Achieng", specialty: "Cardiology", phone: "+254 733 333 222", email: "f.achieng@hospital.ke", patients: 115, rating: 4.7, status: "Off Duty", experience: 15, schedule: ["Tue", "Wed", "Thu"] },
  { id: "D004", name: "Dr. Zainab Hussain", specialty: "Pediatrics", phone: "+254 700 444 333", email: "z.hussain@hospital.ke", patients: 203, rating: 4.9, status: "On Duty", experience: 7, schedule: ["Mon", "Tue", "Wed", "Thu", "Fri"] },
];

const SAMPLE_APPOINTMENTS = [
  { id: "A001", patient: "Amara Okonkwo", doctor: "Dr. Kiprotich", date: "2024-12-18", time: "09:00", type: "Follow-up", status: "Confirmed" },
  { id: "A002", patient: "James Mwangi", doctor: "Dr. Njeri", date: "2024-12-18", time: "10:30", type: "Consultation", status: "Pending" },
  { id: "A003", patient: "David Otieno", doctor: "Dr. Achieng", date: "2024-12-19", time: "14:00", type: "Check-up", status: "Confirmed" },
  { id: "A004", patient: "Grace Kamau", doctor: "Dr. Njeri", date: "2024-12-19", time: "11:00", type: "Follow-up", status: "Confirmed" },
  { id: "A005", patient: "Hassan Musa", doctor: "Dr. Achieng", date: "2024-12-20", time: "15:00", type: "Consultation", status: "Cancelled" },
  { id: "A006", patient: "Fatuma Wanjiku", doctor: "Dr. Kiprotich", date: "2024-12-20", time: "09:30", type: "Check-up", status: "Pending" },
];

const SAMPLE_BILLS = [
  { id: "B001", patient: "Amara Okonkwo", date: "2024-12-10", items: ["Consultation", "Blood Test", "Medication"], amount: 4800, paid: 4800, status: "Paid", method: "M-Pesa" },
  { id: "B002", patient: "James Mwangi", date: "2024-12-08", items: ["Consultation", "HbA1c Test"], amount: 3200, paid: 1500, status: "Partial", method: "Cash" },
  { id: "B003", patient: "David Otieno", date: "2024-12-12", items: ["ECG", "Echo", "Consultation"], amount: 12500, paid: 0, status: "Unpaid", method: "-" },
  { id: "B004", patient: "Grace Kamau", date: "2024-12-05", items: ["DEXA Scan", "Consultation", "Supplements"], amount: 7800, paid: 7800, status: "Paid", method: "Card" },
  { id: "B005", patient: "Hassan Musa", date: "2024-12-01", items: ["MRI", "Consultation"], amount: 15000, paid: 15000, status: "Paid", method: "Insurance" },
];

const styles = `
  @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600&family=Space+Grotesk:wght@400;500;600&display=swap');
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: 'DM Sans', sans-serif; background: #F4F6F9; color: #1a1a2e; }
  .hms { display: flex; height: 100vh; overflow: hidden; font-family: 'DM Sans', sans-serif; }
  .sidebar { width: 240px; background: #0d1b2a; color: white; display: flex; flex-direction: column; flex-shrink: 0; }
  .sidebar-logo { padding: 20px 20px 16px; border-bottom: 1px solid rgba(255,255,255,0.08); }
  .logo-text { font-family: 'Space Grotesk', sans-serif; font-size: 18px; font-weight: 600; color: #fff; display: flex; align-items: center; gap: 8px; }
  .logo-icon { width: 32px; height: 32px; background: #185FA5; border-radius: 8px; display: flex; align-items: center; justify-content: center; font-size: 16px; }
  .logo-sub { font-size: 10px; color: rgba(255,255,255,0.4); letter-spacing: 0.08em; text-transform: uppercase; margin-top: 2px; }
  .sidebar-nav { flex: 1; padding: 12px 8px; overflow-y: auto; }
  .nav-section { font-size: 10px; text-transform: uppercase; letter-spacing: 0.1em; color: rgba(255,255,255,0.3); padding: 8px 12px 4px; margin-top: 8px; }
  .nav-item { display: flex; align-items: center; gap: 10px; padding: 9px 12px; border-radius: 8px; cursor: pointer; color: rgba(255,255,255,0.6); font-size: 13.5px; font-weight: 400; transition: all 0.15s; margin-bottom: 2px; }
  .nav-item:hover { background: rgba(255,255,255,0.07); color: white; }
  .nav-item.active { background: #185FA5; color: white; font-weight: 500; }
  .nav-item span.icon { font-size: 16px; opacity: 0.9; }
  .nav-badge { margin-left: auto; background: rgba(255,255,255,0.15); font-size: 10px; padding: 2px 6px; border-radius: 10px; }
  .sidebar-footer { padding: 12px; border-top: 1px solid rgba(255,255,255,0.08); }
  .user-card { display: flex; align-items: center; gap: 10px; padding: 8px; border-radius: 8px; background: rgba(255,255,255,0.06); }
  .user-avatar { width: 32px; height: 32px; border-radius: 50%; background: #185FA5; display: flex; align-items: center; justify-content: center; font-size: 12px; font-weight: 600; color: white; }
  .user-info { flex: 1; }
  .user-name { font-size: 12.5px; font-weight: 500; color: white; }
  .user-role { font-size: 10px; color: rgba(255,255,255,0.4); text-transform: capitalize; }
  .main { flex: 1; display: flex; flex-direction: column; overflow: hidden; }
  .topbar { background: white; border-bottom: 1px solid #e8eaed; padding: 0 24px; height: 60px; display: flex; align-items: center; gap: 16px; }
  .topbar-title { font-family: 'Space Grotesk', sans-serif; font-size: 17px; font-weight: 600; color: #0d1b2a; flex: 1; }
  .topbar-search { display: flex; align-items: center; gap: 8px; background: #f4f6f9; border: 1px solid #e8eaed; border-radius: 8px; padding: 7px 12px; width: 240px; }
  .topbar-search input { border: none; background: transparent; font-size: 13px; outline: none; color: #444; width: 100%; font-family: 'DM Sans', sans-serif; }
  .topbar-search input::placeholder { color: #aaa; }
  .topbar-actions { display: flex; align-items: center; gap: 8px; }
  .icon-btn { width: 36px; height: 36px; border-radius: 8px; border: 1px solid #e8eaed; background: white; cursor: pointer; display: flex; align-items: center; justify-content: center; font-size: 16px; color: #666; transition: all 0.15s; }
  .icon-btn:hover { background: #f4f6f9; }
  .content { flex: 1; overflow-y: auto; padding: 24px; background: #f4f6f9; }
  .grid-4 { display: grid; grid-template-columns: repeat(4, 1fr); gap: 16px; margin-bottom: 24px; }
  .grid-2 { display: grid; grid-template-columns: repeat(2, 1fr); gap: 20px; margin-bottom: 24px; }
  .metric-card { background: white; border-radius: 12px; padding: 18px 20px; border: 1px solid #e8eaed; }
  .metric-label { font-size: 12px; color: #888; text-transform: uppercase; letter-spacing: 0.06em; margin-bottom: 6px; }
  .metric-value { font-size: 28px; font-weight: 600; font-family: 'Space Grotesk', sans-serif; color: #0d1b2a; }
  .metric-change { font-size: 12px; margin-top: 4px; }
  .metric-icon { width: 40px; height: 40px; border-radius: 10px; display: flex; align-items: center; justify-content: center; font-size: 18px; margin-bottom: 12px; }
  .card { background: white; border-radius: 12px; border: 1px solid #e8eaed; overflow: hidden; }
  .card-header { padding: 16px 20px; border-bottom: 1px solid #f0f0f0; display: flex; align-items: center; justify-content: space-between; }
  .card-title { font-size: 14px; font-weight: 600; color: #0d1b2a; }
  .card-body { padding: 0; }
  .table { width: 100%; border-collapse: collapse; font-size: 13px; }
  .table th { text-align: left; padding: 12px 16px; background: #f8f9fa; color: #666; font-size: 11px; text-transform: uppercase; letter-spacing: 0.06em; font-weight: 500; border-bottom: 1px solid #e8eaed; }
  .table td { padding: 12px 16px; border-bottom: 1px solid #f5f5f5; color: #333; vertical-align: middle; }
  .table tr:last-child td { border-bottom: none; }
  .table tr:hover td { background: #fafafa; }
  .badge { display: inline-flex; align-items: center; font-size: 11px; font-weight: 500; padding: 3px 9px; border-radius: 20px; }
  .btn { display: inline-flex; align-items: center; gap: 6px; padding: 8px 16px; border-radius: 8px; font-size: 13px; font-weight: 500; cursor: pointer; border: none; transition: all 0.15s; font-family: 'DM Sans', sans-serif; }
  .btn-primary { background: #185FA5; color: white; }
  .btn-primary:hover { background: #0C447C; }
  .btn-secondary { background: #f4f6f9; color: #333; border: 1px solid #e8eaed; }
  .btn-secondary:hover { background: #e8eaed; }
  .btn-outline { background: white; color: #333; border: 1px solid #e8eaed; }
  .btn-outline:hover { background: #f4f6f9; }
  .btn-sm { padding: 5px 12px; font-size: 12px; }
  .page-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 20px; }
  .page-title { font-family: 'Space Grotesk', sans-serif; font-size: 22px; font-weight: 600; color: #0d1b2a; }
  .page-subtitle { font-size: 13px; color: #888; margin-top: 2px; }
  .filters { display: flex; gap: 10px; margin-bottom: 16px; flex-wrap: wrap; }
  .filter-input { background: white; border: 1px solid #e8eaed; border-radius: 8px; padding: 8px 12px; font-size: 13px; outline: none; color: #333; font-family: 'DM Sans', sans-serif; }
  .filter-input:focus { border-color: #185FA5; }
  .avatar { width: 34px; height: 34px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 12px; font-weight: 600; flex-shrink: 0; }
  .modal-overlay { position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.4); z-index: 1000; display: flex; align-items: center; justify-content: center; }
  .modal { background: white; border-radius: 16px; padding: 28px; width: 520px; max-width: 95vw; max-height: 85vh; overflow-y: auto; }
  .modal-title { font-family: 'Space Grotesk', sans-serif; font-size: 18px; font-weight: 600; margin-bottom: 20px; }
  .form-group { margin-bottom: 16px; }
  .form-label { font-size: 12px; font-weight: 500; color: #666; margin-bottom: 5px; display: block; text-transform: uppercase; letter-spacing: 0.04em; }
  .form-input { width: 100%; padding: 9px 12px; border: 1px solid #e8eaed; border-radius: 8px; font-size: 13px; outline: none; font-family: 'DM Sans', sans-serif; color: #333; }
  .form-input:focus { border-color: #185FA5; }
  .form-row { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
  .stat-row { display: flex; align-items: center; gap: 8px; padding: 10px 0; border-bottom: 1px solid #f5f5f5; }
  .stat-row:last-child { border-bottom: none; }
  .progress-bar { flex: 1; height: 6px; background: #f0f0f0; border-radius: 3px; overflow: hidden; }
  .progress-fill { height: 100%; border-radius: 3px; transition: width 0.6s ease; }
  .appt-slot { background: white; border: 1px solid #e8eaed; border-radius: 10px; padding: 12px 16px; margin-bottom: 8px; display: flex; align-items: center; gap: 12px; cursor: pointer; transition: all 0.15s; }
  .appt-slot:hover { border-color: #185FA5; box-shadow: 0 0 0 3px rgba(24,95,165,0.08); }
  .appt-time { font-size: 13px; font-weight: 600; color: #185FA5; min-width: 50px; }
  .bill-summary { background: #f8f9fa; border-radius: 10px; padding: 16px; margin-bottom: 16px; }
  .notification { background: white; border: 1px solid #e8eaed; border-radius: 10px; padding: 12px 16px; display: flex; gap: 12px; align-items: flex-start; margin-bottom: 8px; }
  .notif-dot { width: 8px; height: 8px; border-radius: 50%; margin-top: 5px; flex-shrink: 0; }
  select.form-input { appearance: none; background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='8' viewBox='0 0 12 8'%3E%3Cpath d='M1 1l5 5 5-5' stroke='%23666' stroke-width='1.5' fill='none'/%3E%3C/svg%3E"); background-repeat: no-repeat; background-position: right 12px center; padding-right: 36px; }
  .chart-bar { transition: height 0.6s ease; }
  .tab { padding: 8px 16px; font-size: 13px; border: none; background: none; cursor: pointer; color: #888; border-bottom: 2px solid transparent; font-family: 'DM Sans', sans-serif; font-weight: 500; transition: all 0.15s; }
  .tab.active { color: #185FA5; border-bottom-color: #185FA5; }
  .tabs { display: flex; border-bottom: 1px solid #e8eaed; margin-bottom: 20px; }
  .doctor-card { background: white; border: 1px solid #e8eaed; border-radius: 12px; padding: 20px; transition: all 0.15s; cursor: pointer; }
  .doctor-card:hover { box-shadow: 0 4px 20px rgba(0,0,0,0.08); transform: translateY(-1px); }
  .stars { color: #F59E0B; font-size: 12px; }
  .tag { display: inline-block; font-size: 11px; padding: 3px 8px; border-radius: 4px; margin: 2px; font-weight: 500; }
  .empty-state { text-align: center; padding: 48px 20px; color: #aaa; }
  .empty-icon { font-size: 40px; margin-bottom: 12px; }
  .role-switcher { display: flex; gap: 6px; flex-wrap: wrap; }
  .role-btn { padding: 5px 12px; border-radius: 6px; font-size: 11px; font-weight: 500; cursor: pointer; border: 1px solid #e8eaed; background: white; color: #666; text-transform: capitalize; font-family: 'DM Sans', sans-serif; transition: all 0.15s; }
  .role-btn.active { background: #185FA5; color: white; border-color: #185FA5; }
  .access-denied { display: flex; flex-direction: column; align-items: center; justify-content: center; height: 300px; color: #aaa; gap: 12px; }
  .pos-layout { display: grid; grid-template-columns: 1fr 360px; gap: 16px; height: calc(100vh - 140px); }
  .pos-left { display: flex; flex-direction: column; gap: 12px; overflow: hidden; }
  .pos-right { display: flex; flex-direction: column; background: white; border-radius: 12px; border: 1px solid #e8eaed; overflow: hidden; }
  .drug-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(160px, 1fr)); gap: 10px; overflow-y: auto; padding-bottom: 4px; }
  .drug-tile { background: white; border: 1.5px solid #e8eaed; border-radius: 10px; padding: 12px; cursor: pointer; transition: all 0.15s; position: relative; }
  .drug-tile:hover { border-color: #185FA5; box-shadow: 0 0 0 3px rgba(24,95,165,0.08); }
  .drug-tile.out-of-stock { opacity: 0.5; cursor: not-allowed; }
  .drug-tile.low-stock { border-color: #EF9F27; }
  .drug-name { font-size: 12.5px; font-weight: 600; color: #0d1b2a; margin-bottom: 2px; line-height: 1.3; }
  .drug-generic { font-size: 10.5px; color: #aaa; margin-bottom: 8px; }
  .drug-price { font-size: 14px; font-weight: 700; color: #185FA5; font-family: 'Space Grotesk', sans-serif; }
  .drug-stock { font-size: 10px; color: #888; margin-top: 2px; }
  .rx-badge { position: absolute; top: 8px; right: 8px; background: #FAEEDA; color: #854F0B; font-size: 9px; font-weight: 600; padding: 2px 5px; border-radius: 4px; }
  .cart-header { padding: 14px 16px; border-bottom: 1px solid #f0f0f0; background: #0d1b2a; }
  .cart-header-title { font-size: 13px; font-weight: 600; color: white; display: flex; justify-content: space-between; align-items: center; }
  .cart-patient { padding: 10px 14px; border-bottom: 1px solid #f0f0f0; background: #f8f9fa; }
  .cart-items { flex: 1; overflow-y: auto; padding: 8px 14px; min-height: 0; }
  .cart-item { display: flex; align-items: center; gap: 8px; padding: 8px 0; border-bottom: 1px solid #f5f5f5; }
  .cart-item-name { flex: 1; font-size: 12px; font-weight: 500; line-height: 1.3; }
  .cart-item-sub { font-size: 10px; color: #aaa; }
  .qty-ctrl { display: flex; align-items: center; gap: 4px; }
  .qty-btn { width: 22px; height: 22px; border-radius: 6px; border: 1px solid #e8eaed; background: white; cursor: pointer; font-size: 14px; display: flex; align-items: center; justify-content: center; color: #555; transition: all 0.1s; line-height: 1; }
  .qty-btn:hover { background: #185FA5; color: white; border-color: #185FA5; }
  .qty-num { font-size: 12px; font-weight: 600; min-width: 20px; text-align: center; }
  .cart-footer { padding: 14px 16px; border-top: 1px solid #e8eaed; background: #f8f9fa; flex-shrink: 0; }
  .cart-total-row { display: flex; justify-content: space-between; font-size: 12px; margin-bottom: 5px; color: #666; }
  .cart-grand { display: flex; justify-content: space-between; font-size: 16px; font-weight: 700; font-family: 'Space Grotesk', sans-serif; margin: 8px 0; padding-top: 8px; border-top: 2px solid #e8eaed; color: #0d1b2a; }
  .pay-btns { display: grid; grid-template-columns: 1fr 1fr; gap: 6px; margin-top: 8px; }
  .pay-btn { padding: 9px 8px; border-radius: 8px; border: 1.5px solid #e8eaed; background: white; cursor: pointer; font-size: 11px; font-weight: 600; text-align: center; transition: all 0.15s; font-family: 'DM Sans', sans-serif; color: #333; }
  .pay-btn:hover { border-color: #185FA5; color: #185FA5; background: #E6F1FB; }
  .pay-btn.selected { border-color: #185FA5; color: #185FA5; background: #E6F1FB; }
  .success-overlay { position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.5); z-index: 2000; display: flex; align-items: center; justify-content: center; }
  .receipt-card { background: white; border-radius: 16px; padding: 32px; width: 380px; text-align: center; }
  .pos-tabs { display: flex; background: #f4f6f9; border-radius: 8px; padding: 3px; gap: 2px; width: fit-content; }
  .pos-tab { padding: 6px 16px; border-radius: 6px; font-size: 12px; font-weight: 500; cursor: pointer; border: none; background: transparent; color: #888; font-family: 'DM Sans', sans-serif; transition: all 0.15s; }
  .pos-tab.active { background: white; color: #185FA5; box-shadow: 0 1px 3px rgba(0,0,0,0.1); }
  .presc-card { background: white; border: 1.5px solid #e8eaed; border-radius: 10px; padding: 14px; margin-bottom: 8px; cursor: pointer; transition: all 0.15s; }
  .presc-card:hover { border-color: #185FA5; }
  .btn:disabled { opacity: 0.55; cursor: not-allowed; }
  .login-wrap { display: flex; align-items: center; justify-content: center; min-height: 100vh; background: radial-gradient(1000px 600px at 15% -10%, #17324d 0%, #0d1b2a 55%); }
  .login-card { width: 400px; max-width: 92vw; background: #fff; border-radius: 16px; padding: 32px; box-shadow: 0 24px 60px rgba(0,0,0,0.35); }
  .login-logo { display: flex; align-items: center; gap: 10px; margin-bottom: 6px; font-family: "Space Grotesk", sans-serif; font-size: 20px; font-weight: 600; color: #0d1b2a; }
  .login-sub { font-size: 12.5px; color: #888; margin-bottom: 20px; }
  .login-err { background: #FCEBEB; color: #791F1F; font-size: 12.5px; border: 1px solid #f6d5d5; border-radius: 8px; padding: 9px 12px; margin-bottom: 14px; }
  .login-hint { margin-top: 18px; background: #f8f9fa; border: 1px dashed #e2e5ea; border-radius: 10px; padding: 10px 14px; font-size: 11.5px; color: #666; line-height: 1.8; }
  .login-hint-title { font-weight: 600; color: #444; font-size: 11px; text-transform: uppercase; letter-spacing: 0.06em; margin-bottom: 4px; cursor: pointer; }
  .login-hint code { background: #eaeef4; padding: 1px 5px; border-radius: 4px; font-size: 10.5px; }
  .logout-btn { width: 100%; justify-content: center; margin-top: 8px; }
  
  @media print {
    #generateReportBtn { display: none !important; }
    .sidebar, .topbar, .nav-item, .icon-btn, .role-switcher { display: none !important; }
    .content { padding: 0; margin: 0; }
  }
`;

function getInitials(name: string) {
  return name.split(" ").filter((w) => !w.startsWith("Dr")).slice(0, 2).map((w) => w[0]).join("").toUpperCase();
}

function Badge({ status }: { status: string }) {
  const map: Record<string, { bg: string; color: string }> = {
    Active: { bg: "#E1F5EE", color: "#0F6E56" }, Inactive: { bg: "#F1EFE8", color: "#5F5E5A" },
    Confirmed: { bg: "#E6F1FB", color: "#185FA5" }, Pending: { bg: "#FAEEDA", color: "#854F0B" },
    Cancelled: { bg: "#FCEBEB", color: "#A32D2D" }, Paid: { bg: "#E1F5EE", color: "#0F6E56" },
    Partial: { bg: "#FAEEDA", color: "#854F0B" }, Unpaid: { bg: "#FCEBEB", color: "#A32D2D" },
    "On Duty": { bg: "#E1F5EE", color: "#0F6E56" }, "Off Duty": { bg: "#F1EFE8", color: "#5F5E5A" },
  };
  const c = map[status] || { bg: "#f0f0f0", color: "#666" };
  return <span className="badge" style={{ background: c.bg, color: c.color }}>{status}</span>;
}

function MetricCard({ icon, label, value, change, color, bg }: { icon: string; label: string; value: string | number; change?: string; color: string; bg: string }) {
  return (
    <div className="metric-card">
      <div className="metric-icon" style={{ background: bg, color }}>{icon}</div>
      <div className="metric-label">{label}</div>
      <div className="metric-value">{value}</div>
      {change && <div className="metric-change" style={{ color: change.startsWith("+") ? COLORS.teal : COLORS.red }}>{change}</div>}
    </div>
  );
}

function BarChart({ data, colors }: { data: { label: string; value: number }[]; colors: string[] }) {
  const max = Math.max(...data.map((d) => d.value));
  return (
    <div style={{ display: "flex", alignItems: "flex-end", gap: 8, height: 120, padding: "0 8px" }}>
      {data.map((d, i) => (
        <div key={i} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
          <div style={{ fontSize: 10, color: "#888" }}>{d.value}</div>
          <div style={{ width: "100%", height: `${(d.value / max) * 90}px`, background: colors[i % colors.length], borderRadius: "4px 4px 0 0", minHeight: 4 }} />
          <div style={{ fontSize: 10, color: "#aaa" }}>{d.label}</div>
</div>
      </div>
      </div>
    </div>
  );
}

function DonutChart({ value, total, color, label }: { value: number; total: number; color: string; label: string }) {
  const pct = (value / total) * 100;
  const r = 36, cx = 44, cy = 44;
  const circ = 2 * Math.PI * r;
  const dash = (pct / 100) * circ;
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
      <svg width={88} height={88} viewBox="0 0 88 88">
        <circle cx={cx} cy={cy} r={r} fill="none" stroke="#f0f0f0" strokeWidth={10} />
        <circle cx={cx} cy={cy} r={r} fill="none" stroke={color} strokeWidth={10}
          strokeDasharray={`${dash} ${circ}`} strokeLinecap="round"
          transform={`rotate(-90 ${cx} ${cy})`} />
        <text x={cx} y={cy + 1} textAnchor="middle" dominantBaseline="middle" fontSize={14} fontWeight={600} fill="#0d1b2a">{Math.round(pct)}%</text>
      </svg>
      <div style={{ fontSize: 12, color: "#888" }}>{label}</div>
    </div>
  );
}

function handleGenerateReport() {
  const reportContent = document.getElementById('report-content')?.innerHTML;
  
  if (reportContent) {
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      window.print();
      return;
    }

    printWindow.document.write(`
      <!DOCTYPE html>
      <html lang="en">
        <head>
          <meta charset="UTF-8" />
          <title>MedCore HMS - Patient Report</title>
          <style>
            @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600&family=Space+Grotesk:wght@500;600&display=swap');
            * { box-sizing: border-box; margin: 0; padding: 0; }
            body { font-family: 'DM Sans', sans-serif; color: #1a1a2e; padding: 32px; line-height: 1.5; }
            .report-header { text-align: center; margin-bottom: 32px; padding-bottom: 20px; border-bottom: 2px solid #185FA5; }
            .report-logo { font-family: 'Space Grotesk', sans-serif; font-size: 24px; font-weight: 600; color: #0d1b2a; }
            .report-sub { font-size: 12px; color: #888; margin-top: 4px; }
            .report-meta { display: flex; justify-content: space-between; margin-bottom: 24px; font-size: 12px; color: #666; }
            h2 { font-family: 'Space Grotesk', sans-serif; font-size: 16px; color: #0d1b2a; margin: 20px 0 12px; padding-bottom: 6px; border-bottom: 1px solid #e8eaed; }
            table { width: 100%; border-collapse: collapse; margin-bottom: 16px; font-size: 12px; }
            th { text-align: left; padding: 8px 10px; background: #f8f9fa; color: #666; font-weight: 500; border-bottom: 1px solid #e8eaed; font-size: 11px; text-transform: uppercase; letter-spacing: 0.04em; }
            td { padding: 8px 10px; border-bottom: 1px solid #f5f5f5; color: #333; }
            tr:last-child td { border-bottom: none; }
            .metric-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; margin-bottom: 20px; }
            .metric-card { background: #fff; border: 1px solid #e8eaed; border-radius: 8px; padding: 14px; }
            .metric-label { font-size: 10px; color: #888; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 4px; }
            .metric-value { font-size: 22px; font-weight: 600; font-family: 'Space Grotesk', sans-serif; color: #0d1b2a; }
            .two-col { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
            @media print {
              body { padding: 0; }
              .no-print { display: none; }
            }
          </style>
        </head>
        <body>
          <div class="report-header">
            <div class="report-logo">MedCore HMS</div>
            <div class="report-sub">Kenyatta National Hospital · Patient Analytics Report</div>
          </div>
          <div class="report-meta">
            <span>Generated: ${new Date().toLocaleString()}</span>
            <span>Page 1 of 1</span>
          </div>
          ${reportContent}
        </body>
      </html>
    `);
    
    printWindow.document.close();
    printWindow.focus();
    
    setTimeout(() => {
      printWindow.print();
    }, 250);
  } else {
    window.print();
  }
}

function Dashboard({ patients, appointments, bills }: { patients: any[]; appointments: any[]; bills: any[] }) {
  const today = appointments.filter((a) => a.date === "2024-12-18").length;
  const revenue = bills.reduce((s, b) => s + b.paid, 0);
  const pending = appointments.filter((a) => a.status === "Pending").length;

  const weeklyData = [
    { label: "Mon", value: 32 }, { label: "Tue", value: 45 }, { label: "Wed", value: 28 },
    { label: "Thu", value: 51 }, { label: "Fri", value: 38 }, { label: "Sat", value: 12 }, { label: "Sun", value: 8 },
  ];

  const deptData = [
    { name: "Cardiology", pct: 82, color: COLORS.red },
    { name: "Internal Med.", pct: 65, color: COLORS.blue },
    { name: "Endocrinology", pct: 74, color: COLORS.purple },
    { name: "Pediatrics", pct: 91, color: COLORS.teal },
  ];

  return (
    <div>
      <div className="page-header">
        <div>
          <div className="page-title">Dashboard</div>
          <div className="page-subtitle">Monday, December 18, 2024 · Kenyatta National Hospital</div>
        </div>
        <button id="generateReportBtn" className="btn btn-primary" style={{ fontSize: 13 }} onClick={handleGenerateReport}>📊 Generate Report</button>
      </div>

      <div id="report-content">

      <div className="grid-4">
        <MetricCard icon="🏥" label="Total Patients" value={patients.length} change="+12 this week" color={COLORS.blue} bg={COLORS.blueSoft} />
        <MetricCard icon="📅" label="Today's Appointments" value={today} change="+3 vs yesterday" color={COLORS.purple} bg={COLORS.purpleSoft} />
        <MetricCard icon="⏳" label="Pending Requests" value={pending} change="" color={COLORS.amber} bg={COLORS.amberSoft} />
        <MetricCard icon="💰" label="Monthly Revenue" value={`KES ${(revenue / 1000).toFixed(0)}K`} change="+18% vs last month" color={COLORS.teal} bg={COLORS.tealSoft} />
      </div>

      <div className="grid-2">
        <div className="card">
          <div className="card-header">
            <span className="card-title">Patient Visits (This Week)</span>
            <span style={{ fontSize: 11, color: "#aaa" }}>Dec 12–18</span>
          </div>
          <div style={{ padding: "20px 16px" }}>
            <BarChart data={weeklyData} colors={[COLORS.blue, COLORS.blue, COLORS.blue, COLORS.blue, COLORS.blue, "#B5D4F4", "#B5D4F4"]} />
          </div>
        </div>

        <div className="card">
          <div className="card-header">
            <span className="card-title">Department Occupancy</span>
          </div>
          <div style={{ padding: "12px 20px" }}>
            {deptData.map((d, i) => (
              <div className="stat-row" key={i}>
                <span style={{ fontSize: 12, color: "#555", minWidth: 110 }}>{d.name}</span>
                <div className="progress-bar">
                  <div className="progress-fill" style={{ width: `${d.pct}%`, background: d.color }} />
                </div>
                <span style={{ fontSize: 12, color: d.color, minWidth: 36, textAlign: "right", fontWeight: 500 }}>{d.pct}%</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="grid-2">
        <div className="card">
          <div className="card-header"><span className="card-title">Today's Appointments</span></div>
          <div style={{ padding: "12px 16px" }}>
            {appointments.filter((a) => a.date === "2024-12-18").map((a) => (
              <div className="appt-slot" key={a.id}>
                <div className="appt-time">{a.time}</div>
                <div className="avatar" style={{ background: COLORS.blueSoft, color: COLORS.blueText }}>{getInitials(a.patient)}</div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, fontWeight: 500 }}>{a.patient}</div>
                  <div style={{ fontSize: 11, color: "#888" }}>{a.type} · {a.doctor}</div>
                </div>
                <Badge status={a.status} />
              </div>
            ))}
          </div>
        </div>

        <div className="card">
          <div className="card-header"><span className="card-title">Billing Overview</span></div>
          <div style={{ padding: "20px", display: "flex", justifyContent: "space-around" }}>
            <DonutChart value={bills.filter((b) => b.status === "Paid").length} total={bills.length} color={COLORS.teal} label="Paid" />
            <DonutChart value={bills.filter((b) => b.status === "Partial").length} total={bills.length} color={COLORS.amber} label="Partial" />
            <DonutChart value={bills.filter((b) => b.status === "Unpaid").length} total={bills.length} color={COLORS.red} label="Unpaid" />
          </div>
          <div style={{ padding: "0 20px 16px", borderTop: "1px solid #f0f0f0", paddingTop: 12 }}>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, marginBottom: 4 }}>
              <span style={{ color: "#888" }}>Total Outstanding</span>
              <span style={{ fontWeight: 600, color: COLORS.red }}>KES {bills.filter((b) => b.status !== "Paid").reduce((s, b) => s + (b.amount - b.paid), 0).toLocaleString()}</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13 }}>
              <span style={{ color: "#888" }}>Total Collected</span>
              <span style={{ fontWeight: 600, color: COLORS.teal }}>KES {bills.reduce((s, b) => s + b.paid, 0).toLocaleString()}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// VIDEO_PROVIDER_SEAM: replace VideoComingSoon with Daily/Agora/Jitsi component later.
// Backend seam: backend/src/routes/appointments.ts GET /:id/video-token (currently 501).
function VideoComingSoon({ roomName, onClose }: { roomName: string; onClose: () => void }) {
  return (
    <div>
      <div className="page-header">
        <div>
          <div className="page-title">Video Consultation</div>
          <div className="page-subtitle">Room: {roomName}</div>
        </div>
        <button className="btn btn-outline btn-sm" onClick={onClose}>Back</button>
      </div>
      <div className="card" style={{ textAlign: "center", padding: 32 }}>
        <div style={{ fontSize: 16, fontWeight: 700 }}>Video consultation</div>
        <span className="badge badge-warning" style={{ marginTop: 12, display: "inline-block" }}>Video coming soon</span>
        <div style={{ fontSize: 13, color: "#666", marginTop: 8 }}>Video provider not configured yet. Booking and records still work.</div>
        <div style={{ marginTop: 16, display: "flex", gap: 8, justifyContent: "center" }}>
          <button className="btn btn-outline btn-sm" onClick={() => { try { navigator.clipboard.writeText(roomName); } catch {} }}>Copy room name</button>
          <button className="btn btn-outline btn-sm" onClick={onClose}>Back</button>
        </div>
      </div>
    </div>
  );
}


function Patients({ patients, setPatients }: { patients: any[]; setPatients: (patients: any[]) => void }) {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");
  const [showModal, setShowModal] = useState(false);
  const [selectedPatient, setSelectedPatient] = useState<any>(null);
  const [newPatient, setNewPatient] = useState({ name: "", age: "", gender: "Female", phone: "", email: "", blood: "O+", condition: "" });

  const [bookingAppt, setBookingAppt] = useState<{ id: string; roomName: string } | null>(null);
  const [showVideo, setShowVideo] = useState<{ roomName: string } | null>(null);

  const handleBookAppointment = async () => {
    if (!selectedPatient) return;
    try {
      const res = await fetch("/api/appointments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          patient: selectedPatient.id,
          doctor: selectedPatient.doctor || "Dr. Kiprotich",
          date: new Date().toISOString().split("T")[0],
          time: "09:00",
          type: "Consultation",
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Failed to book appointment");
      setBookingAppt({ id: data.id, roomName: data.roomName || `hms-appt-${data.id}` });
    } catch (err: any) {
      alert(err.message || "Failed to book appointment");
    }
  };

  // VIDEO_PROVIDER_SEAM: open placeholder instead of fetching a token.
  const openVideoPlaceholder = (appointmentId: string, roomName: string) => {
    void appointmentId;
    setShowVideo({ roomName });
  };

  const filtered = patients.filter((p) =>
    (p.name.toLowerCase().includes(search.toLowerCase()) || p.id.includes(search)) &&
    (statusFilter === "All" || p.status === statusFilter)
  )
    .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));

  const addPatient = () => {
    const id = `P${String(patients.length + 1).padStart(3, "0")}`;
    setPatients([...patients, { ...newPatient, id, status: "Active", lastVisit: new Date().toISOString().split("T")[0], doctor: "Dr. Kiprotich", createdAt: Date.now(), age: parseInt(newPatient.age, 10) }]);
    setShowModal(false);
    setNewPatient({ name: "", age: "", gender: "Female", phone: "", email: "", blood: "O+", condition: "" });
  };

  if (showVideo) {
    return (
      <div>
        <VideoComingSoon roomName={showVideo.roomName} onClose={() => setShowVideo(null)} />
      </div>
    );
  }

  return (
    <div>
      <>
      <div className="page-header">
        <div>
          <div className="page-title">Patient Registry</div>
          <div className="page-subtitle">{patients.length} total patients registered</div>
        </div>
        <button className="btn btn-primary" onClick={() => setShowModal(true)}>+ Register Patient</button>
      </div>

      <div className="filters">
        <div className="topbar-search" style={{ width: 280 }}>
          <span>🔍</span>
          <input placeholder="Search by name or ID..." value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        {["All", "Active", "Inactive"].map((s) => (
          <button key={s} className="btn btn-outline btn-sm" style={{ background: statusFilter === s ? "#185FA5" : "white", color: statusFilter === s ? "white" : "#333", borderColor: statusFilter === s ? "#185FA5" : "#e8eaed" }} onClick={() => setStatusFilter(s)}>{s}</button>
        ))}
        <span style={{ marginLeft: "auto", fontSize: 12, color: "#888" }}>{filtered.length} results</span>
      </div>

      <div className="card">
        <table className="table">
          <thead>
            <tr>
              <th>Patient</th><th>ID</th><th>Age</th><th>Blood</th><th>Condition</th><th>Assigned Doctor</th><th>Last Visit</th><th>Status</th><th>Action</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((p) => (
              <tr key={p.id}>
                <td>
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <div className="avatar" style={{ background: COLORS.purpleSoft, color: COLORS.purpleText }}>{getInitials(p.name)}</div>
                    <div>
                      <div style={{ fontWeight: 500, fontSize: 13 }}>{p.name}</div>
                      <div style={{ fontSize: 11, color: "#888" }}>{p.email}</div>
                    </div>
                  </div>
                </td>
                <td><code style={{ fontSize: 11, background: "#f4f6f9", padding: "2px 6px", borderRadius: 4 }}>{p.id}</code></td>
                <td>{p.age}y</td>
                <td><span className="badge" style={{ background: "#FCEBEB", color: "#A32D2D" }}>{p.blood}</span></td>
                <td style={{ fontSize: 12, color: "#555" }}>{p.condition}</td>
                <td style={{ fontSize: 12, color: "#555" }}>{p.doctor}</td>
                <td style={{ fontSize: 12, color: "#888" }}>{p.lastVisit}</td>
                <td><Badge status={p.status} /></td>
                <td>
                  <button className="btn btn-outline btn-sm" onClick={() => setSelectedPatient(p)}>View</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {filtered.length === 0 && <div className="empty-state"><div className="empty-icon">👤</div><div>No patients found</div></div>}
      </div>

      {showModal && (
        <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && setShowModal(false)}>
          <div className="modal">
            <div className="modal-title">Register New Patient</div>
            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Full Name</label>
                <input className="form-input" value={newPatient.name} onChange={(e) => setNewPatient({ ...newPatient, name: e.target.value })} placeholder="Jane Doe" />
              </div>
              <div className="form-group">
                <label className="form-label">Age</label>
                <input className="form-input" type="number" value={newPatient.age} onChange={(e) => setNewPatient({ ...newPatient, age: e.target.value })} placeholder="25" />
              </div>
            </div>
            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Gender</label>
                <select className="form-input" value={newPatient.gender} onChange={(e) => setNewPatient({ ...newPatient, gender: e.target.value })}>
                  <option>Female</option><option>Male</option><option>Other</option>
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Blood Group</label>
                <select className="form-input" value={newPatient.blood} onChange={(e) => setNewPatient({ ...newPatient, blood: e.target.value })}>
                  {["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"].map((b) => <option key={b}>{b}</option>)}
                </select>
              </div>
            </div>
            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Phone</label>
                <input className="form-input" value={newPatient.phone} onChange={(e) => setNewPatient({ ...newPatient, phone: e.target.value })} placeholder="+254 7XX XXX XXX" />
              </div>
              <div className="form-group">
                <label className="form-label">Email</label>
                <input className="form-input" value={newPatient.email} onChange={(e) => setNewPatient({ ...newPatient, email: e.target.value })} placeholder="patient@email.com" />
              </div>
            </div>
            <div className="form-group">
              <label className="form-label">Primary Condition / Notes</label>
              <input className="form-input" value={newPatient.condition} onChange={(e) => setNewPatient({ ...newPatient, condition: e.target.value })} placeholder="e.g. Hypertension" />
            </div>
            <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", marginTop: 8 }}>
              <button className="btn btn-outline" onClick={() => setShowModal(false)}>Cancel</button>
              <button className="btn btn-primary" onClick={addPatient} disabled={!newPatient.name || !newPatient.age}>Register Patient</button>
            </div>
          </div>
        </div>
      )}

      {selectedPatient && (
        <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && setSelectedPatient(null)}>
          <div className="modal">
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 20 }}>
              <div style={{ display: "flex", gap: 14, alignItems: "center" }}>
                <div className="avatar" style={{ width: 52, height: 52, fontSize: 16, background: COLORS.purpleSoft, color: COLORS.purpleText }}>{getInitials(selectedPatient.name)}</div>
                <div>
                  <div style={{ fontSize: 17, fontWeight: 600, fontFamily: "Space Grotesk, sans-serif" }}>{selectedPatient.name}</div>
                  <div style={{ fontSize: 12, color: "#888" }}>{selectedPatient.id} · {selectedPatient.gender}, {selectedPatient.age} years</div>
                </div>
              </div>
              <Badge status={selectedPatient.status} />
            </div>
            {[["📞 Phone", selectedPatient.phone], ["✉️ Email", selectedPatient.email], ["🩸 Blood Group", selectedPatient.blood], ["🏥 Condition", selectedPatient.condition], ["👨‍⚕️ Doctor", selectedPatient.doctor], ["📅 Last Visit", selectedPatient.lastVisit]].map(([l, v]) => (
              <div key={l as string} style={{ display: "flex", justifyContent: "space-between", padding: "9px 0", borderBottom: "1px solid #f5f5f5", fontSize: 13 }}>
                <span style={{ color: "#888" }}>{l}</span>
                <span style={{ fontWeight: 500 }}>{v}</span>
              </div>
            ))}
            <div style={{ display: "flex", gap: 8, marginTop: 20 }}>
              <button className="btn btn-primary" style={{ flex: 1 }} onClick={handleBookAppointment}>Book Appointment</button>
              <button className="btn btn-outline" onClick={() => setSelectedPatient(null)}>Close</button>
              {bookingAppt && (
                <button className="btn btn-outline" onClick={() => openVideoPlaceholder(bookingAppt.id, bookingAppt.roomName)}>Join Video Call</button>
              )}
            </div>
          </div>
        </div>
      )}
      </>
    </div>
  );
}

function Appointments({ appointments, setAppointments }: { appointments: any[]; setAppointments: (appointments: any[]) => void }) {
  const [filter, setFilter] = useState("All");
  const [search, setSearch] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [newAppt, setNewAppt] = useState({ patient: "", doctor: "Dr. Kiprotich", date: "", time: "09:00", type: "Consultation" });

  const filtered = appointments.filter((a) =>
    (a.patient.toLowerCase().includes(search.toLowerCase()) || a.doctor.toLowerCase().includes(search.toLowerCase())) &&
    (filter === "All" || a.status === filter)
  );

  const add = () => {
    const id = `A${String(appointments.length + 1).padStart(3, "0")}`;
    setAppointments([...appointments, { ...newAppt, id, status: "Pending" }]);
    setShowModal(false);
    setNewAppt({ patient: "", doctor: "Dr. Kiprotich", date: "", time: "09:00", type: "Consultation" });
  };

  const updateStatus = (id: string, status: string) => {
    setAppointments(appointments.map((a) => a.id === id ? { ...a, status } : a));
  };

  return (
    <div>
      <div className="page-header">
        <div>
          <div className="page-title">Appointments</div>
          <div className="page-subtitle">{appointments.length} total · {appointments.filter((a) => a.status === "Confirmed").length} confirmed</div>
        </div>
        <button className="btn btn-primary" onClick={() => setShowModal(true)}>+ Schedule Appointment</button>
      </div>

      <div className="filters">
        <div className="topbar-search" style={{ width: 260 }}>
          <span>🔍</span>
          <input placeholder="Search patient or doctor..." value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        {["All", "Confirmed", "Pending", "Cancelled"].map((s) => (
          <button key={s} className="btn btn-outline btn-sm" style={{ background: filter === s ? "#185FA5" : "white", color: filter === s ? "white" : "#333", borderColor: filter === s ? "#185FA5" : "#e8eaed" }} onClick={() => setFilter(s)}>{s}</button>
        ))}
      </div>

      <div className="card">
        <table className="table">
          <thead><tr><th>Patient</th><th>Doctor</th><th>Date</th><th>Time</th><th>Type</th><th>Status</th><th>Actions</th></tr></thead>
          <tbody>
            {filtered.map((a) => (
              <tr key={a.id}>
                <td style={{ fontWeight: 500, fontSize: 13 }}>{a.patient}</td>
                <td style={{ fontSize: 13, color: "#555" }}>{a.doctor}</td>
                <td style={{ fontSize: 12, color: "#666" }}>{a.date}</td>
                <td><span style={{ background: COLORS.blueSoft, color: COLORS.blueText, fontSize: 12, padding: "3px 8px", borderRadius: 6, fontWeight: 500 }}>{a.time}</span></td>
                <td><span className="tag" style={{ background: "#EEEDFE", color: COLORS.purple }}>{a.type}</span></td>
                <td><Badge status={a.status} /></td>
                <td>
                  <div style={{ display: "flex", gap: 4 }}>
                    {a.status === "Pending" && <button className="btn btn-outline btn-sm" style={{ color: COLORS.teal, fontSize: 11 }} onClick={() => updateStatus(a.id, "Confirmed")}>Confirm</button>}
                    {a.status !== "Cancelled" && <button className="btn btn-outline btn-sm" style={{ color: COLORS.red, fontSize: 11 }} onClick={() => updateStatus(a.id, "Cancelled")}>Cancel</button>}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {filtered.length === 0 && <div className="empty-state"><div className="empty-icon">📅</div><div>No appointments found</div></div>}
      </div>

      {showModal && (
        <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && setShowModal(false)}>
          <div className="modal">
            <div className="modal-title">Schedule Appointment</div>
            <div className="form-group">
              <label className="form-label">Patient Name</label>
              <input className="form-input" value={newAppt.patient} onChange={(e) => setNewAppt({ ...newAppt, patient: e.target.value })} placeholder="Patient full name" />
            </div>
            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Doctor</label>
                <select className="form-input" value={newAppt.doctor} onChange={(e) => setNewAppt({ ...newAppt, doctor: e.target.value })}>
                  {SAMPLE_DOCTORS.map((d) => <option key={d.id}>{d.name.replace("Dr. Samuel ", "Dr. ").replace("Dr. Nancy ", "Dr. ").replace("Dr. Felix ", "Dr. ").replace("Dr. Zainab ", "Dr. ")}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Appointment Type</label>
                <select className="form-input" value={newAppt.type} onChange={(e) => setNewAppt({ ...newAppt, type: e.target.value })}>
                  {["Consultation", "Follow-up", "Check-up", "Emergency", "Procedure"].map((t) => <option key={t}>{t}</option>)}
                </select>
              </div>
            </div>
            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Date</label>
                <input className="form-input" type="date" value={newAppt.date} onChange={(e) => setNewAppt({ ...newAppt, date: e.target.value })} />
              </div>
              <div className="form-group">
                <label className="form-label">Time</label>
                <input className="form-input" type="time" value={newAppt.time} onChange={(e) => setNewAppt({ ...newAppt, time: e.target.value })} />
              </div>
            </div>
            <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", marginTop: 8 }}>
              <button className="btn btn-outline" onClick={() => setShowModal(false)}>Cancel</button>
              <button className="btn btn-primary" onClick={add} disabled={!newAppt.patient || !newAppt.date}>Schedule</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Doctors() {
  const [search, setSearch] = useState("");
  const [tab, setTab] = useState("All");
  const filtered = SAMPLE_DOCTORS.filter((d) =>
    d.name.toLowerCase().includes(search.toLowerCase()) &&
    (tab === "All" || d.status === tab)
  );

  return (
    <div>
      <div className="page-header">
        <div>
          <div className="page-title">Medical Staff</div>
          <div className="page-subtitle">{SAMPLE_DOCTORS.length} registered doctors</div>
        </div>
        <button className="btn btn-primary">+ Add Doctor</button>
      </div>
      <div className="filters">
        <div className="topbar-search" style={{ width: 260 }}>
          <span>🔍</span>
          <input placeholder="Search by name or specialty..." value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <div className="tabs" style={{ borderBottom: "none", marginBottom: 0 }}>
          {["All", "On Duty", "Off Duty"].map((t) => (
            <button key={t} className={`tab ${tab === t ? "active" : ""}`} onClick={() => setTab(t)}>{t}</button>
          ))}
        </div>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 16 }}>
        {filtered.map((d) => (
          <div className="doctor-card" key={d.id}>
            <div style={{ display: "flex", gap: 14, marginBottom: 14 }}>
              <div className="avatar" style={{ width: 52, height: 52, fontSize: 16, background: COLORS.tealSoft, color: COLORS.tealText }}>{getInitials(d.name)}</div>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 600, fontSize: 14 }}>{d.name}</div>
                <div style={{ fontSize: 12, color: "#888", marginBottom: 4 }}>{d.specialty}</div>
                <div className="stars">{"★".repeat(Math.floor(d.rating))} <span style={{ color: "#888", fontSize: 11, fontWeight: 400 }}>{d.rating}</span></div>
              </div>
              <Badge status={d.status} />
            </div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 12 }}>
              {d.schedule.map((s) => <span key={s} className="tag" style={{ background: COLORS.blueSoft, color: COLORS.blueText }}>{s}</span>)}
            </div>
            <div style={{ display: "flex", gap: 16, fontSize: 12, color: "#888", paddingTop: 12, borderTop: "1px solid #f5f5f5" }}>
              <span>👤 <strong style={{ color: "#333" }}>{d.patients}</strong> patients</span>
              <span>🕐 <strong style={{ color: "#333" }}>{d.experience}y</strong> experience</span>
              <span style={{ marginLeft: "auto" }}>
                <button className="btn btn-outline btn-sm">View Profile</button>
              </span>
            </div>
          </div>
        ))}
      </div>
      {filtered.length === 0 && <div className="empty-state"><div className="empty-icon">👨‍⚕️</div><div>No doctors found</div></div>}
    </div>
  );
}

function Billing({ bills, setBills }: { bills: any[]; setBills: (bills: any[]) => void }) {
  const [filter, setFilter] = useState("All");
  const [showModal, setShowModal] = useState(false);
  const [selected, setSelected] = useState<any>(null);

  const filtered = bills.filter((b) => filter === "All" || b.status === filter);

  const markPaid = (id: string) => setBills(bills.map((b) => b.id === id ? { ...b, status: "Paid", paid: b.amount, method: "M-Pesa" } : b));

  return (
    <div>
      <div className="page-header">
        <div>
          <div className="page-title">Billing & Payments</div>
          <div className="page-subtitle">Integrated with M-Pesa, Card & Insurance</div>
        </div>
        <button className="btn btn-primary" onClick={() => setShowModal(true)}>+ Create Invoice</button>
      </div>

      <div className="grid-4" style={{ marginBottom: 20 }}>
        <MetricCard icon="💳" label="Total Billed" value={`KES ${(bills.reduce((s, b) => s + b.amount, 0) / 1000).toFixed(1)}K`} color={COLORS.blue} bg={COLORS.blueSoft} />
        <MetricCard icon="✅" label="Collected" value={`KES ${(bills.reduce((s, b) => s + b.paid, 0) / 1000).toFixed(1)}K`} color={COLORS.teal} bg={COLORS.tealSoft} />
        <MetricCard icon="⚠️" label="Outstanding" value={`KES ${(bills.filter((b) => b.status !== "Paid").reduce((s, b) => s + (b.amount - b.paid), 0) / 1000).toFixed(1)}K`} color={COLORS.amber} bg={COLORS.amberSoft} />
        <MetricCard icon="❌" label="Unpaid Bills" value={bills.filter((b) => b.status === "Unpaid").length} color={COLORS.red} bg={COLORS.redSoft} />
      </div>

      <div className="filters">
        {["All", "Paid", "Partial", "Unpaid"].map((s) => (
          <button key={s} className="btn btn-outline btn-sm" style={{ background: filter === s ? "#185FA5" : "white", color: filter === s ? "white" : "#333", borderColor: filter === s ? "#185FA5" : "#e8eaed" }} onClick={() => setFilter(s)}>{s}</button>
        ))}
      </div>

      <div className="card">
        <table className="table">
          <thead><tr><th>Invoice</th><th>Patient</th><th>Date</th><th>Services</th><th>Total</th><th>Paid</th><th>Method</th><th>Status</th><th>Action</th></tr></thead>
          <tbody>
            {filtered.map((b) => (
              <tr key={b.id}>
                <td><code style={{ fontSize: 11, background: "#f4f6f9", padding: "2px 6px", borderRadius: 4 }}>{b.id}</code></td>
                <td style={{ fontWeight: 500, fontSize: 13 }}>{b.patient}</td>
                <td style={{ fontSize: 12, color: "#888" }}>{b.date}</td>
                <td style={{ fontSize: 11, color: "#666" }}>{b.items.join(", ")}</td>
                <td style={{ fontWeight: 500 }}>KES {b.amount.toLocaleString()}</td>
                <td style={{ color: COLORS.teal, fontWeight: 500 }}>KES {b.paid.toLocaleString()}</td>
                <td>
                  {b.method !== "-" && <span className="tag" style={{ background: "#E1F5EE", color: COLORS.tealText }}>{b.method}</span>}
                  {b.method === "-" && <span style={{ color: "#ccc" }}>—</span>}
                </td>
                <td><Badge status={b.status} /></td>
                <td>
                  <div style={{ display: "flex", gap: 4 }}>
                    {b.status !== "Paid" && <button className="btn btn-outline btn-sm" style={{ color: COLORS.teal, fontSize: 11 }} onClick={() => markPaid(b.id)}>Mark Paid</button>}
                    <button className="btn btn-outline btn-sm" style={{ fontSize: 11 }} onClick={() => setSelected(b)}>View</button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {selected && (
        <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && setSelected(null)}>
          <div className="modal">
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
              <div className="modal-title" style={{ margin: 0 }}>Invoice {selected.id}</div>
              <Badge status={selected.status} />
            </div>
            <div className="bill-summary">
              <div style={{ fontSize: 13, color: "#888", marginBottom: 4 }}>Patient</div>
              <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 12 }}>{selected.patient}</div>
              <div style={{ fontSize: 12, color: "#888", marginBottom: 8 }}>Services Rendered</div>
              {selected.items.map((item: string, i: number) => (
                <div key={i} style={{ display: "flex", justifyContent: "space-between", fontSize: 13, padding: "5px 0", borderBottom: "1px solid #e8eaed" }}>
                  <span>{item}</span>
                </div>
              ))}
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, padding: "5px 0", marginTop: 6 }}>
                <span style={{ color: "#888" }}>Total</span>
                <span style={{ fontWeight: 600 }}>KES {selected.amount.toLocaleString()}</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, padding: "5px 0" }}>
                <span style={{ color: "#888" }}>Paid</span>
                <span style={{ fontWeight: 600, color: COLORS.teal }}>KES {selected.paid.toLocaleString()}</span>
              </div>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 15, fontWeight: 700, marginBottom: 16 }}>
              <span>Balance Due</span>
              <span style={{ color: selected.amount - selected.paid > 0 ? COLORS.red : COLORS.teal }}>
                KES {(selected.amount - selected.paid).toLocaleString()}
              </span>
            </div>
            <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
              {selected.status !== "Paid" && (
                <button className="btn btn-primary" onClick={() => markPaid(selected.id)}>Mark Paid</button>
              )}
              <button className="btn btn-outline" onClick={() => setSelected(null)}>Close</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Pharmacy({ patients }: { patients: any[] }) {
  const [drugs, setDrugs] = useState<any[]>(SAMPLE_DRUGS);
  const [prescriptions, setPrescriptions] = useState<any[]>(SAMPLE_PRESCRIPTIONS);
  const [sales, setSales] = useState<any[]>(SAMPLE_SALES);
  const [tab, setTab] = useState("POS");
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("All");
  const [cart, setCart] = useState<{ id: string; qty: number }[]>([]);
  const [patient, setPatient] = useState("Walk-in");
  const [payMethod, setPayMethod] = useState("M-Pesa");
  const [receipt, setReceipt] = useState<any>(null);

  const filtered = drugs.filter((d) =>
    (d.name.toLowerCase().includes(search.toLowerCase()) ||
      d.generic.toLowerCase().includes(search.toLowerCase())) &&
    (category === "All" || d.category === category)
  );

  const addToCart = (id: string) => {
    const drug = drugs.find((d) => d.id === id);
    if (!drug || drug.stock <= 0) return;
    setCart((prev) =>
      prev.some((c) => c.id === id)
        ? prev.map((c) => (c.id === id ? { ...c, qty: c.qty + 1 } : c))
        : [...prev, { id, qty: 1 }]
    );
  };

  const changeQty = (id: string, delta: number) =>
    setCart((prev) =>
      prev
        .map((c) => (c.id === id ? { ...c, qty: c.qty + delta } : c))
        .filter((c) => c.qty > 0)
    );

  const cartItems = cart
    .map((c) => ({ ...c, drug: drugs.find((d) => d.id === c.id)! }))
    .filter((c) => c.drug);

  const subtotal = cartItems.reduce((s, c) => s + c.drug.price * c.qty, 0);
  const tax = Math.round(subtotal * 0.16);
  const total = subtotal + tax;
  const lowStock = drugs.filter((d) => d.stock <= d.minStock).length;

  const checkout = () => {
    if (cartItems.length === 0) return;
    const id = String(sales.length + 1).padStart(3, "0");
    const sale = {
      id: `S${id}`,
      ref: `TXN-2412-${id}`,
      patient,
      items: cartItems.length,
      total,
      method: payMethod,
      time: new Date().toTimeString().slice(0, 5),
      prescription: cartItems.some((c) => c.drug.prescription),
    };
    setSales([sale, ...sales]);
    setDrugs((prev) =>
      prev.map((d) => {
        const line = cart.find((c) => c.id === d.id);
        return line ? { ...d, stock: d.stock - line.qty } : d;
      })
    );
    setReceipt({
      ...sale,
      lines: cartItems.map((c) => ({ name: c.drug.name, qty: c.qty, price: c.drug.price })),
    });
    setCart([]);
    setPatient("Walk-in");
  };

  const dispense = (rx: any) => {
    setPrescriptions((prev) => prev.map((p) => (p.id === rx.id ? { ...p, status: "Dispensed" } : p)));
    setDrugs((prev) =>
      prev.map((d) => {
        const line = rx.drugs.find((x: any) => x.drugId === d.id);
        return line ? { ...d, stock: d.stock - line.qty } : d;
      })
    );
  };

  return (
    <div>
      <div className="page-header">
        <div>
          <div className="page-title">Pharmacy &amp; POS</div>
          <div className="page-subtitle">{drugs.length} drugs in inventory · {lowStock} low-stock alerts</div>
        </div>
        <div className="pos-tabs">
          {["POS", "Prescriptions", "Sales"].map((t) => (
            <button key={t} className={`pos-tab ${tab === t ? "active" : ""}`} onClick={() => setTab(t)}>
              {t}
            </button>
          ))}
        </div>
      </div>
      {tab === "POS" && (
        <div className="pos-layout">
          <div className="pos-left">
            <div className="filters" style={{ marginBottom: 0 }}>
              <div className="topbar-search" style={{ width: 300 }}>
                <span>🔍</span>
                <input placeholder="Search drug or generic..." value={search} onChange={(e) => setSearch(e.target.value)} />
              </div>
              <select className="filter-input" value={category} onChange={(e) => setCategory(e.target.value)}>
                <option>All</option>
                {DRUG_CATEGORIES.map((c) => <option key={c}>{c}</option>)}
              </select>
            </div>
            <div className="drug-grid">
              {filtered.map((d) => (
                <div
                  key={d.id}
                  className={`drug-tile ${d.stock === 0 ? "out-of-stock" : d.stock <= d.minStock ? "low-stock" : ""}`}
                  onClick={() => addToCart(d.id)}
                >
                  {d.prescription && <span className="rx-badge">Rx</span>}
                  <div className="drug-name">{d.name}</div>
                  <div className="drug-generic">{d.generic}</div>
                  <div className="drug-price">KES {d.price}</div>
                  <div className="drug-stock">{d.stock === 0 ? "Out of stock" : `${d.stock} in stock`} · Exp {d.expiry}</div>
                </div>
              ))}
              {filtered.length === 0 && (
                <div className="empty-state"><div className="empty-icon">🔎</div><div>No drugs found</div></div>
              )}
            </div>
          </div>

          <div className="pos-right">
            <div className="cart-header">
              <div className="cart-header-title">
                <span>🛒 Current Sale</span>
                <span style={{ fontSize: 11, color: "rgba(255,255,255,0.5)" }}>{cartItems.length} items</span>
              </div>
            </div>
            <div className="cart-patient">
              <select className="form-input" value={patient} onChange={(e) => setPatient(e.target.value)}>
                <option>Walk-in</option>
                {patients.map((p) => <option key={p.id}>{p.name}</option>)}
              </select>
            </div>
            <div className="cart-items">
              {cartItems.length === 0 && (
                <div className="empty-state" style={{ padding: "32px 12px" }}>
                  <div className="empty-icon" style={{ fontSize: 28 }}>🧺</div>
                  <div style={{ fontSize: 12 }}>Tap a drug to add it to the cart</div>
                </div>
              )}
              {cartItems.map((c) => (
                <div className="cart-item" key={c.id}>
                  <div style={{ flex: 1 }}>
                    <div className="cart-item-name">{c.drug.name}</div>
                    <div className="cart-item-sub">KES {c.drug.price} each</div>
                  </div>
                  <div className="qty-ctrl">
                    <button className="qty-btn" onClick={() => changeQty(c.id, -1)}>-</button>
                    <span className="qty-num">{c.qty}</span>
                    <button className="qty-btn" onClick={() => changeQty(c.id, 1)}>+</button>
                  </div>
                  <div style={{ fontSize: 12, fontWeight: 600, minWidth: 56, textAlign: "right" }}>
                    KES {(c.drug.price * c.qty).toLocaleString()}
                  </div>
                </div>
              ))}
            </div>
            <div className="cart-footer">
              <div className="cart-total-row"><span>Subtotal</span><span>KES {subtotal.toLocaleString()}</span></div>
              <div className="cart-total-row"><span>VAT (16%)</span><span>KES {tax.toLocaleString()}</span></div>
              <div className="cart-grand"><span>Total</span><span>KES {total.toLocaleString()}</span></div>
              <div className="pay-btns">
                {["M-Pesa", "Card", "Cash", "Insurance"].map((m) => (
                  <button key={m} className={`pay-btn ${payMethod === m ? "selected" : ""}`} onClick={() => setPayMethod(m)}>
                    {m}
                  </button>
                ))}
              </div>
              <button
                className="btn btn-primary"
                style={{ width: "100%", justifyContent: "center", marginTop: 10 }}
                disabled={cartItems.length === 0}
                onClick={checkout}
              >
                Charge KES {total.toLocaleString()}
              </button>
            </div>
          </div>
        </div>
      )}

      {tab === "Prescriptions" && (
        <div>
          {prescriptions.map((p) => (
            <div className="presc-card" key={p.id}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                <div>
                  <div style={{ fontWeight: 600, fontSize: 14 }}>{p.patient}</div>
                  <div style={{ fontSize: 12, color: "#888" }}>{p.id} · {p.doctor} · {p.date}</div>
                </div>
                <Badge status={p.status} />
              </div>
              <div style={{ margin: "10px 0" }}>
                {p.drugs.map((rx: any) => {
                  const drug = drugs.find((d) => d.id === rx.drugId);
                  return (
                    <span key={rx.drugId} className="tag" style={{ background: COLORS.blueSoft, color: COLORS.blueText }}>
                      {drug ? drug.name : rx.drugId} × {rx.qty}
                    </span>
                  );
                })}
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ fontSize: 12, color: "#888" }}>
                  Total: KES {p.drugs.reduce((s: number, rx: any) => {
                    const drug = drugs.find((d) => d.id === rx.drugId);
                    return s + (drug ? drug.price * rx.qty : 0);
                  }, 0).toLocaleString()}
                </span>
                {p.status === "Pending" && (
                  <button className="btn btn-primary btn-sm" onClick={() => dispense(p)}>Dispense</button>
                )}
              </div>
            </div>
          ))}
          {prescriptions.length === 0 && (
            <div className="empty-state"><div className="empty-icon">📋</div><div>No prescriptions</div></div>
          )}
        </div>
      )}

      {tab === "Sales" && (
        <div className="card">
          <table className="table">
            <thead>
              <tr><th>Sale</th><th>Reference</th><th>Customer</th><th>Items</th><th>Total</th><th>Method</th><th>Time</th><th>Rx</th></tr>
            </thead>
            <tbody>
              {sales.map((s) => (
                <tr key={s.id}>
                  <td><code style={{ fontSize: 11, background: "#f4f6f9", padding: "2px 6px", borderRadius: 4 }}>{s.id}</code></td>
                  <td style={{ fontSize: 12, color: "#666" }}>{s.ref}</td>
                  <td style={{ fontWeight: 500, fontSize: 13 }}>{s.patient}</td>
                  <td>{s.items}</td>
                  <td style={{ fontWeight: 600 }}>KES {s.total.toLocaleString()}</td>
                  <td><span className="tag" style={{ background: COLORS.tealSoft, color: COLORS.tealText }}>{s.method}</span></td>
                  <td style={{ fontSize: 12, color: "#888" }}>{s.time}</td>
                  <td>{s.prescription ? <span className="tag" style={{ background: COLORS.amberSoft, color: COLORS.amberText }}>Rx</span> : <span style={{ color: "#ccc" }}>—</span>}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {sales.length === 0 && (
            <div className="empty-state"><div className="empty-icon">🧾</div><div>No sales recorded today</div></div>
          )}
        </div>
      )}

      {receipt && (
        <div className="success-overlay" onClick={(e) => e.target === e.currentTarget && setReceipt(null)}>
          <div className="receipt-card">
            <div style={{ fontSize: 40 }}>✅</div>
            <div style={{ fontFamily: "Space Grotesk, sans-serif", fontSize: 18, fontWeight: 600, marginTop: 8 }}>Payment Successful</div>
            <div style={{ fontSize: 12, color: "#888", margin: "4px 0 16px" }}>{receipt.ref} · {receipt.time}</div>
            <div className="bill-summary" style={{ textAlign: "left" }}>
              {receipt.lines.map((l: any, i: number) => (
                <div key={i} style={{ display: "flex", justifyContent: "space-between", fontSize: 13, padding: "4px 0" }}>
                  <span>{l.name} × {l.qty}</span>
                  <span style={{ fontWeight: 500 }}>KES {(l.price * l.qty).toLocaleString()}</span>
                </div>
              ))}
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 15, fontWeight: 700, marginTop: 8, paddingTop: 8, borderTop: "1px solid #e8eaed" }}>
                <span>Total ({receipt.method})</span>
                <span>KES {receipt.total.toLocaleString()}</span>
              </div>
            </div>
            <div style={{ fontSize: 12, color: "#888", marginBottom: 14 }}>Customer: {receipt.patient}</div>
            <button className="btn btn-primary" style={{ width: "100%", justifyContent: "center" }} onClick={() => setReceipt(null)}>
              New Sale
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function SettingsPage({ role, setRole }: { role: string; setRole: (r: string) => void }) {
  return (
    <div>
      <div className="page-header">
        <div>
          <div className="page-title">Settings</div>
          <div className="page-subtitle">Roles, permissions and facility configuration</div>
        </div>
        <button className="btn btn-primary">Save Changes</button>
      </div>

      <div className="grid-2">
        <div className="card">
          <div className="card-header"><span className="card-title">Role &amp; Permissions</span></div>
          <div style={{ padding: 20 }}>
            <div className="form-group">
              <label className="form-label">Viewing as role</label>
              <div className="role-switcher">
                {Object.values(ROLES).map((r) => (
                  <button key={r} className={`role-btn ${role === r ? "active" : ""}`} onClick={() => setRole(r)}>
                    {r}
                  </button>
                ))}
              </div>
            </div>
            {Object.entries(PERMISSIONS).map(([r, perms]) => (
              <div key={r} className="stat-row">
                <span style={{ fontSize: 13, fontWeight: 500, minWidth: 110, textTransform: "capitalize" }}>{r}</span>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                  {perms.map((p) => (
                    <span key={p} className="tag" style={{ background: COLORS.blueSoft, color: COLORS.blueText }}>{p}</span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="card">
          <div className="card-header"><span className="card-title">Facility</span></div>
          <div style={{ padding: 20 }}>
            <div className="form-group">
              <label className="form-label">Facility Name</label>
              <input className="form-input" defaultValue="Kenyatta National Hospital" />
            </div>
            <div className="form-row">
              <div className="form-group">
                <label className="form-label">M-Pesa Paybill</label>
                <input className="form-input" defaultValue="400200" />
              </div>
              <div className="form-group">
                <label className="form-label">VAT Rate</label>
                <input className="form-input" defaultValue="16%" />
              </div>
            </div>
            <div className="form-group">
              <label className="form-label">Address</label>
              <input className="form-input" defaultValue="Hospital Road, Upper Hill, Nairobi" />
            </div>
            <div className="form-group">
              <label className="form-label">Emergency Line</label>
              <input className="form-input" defaultValue="+254 20 272 6300" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

const NAV_ITEMS = [
  { key: "dashboard", label: "Dashboard", icon: "📊", perm: "analytics", group: "Main" },
  { key: "patients", label: "Patients", icon: "🧑‍🤝‍🧑", perm: "patients", group: "Main" },
  { key: "appointments", label: "Appointments", icon: "📅", perm: "appointments", group: "Main" },
  { key: "doctors", label: "Doctors", icon: "👨‍⚕️", perm: "doctors", group: "Clinical" },
  { key: "pharmacy", label: "Pharmacy", icon: "💊", perm: "pharmacy", group: "Clinical" },
  { key: "billing", label: "Billing", icon: "💳", perm: "billing", group: "Finance" },
  { key: "settings", label: "Settings", icon: "⚙️", perm: "settings", group: "System" },
];

const GROUPS = ["Main", "Clinical", "Finance", "System"];

const PAGE_TITLES: Record<string, string> = {
  dashboard: "Dashboard",
  patients: "Patient Registry",
  appointments: "Appointments",
  doctors: "Medical Staff",
  pharmacy: "Pharmacy & POS",
  billing: "Billing & Payments",
  settings: "Settings",
};

function Clock() {
  const [now, setNow] = useState(new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 30000);
    return () => clearInterval(t);
  }, []);
  return (
    <span style={{ fontSize: 12, color: "#888", whiteSpace: "nowrap" }}>
      {now.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short", year: "numeric" })}
      {" · "}
      {now.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}
    </span>
  );
}

const AUTH_STORAGE_KEY = "hms_auth";

type Session = {
  token: string;
  user: { id: string; name: string; email: string; role: string };
};

function readSession(): Session | null {
  try {
    const raw = localStorage.getItem(AUTH_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (parsed && parsed.token && parsed.user && parsed.user.role) {
      return parsed as Session;
    }
  } catch {
    // corrupted session - treat as logged out
  }
  return null;
}

function LoginScreen({ onLogin }: { onLogin: (token: string, user: Session["user"]) => void }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [showHint, setShowHint] = useState(true);

  const submit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (busy) return;
    setError("");
    setBusy(true);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError((data && data.message) || "Login failed");
        setBusy(false);
        return;
      }
      onLogin(data.token, data.user);
    } catch {
      setError("Cannot reach the auth server - is the backend running on port 4000?");
      setBusy(false);
    }
  };

  return (
    <div className="login-wrap">
      <style>{styles}</style>
      <div className="login-card">
        <div className="login-logo">
          <div className="logo-icon">🏥</div>
          MedCore HMS
        </div>
        <div className="login-sub">Sign in to continue to the hospital management system</div>
        {error && <div className="login-err">{error}</div>}
        <form onSubmit={submit}>
          <div className="form-group">
            <label className="form-label">Email</label>
            <input className="form-input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="admin@hms.ke" autoComplete="username" />
          </div>
          <div className="form-group">
            <label className="form-label">Password</label>
            <input className="form-input" type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Your password" autoComplete="current-password" />
          </div>
          <button className="btn btn-primary" style={{ width: "100%", justifyContent: "center", marginTop: 4 }} disabled={busy || !email || !password}>
            {busy ? "Signing in..." : "Sign In"}
          </button>
        </form>
        <div className="login-hint">
          <div className="login-hint-title" onClick={() => setShowHint(!showHint)}>
            Demo accounts {showHint ? "▾" : "▸"}
          </div>
          {showHint && (
            <>
              <div><code>admin@hms.ke</code> / <code>admin123</code> - admin</div>
              <div><code>doctor@hms.ke</code> / <code>doctor123</code> - doctor</div>
              <div><code>reception@hms.ke</code> / <code>front123</code> - receptionist</div>
              <div><code>billing@hms.ke</code> / <code>bills123</code> - billing</div>
              <div><code>pharmacy@hms.ke</code> / <code>rx123</code> - pharmacist</div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export default function HospitalManagementSystem() {
  const [token, setToken] = useState<string | null>(null);
  const [user, setUser] = useState<Session["user"] | null>(null);
  const [role, setRole] = useState<string>(ROLES.ADMIN);
  const [active, setActive] = useState("dashboard");
  const [patients, setPatients] = useState<any[]>(SAMPLE_PATIENTS);
  const [appointments, setAppointments] = useState<any[]>(SAMPLE_APPOINTMENTS);
  const [bills, setBills] = useState<any[]>(SAMPLE_BILLS);

  useEffect(() => {
    const session = readSession();
    if (session) {
      setToken(session.token);
      setUser(session.user);
      setRole(session.user.role);
    }
  }, []);

  const can = (perm: string) => (PERMISSIONS[role] || []).includes(perm);
  const pending = appointments.filter((a) => a.status === "Pending").length;
  const lowStock = SAMPLE_DRUGS.filter((d) => d.stock <= d.minStock).length;
  const unpaid = bills.filter((b) => b.status !== "Paid").length;
  const badges: Record<string, number> = { appointments: pending, pharmacy: lowStock, billing: unpaid };

  const switchRole = (r: string) => {
    setRole(r);
    const current = NAV_ITEMS.find((i) => i.key === active);
    if (current && !(PERMISSIONS[r] || []).includes(current.perm)) {
      const fallback = NAV_ITEMS.find((i) => (PERMISSIONS[r] || []).includes(i.perm));
      if (fallback) setActive(fallback.key);
    }
  };

  const renderPage = () => {
    const item = NAV_ITEMS.find((i) => i.key === active);
    if (!item || !can(item.perm)) {
      return (
        <div className="access-denied">
          <div style={{ fontSize: 40 }}>🔒</div>
          <div style={{ fontSize: 15, fontWeight: 500 }}>Access Denied</div>
          <div style={{ fontSize: 12 }}>The “{role}” role does not have permission to view this page.</div>
        </div>
      );
    }
    switch (active) {
      case "patients": return <Patients patients={patients} setPatients={setPatients} />;
      case "appointments": return <Appointments appointments={appointments} setAppointments={setAppointments} />;
      case "doctors": return <Doctors />;
      case "pharmacy": return <Pharmacy patients={patients} />;
      case "billing": return <Billing bills={bills} setBills={setBills} />;
      case "settings": return <SettingsPage role={role} setRole={switchRole} />;
      default: return <Dashboard patients={patients} appointments={appointments} bills={bills} />;
    }
  };

  if (!token) return <LoginScreen onLogin={(t, u) => { setToken(t); setUser(u); setRole(u.role); localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify({ token: t, user: u })); }} />;

  return (
    <div className="hms">
      <style>{styles}</style>

      <aside className="sidebar">
        <div className="sidebar-logo">
          <div className="logo-text"><div className="logo-icon">🏥</div>MedCore HMS</div>
          <div className="logo-sub">Hospital Management System</div>
        </div>

        <nav className="sidebar-nav">
          {GROUPS.map((g) => {
            const items = NAV_ITEMS.filter((i) => i.group === g && can(i.perm));
            if (items.length === 0) return null;
            return (
              <div key={g}>
                <div className="nav-section">{g}</div>
                {items.map((item) => (
                  <div
                    key={item.key}
                    className={`nav-item ${active === item.key ? "active" : ""}`}
                    onClick={() => setActive(item.key)}
                  >
                    <span className="icon">{item.icon}</span>
                    {item.label}
                    {badges[item.key] ? <span className="nav-badge">{badges[item.key]}</span> : null}
                  </div>
                ))}
              </div>
            );
          })}
        </nav>

        <div className="sidebar-footer">
          <div className="user-card">
            <div className="user-avatar">{user?.name?.[0] || "A"}</div>
            <div className="user-info">
              <div className="user-name">{user?.name || "Guest"}</div>
              <div className="user-role">{role}</div>
            </div>
          </div>
          {user && (
            <button className="btn btn-secondary" style={{ width: "100%", marginTop: 8 }} onClick={() => { setToken(null); setUser(null); setRole(ROLES.ADMIN); localStorage.removeItem(AUTH_STORAGE_KEY); }}>Sign Out</button>
          )}
          <div className="role-switcher" style={{ marginTop: 10 }}>
            {Object.values(ROLES).map((r) => (
              <button key={r} className={`role-btn ${role === r ? "active" : ""}`} onClick={() => switchRole(r)}>
                {r}
              </button>
            ))}
          </div>
        </div>
      </aside>

      <div className="main">
        <header className="topbar">
          <div className="topbar-title">{PAGE_TITLES[active] || "MedCore HMS"}</div>
          <div className="topbar-search">
            <span>🔍</span>
            <input placeholder="Search patients, invoices, drugs..." />
          </div>
          <div className="topbar-actions">
            <Clock />
            <button className="icon-btn" style={{ position: "relative" }}>
              🔔
              {pending > 0 && <span className="notif-dot" style={{ background: COLORS.amber, position: "absolute", top: 7, right: 7 }} />}
            </button>
            <button className="icon-btn">⚙️</button>
            {user && (
              <button className="btn btn-secondary" style={{ padding: "6px 14px", fontSize: 12 }} onClick={() => { setToken(null); setUser(null); setRole(ROLES.ADMIN); localStorage.removeItem(AUTH_STORAGE_KEY); }}>Sign Out</button>
            )}
          </div>
        </header>
        <main className="content">{renderPage()}</main>
      </div>
    </div>
  );
}
