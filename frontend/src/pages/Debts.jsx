import { useEffect, useState } from "react";
import { api } from "../api/client.js";
import Switch from "../components/Switch.jsx";

function rupees(n) {
  return `₹${Number(n).toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;
}

function formatNice(dateStr) {
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString(undefined, { day: "numeric", month: "short" });
}

export default function Debts() {
  const [debts, setDebts] = useState([]);
  const [showSettled, setShowSettled] = useState(false);
  const [form, setForm] = useState({ personName: "", amount: "", direction: "owed_to_me", note: "" });

  async function refresh() {
    const d = await api.get("/debts");
    setDebts(d.debts);
  }

  useEffect(() => {
    refresh().catch(() => {});
  }, []);

  async function addDebt(e) {
    e.preventDefault();
    if (!form.personName.trim() || !form.amount || Number(form.amount) <= 0) return;
    await api.post("/debts", { ...form, amount: Number(form.amount) });
    setForm({ personName: "", amount: "", direction: form.direction, note: "" });
    refresh();
  }

  async function settle(id) {
    await api.post(`/debts/${id}/settle`);
    refresh();
  }

  async function unsettle(id) {
    await api.post(`/debts/${id}/unsettle`);
    refresh();
  }

  async function removeDebt(id) {
    await api.del(`/debts/${id}`);
    refresh();
  }

  const active = debts.filter((d) => !d.settled);
  const settled = debts.filter((d) => d.settled);
  const owedToMe = active.filter((d) => d.direction === "owed_to_me").reduce((s, d) => s + Number(d.amount), 0);
  const iOwe = active.filter((d) => d.direction === "i_owe").reduce((s, d) => s + Number(d.amount), 0);
  const visible = showSettled ? [...active, ...settled] : active;

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Debts</h1>
          <p className="page-subtitle">Who owes what — settle up whenever, no math required.</p>
        </div>
        <Switch checked={showSettled} onChange={setShowSettled} label="Show settled" />
      </div>

      <div className="grid grid-2" style={{ marginBottom: 20 }}>
        <div className="card">
          <div className="label">Owed to me</div>
          <div className="stat-num" style={{ color: "var(--present)" }}>{rupees(owedToMe)}</div>
        </div>
        <div className="card">
          <div className="label">I owe</div>
          <div className="stat-num" style={{ color: "var(--absent)" }}>{rupees(iOwe)}</div>
        </div>
      </div>

      <form onSubmit={addDebt} className="card" style={{ marginBottom: 20 }}>
        <div className="label" style={{ marginBottom: 12 }}>Add an entry</div>
        <div style={{ display: "flex", gap: 8, marginBottom: 10, flexWrap: "wrap" }}>
          <button
            type="button"
            className={form.direction === "owed_to_me" ? "btn" : "btn-ghost btn"}
            style={{ background: form.direction === "owed_to_me" ? "var(--present)" : undefined, borderColor: form.direction === "owed_to_me" ? "var(--present)" : undefined }}
            onClick={() => setForm((f) => ({ ...f, direction: "owed_to_me" }))}
          >
            They owe me
          </button>
          <button
            type="button"
            className={form.direction === "i_owe" ? "btn" : "btn-ghost btn"}
            style={{ background: form.direction === "i_owe" ? "var(--absent)" : undefined, borderColor: form.direction === "i_owe" ? "var(--absent)" : undefined }}
            onClick={() => setForm((f) => ({ ...f, direction: "i_owe" }))}
          >
            I owe them
          </button>
        </div>
        <div style={{ display: "flex", gap: 8, marginBottom: 10, flexWrap: "wrap" }}>
          <input className="input" placeholder="Person's name" value={form.personName} onChange={(e) => setForm((f) => ({ ...f, personName: e.target.value }))} style={{ flex: "1 1 140px" }} required />
          <input className="input" type="number" min="0.01" step="0.01" placeholder="Amount (₹)" value={form.amount} onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))} style={{ flex: "1 1 120px" }} required />
        </div>
        <input className="input" placeholder="What for? (optional)" value={form.note} onChange={(e) => setForm((f) => ({ ...f, note: e.target.value }))} style={{ marginBottom: 10 }} />
        <button className="btn" type="submit" style={{ width: "100%" }}>Add</button>
      </form>

      <div className="card">
        <div className="label" style={{ marginBottom: 12 }}>All entries</div>
        {visible.length === 0 && <div className="empty-state">Nothing here yet.</div>}
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {visible.map((d) => (
            <div
              key={d.id}
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                gap: 10,
                flexWrap: "wrap",
                padding: "10px 12px",
                borderRadius: 8,
                background: "var(--bg-elevated)",
                opacity: d.settled ? 0.6 : 1,
              }}
            >
              <div style={{ minWidth: 0, flex: "1 1 160px" }}>
                <div style={{ fontSize: 14, fontWeight: 600, wordBreak: "break-word" }}>
                  {d.person_name}
                  {d.settled && <span style={{ color: "var(--text-muted)", fontWeight: 400 }}> · settled</span>}
                </div>
                <div style={{ fontSize: 12, color: "var(--text-muted)" }}>
                  {formatNice(d.date)}{d.note ? ` · ${d.note}` : ""}
                </div>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
                <span style={{ fontWeight: 600, color: d.direction === "owed_to_me" ? "var(--present)" : "var(--absent)" }}>
                  {d.direction === "owed_to_me" ? "+" : "−"}{rupees(d.amount)}
                </span>
                {d.settled ? (
                  <button onClick={() => unsettle(d.id)} className="btn-ghost btn" style={{ fontSize: 11, padding: "5px 8px" }}>Undo</button>
                ) : (
                  <button onClick={() => settle(d.id)} className="btn" style={{ fontSize: 11, padding: "5px 8px" }}>Settle</button>
                )}
                <button onClick={() => removeDebt(d.id)} className="btn-ghost btn" style={{ fontSize: 11, padding: "5px 8px" }}>Delete</button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
