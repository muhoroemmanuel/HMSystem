import { useCallback, useEffect, useMemo, useState } from "react";
import { api, ApiError } from "../lib/api";
import { formatDate, formatDateTime, money } from "../lib/format";
import {
  Badge,
  EmptyState,
  Icon,
  Modal,
  PageHeader,
  PageLoader,
  SearchBox,
  Tabs,
} from "../components/ui";
import { useToast } from "../context/ToastContext";
import { useAuth } from "../context/AuthContext";

interface Drug {
  id: string;
  name: string;
  genericName: string;
  category: string;
  form: string;
  strength: string;
  price: number;
  stock: number;
  minStock: number;
  supplier: string;
  expiryDate: string | null;
  prescriptionRequired: boolean;
  barcode: string | null;
  isActive: boolean;
  lowStock: boolean;
}

interface SaleItem {
  drugId: string;
  drugName: string;
  quantity: number;
  unitPrice: number;
  subtotal: number;
}

interface Sale {
  id: string;
  reference: string;
  customerName: string;
  subtotal: number;
  discount: number;
  vatAmount: number;
  total: number;
  paymentMethod: string;
  prescriptionRequired: boolean;
  soldAt: string;
  soldByName: string | null;
  items?: SaleItem[];
}

interface Prescription {
  id: string;
  reference: string;
  patientName: string;
  doctorName: string;
  status: "Pending" | "Dispensed" | "Cancelled";
  issuedAt: string;
  items: { id: string; drugId: string; drugName: string; quantity: number; dosage: string }[];
}

interface Patient {
  id: string;
  name: string;
  reference: string;
}

interface Doctor {
  id: string;
  name: string;
}

const PAY_METHODS = ["M-Pesa", "Cash", "Card", "Insurance", "Bank"] as const;

const EMPTY_DRUG = {
  name: "",
  genericName: "",
  category: "General",
  form: "Tablet",
  strength: "",
  price: 0,
  stock: 0,
  minStock: 10,
  supplier: "",
  expiryDate: "",
  prescriptionRequired: false,
  barcode: "",
  isActive: true,
};

