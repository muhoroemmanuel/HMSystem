import { useCallback, useEffect, useState } from "react";
import { api, ApiError } from "../lib/api";
import { formatDate, formatDateTime, money } from "../lib/format";
import {
  Badge,
  DetailRow,
  EmptyState,
  Icon,
  MetricCard,
  Modal,
  PageHeader,
  PageLoader,
  SearchBox,
  Tabs,
} from "../components/ui";
import { useToast } from "../context/ToastContext";
import { useAuth } from "../context/AuthContext";

interface InvoiceItem {
  id: string;
  description: string;
  quantity: number;
  unitPrice: number;
  subtotal: number;
}

interface Payment {
  id: string;
  amount: number;
  method: string;
  reference: string;
  receivedAt: string;
  receivedByName: string | null;
}

interface Invoice {
  id: string;
  reference: string;
  patientId: string;
  patientName: string;
  patientReference: string | null;
  status: "Unpaid" | "Partial" | "Paid" | "Void";
  subtotal: number;
  vatAmount: number;
  total: number;
  amountPaid: number;
  balance: number;
  notes: string;
  issuedAt: string;
  items?: InvoiceItem[];
  payments?: Payment[];
}

interface Patient {
  id: string;
  name: string;
  reference: string;
}

interface Service {
  id: string;
  name: string;
  price: number;
}

const METHODS = ["M-Pesa", "Cash", "Card", "Insurance", "Bank"] as const;

