"use client";
import { useEffect, useState } from "react";
import { Plus, Trash2, TrendingUp, TrendingDown, Building2, X } from "lucide-react";
import { cn, formatCurrency } from "@/lib/utils";
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, ReferenceLine } from "recharts";
import { format, startOfMonth, endOfMonth, eachDayOfInterval, getDay } from "date-fns";

const TOOLTIP_STYLE = { fontSize: 11, borderRadius: 8, backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))", color: "hsl(var(--foreground))" };

function StatCard({ label, value, sub, color }: { label: string; value: string; sub?: string; color?: string }) {
  return (
    <div className="bg-card border rounded-xl p-4">
      <p className="text-xs text-muted-foreground mb-1">{label}</p>
      <p className={cn("text-lg font-bold", color)}>{value}</p>
      {sub && <p className="text-[11px] text-muted-foreground mt-0.5">{sub}</p>}
    </div>
  );
}

export default function PropFirmPage() {
  const [firms, setFirms] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedFirm, setSelectedFirm] = useState<string>("all");
  const [showAddFirm, setShowAddFirm] = useState(false);
  const [showAddEntry, setShowAddEntry] = useState(false);
  const [newFirmName, setNewFirmName] = useState("");
  const [entryForm, setEntryForm] = useState({ propFirmId: "", type: "expense", amount: "", note: "", date: "" });
  const [saving, setSaving] = useState(false);
  const [calMonth, setCalMonth] = useState(new Date());

  useEffect(() => { loadData(); }, []);

  async function loadData() {
    setLoading(true);
    const res = await fetch("/api/propfirm");
    const d = await res.json();
    setFirms(Array.isArray(d) ? d : []);
    setLoading(false);
  }

  async function addFirm() {
    if (!newFirmName.trim()) return;
    setSaving(true);
    await fetch("/api/propfirm", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: newFirmName }) });
    setNewFirmName(""); setShowAddFirm(false); setSaving(false); loadData();
  }

  async function deleteFirm(id: string) {
    await fetch(`/api/propfirm?id=${id}`, { method: "DELETE" });
    if (selectedFirm === id) setSelectedFirm("all");
    loadData();
  }

  async function addEntry() {
    if (!entryForm.propFirmId || !entryForm.amount) return;
    setSaving(true);
    await fetch("/api/propfirm/entry", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(entryForm) });
    setEntryForm({ propFirmId: "", type: "expense", amount: "", note: "", date: "" });
    setShowAddEntry(false); setSaving(false); loadData();
  }

  async function deleteEntry(id: string) {
    await fetch(`/api/propfirm/entry?id=${id}`, { method: "DELETE" });
    loadData();
  }

  // Filter entries
  const filteredFirms = selectedFirm === "all" ? firms : firms.filter(f => f.id === selectedFirm);
  const allEntries = filteredFirms.flatMap((f: any) => f.entries.map((e: any) => ({ ...e, firmName: f.name })));
  const totalExpense = allEntries.filter(e => e.type === "expense").reduce((s, e) => s + e.amount, 0);
  const totalPayout = allEntries.filter(e => e.type === "payout").reduce((s, e) => s + e.amount, 0);
  const netProfit = totalPayout - totalExpense;
  const roi = totalExpense > 0 ? (netProfit / totalExpense) * 100 : 0;

  // Cumulative chart data
  const sortedEntries = [...allEntries].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  let cumExpense = 0, cumPayout = 0;
  const chartData: any[] = [];
  for (const e of sortedEntries) {
    if (e.type === "expense") cumExpense += e.amount;
    else cumPayout += e.amount;
    const date = format(new Date(e.date), "MM/dd");
    const last = chartData[chartData.length - 1];
    if (last?.date === date) { last.expense = cumExpense; last.payout = cumPayout; last.net = cumPayout - cumExpense; }
    else chartData.push({ date, expense: cumExpense, payout: cumPayout, net: cumPayout - cumExpense });
  }

  // Calendar
  const calStart = startOfMonth(calMonth);
  const calEnd = endOfMonth(calMonth);
  const calDays = eachDayOfInterval({ start: calStart, end: calEnd });
  const startDow = getDay(calStart);
  const weeks: (Date | null)[][] = [];
  let week: (Date | null)[] = Array(startDow).fill(null);
  for (const day of calDays) {
    week.push(day);
    if (week.length === 7) { weeks.push(week); week = []; }
  }
  if (week.length > 0) { while (week.length < 7) week.push(null); weeks.push(week); }

  const calMap = new Map<string, { expense: number; payout: number }>();
  for (const e of allEntries) {
    const key = format(new Date(e.date), "yyyy-MM-dd");
    const cur = calMap.get(key) ?? { expense: 0, payout: 0 };
    if (e.type === "expense") cur.expense += e.amount;
    else cur.payout += e.amount;
    calMap.set(key, cur);
  }

  const currency = "IDR";

  if (loading) return <div className="flex items-center justify-center h-64 text-sm text-muted-foreground">Loading...</div>;

  return (
    <div className="p-4 space-y-4 max-w-5xl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Building2 className="w-4 h-4 text-indigo-500" />
          <h1 className="text-sm font-semibold">Prop Firm Tracker</h1>
        </div>
        <div className="flex gap-2">
          <button onClick={() => setShowAddFirm(true)} className="text-xs px-3 py-1.5 border rounded-lg hover:bg-muted transition-colors flex items-center gap-1">
            <Plus className="w-3 h-3" /> Add Firm
          </button>
          <button onClick={() => { setEntryForm(f => ({ ...f, propFirmId: firms[0]?.id ?? "" })); setShowAddEntry(true); }}
            className="text-xs px-3 py-1.5 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors flex items-center gap-1">
            <Plus className="w-3 h-3" /> Add Entry
          </button>
        </div>
      </div>

      {/* Firm tabs */}
      {firms.length > 0 && (
        <div className="flex items-center gap-2 flex-wrap">
          <button onClick={() => setSelectedFirm("all")}
            className={cn("text-xs px-3 py-1.5 rounded-lg border transition-colors", selectedFirm === "all" ? "bg-indigo-600 text-white border-indigo-600" : "text-muted-foreground hover:bg-muted")}>
            All Firms
          </button>
          {firms.map(f => (
            <div key={f.id} className="flex items-center gap-1">
              <button onClick={() => setSelectedFirm(f.id)}
                className={cn("text-xs px-3 py-1.5 rounded-lg border transition-colors", selectedFirm === f.id ? "bg-indigo-600 text-white border-indigo-600" : "text-muted-foreground hover:bg-muted")}>
                {f.name}
              </button>
              <button onClick={() => deleteFirm(f.id)} className="text-muted-foreground hover:text-red-500 transition-colors">
                <X className="w-3 h-3" />
              </button>
            </div>
          ))}
        </div>
      )}

      {firms.length === 0 ? (
        <div className="bg-card border rounded-xl p-12 text-center">
          <Building2 className="w-8 h-8 text-muted-foreground mx-auto mb-3" />
          <p className="text-sm font-medium mb-1">No prop firms yet</p>
          <p className="text-xs text-muted-foreground mb-4">Add your first prop firm to start tracking</p>
          <button onClick={() => setShowAddFirm(true)} className="text-xs px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700">
            Add Firm
          </button>
        </div>
      ) : (
        <>
          {/* Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <StatCard label="Total Expense" value={formatCurrency(totalExpense, currency, false)} color="text-[#f87171]" sub={`${allEntries.filter(e => e.type === "expense").length} purchases`} />
            <StatCard label="Total Payout" value={formatCurrency(totalPayout, currency, false)} color="text-[#4ade80]" sub={`${allEntries.filter(e => e.type === "payout").length} payouts`} />
            <StatCard label="Net Profit" value={formatCurrency(netProfit, currency)} color={netProfit >= 0 ? "text-[#4ade80]" : "text-[#f87171]"} sub="Payout - Expense" />
            <StatCard label="Net ROI" value={`${roi >= 0 ? "+" : ""}${roi.toFixed(1)}%`} color={roi >= 0 ? "text-[#4ade80]" : "text-[#f87171]"} sub="Return on investment" />
          </div>

          {/* Chart */}
          <div className="bg-card border rounded-xl p-4">
            <p className="text-xs font-semibold mb-3">Cumulative Expense vs Payout</p>
            {chartData.length > 0 ? (
              <ResponsiveContainer width="100%" height={200}>
                <AreaChart data={chartData} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="payGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#16a34a" stopOpacity={0.3} />
                      <stop offset="100%" stopColor="#16a34a" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="expGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#dc2626" stopOpacity={0.3} />
                      <stop offset="100%" stopColor="#dc2626" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                  <XAxis dataKey="date" tick={{ fontSize: 9, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 9, fill: "hsl(var(--muted-foreground))" }} width={52} axisLine={false} tickLine={false}
                    tickFormatter={v => `${(v/1000000).toFixed(1)}M`} />
                  <ReferenceLine y={0} stroke="hsl(var(--border))" />
                  <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(v: number, name: string) => [formatCurrency(v, currency, false), name === "payout" ? "Payout" : name === "expense" ? "Expense" : "Net"]} />
                  <Area type="monotone" dataKey="payout" stroke="#16a34a" strokeWidth={2} fill="url(#payGrad)" dot={false} />
                  <Area type="monotone" dataKey="expense" stroke="#dc2626" strokeWidth={2} fill="url(#expGrad)" dot={false} />
                </AreaChart>
              </ResponsiveContainer>
            ) : <div className="h-48 flex items-center justify-center text-xs text-muted-foreground">No data yet</div>}
          </div>

          {/* Calendar */}
          <div className="bg-card border rounded-xl p-4">
            <div className="flex items-center justify-between mb-3">
              <p className="text-xs font-semibold">Activity Calendar</p>
              <div className="flex items-center gap-2">
                <button onClick={() => setCalMonth(m => new Date(m.getFullYear(), m.getMonth() - 1))} className="w-6 h-6 flex items-center justify-center rounded border hover:bg-muted text-xs">‹</button>
                <span className="text-xs font-medium">{format(calMonth, "MMMM yyyy")}</span>
                <button onClick={() => setCalMonth(m => new Date(m.getFullYear(), m.getMonth() + 1))} className="w-6 h-6 flex items-center justify-center rounded border hover:bg-muted text-xs">›</button>
              </div>
            </div>
            <div className="grid grid-cols-7 gap-1 mb-1">
              {["S","M","T","W","T","F","S"].map((d, i) => (
                <div key={i} className="text-center text-[9px] text-muted-foreground font-medium py-1">{d}</div>
              ))}
            </div>
            {weeks.map((wk, wi) => (
              <div key={wi} className="grid grid-cols-7 gap-1 mb-1">
                {wk.map((day, di) => {
                  if (!day) return <div key={di} className="h-12 rounded-lg border border-dashed border-border/30" />;
                  const key = format(day, "yyyy-MM-dd");
                  const data = calMap.get(key);
                  const isToday = key === format(new Date(), "yyyy-MM-dd");
                  const hasPayout = data && data.payout > 0;
                  const hasExpense = data && data.expense > 0;
                  const bg = hasPayout && hasExpense ? "rgba(99,102,241,0.2)" : hasPayout ? "rgba(22,163,74,0.2)" : hasExpense ? "rgba(220,38,38,0.2)" : "transparent";
                  const border = hasPayout && hasExpense ? "rgba(99,102,241,0.6)" : hasPayout ? "rgba(22,163,74,0.6)" : hasExpense ? "rgba(220,38,38,0.6)" : isToday ? "#6366f1" : "hsl(var(--border))";
                  return (
                    <div key={di} className="h-12 rounded-lg border p-1 flex flex-col justify-between" style={{ background: bg, borderColor: border }}>
                      <p className={cn("text-[9px] font-medium", isToday && !data ? "text-indigo-500" : "text-muted-foreground")}>{format(day, "d")}</p>
                      {hasPayout && <p className="text-[8px] font-bold text-[#4ade80] truncate">+{(data!.payout/1000000).toFixed(1)}M</p>}
                      {hasExpense && <p className="text-[8px] font-bold text-[#f87171] truncate">-{(data!.expense/1000000).toFixed(1)}M</p>}
                    </div>
                  );
                })}
              </div>
            ))}
            <div className="flex items-center gap-4 mt-2 text-[10px] text-muted-foreground">
              <div className="flex items-center gap-1"><div className="w-3 h-3 rounded bg-[#16a34a]/30" />Payout</div>
              <div className="flex items-center gap-1"><div className="w-3 h-3 rounded bg-[#dc2626]/30" />Expense</div>
              <div className="flex items-center gap-1"><div className="w-3 h-3 rounded bg-[#6366f1]/30" />Both</div>
            </div>
          </div>

          {/* Entry list */}
          <div className="bg-card border rounded-xl overflow-hidden">
            <div className="px-4 py-3 border-b flex items-center justify-between">
              <p className="text-xs font-semibold">Transaction History</p>
              <span className="text-[10px] text-muted-foreground">{allEntries.length} entries</span>
            </div>
            <div className="divide-y max-h-80 overflow-y-auto">
              {allEntries.length === 0 ? (
                <div className="py-8 text-center text-xs text-muted-foreground">No entries yet</div>
              ) : [...allEntries].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()).map(e => (
                <div key={e.id} className="flex items-center justify-between px-4 py-2.5 hover:bg-muted/30">
                  <div className="flex items-center gap-3">
                    <span className={cn("text-[9px] px-1.5 py-0.5 rounded font-medium", e.type === "payout" ? "bg-[#16a34a]/20 text-[#4ade80]" : "bg-[#dc2626]/20 text-[#f87171]")}>
                      {e.type === "payout" ? "PAYOUT" : "EXPENSE"}
                    </span>
                    <div>
                      <p className="text-xs font-medium">{e.firmName}</p>
                      {e.note && <p className="text-[10px] text-muted-foreground">{e.note}</p>}
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="text-right">
                      <p className={cn("text-xs font-semibold", e.type === "payout" ? "text-[#4ade80]" : "text-[#f87171]")}>
                        {e.type === "payout" ? "+" : "-"}{formatCurrency(e.amount, currency, false)}
                      </p>
                      <p className="text-[10px] text-muted-foreground">{format(new Date(e.date), "dd MMM yyyy")}</p>
                    </div>
                    <button onClick={() => deleteEntry(e.id)} className="text-muted-foreground hover:text-[#f87171] transition-colors">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </>
      )}

      {/* Add Firm Modal */}
      {showAddFirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={() => setShowAddFirm(false)}>
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />
          <div className="relative bg-card border rounded-2xl p-5 w-full max-w-sm shadow-2xl" onClick={e => e.stopPropagation()}>
            <p className="text-sm font-semibold mb-4">Add Prop Firm</p>
            <input type="text" value={newFirmName} onChange={e => setNewFirmName(e.target.value)}
              placeholder="e.g. FTMO, MyForexFunds, The5ers"
              className="w-full text-sm border rounded-xl px-3 py-2 bg-background mb-3" autoFocus />
            <div className="flex gap-2">
              <button onClick={() => setShowAddFirm(false)} className="flex-1 py-2 text-xs border rounded-xl text-muted-foreground hover:bg-muted">Cancel</button>
              <button onClick={addFirm} disabled={!newFirmName.trim() || saving}
                className="flex-1 py-2 text-xs bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 disabled:opacity-50">
                {saving ? "..." : "Add"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add Entry Modal */}
      {showAddEntry && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4" onClick={() => setShowAddEntry(false)}>
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />
          <div className="relative bg-card border rounded-2xl p-5 w-full max-w-sm shadow-2xl" onClick={e => e.stopPropagation()}>
            <p className="text-sm font-semibold mb-4">Add Entry</p>
            <div className="space-y-3">
              <div>
                <label className="text-[10px] text-muted-foreground">Prop Firm</label>
                <select value={entryForm.propFirmId} onChange={e => setEntryForm(f => ({ ...f, propFirmId: e.target.value }))}
                  className="w-full mt-1 text-xs border rounded-xl px-3 py-2 bg-background">
                  {firms.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
                </select>
              </div>
              <div className="flex gap-2">
                {(["expense", "payout"] as const).map(t => (
                  <button key={t} onClick={() => setEntryForm(f => ({ ...f, type: t }))}
                    className={cn("flex-1 py-2 rounded-xl text-xs font-medium capitalize transition-colors",
                      entryForm.type === t ? t === "expense" ? "bg-[#dc2626] text-white" : "bg-[#16a34a] text-white" : "bg-muted text-muted-foreground")}>
                    {t}
                  </button>
                ))}
              </div>
              <div>
                <label className="text-[10px] text-muted-foreground">Amount (IDR)</label>
                <input type="number" value={entryForm.amount} onChange={e => setEntryForm(f => ({ ...f, amount: e.target.value }))}
                  placeholder="0" className="w-full mt-1 text-sm border rounded-xl px-3 py-2 bg-background" />
              </div>
              <div>
                <label className="text-[10px] text-muted-foreground">Note (optional)</label>
                <input type="text" value={entryForm.note} onChange={e => setEntryForm(f => ({ ...f, note: e.target.value }))}
                  placeholder="e.g. Phase 1 challenge" className="w-full mt-1 text-xs border rounded-xl px-3 py-2 bg-background" />
              </div>
              <div>
                <label className="text-[10px] text-muted-foreground">Date</label>
                <input type="date" value={entryForm.date} onChange={e => setEntryForm(f => ({ ...f, date: e.target.value }))}
                  className="w-full mt-1 text-xs border rounded-xl px-3 py-2 bg-background" />
              </div>
            </div>
            <div className="flex gap-2 mt-4">
              <button onClick={() => setShowAddEntry(false)} className="flex-1 py-2 text-xs border rounded-xl text-muted-foreground hover:bg-muted">Cancel</button>
              <button onClick={addEntry} disabled={!entryForm.propFirmId || !entryForm.amount || saving}
                className="flex-1 py-2 text-xs bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 disabled:opacity-50">
                {saving ? "..." : "Add"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