export default function PharmacyPage() {
  const toast = useToast();
  const { can } = useAuth();
  const canWrite = can("pharmacy.write");

  const [tab, setTab] = useState("pos");
  const [drugs, setDrugs] = useState<Drug[]>([]);
  const [sales, setSales] = useState<Sale[]>([]);
  const [prescriptions, setPrescriptions] = useState<Prescription[]>([]);
  const [patients, setPatients] = useState<Patient[]>([]);
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [vatRate, setVatRate] = useState(0.16);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("All");

  const [cart, setCart] = useState<{ drugId: string; quantity: number }[]>([]);
  const [customer, setCustomer] = useState("");
  const [payMethod, setPayMethod] = useState<(typeof PAY_METHODS)[number]>("M-Pesa");
  const [discount, setDiscount] = useState(0);
  const [checkingOut, setCheckingOut] = useState(false);
  const [receipt, setReceipt] = useState<Sale | null>(null);

  const [showDrugForm, setShowDrugForm] = useState(false);
  const [editingDrug, setEditingDrug] = useState<Drug | null>(null);
  const [drugForm, setDrugForm] = useState({ ...EMPTY_DRUG });
  const [savingDrug, setSavingDrug] = useState(false);
  const [drugError, setDrugError] = useState("");

  const [showRxForm, setShowRxForm] = useState(false);
  const [rxForm, setRxForm] = useState({
    patientId: "",
    doctorId: "",
    notes: "",
    items: [{ drugId: "", quantity: 1, dosage: "" }],
  });
  const [savingRx, setSavingRx] = useState(false);
  const [rxError, setRxError] = useState("");

  const loadAll = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [d, s, p] = await Promise.all([
        api.get<{ drugs: Drug[] }>("/pharmacy/drugs"),
        api.get<{ sales: Sale[] }>("/pharmacy/sales"),
        api.get<{ prescriptions: Prescription[] }>("/pharmacy/prescriptions"),
      ]);
      setDrugs(d.drugs);
      setSales(s.sales);
      setPrescriptions(p.prescriptions);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadAll();
    api
      .get<{ patients: Patient[] }>("/patients?limit=300")
      .then((d) => setPatients(d.patients))
      .catch(() => undefined);
    api
      .get<{ doctors: Doctor[] }>("/doctors")
      .then((d) => setDoctors(d.doctors))
      .catch(() => undefined);
    api
      .get<{ settings: { vatRate: number } | null }>("/settings")
      .then((d) => {
        if (d.settings) setVatRate(d.settings.vatRate);
      })
      .catch(() => undefined);
  }, [loadAll]);

  const categories = useMemo(() => {
    const set = new Set(drugs.map((d) => d.category).filter(Boolean));
    return ["All", ...Array.from(set).sort()];
  }, [drugs]);

  const filtered = drugs.filter(
    (d) =>
      (category === "All" || d.category === category) &&
      (d.name.toLowerCase().includes(search.toLowerCase()) ||
        d.genericName.toLowerCase().includes(search.toLowerCase()) ||
        (d.barcode || "").includes(search)),
  );

  const cartLines = cart
    .map((c) => {
      const drug = drugs.find((d) => d.id === c.drugId);
      return drug ? { drug, quantity: c.quantity } : null;
    })
    .filter(Boolean) as { drug: Drug; quantity: number }[];

  const subtotal = cartLines.reduce((s, l) => s + l.drug.price * l.quantity, 0);
  const vat = Math.round((subtotal - Math.min(discount, subtotal)) * vatRate * 100) / 100;
  const total = Math.round((subtotal - Math.min(discount, subtotal) + vat) * 100) / 100;
  const lowStock = drugs.filter((d) => d.isActive && d.stock <= d.minStock).length;

  function addToCart(drug: Drug) {
    if (drug.stock <= 0) return;
    const existing = cart.find((c) => c.drugId === drug.id);
    if (existing) {
      if (existing.quantity >= drug.stock) {
        toast.error(`Only ${drug.stock} in stock`);
        return;
      }
      setCart(cart.map((c) => (c.drugId === drug.id ? { ...c, quantity: c.quantity + 1 } : c)));
    } else {
      setCart([...cart, { drugId: drug.id, quantity: 1 }]);
    }
  }

  function changeQty(drugId: string, delta: number) {
    const drug = drugs.find((d) => d.id === drugId);
    setCart(
      cart
        .map((c) => {
          if (c.drugId !== drugId) return c;
          const next = c.quantity + delta;
          if (drug && next > drug.stock) {
            toast.error(`Only ${drug.stock} in stock`);
            return c;
          }
          return { ...c, quantity: next };
        })
        .filter((c) => c.quantity > 0),
    );
  }

  async function checkout() {
    setCheckingOut(true);
    try {
      const patient = patients.find((p) => p.id === customer);
      const data = await api.post<{ sale: Sale }>("/pharmacy/sales", {
        patientId: patient?.id ?? null,
        customerName: patient?.name,
        items: cart.map((c) => ({ drugId: c.drugId, quantity: c.quantity })),
        discount,
        paymentMethod: payMethod,
      });
      setReceipt(data.sale);
      setCart([]);
      setDiscount(0);
      setCustomer("");
      await loadAll();
    } catch (err) {
      toast.error((err as ApiError).message);
    } finally {
      setCheckingOut(false);
    }
  }

  function openDrugCreate() {
    setEditingDrug(null);
    setDrugForm({ ...EMPTY_DRUG });
    setDrugError("");
    setShowDrugForm(true);
  }

  function openDrugEdit(d: Drug) {
    setEditingDrug(d);
    setDrugForm({
      name: d.name,
      genericName: d.genericName,
      category: d.category,
      form: d.form,
      strength: d.strength,
      price: d.price,
      stock: d.stock,
      minStock: d.minStock,
      supplier: d.supplier,
      expiryDate: d.expiryDate || "",
      prescriptionRequired: d.prescriptionRequired,
      barcode: d.barcode || "",
      isActive: d.isActive,
    });
    setDrugError("");
    setShowDrugForm(true);
  }

  async function saveDrug() {
    setSavingDrug(true);
    setDrugError("");
    const payload = {
      ...drugForm,
      expiryDate: drugForm.expiryDate || null,
      barcode: drugForm.barcode || null,
    };
    try {
      if (editingDrug) {
        await api.patch(`/pharmacy/drugs/${editingDrug.id}`, payload);
        toast.success("Drug updated");
      } else {
        await api.post("/pharmacy/drugs", payload);
        toast.success("Drug added to inventory");
      }
      setShowDrugForm(false);
      await loadAll();
    } catch (err) {
      setDrugError((err as ApiError).message);
    } finally {
      setSavingDrug(false);
    }
  }

  async function saveRx() {
    setSavingRx(true);
    setRxError("");
    try {
      await api.post("/pharmacy/prescriptions", {
        patientId: rxForm.patientId,
        doctorId: rxForm.doctorId,
        notes: rxForm.notes,
        items: rxForm.items.filter((i) => i.drugId),
      });
      toast.success("Prescription recorded");
      setShowRxForm(false);
      setRxForm({ patientId: "", doctorId: "", notes: "", items: [{ drugId: "", quantity: 1, dosage: "" }] });
      await loadAll();
    } catch (err) {
      setRxError((err as ApiError).message);
    } finally {
      setSavingRx(false);
    }
  }

  async function dispense(rx: Prescription) {
    try {
      await api.post(`/pharmacy/prescriptions/${rx.id}/dispense`);
      toast.success(`${rx.reference} dispensed — stock updated`);
      await loadAll();
    } catch (err) {
      toast.error((err as Error).message);
    }
  }

  return (
    <>
      <PageHeader
        title="Pharmacy"
        subtitle={`${drugs.length} products · ${lowStock} low-stock alert${lowStock === 1 ? "" : "s"}`}
        actions={
          <>
            <Tabs
              options={[
                { key: "pos", label: "Till" },
                { key: "prescriptions", label: "Prescriptions", count: prescriptions.filter((p) => p.status === "Pending").length },
                { key: "sales", label: "Sales" },
                { key: "inventory", label: "Inventory" },
              ]}
              value={tab}
              onChange={setTab}
            />
            {canWrite && tab === "inventory" ? (
              <button className="btn btn-primary" onClick={openDrugCreate}>
                <Icon name="plus" size={15} /> Add drug
              </button>
            ) : null}
            {canWrite && tab === "prescriptions" ? (
              <button className="btn btn-primary" onClick={() => setShowRxForm(true)}>
                <Icon name="plus" size={15} /> New prescription
              </button>
            ) : null}
          </>
        }
      />

      {error ? <div className="alert alert-error">{error}</div> : null}

      {loading ? <PageLoader label="Loading pharmacy…" /> : null}

      {/* ------------------------------------------------------------- till */}
      {!loading && tab === "pos" ? (
        drugs.length === 0 ? (
          <div className="card">
            <EmptyState
              icon="💊"
              title="No stock in the pharmacy yet"
              hint="Add your first product in Inventory before making a sale."
              action={
                canWrite ? (
                  <button className="btn btn-primary btn-sm" onClick={openDrugCreate}>
                    Add a drug
                  </button>
                ) : null
              }
            />
          </div>
        ) : (
          <div className="pos-layout">
            <div>
              <div className="filters" style={{ marginBottom: 12 }}>
                <SearchBox value={search} onChange={setSearch} placeholder="Search drug, generic or barcode…" width={300} />
                <select className="input" style={{ maxWidth: 190 }} value={category} onChange={(e) => setCategory(e.target.value)}>
                  {categories.map((c) => (
                    <option key={c}>{c}</option>
                  ))}
                </select>
              </div>
              <div className="drug-grid">
                {filtered.map((d) => (
                  <button
                    key={d.id}
                    className={`drug-tile ${d.stock <= 0 ? "" : d.stock <= d.minStock ? "low" : ""}`}
                    onClick={() => addToCart(d)}
                    disabled={d.stock <= 0 || !d.isActive}
                  >
                    {d.prescriptionRequired ? <span className="rx-badge">Rx</span> : null}
                    <span className="drug-name">{d.name}</span>
                    <span className="drug-generic">{d.genericName || d.category}</span>
                    <span className="drug-price">{money(d.price, "KES")}</span>
                    <span className="drug-stock">
                      {d.stock <= 0 ? "Out of stock" : `${d.stock} in stock`}
                      {d.expiryDate ? ` · exp ${formatDate(d.expiryDate)}` : ""}
                    </span>
                  </button>
                ))}
                {filtered.length === 0 ? (
                  <div className="empty" style={{ gridColumn: "1 / -1" }}>
                    No products match that search.
                  </div>
                ) : null}
              </div>
            </div>

            <div className="cart">
              <div className="cart-head">
                <span>🛒 Current sale</span>
                <span style={{ fontSize: 11, opacity: 0.6 }}>
                  {cartLines.length} item{cartLines.length === 1 ? "" : "s"}
                </span>
              </div>
              <div style={{ padding: 12, borderBottom: "1px solid var(--line-soft)" }}>
                <select className="input" value={customer} onChange={(e) => setCustomer(e.target.value)}>
                  <option value="">Walk-in customer</option>
                  {patients.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} — {p.reference}
                    </option>
                  ))}
                </select>
              </div>
              <div className="cart-body">
                {cartLines.length === 0 ? (
                  <div className="empty" style={{ padding: "26px 8px", fontSize: 12.5 }}>
                    <div className="empty-icon" style={{ fontSize: 24 }}>
                      🧺
                    </div>
                    Tap a product to add it
                  </div>
                ) : (
                  cartLines.map(({ drug, quantity }) => (
                    <div className="cart-line" key={drug.id}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div className="drug-name" style={{ paddingRight: 0 }}>
                          {drug.name}
                        </div>
                        <div className="drug-generic">{money(drug.price, "KES")} each</div>
                      </div>
                      <div className="qty-ctrl">
                        <button className="qty-btn" onClick={() => changeQty(drug.id, -1)}>
                          −
                        </button>
                        <span className="qty-num">{quantity}</span>
                        <button className="qty-btn" onClick={() => changeQty(drug.id, 1)}>
                          +
                        </button>
                      </div>
                      <div className="strong" style={{ minWidth: 64, textAlign: "right", fontSize: 12.5 }}>
                        {money(drug.price * quantity, "KES")}
                      </div>
                    </div>
                  ))
                )}
              </div>
              <div className="cart-foot">
                <div className="cart-line-total">
                  <span>Subtotal</span>
                  <span>{money(subtotal, "KES")}</span>
                </div>
                <div className="cart-line-total">
                  <span>Discount</span>
                  <input
                    className="input"
                    type="number"
                    min={0}
                    max={subtotal}
                    value={discount || ""}
                    onChange={(e) => setDiscount(Math.max(0, Number(e.target.value) || 0))}
                    style={{ width: 96, padding: "4px 8px", fontSize: 12, textAlign: "right" }}
                    placeholder="0"
                  />
                </div>
                <div className="cart-line-total">
                  <span>VAT ({Math.round(vatRate * 100)}%)</span>
                  <span>{money(vat, "KES")}</span>
                </div>
                <div className="cart-grand">
                  <span>Total</span>
                  <span>{money(total, "KES")}</span>
                </div>
                <div className="pay-grid">
                  {PAY_METHODS.map((m) => (
                    <button key={m} className={`pay-btn ${payMethod === m ? "selected" : ""}`} onClick={() => setPayMethod(m)}>
                      {m}
                    </button>
                  ))}
                </div>
                <button
                  className="btn btn-primary btn-block"
                  disabled={cartLines.length === 0 || checkingOut}
                  onClick={checkout}
                >
                  {checkingOut ? <span className="spinner" /> : null}
                  {checkingOut ? "Processing…" : `Charge ${money(total, "KES")}`}
                </button>
              </div>
            </div>
          </div>
        )
      ) : null}

      {/* ---------------------------------------------------- prescriptions */}
      {!loading && tab === "prescriptions" ? (
        <div className="stack">
          {prescriptions.length === 0 ? (
            <div className="card">
              <EmptyState icon="📋" title="No prescriptions yet" hint="Clinicians can record a prescription and pharmacy will dispense it here." />
            </div>
          ) : (
            prescriptions.map((rx) => (
              <div className="card" key={rx.id}>
                <div className="card-body">
                  <div className="row-between">
                    <div>
                      <div className="strong">
                        {rx.patientName} <span className="muted small">· {rx.reference}</span>
                      </div>
                      <div className="small muted">
                        {rx.doctorName} · {formatDate(rx.issuedAt)}
                      </div>
                    </div>
                    <Badge status={rx.status} />
                  </div>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 5, margin: "11px 0" }}>
                    {rx.items.map((i) => (
                      <span key={i.id} className="tag" style={{ background: "var(--blue-050)", color: "var(--blue-700)" }}>
                        {i.drugName} × {i.quantity}
                        {i.dosage ? ` · ${i.dosage}` : ""}
                      </span>
                    ))}
                  </div>
                  <div className="row-between">
                    <span className="small muted">
                      Total:{" "}
                      {money(
                        rx.items.reduce((s, i) => s + (drugs.find((d) => d.id === i.drugId)?.price ?? 0) * i.quantity, 0),
                        "KES",
                      )}
                    </span>
                    {rx.status === "Pending" && canWrite ? (
                      <button className="btn btn-primary btn-sm" onClick={() => dispense(rx)}>
                        Dispense
                      </button>
                    ) : null}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      ) : null}

      {/* ------------------------------------------------------------ sales */}
      {!loading && tab === "sales" ? (
        <div className="card card-flush">
          {sales.length === 0 ? (
            <EmptyState icon="🧾" title="No sales recorded" hint="Sales made at the till appear here." />
          ) : (
            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr>
                    <th>Reference</th>
                    <th>Customer</th>
                    <th>Items</th>
                    <th className="num">Total</th>
                    <th>Method</th>
                    <th>Sold</th>
                    <th>Rx</th>
                  </tr>
                </thead>
                <tbody>
                  {sales.map((s) => (
                    <tr key={s.id}>
                      <td>
                        <code className="mono">{s.reference}</code>
                      </td>
                      <td className="strong" style={{ fontSize: 13 }}>
                        {s.customerName}
                      </td>
                      <td className="small">{s.items?.map((i) => `${i.drugName} ×${i.quantity}`).join(", ") || "—"}</td>
                      <td className="num">{money(s.total, "KES")}</td>
                      <td>
                        <span className="tag">{s.paymentMethod}</span>
                      </td>
                      <td className="small">{formatDateTime(s.soldAt)}</td>
                      <td>
                        {s.prescriptionRequired ? (
                          <span className="tag" style={{ background: "var(--amber-050)", color: "var(--amber-600)" }}>
                            Rx
                          </span>
                        ) : (
                          <span className="muted">—</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      ) : null}

      {/* -------------------------------------------------------- inventory */}
      {!loading && tab === "inventory" ? (
        <div className="card card-flush">
          {drugs.length === 0 ? (
            <EmptyState
              icon="📦"
              title="Inventory is empty"
              hint="Add the medicines you stock so the till and prescriptions can use them."
              action={
                canWrite ? (
                  <button className="btn btn-primary btn-sm" onClick={openDrugCreate}>
                    Add the first drug
                  </button>
                ) : null
              }
            />
          ) : (
            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr>
                    <th>Product</th>
                    <th>Category</th>
                    <th className="num">Price</th>
                    <th className="num">Stock</th>
                    <th>Expiry</th>
                    <th>Status</th>
                    <th style={{ textAlign: "right" }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {drugs.map((d) => (
                    <tr key={d.id}>
                      <td>
                        <div className="strong" style={{ fontSize: 13 }}>
                          {d.name}
                        </div>
                        <div className="small muted">
                          {d.genericName} {d.strength ? `· ${d.strength}` : ""} {d.form}
                        </div>
                      </td>
                      <td className="small">{d.category}</td>
                      <td className="num">{money(d.price, "KES")}</td>
                      <td className="num">
                        {d.stock}
                        <span className="muted small"> / min {d.minStock}</span>
                      </td>
                      <td className="small">{formatDate(d.expiryDate)}</td>
                      <td>
                        {d.stock <= 0 ? (
                          <Badge status="Unpaid" label="Out of stock" />
                        ) : d.stock <= d.minStock ? (
                          <Badge status="Pending" label="Low stock" />
                        ) : (
                          <Badge status="Active" label={d.isActive ? "In stock" : "Inactive"} />
                        )}
                      </td>
                      <td>
                        <div className="table-actions">
                          {canWrite ? (
                            <button className="btn btn-ghost btn-sm" onClick={() => openDrugEdit(d)}>
                              Edit
                            </button>
                          ) : null}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      ) : null}

      {/* ------------------------------------------------------- drug modal */}
      {showDrugForm ? (
        <Modal
          title={editingDrug ? `Edit ${editingDrug.name}` : "Add a drug"}
          subtitle="Prices are per unit sold at the till"
          onClose={() => setShowDrugForm(false)}
          footer={
            <>
              <button className="btn btn-outline" onClick={() => setShowDrugForm(false)}>
                Cancel
              </button>
              <button className="btn btn-primary" onClick={saveDrug} disabled={savingDrug || !drugForm.name.trim()}>
                {savingDrug ? <span className="spinner" /> : null}
                {savingDrug ? "Saving…" : "Save product"}
              </button>
            </>
          }
        >
          {drugError ? <div className="alert alert-error">{drugError}</div> : null}
          <div className="form-row">
            <div className="form-group">
              <label className="form-label" htmlFor="product-name">
                Product name <span className="req">*</span>
              </label>
              <input id="product-name" className="input" value={drugForm.name} onChange={(e) => setDrugForm({ ...drugForm, name: e.target.value })} placeholder="Amlodipine 5mg" />
            </div>
            <div className="form-group">
              <label className="form-label" htmlFor="generic-name">Generic name</label>
              <input id="generic-name" className="input" value={drugForm.genericName} onChange={(e) => setDrugForm({ ...drugForm, genericName: e.target.value })} />
            </div>
          </div>
          <div className="form-row">
            <div className="form-group">
              <label className="form-label" htmlFor="category">Category</label>
              <input id="category" className="input" value={drugForm.category} onChange={(e) => setDrugForm({ ...drugForm, category: e.target.value })} />
            </div>
            <div className="form-group">
              <label className="form-label" htmlFor="form">Form</label>
              <select id="form" className="input" value={drugForm.form} onChange={(e) => setDrugForm({ ...drugForm, form: e.target.value })}>
                {["Tablet", "Capsule", "Syrup", "Injection", "Inhaler", "Cream", "Drops", "Other"].map((f) => (
                  <option key={f}>{f}</option>
                ))}
              </select>
            </div>
          </div>
          <div className="form-row">
            <div className="form-group">
              <label className="form-label" htmlFor="strength">Strength</label>
              <input id="strength" className="input" value={drugForm.strength} onChange={(e) => setDrugForm({ ...drugForm, strength: e.target.value })} placeholder="5mg" />
            </div>
            <div className="form-group">
              <label className="form-label" htmlFor="unit-price-kes">Unit price (KES)</label>
              <input id="unit-price-kes" className="input" type="number" min={0} value={drugForm.price} onChange={(e) => setDrugForm({ ...drugForm, price: Number(e.target.value) || 0 })} />
            </div>
          </div>
          <div className="form-row">
            <div className="form-group">
              <label className="form-label" htmlFor="stock-on-hand">Stock on hand</label>
              <input id="stock-on-hand" className="input" type="number" min={0} value={drugForm.stock} onChange={(e) => setDrugForm({ ...drugForm, stock: Number(e.target.value) || 0 })} />
            </div>
            <div className="form-group">
              <label className="form-label" htmlFor="reorder-level">Reorder level</label>
              <input id="reorder-level" className="input" type="number" min={0} value={drugForm.minStock} onChange={(e) => setDrugForm({ ...drugForm, minStock: Number(e.target.value) || 0 })} />
            </div>
          </div>
          <div className="form-row">
            <div className="form-group">
              <label className="form-label" htmlFor="expiry-date">Expiry date</label>
              <input id="expiry-date" className="input" type="date" value={drugForm.expiryDate} onChange={(e) => setDrugForm({ ...drugForm, expiryDate: e.target.value })} />
            </div>
            <div className="form-group">
              <label className="form-label" htmlFor="supplier">Supplier</label>
              <input id="supplier" className="input" value={drugForm.supplier} onChange={(e) => setDrugForm({ ...drugForm, supplier: e.target.value })} />
            </div>
          </div>
          <div className="form-group">
            <label className="form-label" htmlFor="barcode-optional">Barcode (optional)</label>
            <input id="barcode-optional" className="input" value={drugForm.barcode} onChange={(e) => setDrugForm({ ...drugForm, barcode: e.target.value })} />
          </div>
          <label className="checkbox">
            <input
              type="checkbox"
              checked={drugForm.prescriptionRequired}
              onChange={(e) => setDrugForm({ ...drugForm, prescriptionRequired: e.target.checked })}
            />
            <span>Prescription required before dispensing</span>
          </label>
          <label className="checkbox" style={{ marginTop: 8 }}>
            <input type="checkbox" checked={drugForm.isActive} onChange={(e) => setDrugForm({ ...drugForm, isActive: e.target.checked })} />
            <span>Available at the till</span>
          </label>
        </Modal>
      ) : null}

      {/* --------------------------------------------------------- rx modal */}
      {showRxForm ? (
        <Modal
          title="Record a prescription"
          subtitle="Stock is deducted when the pharmacy dispenses it"
          onClose={() => setShowRxForm(false)}
          footer={
            <>
              <button className="btn btn-outline" onClick={() => setShowRxForm(false)}>
                Cancel
              </button>
              <button
                className="btn btn-primary"
                onClick={saveRx}
                disabled={savingRx || !rxForm.patientId || !rxForm.doctorId || !rxForm.items.some((i) => i.drugId)}
              >
                {savingRx ? <span className="spinner" /> : null}
                {savingRx ? "Saving…" : "Save prescription"}
              </button>
            </>
          }
        >
          {rxError ? <div className="alert alert-error">{rxError}</div> : null}
          <div className="form-row">
            <div className="form-group">
              <label className="form-label" htmlFor="patient">
                Patient <span className="req">*</span>
              </label>
              <select id="patient" className="input" value={rxForm.patientId} onChange={(e) => setRxForm({ ...rxForm, patientId: e.target.value })}>
                <option value="">Choose…</option>
                {patients.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} — {p.reference}
                  </option>
                ))}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label" htmlFor="prescribing-clinician">
                Prescribing clinician <span className="req">*</span>
              </label>
              <select id="prescribing-clinician" className="input" value={rxForm.doctorId} onChange={(e) => setRxForm({ ...rxForm, doctorId: e.target.value })}>
                <option value="">Choose…</option>
                {doctors.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <label className="form-label" htmlFor="medicines">Medicines</label>
          {rxForm.items.map((item, idx) => (
            <div key={idx} className="row" style={{ gap: 8, marginBottom: 8, alignItems: "flex-start", flexWrap: "wrap" }}>
              <select id="medicines"
                className="input"
                style={{ flex: 2, minWidth: 180 }}
                value={item.drugId}
                onChange={(e) => {
                  const items = [...rxForm.items];
                  items[idx] = { ...item, drugId: e.target.value };
                  setRxForm({ ...rxForm, items });
                }}
              >
                <option value="">Choose a drug…</option>
                {drugs.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name} ({d.stock} left)
                  </option>
                ))}
              </select>
              <input
                className="input"
                style={{ width: 80 }}
                type="number"
                min={1}
                value={item.quantity}
                onChange={(e) => {
                  const items = [...rxForm.items];
                  items[idx] = { ...item, quantity: Math.max(1, Number(e.target.value) || 1) };
                  setRxForm({ ...rxForm, items });
                }}
              />
              <input
                className="input"
                style={{ width: 150 }}
                placeholder="Dosage (1 tab BD)"
                value={item.dosage}
                onChange={(e) => {
                  const items = [...rxForm.items];
                  items[idx] = { ...item, dosage: e.target.value };
                  setRxForm({ ...rxForm, items });
                }}
              />
              <button
                className="btn btn-ghost btn-sm"
                style={{ padding: "10px 8px" }}
                disabled={rxForm.items.length === 1}
                onClick={() => setRxForm({ ...rxForm, items: rxForm.items.filter((_, i) => i !== idx) })}
              >
                <Icon name="close" size={15} />
              </button>
            </div>
          ))}
          <button
            className="btn btn-outline btn-sm"
            onClick={() => setRxForm({ ...rxForm, items: [...rxForm.items, { drugId: "", quantity: 1, dosage: "" }] })}
          >
            <Icon name="plus" size={13} /> Add medicine
          </button>
          <div className="form-group" style={{ marginTop: 14 }}>
            <label className="form-label" htmlFor="notes">Notes</label>
            <textarea id="notes" className="input" value={rxForm.notes} onChange={(e) => setRxForm({ ...rxForm, notes: e.target.value })} />
          </div>
        </Modal>
      ) : null}

      {/* ----------------------------------------------------------- receipt */}
      {receipt ? (
        <Modal title="Sale complete" onClose={() => setReceipt(null)} footer={
          <button className="btn btn-primary" onClick={() => setReceipt(null)}>
            New sale
          </button>
        }>
          <div style={{ textAlign: "center", marginBottom: 16 }}>
            <div style={{ fontSize: 34 }}>✅</div>
            <div className="strong" style={{ fontSize: 16, marginTop: 4 }}>
              {money(receipt.total, "KES")} received
            </div>
            <div className="small muted">
              {receipt.reference} · {receipt.paymentMethod}
            </div>
          </div>
          <div className="confirm-box" style={{ margin: 0 }}>
            {receipt.items?.map((i) => (
              <div key={i.drugId} className="summary-line">
                <span>
                  {i.drugName} × {i.quantity}
                </span>
                <span>{money(i.subtotal, "KES")}</span>
              </div>
            ))}
            <div className="summary-line">
              <span>Customer</span>
              <span>{receipt.customerName}</span>
            </div>
            <div className="summary-line">
              <span>VAT</span>
              <span>{money(receipt.vatAmount, "KES")}</span>
            </div>
            <div className="summary-line">
              <span className="strong">Total</span>
              <span className="strong">{money(receipt.total, "KES")}</span>
            </div>
          </div>
        </Modal>
      ) : null}
    </>
  );
}