export default function BillingPage() {
  const toast = useToast();
  const { can } = useAuth();
  const canWrite = can("billing.write");

  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [summary, setSummary] = useState({ billed: 0, collected: 0, outstanding: 0, unpaidCount: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [status, setStatus] = useState("All");
  const [search, setSearch] = useState("");

  const [patients, setPatients] = useState<Patient[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [vatRate, setVatRate] = useState(0.16);

  const [showCreate, setShowCreate] = useState(false);
  const [createForm, setCreateForm] = useState({
    patientId: "",
    items: [{ description: "", quantity: 1, unitPrice: 0 }],
    notes: "",
  });
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");

  const [selected, setSelected] = useState<Invoice | null>(null);
  const [detail, setDetail] = useState<Invoice | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [payAmount, setPayAmount] = useState("");
  const [payMethod, setPayMethod] = useState<(typeof METHODS)[number]>("M-Pesa");
  const [payRef, setPayRef] = useState("");
  const [paying, setPaying] = useState(false);
  const [payError, setPayError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const params = new URLSearchParams();
      if (status !== "All") params.set("status", status);
      if (search.trim()) params.set("search", search.trim());
      const data = await api.get<{ invoices: Invoice[]; summary: typeof summary }>(`/billing?${params}`);
      setInvoices(data.invoices);
      if (!search.trim() && status === "All") setSummary(data.summary);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, [status, search]);

  useEffect(() => {
    const t = setTimeout(() => void load(), 250);
    return () => clearTimeout(t);
  }, [load]);

  useEffect(() => {
    api
      .get<{ patients: Patient[] }>("/patients?limit=300")
      .then((d) => setPatients(d.patients))
      .catch(() => undefined);
    api
      .get<{ services: Service[] }>("/settings/services")
      .then((d) => setServices(d.services))
      .catch(() => undefined);
    api
      .get<{ settings: { vatRate: number } | null }>("/settings")
      .then((d) => {
        if (d.settings) setVatRate(d.settings.vatRate);
      })
      .catch(() => undefined);
  }, []);

  const subtotal = createForm.items.reduce((s, i) => s + i.quantity * i.unitPrice, 0);
  const vat = Math.round(subtotal * vatRate * 100) / 100;
  const total = Math.round((subtotal + vat) * 100) / 100;

  async function create() {
    setSaving(true);
    setFormError("");
    try {
      await api.post("/billing", {
        patientId: createForm.patientId,
        items: createForm.items.filter((i) => i.description.trim() && i.unitPrice >= 0),
        notes: createForm.notes,
      });
      toast.success("Invoice created");
      setShowCreate(false);
      setCreateForm({ patientId: "", items: [{ description: "", quantity: 1, unitPrice: 0 }], notes: "" });
      await load();
    } catch (err) {
      setFormError((err as ApiError).message);
    } finally {
      setSaving(false);
    }
  }

  async function openInvoice(inv: Invoice) {
    setSelected(inv);
    setDetail(null);
    setPayError("");
    setPayAmount("");
    setPayRef("");
    setDetailLoading(true);
    try {
      const data = await api.get<{ invoice: Invoice }>(`/billing/${inv.id}`);
      setDetail(data.invoice);
      setPayAmount(String(data.invoice.balance));
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setDetailLoading(false);
    }
  }

  async function pay() {
    if (!detail) return;
    setPaying(true);
    setPayError("");
    try {
      const data = await api.post<{ invoice: Invoice }>(`/billing/${detail.id}/payments`, {
        amount: Number(payAmount),
        method: payMethod,
        reference: payRef,
      });
      setDetail(data.invoice);
      setPayAmount(String(data.invoice.balance));
      setPayRef("");
      toast.success(`Payment recorded — ${money(Number(payAmount), "KES")}`);
      await load();
    } catch (err) {
      setPayError((err as ApiError).message);
    } finally {
      setPaying(false);
    }
  }

  async function voidInvoice() {
    if (!detail) return;
    if (!window.confirm("Void this invoice? Only possible when no payments are recorded.")) return;
    try {
      await api.post(`/billing/${detail.id}/void`);
      toast.success("Invoice voided");
      setSelected(null);
      setDetail(null);
      await load();
    } catch (err) {
      toast.error((err as Error).message);
    }
  }

  function addServiceToInvoice(serviceId: string) {
    const svc = services.find((s) => s.id === serviceId);
    if (!svc) return;
    setCreateForm({
      ...createForm,
      items: [...createForm.items, { description: svc.name, quantity: 1, unitPrice: svc.price }],
    });
  }

  return (
    <>
      <PageHeader
        title="Billing & payments"
        subtitle="Invoices, part-payments and balances"
        actions={
          canWrite ? (
            <button className="btn btn-primary" onClick={() => setShowCreate(true)}>
              <Icon name="plus" size={15} /> Create invoice
            </button>
          ) : null
        }
      />

      <div className="grid-4">
        <MetricCard label="Total billed" value={money(summary.billed, "KES")} icon={<Icon name="billing" size={17} />} />
        <MetricCard
          label="Collected"
          value={money(summary.collected, "KES")}
          icon={<Icon name="check" size={17} />}
          tint="var(--teal-050)"
          color="var(--teal-600)"
        />
        <MetricCard
          label="Outstanding"
          value={money(summary.outstanding, "KES")}
          icon={<Icon name="alert" size={17} />}
          tint="var(--amber-050)"
          color="var(--amber-600)"
        />
        <MetricCard
          label="Unpaid invoices"
          value={summary.unpaidCount}
          icon={<Icon name="clock" size={17} />}
          tint="var(--red-050)"
          color="var(--red-600)"
        />
      </div>

      <div className="filters">
        <SearchBox value={search} onChange={setSearch} placeholder="Search patient or invoice…" width={280} />
        <Tabs
          options={[
            { key: "All", label: "All" },
            { key: "Unpaid", label: "Unpaid" },
            { key: "Partial", label: "Partial" },
            { key: "Paid", label: "Paid" },
            { key: "Void", label: "Void" },
          ]}
          value={status}
          onChange={setStatus}
        />
      </div>

      {error ? <div className="alert alert-error">{error}</div> : null}

      <div className="card card-flush">
        {loading ? (
          <PageLoader label="Loading invoices…" />
        ) : invoices.length === 0 ? (
          <EmptyState
            icon="💳"
            title="No invoices yet"
            hint="Raise an invoice from here, or for a pharmacy sale use the till in Pharmacy."
            action={
              canWrite ? (
                <button className="btn btn-primary btn-sm" onClick={() => setShowCreate(true)}>
                  Create the first invoice
                </button>
              ) : null
            }
          />
        ) : (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Invoice</th>
                  <th>Patient</th>
                  <th>Issued</th>
                  <th className="num">Total</th>
                  <th className="num">Paid</th>
                  <th className="num">Balance</th>
                  <th>Status</th>
                  <th style={{ textAlign: "right" }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {invoices.map((inv) => (
                  <tr key={inv.id}>
                    <td>
                      <code className="mono">{inv.reference}</code>
                    </td>
                    <td>
                      <div className="strong" style={{ fontSize: 13 }}>
                        {inv.patientName}
                      </div>
                      <div className="small muted">{inv.patientReference}</div>
                    </td>
                    <td className="small">{formatDate(inv.issuedAt)}</td>
                    <td className="num">{money(inv.total, "KES")}</td>
                    <td className="num" style={{ color: "var(--teal-600)" }}>
                      {money(inv.amountPaid, "KES")}
                    </td>
                    <td className="num" style={{ color: inv.balance > 0 ? "var(--red-600)" : "inherit" }}>
                      {money(inv.balance, "KES")}
                    </td>
                    <td>
                      <Badge status={inv.status} />
                    </td>
                    <td>
                      <div className="table-actions">
                        <button className="btn btn-outline btn-sm" onClick={() => openInvoice(inv)}>
                          {inv.status === "Unpaid" || inv.status === "Partial" ? "Collect" : "View"}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* -------------------------------------------------- create invoice */}
      {showCreate ? (
        <Modal
          title="Create an invoice"
          subtitle="VAT is applied automatically from clinic settings"
          onClose={() => setShowCreate(false)}
          wide
          footer={
            <>
              <button className="btn btn-outline" onClick={() => setShowCreate(false)}>
                Cancel
              </button>
              <button
                className="btn btn-primary"
                onClick={create}
                disabled={saving || !createForm.patientId || subtotal <= 0}
              >
                {saving ? <span className="spinner" /> : null}
                {saving ? "Creating…" : `Create invoice · ${money(total, "KES")}`}
              </button>
            </>
          }
        >
          {formError ? <div className="alert alert-error">{formError}</div> : null}
          <div className="form-group">
            <label className="form-label" htmlFor="patient">
              Patient <span className="req">*</span>
            </label>
            <select id="patient" className="input" value={createForm.patientId} onChange={(e) => setCreateForm({ ...createForm, patientId: e.target.value })}>
              <option value="">Choose a patient…</option>
              {patients.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} — {p.reference}
                </option>
              ))}
            </select>
          </div>

          {services.length > 0 ? (
            <div className="form-group">
              <label className="form-label" htmlFor="quick-add-from-the-service-cat">Quick add from the service catalogue</label>
              <select id="quick-add-from-the-service-cat" className="input" value="" onChange={(e) => addServiceToInvoice(e.target.value)}>
                <option value="">Choose a service to add…</option>
                {services.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name} — {money(s.price, "KES")}
                  </option>
                ))}
              </select>
            </div>
          ) : null}

          <label className="form-label" htmlFor="line-items">Line items</label>
          {createForm.items.map((item, idx) => (
            <div key={idx} className="row" style={{ gap: 8, marginBottom: 8, alignItems: "flex-start" }}>
              <input id="line-items"
                className="input"
                style={{ flex: 2 }}
                placeholder="Description (e.g. Consultation)"
                value={item.description}
                onChange={(e) => {
                  const items = [...createForm.items];
                  items[idx] = { ...item, description: e.target.value };
                  setCreateForm({ ...createForm, items });
                }}
              />
              <input
                className="input"
                style={{ width: 74 }}
                type="number"
                min={1}
                value={item.quantity}
                onChange={(e) => {
                  const items = [...createForm.items];
                  items[idx] = { ...item, quantity: Math.max(1, Number(e.target.value) || 1) };
                  setCreateForm({ ...createForm, items });
                }}
              />
              <input
                className="input"
                style={{ width: 120 }}
                type="number"
                min={0}
                placeholder="Unit price"
                value={item.unitPrice}
                onChange={(e) => {
                  const items = [...createForm.items];
                  items[idx] = { ...item, unitPrice: Math.max(0, Number(e.target.value) || 0) };
                  setCreateForm({ ...createForm, items });
                }}
              />
              <button
                className="btn btn-ghost btn-sm"
                style={{ padding: "10px 8px" }}
                onClick={() => {
                  if (createForm.items.length === 1) return;
                  setCreateForm({ ...createForm, items: createForm.items.filter((_, i) => i !== idx) });
                }}
                disabled={createForm.items.length === 1}
                aria-label="Remove line"
              >
                <Icon name="close" size={15} />
              </button>
            </div>
          ))}
          <button
            className="btn btn-outline btn-sm"
            onClick={() => setCreateForm({ ...createForm, items: [...createForm.items, { description: "", quantity: 1, unitPrice: 0 }] })}
          >
            <Icon name="plus" size={13} /> Add line
          </button>

          <div className="divider" />
          <div className="summary-line">
            <span>Subtotal</span>
            <span>{money(subtotal, "KES")}</span>
          </div>
          <div className="summary-line">
            <span>VAT ({Math.round(vatRate * 100)}%)</span>
            <span>{money(vat, "KES")}</span>
          </div>
          <div className="summary-line" style={{ fontSize: 15 }}>
            <span className="strong">Total</span>
            <span className="strong">{money(total, "KES")}</span>
          </div>
          <div className="form-group" style={{ marginTop: 14 }}>
            <label className="form-label" htmlFor="notes">Notes</label>
            <input id="notes" className="input" value={createForm.notes} onChange={(e) => setCreateForm({ ...createForm, notes: e.target.value })} />
          </div>
        </Modal>
      ) : null}

      {/* ------------------------------------------------------ detail/pay */}
      {selected ? (
        <Modal
          title={`Invoice ${detail?.reference ?? selected.reference}`}
          subtitle={detail?.patientName ?? selected.patientName}
          onClose={() => {
            setSelected(null);
            setDetail(null);
          }}
          footer={
            <>
              {canWrite && detail && detail.balance > 0 && detail.status !== "Void" ? (
                <button className="btn btn-danger btn-sm" onClick={voidInvoice}>
                  Void invoice
                </button>
              ) : null}
              <span style={{ flex: 1 }} />
              <button
                className="btn btn-outline"
                onClick={() => {
                  setSelected(null);
                  setDetail(null);
                }}
              >
                Close
              </button>
              {canWrite && detail && detail.balance > 0 && detail.status !== "Void" ? (
                <button className="btn btn-primary" onClick={pay} disabled={paying || Number(payAmount) <= 0}>
                  {paying ? <span className="spinner" /> : null}
                  {paying ? "Recording…" : `Record ${money(Number(payAmount) || 0, "KES")}`}
                </button>
              ) : null}
            </>
          }
        >
          {detailLoading ? (
            <PageLoader label="Loading invoice…" />
          ) : !detail ? null : (
            <>
              <div className="row" style={{ marginBottom: 14 }}>
                <Badge status={detail.status} />
                <span className="small muted">Issued {formatDate(detail.issuedAt)}</span>
              </div>

              {detail.items?.map((item) => (
                <div key={item.id} className="summary-line">
                  <span>
                    {item.description} × {item.quantity}
                  </span>
                  <span>{money(item.subtotal, "KES")}</span>
                </div>
              ))}
              <div className="divider" />
              <DetailRow label="Subtotal" value={money(detail.subtotal, "KES")} />
              <DetailRow label="VAT" value={money(detail.vatAmount, "KES")} />
              <DetailRow label="Total" value={<strong>{money(detail.total, "KES")}</strong>} />
              <DetailRow label="Paid" value={<span style={{ color: "var(--teal-600)" }}>{money(detail.amountPaid, "KES")}</span>} />
              <DetailRow
                label="Balance due"
                value={
                  <strong style={{ color: detail.balance > 0 ? "var(--red-600)" : "var(--teal-600)" }}>
                    {money(detail.balance, "KES")}
                  </strong>
                }
              />

              <div className="divider" />
              <h4 style={{ fontSize: 13.5, marginBottom: 8 }}>Payments</h4>
              {!detail.payments || detail.payments.length === 0 ? (
                <p className="small muted">No payments recorded yet.</p>
              ) : (
                detail.payments.map((p) => (
                  <div className="stat-row" key={p.id}>
                    <div style={{ flex: 1 }}>
                      <div className="strong small">
                        {money(p.amount, "KES")} · {p.method}
                        {p.reference ? ` · ${p.reference}` : ""}
                      </div>
                      <div className="small muted">
                        {formatDateTime(p.receivedAt)}
                        {p.receivedByName ? ` · by ${p.receivedByName}` : ""}
                      </div>
                    </div>
                  </div>
                ))
              )}

              {canWrite && detail.balance > 0 && detail.status !== "Void" ? (
                <>
                  <div className="divider" />
                  <label className="form-label" htmlFor="take-a-payment">Take a payment</label>
                  {payError ? <div className="alert alert-error">{payError}</div> : null}
                  <div className="form-row">
                    <div className="form-group">
                      <input id="take-a-payment"
                        className="input"
                        type="number"
                        min={0}
                        value={payAmount}
                        onChange={(e) => setPayAmount(e.target.value)}
                        placeholder="Amount"
                      />
                    </div>
                    <div className="form-group">
                      <input
                        className="input"
                        value={payRef}
                        onChange={(e) => setPayRef(e.target.value)}
                        placeholder="Reference (M-Pesa code, receipt no.)"
                      />
                    </div>
                  </div>
                  <div className="pay-grid">
                    {METHODS.map((m) => (
                      <button
                        key={m}
                        className={`pay-btn ${payMethod === m ? "selected" : ""}`}
                        onClick={() => setPayMethod(m)}
                      >
                        {m}
                      </button>
                    ))}
                  </div>
                </>
              ) : null}
            </>
          )}
        </Modal>
      ) : null}
    </>
  );
}
