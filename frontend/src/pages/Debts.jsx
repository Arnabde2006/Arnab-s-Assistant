import { useCallback, useEffect, useState, useMemo } from "react";
import { api } from "../api/client.js";
import { useAsyncAction } from "../hooks/useAsyncAction.js";
import { useDialog } from "../hooks/useDialog.js";
import Switch from "../components/Switch.jsx";
import {
  Users,
  User,
  ArrowUpRight,
  ArrowDownLeft,
  Scale,
  X,
  Plus,
  Check,
  Search,
  Trash2,
  RotateCcw,
  CheckCheck,
  FileText
} from "lucide-react";

function rupees(n) {
  return `₹${Number(n).toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;
}

function formatNice(dateStr) {
  if (!dateStr) return "";
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString(undefined, { day: "numeric", month: "short" });
}

export default function Debts() {
  const [debts, setDebts] = useState([]);
  const [showSettled, setShowSettled] = useState(false);
  const [activeTab, setActiveTab] = useState("summaries"); // "summaries" | "entries"
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedPersonKey, setSelectedPersonKey] = useState(null);
  const [partialDebt, setPartialDebt] = useState(null);
  const [partialPaidAmount, setPartialPaidAmount] = useState("");

  // Form state for main add form
  const [form, setForm] = useState({ personName: "", amount: "", direction: "owed_to_me", note: "" });

  // Form state for modal quick add form
  const [modalForm, setModalForm] = useState({ amount: "", direction: "owed_to_me", note: "" });

  const { run, pending } = useAsyncAction();
  const [loadError, setLoadError] = useState("");

  const refresh = useCallback(async () => {
    const d = await api.get("/debts");
    setDebts(d.debts || []);
  }, []);

  useEffect(() => {
    // A failed load must not render as an empty list — "you have no debts" and
    // "we couldn't reach the server" are very different messages.
    refresh().catch((err) => setLoadError(err.message || "Couldn't load your debts."));
  }, [refresh]);

  async function addDebt(e, customName = null) {
    if (e) e.preventDefault();
    const name = customName || form.personName;
    if (!name.trim() || !form.amount || Number(form.amount) <= 0) return;
    const { ok } = await run(
      () =>
        api.post("/debts", {
          personName: name.trim(),
          amount: Number(form.amount),
          direction: form.direction,
          note: form.note
        }),
      { errorMessage: "Couldn't add that entry" }
    );
    if (!ok) return;
    setForm({ personName: "", amount: "", direction: form.direction, note: "" });
    await run(refresh, { errorMessage: "Saved, but the list may be out of date" });
  }

  async function addDebtInModal(personName, e) {
    if (e) e.preventDefault();
    if (!personName || !modalForm.amount || Number(modalForm.amount) <= 0) return;
    const { ok } = await run(
      () =>
        api.post("/debts", {
          personName: personName.trim(),
          amount: Number(modalForm.amount),
          direction: modalForm.direction,
          note: modalForm.note
        }),
      { errorMessage: "Couldn't add that entry" }
    );
    if (!ok) return;
    setModalForm({ amount: "", direction: "owed_to_me", note: "" });
    await run(refresh, { errorMessage: "Saved, but the list may be out of date" });
  }

  async function settle(id) {
    const { ok } = await run(() => api.post(`/debts/${id}/settle`), {
      errorMessage: "Couldn't settle that entry",
    });
    if (ok) await run(refresh, { errorMessage: "Saved, but the list may be out of date" });
  }

  async function unsettle(id) {
    const { ok } = await run(() => api.post(`/debts/${id}/unsettle`), {
      errorMessage: "Couldn't reopen that entry",
    });
    if (ok) await run(refresh, { errorMessage: "Saved, but the list may be out of date" });
  }

  async function removeDebt(id) {
    const { ok } = await run(() => api.del(`/debts/${id}`), {
      errorMessage: "Couldn't delete that entry",
    });
    if (ok) await run(refresh, { errorMessage: "Saved, but the list may be out of date" });
  }

  async function settleAllForPerson(personEntries) {
    const activeEntries = personEntries.filter((d) => !d.settled);
    if (activeEntries.length === 0) return;

    // Settle sequentially and report partial progress. Promise.all would leave
    // the set half-applied on a failure with no indication of how far it got.
    const { ok } = await run(
      async () => {
        let done = 0;
        try {
          for (const d of activeEntries) {
            await api.post(`/debts/${d.id}/settle`);
            done++;
          }
        } catch (err) {
          throw new Error(
            done === 0
              ? err.message
              : `only ${done} of ${activeEntries.length} were settled (${err.message})`
          );
        }
      },
      { errorMessage: "Couldn't settle everything" }
    );
    // Refresh either way — on partial failure the list is genuinely changed.
    await run(refresh, { errorMessage: "Saved, but the list may be out of date" });
    return ok;
  }

  async function submitPartialSettle(e) {
    if (e) e.preventDefault();
    if (!partialDebt || !partialPaidAmount || Number(partialPaidAmount) <= 0) return;
    const { ok } = await run(
      () =>
        api.post(`/debts/${partialDebt.id}/partial-settle`, {
          paidAmount: Number(partialPaidAmount)
        }),
      { errorMessage: "Couldn't record that payment" }
    );
    if (!ok) return;
    setPartialDebt(null);
    setPartialPaidAmount("");
    await run(refresh, { errorMessage: "Saved, but the list may be out of date" });
  }

  // All aggregation derives purely from `debts`, so memoize it on [debts].
  // Without this, typing in the search box (which is separate state) would
  // re-run the whole person-map build + sort on every keystroke.
  const { active, settled, owedToMe, iOwe, netPosition, personMap, uniquePeopleList } = useMemo(() => {
    const active = debts.filter((d) => !d.settled);
    const settled = debts.filter((d) => d.settled);
    const owedToMe = active.filter((d) => d.direction === "owed_to_me").reduce((s, d) => s + Number(d.amount), 0);
    const iOwe = active.filter((d) => d.direction === "i_owe").reduce((s, d) => s + Number(d.amount), 0);
    const netPosition = owedToMe - iOwe;

    // Person aggregation
    const personMap = {};
    debts.forEach((d) => {
      const rawName = d.person_name?.trim() || "Unknown";
      const key = rawName.toLowerCase();
      if (!personMap[key]) {
        personMap[key] = {
          key,
          displayName: rawName,
          owedToMeActive: 0,
          iOweActive: 0,
          owedToMeTotal: 0,
          iOweTotal: 0,
          activeCount: 0,
          settledCount: 0,
          entries: [],
        };
      }
      personMap[key].entries.push(d);
      const amt = Number(d.amount) || 0;
      if (d.direction === "owed_to_me") {
        personMap[key].owedToMeTotal += amt;
        if (!d.settled) {
          personMap[key].owedToMeActive += amt;
          personMap[key].activeCount++;
        } else {
          personMap[key].settledCount++;
        }
      } else {
        personMap[key].iOweTotal += amt;
        if (!d.settled) {
          personMap[key].iOweActive += amt;
          personMap[key].activeCount++;
        } else {
          personMap[key].settledCount++;
        }
      }
    });

    const uniquePeopleList = Object.values(personMap).map((p) => {
      const netActive = p.owedToMeActive - p.iOweActive;
      return {
        ...p,
        netActive,
      };
    }).sort((a, b) => Math.abs(b.netActive) - Math.abs(a.netActive));

    return { active, settled, owedToMe, iOwe, netPosition, personMap, uniquePeopleList };
  }, [debts]);

  const visibleEntries = useMemo(
    () => (showSettled ? [...active, ...settled] : active),
    [active, settled, showSettled]
  );

  // Only the cheap search filter re-runs on keystrokes now.
  const filteredPeople = useMemo(
    () => uniquePeopleList.filter((p) =>
      p.displayName.toLowerCase().includes(searchQuery.toLowerCase())
    ),
    [uniquePeopleList, searchQuery]
  );

  const selectedPersonData = selectedPersonKey ? personMap[selectedPersonKey] : null;

  // Two dialogs, and the partial-settlement one opens on top of the person detail
  // one (zIndex 1100 over 1000). useDialog keeps its own stack so Escape closes
  // only the topmost, rather than collapsing both at once.
  const personDialog = useDialog(!!selectedPersonData, () => setSelectedPersonKey(null));
  const partialDialog = useDialog(!!partialDebt, () => setPartialDebt(null));

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Debts & Balances</h1>
          <p className="page-subtitle">Track individual summaries, see who owes whom, and settle up effortless balance differences.</p>
        </div>
        <Switch checked={showSettled} onChange={setShowSettled} label="Show settled" />
      </div>

      {loadError && (
        <div className="load-error" role="alert">
          <span>{loadError}</span>
          <button
            type="button"
            className="btn btn-sm"
            onClick={() => {
              setLoadError("");
              refresh().catch((err) => setLoadError(err.message || "Couldn't load your debts."));
            }}
          >
            Retry
          </button>
        </div>
      )}

      {/* Overview Cards */}
      <div className="grid grid-3" style={{ marginBottom: 20 }}>
        <div className="card">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
            <span className="label">Owed to me</span>
            <ArrowDownLeft size={16} style={{ color: "var(--present)" }} />
          </div>
          <div className="stat-num" style={{ color: "var(--present)" }}>{rupees(owedToMe)}</div>
          <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 4 }}>
            {active.filter((d) => d.direction === "owed_to_me").length} pending entries
          </div>
        </div>

        <div className="card">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
            <span className="label">I owe</span>
            <ArrowUpRight size={16} style={{ color: "var(--absent)" }} />
          </div>
          <div className="stat-num" style={{ color: "var(--absent)" }}>{rupees(iOwe)}</div>
          <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 4 }}>
            {active.filter((d) => d.direction === "i_owe").length} pending entries
          </div>
        </div>

        <div className="card">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
            <span className="label">Net Balance</span>
            <Scale size={16} style={{ color: netPosition > 0 ? "var(--present)" : netPosition < 0 ? "var(--absent)" : "var(--text-muted)" }} />
          </div>
          <div
            className="stat-num"
            style={{
              color: netPosition > 0 ? "var(--present)" : netPosition < 0 ? "var(--absent)" : "var(--text)"
            }}
          >
            {netPosition > 0 ? `+${rupees(netPosition)}` : netPosition < 0 ? `-${rupees(Math.abs(netPosition))}` : "₹0"}
          </div>
          <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 4 }}>
            {netPosition > 0 ? "You are owed overall" : netPosition < 0 ? "You owe overall" : "All settled up"}
          </div>
        </div>
      </div>

      {/* Add Debt Form */}
      <form onSubmit={addDebt} className="card" style={{ marginBottom: 24 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
          <div className="label" style={{ marginBottom: 0 }}>Add an entry</div>
          {uniquePeopleList.length > 0 && (
            <div style={{ fontSize: 12, color: "var(--text-muted)", display: "flex", alignItems: "center", gap: 4 }}>
              <Users size={13} /> {uniquePeopleList.length} people tracked
            </div>
          )}
        </div>

        <div style={{ display: "flex", gap: 8, marginBottom: 12, flexWrap: "wrap" }}>
          <button
            type="button"
            className={form.direction === "owed_to_me" ? "btn" : "btn-ghost btn"}
            style={{
              background: form.direction === "owed_to_me" ? "var(--present)" : undefined,
              borderColor: form.direction === "owed_to_me" ? "var(--present)" : undefined,
              display: "flex",
              alignItems: "center",
              gap: 6
            }}
            onClick={() => setForm((f) => ({ ...f, direction: "owed_to_me" }))}
          >
            <ArrowDownLeft size={14} /> They owe me
          </button>
          <button
            type="button"
            className={form.direction === "i_owe" ? "btn" : "btn-ghost btn"}
            style={{
              background: form.direction === "i_owe" ? "var(--absent)" : undefined,
              borderColor: form.direction === "i_owe" ? "var(--absent)" : undefined,
              display: "flex",
              alignItems: "center",
              gap: 6
            }}
            onClick={() => setForm((f) => ({ ...f, direction: "i_owe" }))}
          >
            <ArrowUpRight size={14} /> I owe them
          </button>
        </div>

        <div style={{ display: "flex", gap: 8, marginBottom: 10, flexWrap: "wrap" }}>
          <input
            className="input"
            placeholder="Person's name (e.g. Rahul)"
            value={form.personName}
            onChange={(e) => setForm((f) => ({ ...f, personName: e.target.value }))}
            style={{ flex: "1 1 180px" }}
            required
          />
          <input
            className="input"
            type="number"
            min="0.01"
            step="0.01"
            placeholder="Amount (₹)"
            value={form.amount}
            onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))}
            style={{ flex: "1 1 120px" }}
            required
          />
        </div>

        {/* Existing Person Quick Chips */}
        {uniquePeopleList.length > 0 && !form.personName && (
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 10, alignItems: "center" }}>
            <span style={{ fontSize: 11, color: "var(--text-muted)" }}>Quick select:</span>
            {uniquePeopleList.slice(0, 6).map((p) => (
              <button
                key={p.key}
                type="button"
                className="btn-ghost btn"
                style={{ fontSize: 11, padding: "3px 8px", borderRadius: 12, height: "auto" }}
                onClick={() => setForm((f) => ({ ...f, personName: p.displayName }))}
              >
                {p.displayName}
              </button>
            ))}
          </div>
        )}

        <input
          className="input"
          placeholder="What for? (e.g. Lunch, Concert ticket, Uber)"
          value={form.note}
          onChange={(e) => setForm((f) => ({ ...f, note: e.target.value }))}
          style={{ marginBottom: 12 }}
        />
        <button className="btn" type="submit" disabled={pending} style={{ width: "100%", display: "flex", justifyContent: "center", alignItems: "center", gap: 6 }}>
          <Plus size={16} /> {pending ? "Saving…" : "Add Entry"}
        </button>
      </form>

      {/* Main View Switcher Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, marginBottom: 16, flexWrap: "wrap" }}>
        <div style={{ display: "flex", gap: 6, background: "var(--bg-elevated)", padding: 4, borderRadius: 10 }}>
          <button
            type="button"
            className={activeTab === "summaries" ? "btn" : "btn-ghost btn"}
            style={{ fontSize: 13, padding: "6px 14px", height: "auto" }}
            onClick={() => setActiveTab("summaries")}
          >
            <Users size={14} style={{ marginRight: 6 }} /> Individual Summaries ({uniquePeopleList.length})
          </button>
          <button
            type="button"
            className={activeTab === "entries" ? "btn" : "btn-ghost btn"}
            style={{ fontSize: 13, padding: "6px 14px", height: "auto" }}
            onClick={() => setActiveTab("entries")}
          >
            <FileText size={14} style={{ marginRight: 6 }} /> All Entries ({visibleEntries.length})
          </button>
        </div>

        {activeTab === "summaries" && uniquePeopleList.length > 0 && (
          <div style={{ position: "relative", width: 220 }}>
            <Search size={14} style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", color: "var(--text-muted)" }} />
            <input
              className="input"
              placeholder="Search person..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{ paddingLeft: 30, fontSize: 13, padding: "6px 12px 6px 30px" }}
            />
          </div>
        )}
      </div>

      {/* Tab Content: INDIVIDUAL SUMMARIES */}
      {activeTab === "summaries" && (
        <div>
          {filteredPeople.length === 0 ? (
            <div className="card empty-state" style={{ textAlign: "center", padding: "32px 16px" }}>
              <User size={32} style={{ color: "var(--text-muted)", marginBottom: 8, opacity: 0.6 }} />
              <div style={{ fontWeight: 600 }}>No individual debt records found</div>
              <div style={{ fontSize: 13, color: "var(--text-muted)", marginTop: 4 }}>
                {searchQuery ? "No person matches your search." : "Add entries above to start tracking person-wise summaries."}
              </div>
            </div>
          ) : (
            <div className="grid grid-2" style={{ gap: 14 }}>
              {filteredPeople.map((person) => {
                const net = person.netActive;
                return (
                  <div
                    key={person.key}
                    className="card"
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      justifyContent: "space-between",
                      gap: 12,
                      transition: "transform 0.15s ease, border-color 0.15s ease",
                      borderLeft: `4px solid ${net > 0 ? "var(--present)" : net < 0 ? "var(--absent)" : "var(--border)"}`
                    }}
                  >
                    <div>
                      {/* Header info */}
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                          <div
                            style={{
                              width: 36,
                              height: 36,
                              borderRadius: "50%",
                              background: "var(--accent-soft)",
                              color: "var(--accent-text)",
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                              fontWeight: 700,
                              fontSize: 15
                            }}
                          >
                            {person.displayName.charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <div style={{ fontWeight: 700, fontSize: 16 }}>{person.displayName}</div>
                            <div style={{ fontSize: 12, color: "var(--text-muted)" }}>
                              {person.activeCount} active entry{person.activeCount !== 1 ? "ies" : ""}
                              {person.settledCount > 0 && ` · ${person.settledCount} settled`}
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Amounts Breakdown */}
                      <div
                        style={{
                          display: "grid",
                          gridTemplateColumns: "1fr 1fr",
                          gap: 8,
                          margin: "14px 0 10px 0",
                          padding: "10px 12px",
                          background: "var(--bg-elevated)",
                          borderRadius: 8
                        }}
                      >
                        <div>
                          <div style={{ fontSize: 11, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.5px" }}>They owe me</div>
                          <div style={{ fontSize: 14, fontWeight: 600, color: "var(--present)" }}>
                            {rupees(person.owedToMeActive)}
                          </div>
                        </div>
                        <div>
                          <div style={{ fontSize: 11, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.5px" }}>I owe them</div>
                          <div style={{ fontSize: 14, fontWeight: 600, color: "var(--absent)" }}>
                            {rupees(person.iOweActive)}
                          </div>
                        </div>
                      </div>

                      {/* Net Difference Callout Banner */}
                      <div
                        style={{
                          padding: "10px 12px",
                          borderRadius: 8,
                          fontSize: 13,
                          fontWeight: 600,
                          display: "flex",
                          alignItems: "center",
                          gap: 8,
                          background:
                            net > 0
                              ? "rgba(79, 168, 138, 0.12)"
                              : net < 0
                              ? "rgba(193, 85, 74, 0.12)"
                              : "var(--bg-elevated)",
                          color:
                            net > 0
                              ? "var(--present)"
                              : net < 0
                              ? "var(--absent)"
                              : "var(--text-muted)",
                          border: `1px solid ${
                            net > 0
                              ? "rgba(79, 168, 138, 0.3)"
                              : net < 0
                              ? "rgba(193, 85, 74, 0.3)"
                              : "var(--border)"
                          }`
                        }}
                      >
                        <Scale size={15} style={{ flexShrink: 0 }} />
                        <span style={{ wordBreak: "break-word" }}>
                          {net > 0
                            ? `${person.displayName} owes you ${rupees(net)}`
                            : net < 0
                            ? `You owe ${person.displayName} ${rupees(Math.abs(net))}`
                            : "All settled up (Difference: ₹0)"}
                        </span>
                      </div>
                    </div>

                    {/* Action buttons */}
                    <div style={{ display: "flex", gap: 8, marginTop: 4 }}>
                      <button
                        type="button"
                        className="btn"
                        style={{ flex: 1, fontSize: 12, padding: "7px 10px" }}
                        onClick={() => setSelectedPersonKey(person.key)}
                      >
                        Full Summary & Statement
                      </button>
                      {person.activeCount > 0 && (
                        <button
                          type="button"
                          className="btn-ghost btn"
                          title="Settle all pending debts with this person"
                          style={{ fontSize: 12, padding: "7px 10px" }}
                          onClick={() => settleAllForPerson(person.entries)}
                        >
                          <CheckCheck size={14} /> Settle All
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Tab Content: ALL ENTRIES */}
      {activeTab === "entries" && (
        <div className="card">
          <div className="label" style={{ marginBottom: 12 }}>
            {showSettled ? "All Entries (including settled)" : "Active Entries"}
          </div>
          {visibleEntries.length === 0 && <div className="empty-state">Nothing here yet.</div>}
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {visibleEntries.map((d) => (
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
                    <button
                      type="button"
                      style={{
                        background: "none",
                        border: "none",
                        padding: 0,
                        color: "inherit",
                        font: "inherit",
                        fontWeight: 600,
                        cursor: "pointer",
                        textDecoration: "underline",
                        textDecorationColor: "var(--border-strong)"
                      }}
                      onClick={() => {
                        setSelectedPersonKey(d.person_name.trim().toLowerCase());
                      }}
                    >
                      {d.person_name}
                    </button>
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
                    <>
                      <button
                        onClick={() => { setPartialDebt(d); setPartialPaidAmount(""); }}
                        className="btn-ghost btn"
                        style={{ fontSize: 11, padding: "5px 8px" }}
                        title="Record partial payment"
                      >
                        Partial
                      </button>
                      <button onClick={() => settle(d.id)} className="btn" style={{ fontSize: 11, padding: "5px 8px" }}>Settle</button>
                    </>
                  )}
                  <button onClick={() => removeDebt(d.id)} className="btn-ghost btn" style={{ fontSize: 11, padding: "5px 8px" }}>Delete</button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* DETAILED PERSON STATEMENT MODAL */}
      {selectedPersonData && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: "rgba(0, 0, 0, 0.65)",
            backdropFilter: "blur(6px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 1000,
            padding: 16
          }}
          onClick={(e) => {
            if (e.target === e.currentTarget) setSelectedPersonKey(null);
          }}
        >
          <div
            className="card"
            {...personDialog.dialogProps}
            style={{
              maxWidth: 580,
              width: "100%",
              maxHeight: "90vh",
              overflowY: "auto",
              position: "relative",
              boxShadow: "var(--shadow)",
              border: "1px solid var(--border-strong)"
            }}
          >
            {/* Modal Header */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <div
                  style={{
                    width: 40,
                    height: 40,
                    borderRadius: "50%",
                    background: "var(--accent-soft)",
                    color: "var(--accent-text)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontWeight: 700,
                    fontSize: 18
                  }}
                >
                  {selectedPersonData.displayName.charAt(0).toUpperCase()}
                </div>
                <div>
                  <h2 {...personDialog.titleProps} style={{ fontSize: 18, fontWeight: 700, margin: 0 }}>
                    {selectedPersonData.displayName}'s Full Summary
                  </h2>
                  <div style={{ fontSize: 12, color: "var(--text-muted)" }}>
                    Detailed debt statement & transaction logs
                  </div>
                </div>
              </div>
              <button
                type="button"
                className="btn-ghost btn"
                style={{ padding: 6, borderRadius: "50%" }}
                onClick={() => setSelectedPersonKey(null)}
                aria-label="Close dialog"
              >
                <X size={18} />
              </button>
            </div>

            {/* Summary Highlights inside Modal */}
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: 10,
                marginBottom: 14
              }}
            >
              <div className="card" style={{ padding: "10px 12px", background: "var(--bg-elevated)" }}>
                <div style={{ fontSize: 11, color: "var(--text-muted)", textTransform: "uppercase" }}>Money They Owe You</div>
                <div style={{ fontSize: 16, fontWeight: 700, color: "var(--present)" }}>
                  {rupees(selectedPersonData.owedToMeActive)}
                </div>
                {selectedPersonData.owedToMeTotal > selectedPersonData.owedToMeActive && (
                  <div style={{ fontSize: 11, color: "var(--text-muted)" }}>
                    Total ever: {rupees(selectedPersonData.owedToMeTotal)}
                  </div>
                )}
              </div>

              <div className="card" style={{ padding: "10px 12px", background: "var(--bg-elevated)" }}>
                <div style={{ fontSize: 11, color: "var(--text-muted)", textTransform: "uppercase" }}>Money You Owe Them</div>
                <div style={{ fontSize: 16, fontWeight: 700, color: "var(--absent)" }}>
                  {rupees(selectedPersonData.iOweActive)}
                </div>
                {selectedPersonData.iOweTotal > selectedPersonData.iOweActive && (
                  <div style={{ fontSize: 11, color: "var(--text-muted)" }}>
                    Total ever: {rupees(selectedPersonData.iOweTotal)}
                  </div>
                )}
              </div>
            </div>

            {/* Main Net Difference Banner in Modal */}
            <div
              style={{
                padding: 14,
                borderRadius: 10,
                marginBottom: 16,
                background:
                  selectedPersonData.netActive > 0
                    ? "rgba(79, 168, 138, 0.15)"
                    : selectedPersonData.netActive < 0
                    ? "rgba(193, 85, 74, 0.15)"
                    : "var(--bg-elevated)",
                border: `1px solid ${
                  selectedPersonData.netActive > 0
                    ? "var(--present)"
                    : selectedPersonData.netActive < 0
                    ? "var(--absent)"
                    : "var(--border)"
                }`,
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                gap: 10,
                flexWrap: "wrap"
              }}
            >
              <div>
                <div style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: "0.5px", color: "var(--text-muted)" }}>
                  Net Difference Result
                </div>
                <div
                  style={{
                    fontSize: 16,
                    fontWeight: 700,
                    color:
                      selectedPersonData.netActive > 0
                        ? "var(--present)"
                        : selectedPersonData.netActive < 0
                        ? "var(--absent)"
                        : "var(--text)"
                  }}
                >
                  {selectedPersonData.netActive > 0
                    ? `${selectedPersonData.displayName} owes you ${rupees(selectedPersonData.netActive)}`
                    : selectedPersonData.netActive < 0
                    ? `You owe ${selectedPersonData.displayName} ${rupees(Math.abs(selectedPersonData.netActive))}`
                    : "Fully Balanced (₹0 difference)"}
                </div>
              </div>

              {selectedPersonData.activeCount > 0 && (
                <button
                  type="button"
                  className="btn"
                  style={{ fontSize: 12, padding: "6px 12px" }}
                  onClick={() => settleAllForPerson(selectedPersonData.entries)}
                >
                  <CheckCheck size={14} style={{ marginRight: 4 }} /> Settle All
                </button>
              )}
            </div>

            {/* Quick Add for this Person in Modal */}
            <form
              onSubmit={(e) => addDebtInModal(selectedPersonData.displayName, e)}
              style={{
                marginBottom: 18,
                padding: 12,
                borderRadius: 8,
                background: "var(--bg-elevated)"
              }}
            >
              <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 8, color: "var(--text-muted)" }}>
                Add entry for {selectedPersonData.displayName}
              </div>
              <div style={{ display: "flex", gap: 6, marginBottom: 8, flexWrap: "wrap" }}>
                <button
                  type="button"
                  className={modalForm.direction === "owed_to_me" ? "btn" : "btn-ghost btn"}
                  style={{
                    fontSize: 11,
                    padding: "4px 8px",
                    background: modalForm.direction === "owed_to_me" ? "var(--present)" : undefined
                  }}
                  onClick={() => setModalForm((f) => ({ ...f, direction: "owed_to_me" }))}
                >
                  They owe me
                </button>
                <button
                  type="button"
                  className={modalForm.direction === "i_owe" ? "btn" : "btn-ghost btn"}
                  style={{
                    fontSize: 11,
                    padding: "4px 8px",
                    background: modalForm.direction === "i_owe" ? "var(--absent)" : undefined
                  }}
                  onClick={() => setModalForm((f) => ({ ...f, direction: "i_owe" }))}
                >
                  I owe them
                </button>
              </div>
              <div style={{ display: "flex", gap: 6, marginBottom: 6 }}>
                <input
                  className="input"
                  type="number"
                  min="0.01"
                  step="0.01"
                  placeholder="Amount (₹)"
                  value={modalForm.amount}
                  onChange={(e) => setModalForm((f) => ({ ...f, amount: e.target.value }))}
                  style={{ flex: 1, fontSize: 13 }}
                  required
                />
                <input
                  className="input"
                  placeholder="Note (optional)"
                  value={modalForm.note}
                  onChange={(e) => setModalForm((f) => ({ ...f, note: e.target.value }))}
                  style={{ flex: 2, fontSize: 13 }}
                />
              </div>
              <button className="btn" type="submit" disabled={pending} style={{ width: "100%", fontSize: 12, padding: "6px" }}>
                {pending ? "Saving…" : `Add Entry for ${selectedPersonData.displayName}`}
              </button>
            </form>

            {/* List of Entries for this Person */}
            <div>
              <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 10 }}>
                Transaction History ({selectedPersonData.entries.length})
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {selectedPersonData.entries.map((d) => (
                  <div
                    key={d.id}
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      gap: 8,
                      padding: "8px 10px",
                      borderRadius: 6,
                      background: "var(--bg-elevated)",
                      opacity: d.settled ? 0.6 : 1
                    }}
                  >
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 600 }}>
                        {d.direction === "owed_to_me" ? "They owe you" : "You owe them"}
                        {d.settled && <span style={{ color: "var(--text-muted)", fontWeight: 400 }}> · settled</span>}
                      </div>
                      <div style={{ fontSize: 11, color: "var(--text-muted)" }}>
                        {formatNice(d.date)}{d.note ? ` · ${d.note}` : ""}
                      </div>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <span
                        style={{
                          fontWeight: 700,
                          fontSize: 13,
                          color: d.direction === "owed_to_me" ? "var(--present)" : "var(--absent)"
                        }}
                      >
                        {d.direction === "owed_to_me" ? "+" : "−"}{rupees(d.amount)}
                      </span>
                      {d.settled ? (
                        <button onClick={() => unsettle(d.id)} className="btn-ghost btn" aria-label={`Reopen ${rupees(d.amount)} entry`} title="Reopen" style={{ fontSize: 10, padding: "4px 6px" }}>
                          <RotateCcw size={12} />
                        </button>
                      ) : (
                        <>
                          <button
                            onClick={() => { setPartialDebt(d); setPartialPaidAmount(""); }}
                            className="btn-ghost btn"
                            style={{ fontSize: 10, padding: "4px 6px" }}
                            title="Partial Settle"
                          >
                            Part
                          </button>
                          <button onClick={() => settle(d.id)} className="btn" aria-label={`Settle ${rupees(d.amount)} in full`} title="Settle in full" style={{ fontSize: 10, padding: "4px 6px" }}>
                            <Check size={12} />
                          </button>
                        </>
                      )}
                      <button onClick={() => removeDebt(d.id)} className="btn-ghost btn" aria-label={`Delete ${rupees(d.amount)} entry`} title="Delete" style={{ fontSize: 10, padding: "4px 6px" }}>
                        <Trash2 size={12} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* PARTIAL SETTLE MODAL */}
      {partialDebt && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: "rgba(0, 0, 0, 0.65)",
            backdropFilter: "blur(6px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 1100,
            padding: 16
          }}
          onClick={(e) => {
            if (e.target === e.currentTarget) setPartialDebt(null);
          }}
        >
          <div
            className="card"
            {...partialDialog.dialogProps}
            style={{
              maxWidth: 420,
              width: "100%",
              boxShadow: "var(--shadow)",
              border: "1px solid var(--border-strong)"
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
              <h3 {...partialDialog.titleProps} style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>
                Partial Settlement for {partialDebt.person_name}
              </h3>
              <button
                type="button"
                className="btn-ghost btn"
                style={{ padding: 4, borderRadius: "50%" }}
                onClick={() => setPartialDebt(null)}
                aria-label="Close dialog"
              >
                <X size={16} />
              </button>
            </div>

            <div style={{ fontSize: 13, color: "var(--text-muted)", marginBottom: 14 }}>
              Current Entry Amount: <strong style={{ color: "var(--text)" }}>{rupees(partialDebt.amount)}</strong>
              {partialDebt.note && <span> · ({partialDebt.note})</span>}
            </div>

            <form onSubmit={submitPartialSettle}>
              <div style={{ marginBottom: 12 }}>
                <label style={{ fontSize: 12, fontWeight: 600, display: "block", marginBottom: 6 }}>
                  Amount Paid Now (₹)
                </label>
                <input
                  className="input"
                  type="number"
                  min="0.01"
                  max={partialDebt.amount}
                  step="0.01"
                  placeholder={`Enter amount up to ₹${partialDebt.amount}`}
                  value={partialPaidAmount}
                  onChange={(e) => setPartialPaidAmount(e.target.value)}
                  style={{ width: "100%", fontSize: 14 }}
                  autoFocus
                  required
                />
              </div>

              {Number(partialPaidAmount) > 0 && (
                <div
                  style={{
                    padding: "10px 12px",
                    borderRadius: 8,
                    background: "var(--bg-elevated)",
                    fontSize: 12,
                    marginBottom: 16,
                    display: "flex",
                    flexDirection: "column",
                    gap: 4
                  }}
                >
                  <div>Paid now (Settled entry): <strong style={{ color: "var(--present)" }}>{rupees(partialPaidAmount)}</strong></div>
                  <div>Remaining Active Debt: <strong style={{ color: "var(--absent)" }}>{rupees(Math.max(0, Number(partialDebt.amount) - Number(partialPaidAmount)))}</strong></div>
                </div>
              )}

              <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
                <button
                  type="button"
                  className="btn-ghost btn"
                  onClick={() => setPartialDebt(null)}
                  style={{ fontSize: 13 }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn"
                  disabled={pending}
                  style={{ fontSize: 13 }}
                >
                  {pending ? "Saving…" : "Confirm Partial Payment"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

