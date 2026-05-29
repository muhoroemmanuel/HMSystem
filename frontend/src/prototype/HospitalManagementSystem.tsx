import { useState, useEffect, useCallback } from "react";

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
  { id: "P001", name: "Amara Okonkwo", age: 34, gender: "Female", phone: "+254 712 345 678", email: "amara@email.com", blood: "O+", status: "Active", condition: "Hypertension", lastVisit: "2024-12-10", doctor: "Dr. Kiprotich" },
  { id: "P002", name: "James Mwangi", age: 52, gender: "Male", phone: "+254 722 987 654", email: "james@email.com", blood: "A-", status: "Active", condition: "Diabetes Type II", lastVisit: "2024-12-08", doctor: "Dr. Njeri" },
  { id: "P003", name: "Fatuma Wanjiku", age: 28, gender: "Female", phone: "+254 733 111 222", email: "fatuma@email.com", blood: "B+", status: "Inactive", condition: "Asthma", lastVisit: "2024-11-22", doctor: "Dr. Kiprotich" },
  { id: "P004", name: "David Otieno", age: 45, gender: "Male", phone: "+254 700 333 444", email: "david@email.com", blood: "AB+", status: "Active", condition: "Cardiac Arrhythmia", lastVisit: "2024-12-12", doctor: "Dr. Achieng" },
  { id: "P005", name: "Grace Kamau", age: 61, gender: "Female", phone: "+254 711 555 666", email: "grace@email.com", blood: "O-", status: "Active", condition: "Osteoporosis", lastVisit: "2024-12-05", doctor: "Dr. Njeri" },
  { id: "P006", name: "Hassan Musa", age: 39, gender: "Male", phone: "+254 720 777 888", email: "hassan@email.com", blood: "A+", status: "Active", condition: "Migraine", lastVisit: "2024-12-01", doctor: "Dr. Achieng" },
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
      ))}
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
        <button className="btn btn-primary" style={{ fontSize: 13 }}>📊 Generate Report</button>
      </div>

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

function Patients({ patients, setPatients }: { patients: any[]; setPatients: (patients: any[]) => void }) {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");
  const [showModal, setShowModal] = useState(false);
  const [selectedPatient, setSelectedPatient] = useState<any>(null);
  const [newPatient, setNewPatient] = useState({ name: "", age: "", gender: "Female", phone: "", email: "", blood: "O+", condition: "" });

  const filtered = patients.filter((p) =>
    (p.name.toLowerCase().includes(search.toLowerCase()) || p.id.includes(search)) &&
    (statusFilter === "All" || p.status === statusFilter)
  );

  const addPatient = () => {
    const id = `P${String(patients.length + 1).padStart(3, "0")}`;
    setPatients([...patients, { ...newPatient, id, status: "Active", lastVisit: new Date().toISOString().split("T")[0], doctor: "Dr. Kiprotich", age: parseInt(newPatient.age, 10) }]);
    setShowModal(false);
    setNewPatient({ name: "", age: "", gender: "Female", phone: "", email: "", blood: "O+", condition: "" });
  };

  return (
    <div>
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
              <button className="btn btn-primary" style={{ flex: 1 }}>Book Appointment</button>
              <button className="btn btn-outline" onClick={() => setSelectedPatient(null)}>Close</button>
            </div>
          </div>
        </div>
      )}
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
                <div key={i} style={{ display: "flex", justifyContent: "space-between", fontSize: 13, padding: "5px 0", borderBottom: "1px solid #e8e...