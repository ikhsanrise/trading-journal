"use client";
import { useEffect, useState } from "react";
import { Plus, Trash2, TrendingUp, TrendingDown, Building2, X, ChevronLeft, ChevronRight, Percent } from "lucide-react";
import { PANEL, BTN_PRIMARY, PAGE, H1, SUB, H2, CAP, KPI, BTN, LABEL, WIN, LOSS } from "@/lib/theme";
import { cn, formatCurrency } from "@/lib/utils";
import { HoverTip, type TipRow } from "@/components/ui/HoverTip";
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, ReferenceLine } from "recharts";
import { format, startOfMonth, endOfMonth, eachDayOfInterval, getDay } from "date-fns";

const TOOLTIP_STYLE = {
  fontSize: 12, borderRadius: 12, padding: "10px 14px", backgroundColor: "rgba(12,19,48,0.96)",
  border: "1px solid rgba(122,140,255,0.25)", color: "#e8ecff", boxShadow: "0 18px 40px -12px rgba(0,0,0,0.7)",
};
const TOOLTIP_LABEL = { color: "#8a94c4", fontWeight: 600, marginBottom: 4 };
const TOOLTIP_ITEM = { color: "#e8ecff", fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace", fontVariantNumeric: "tabular-nums" as const };
const tn = (v: number): TipRow["tone"] => (v === 0 ? "muted" : v > 0 ? "win" : "loss");

const ICO = "w-[46px] h-[46px] rounded-[13px] flex items-center justify-center border border-[#5b74ff]/30 bg-[#4f6bff]/10 text-[#4f6bff] dark:text-[#9fb0ff] dark:bg-gradient-to-br dark:from-[#2b3f9e]/50 dark:to-[#13204f]/60 shrink-0";
const ICO_SM = "w-9 h-9 rounded-[11px] flex items-center justify-center border shrink-0";
const BTN_GHOST = "border border-border bg-transparent text-foreground hover:bg-[#4f6bff]/10 hover:border-[#4f6bff]/60 dark:border-white/15 dark:text-[#dfe4ff]";
const FP = "h-[38px] px-4 rounded-full border text-[12.5px] font-semibold inline-flex items-center gap-2 transition-all duration-200 ease-out hover:-translate-y-0.5 motion-reduce:transform-none motion-reduce:transition-none";
const FP_ON = "border-transparent text-white bg-gradient-to-b from-[#5873ff] to-[#2f4bd8] shadow-[0_0_18px_-4px_rgba(79,107,255,0.75)]";
const FP_OFF = "border-border text-muted-foreground hover:bg-[#4f6bff]/10 hover:border-[#4f6bff]/50 hover:text-foreground dark:border-white/10 dark:text-[#9aa4d2] dark:hover:text-[#e8ecff]";
const LG = "inline-flex items-center gap-[7px] text-xs text-muted-foreground dark:text-[#aab3df]";
const INPUT = "w-full mt-1.5 text-sm border rounded-xl px-3 h-10 bg-background";
const MODAL_LBL = "text-xs font-medium text-muted-foreground dark:text-[#8a94c4]";

function StatCard({ label, value, sub, color, icon, tone, tip, align }: { label: string; value: string; sub?: string; color?: string; icon: React.ReactNode; tone?: "red" | "green" | "blue"; tip: { rows: TipRow[]; note: string }; align: "left" | "center" | "right" }) {
  const iconCls = tone === "red" ? "text-red-500 border-red-400/30 bg-red-400/10 dark:text-[#fca5a5]" : tone === "green" ? "text-emerald-600 border-emerald-400/30 bg-emerald-400/10 dark:text-[#6ee7b7]" : "text-[#4f6bff] border-[#5b74ff]/30 bg-[#4f6bff]/10 dark:text-[#9fb0ff]";
  return (
    <HoverTip block side="bottom" align={align} className="min-w-0 h-full" title={label} rows={tip.rows} note={tip.note}>
    <div className={cn(PANEL, "group p-5 md:px-[22px] flex flex-col gap-2 min-h-[132px] h-full min-w-0 relative", tone === "red" && color === LOSS && "dark:border-red-400/30")}>
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-muted-foreground dark:text-[#8a94c4]">{label}</span>
        <span className={cn(ICO_SM, iconCls, "transition-[transform,box-shadow] duration-300 ease-out group-hover:scale-[1.03] group-hover:shadow-[0_0_16px_rgba(79,107,255,0.45)] motion-reduce:transform-none motion-reduce:transition-none")}>{icon}</span>
      </div>
      <p className={cn(KPI, "text-[28px] md:text-[30px] truncate", color)}>{value}</p>
      {sub && <p className={CAP}>{sub}</p>}
    </div>
    </HoverTip>
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
  const nExpense = allEntries.filter(e => e.type === "expense").length;
  const nPayout = allEntries.filter(e => e.type === "payout").length;
  const idr = (v: number) => formatCurrency(v, "IDR", false);

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

  const calMap = new Map<string, { expense: number; payout: number; count: number }>();
  for (const e of allEntries) {
    const key = format(new Date(e.date), "yyyy-MM-dd");
    const cur = calMap.get(key) ?? { expense: 0, payout: 0, count: 0 };
    cur.count += 1;
    if (e.type === "expense") cur.expense += e.amount;
    else cur.payout += e.amount;
    calMap.set(key, cur);
  }

  const currency = "IDR";

  if (loading) return <div className="flex items-center justify-center h-64 text-sm text-muted-foreground">Loading...</div>;

  const openAddEntry = () => { setEntryForm(f => ({ ...f, propFirmId: firms[0]?.id ?? "" })); setShowAddEntry(true); };
  const monthStr = format(calMonth, "yyyy-MM");
  const monthEntries = allEntries.filter(e => format(new Date(e.date), "yyyy-MM") === monthStr);
  const mExpense = monthEntries.filter(e => e.type === "expense").reduce((s, e) => s + e.amount, 0);
  const mPayout = monthEntries.filter(e => e.type === "payout").reduce((s, e) => s + e.amount, 0);
  const mNet = mPayout - mExpense;
  const sortedDesc = [...allEntries].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  const firstDate = sortedEntries[0] ? format(new Date(sortedEntries[0].date), "MMMM yyyy") : null;
  const AXIS = { fontSize: 11, fill: "#7d88bd" };

  return (
    <div className={PAGE}>
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <span className={ICO}><Building2 className="w-5 h-5" /></span>
          <div>
            <h1 className={H1}>Prop Firm Tracker</h1>
            <p className={SUB}>Pantau biaya challenge, payout, dan return dari semua prop firm Anda</p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2.5">
          <button onClick={() => setShowAddFirm(true)} className={cn(BTN, BTN_GHOST, "transition-colors")}>
            <Plus className="w-4 h-4" /> Add Firm
          </button>
          <button onClick={openAddEntry} className={cn(BTN, BTN_PRIMARY, "transition")}>
            <Plus className="w-4 h-4" /> Add Entry
          </button>
        </div>
      </div>

      {/* Firm tabs */}
      {firms.length > 0 && (
        <div className="flex flex-wrap gap-2">
          <HoverTip side="bottom" align="left" title="All Firms"
            rows={[{ label: "Firm", value: String(firms.length) }, { label: "Entries", value: String(firms.reduce((n: number, f: any) => n + f.entries.length, 0)) }]}
            note="Gabungan seluruh prop firm.">
            <button onClick={() => setSelectedFirm("all")} className={cn(FP, selectedFirm === "all" ? FP_ON : FP_OFF)}>All Firms</button>
          </HoverTip>
          {firms.map(f => {
            const fe: any[] = f.entries ?? [];
            const fx = fe.filter(e => e.type === "expense").reduce((n, e) => n + e.amount, 0);
            const fp = fe.filter(e => e.type === "payout").reduce((n, e) => n + e.amount, 0);
            return (
            <HoverTip key={f.id} side="bottom" align="left" title={f.name}
              rows={[
                { label: "Expense", value: idr(fx), tone: "loss" },
                { label: "Payout", value: idr(fp), tone: "win" },
                { label: "Net", value: formatCurrency(fp - fx, currency), tone: tn(fp - fx) },
                { label: "Entries", value: String(fe.length), tone: "muted" },
              ]}>
            <div className={cn(FP, "cursor-pointer pr-2", selectedFirm === f.id ? FP_ON : FP_OFF)} onClick={() => setSelectedFirm(f.id)} role="button">
              <span>{f.name}</span>
              <button aria-label="Hapus firm" onClick={e => { e.stopPropagation(); deleteFirm(f.id); }}
                className="w-[18px] h-[18px] rounded-full flex items-center justify-center bg-black/10 dark:bg-white/10 hover:text-red-400 transition-colors">
                <X className="w-[11px] h-[11px]" />
              </button>
            </div>
            </HoverTip>
            );
          })}
        </div>
      )}

      {firms.length === 0 ? (
        <div className={cn(PANEL, "p-12 md:p-16 text-center")}>
          <span className={cn(ICO, "mx-auto mb-4")}><Building2 className="w-5 h-5" /></span>
          <p className={cn(H2, "mb-1")}>No prop firms yet</p>
          <p className={cn(CAP, "mb-5")}>Add your first prop firm to start tracking</p>
          <button onClick={() => setShowAddFirm(true)} className={cn(BTN, BTN_PRIMARY)}>Add Firm</button>
        </div>
      ) : (
        <>
          {/* Stats */}
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
            <StatCard align="left" label="Total Expense" value={formatCurrency(totalExpense, currency, false)} color={LOSS} tone="red" icon={<TrendingDown className="w-4 h-4" />} sub={`${nExpense} purchases`}
              tip={{ rows: [{ label: "Pembelian", value: String(nExpense) }, { label: "Total", value: idr(totalExpense), tone: "loss" }, { label: "Rata-rata", value: idr(nExpense ? totalExpense / nExpense : 0), tone: "muted" }], note: "Jumlah semua entry bertipe expense (biaya challenge)." }} />
            <StatCard align="center" label="Total Payout" value={formatCurrency(totalPayout, currency, false)} color={WIN} tone="green" icon={<TrendingUp className="w-4 h-4" />} sub={`${nPayout} payouts`}
              tip={{ rows: [{ label: "Payout", value: String(nPayout) }, { label: "Total", value: idr(totalPayout), tone: "win" }, { label: "Rata-rata", value: idr(nPayout ? totalPayout / nPayout : 0), tone: "muted" }], note: "Jumlah semua entry bertipe payout yang diterima." }} />
            <StatCard align="center" label="Net Profit" value={formatCurrency(netProfit, currency)} color={netProfit >= 0 ? WIN : LOSS} tone="blue" icon={<TrendingUp className="w-4 h-4" />} sub="Payout − Expense"
              tip={{ rows: [{ label: "Total payout", value: idr(totalPayout), tone: "win" }, { label: "Total expense", value: idr(totalExpense), tone: "loss" }, { label: "Net profit", value: formatCurrency(netProfit, currency), tone: tn(netProfit) }], note: "Net profit = total payout − total expense." }} />
            <StatCard align="right" label="Net ROI" value={`${roi >= 0 ? "+" : ""}${roi.toFixed(1)}%`} color={roi >= 0 ? WIN : LOSS} tone={roi >= 0 ? "green" : "red"} icon={<Percent className="w-4 h-4" />} sub="Return on investment"
              tip={{ rows: [{ label: "Net profit", value: formatCurrency(netProfit, currency), tone: tn(netProfit) }, { label: "Total expense", value: idr(totalExpense), tone: "loss" }, { label: "ROI", value: `${roi >= 0 ? "+" : ""}${roi.toFixed(1)}%`, tone: tn(roi) }, { label: "Entries", value: `${nExpense} exp · ${nPayout} pay`, tone: "muted" }], note: "ROI = net profit ÷ total expense × 100%." }} />
          </div>

          {/* Chart */}
          <div className={cn(PANEL, "p-5 md:px-6 md:py-[22px]")}>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className={H2}>Cumulative Expense vs Payout</h2>
                <p className={cn(CAP, "mt-1")}>Akumulasi pengeluaran dan payout{firstDate ? ` sejak ${firstDate}` : ""}</p>
              </div>
              <div className="flex items-center gap-4">
                <span className={LG}><i className="inline-block w-3 h-[3px] rounded-sm bg-[#ef4444]" />Expense</span>
                <span className={LG}><i className="inline-block w-3 h-[3px] rounded-sm bg-[#22c55e]" />Payout</span>
              </div>
            </div>
            <div className="mt-3.5">
              {chartData.length > 0 ? (
                <ResponsiveContainer width="100%" height={248}>
                  <AreaChart data={chartData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                    <defs>
                      <linearGradient id="payGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#22c55e" stopOpacity={0.3} />
                        <stop offset="100%" stopColor="#22c55e" stopOpacity={0} />
                      </linearGradient>
                      <linearGradient id="expGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#ef4444" stopOpacity={0.34} />
                        <stop offset="100%" stopColor="#ef4444" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 5" stroke="rgba(122,140,255,0.15)" vertical={false} />
                    <XAxis dataKey="date" tick={AXIS} axisLine={false} tickLine={false} />
                    <YAxis tick={AXIS} width={56} axisLine={false} tickLine={false}
                      tickFormatter={v => `${(v/1000000).toFixed(1)}M`} />
                    <ReferenceLine y={0} stroke="#22c55e" strokeWidth={1.5} />
                    <Tooltip contentStyle={TOOLTIP_STYLE} labelStyle={TOOLTIP_LABEL} itemStyle={TOOLTIP_ITEM} cursor={{ stroke: "rgba(122,140,255,0.35)", strokeDasharray: "3 3" }} formatter={(v: number, name: string) => [formatCurrency(v, currency, false), name === "payout" ? "Payout" : name === "expense" ? "Expense" : "Net"]} />
                    <Area type="monotone" dataKey="payout" stroke="#22c55e" strokeWidth={2.4} fill="url(#payGrad)" dot={false} />
                    <Area type="monotone" dataKey="expense" stroke="#f87171" strokeWidth={2.4} fill="url(#expGrad)" dot={false} />
                  </AreaChart>
                </ResponsiveContainer>
              ) : <div className="h-[248px] flex items-center justify-center text-sm text-muted-foreground">No data yet</div>}
            </div>
          </div>

          <div className="flex flex-wrap gap-4 items-start">
            {/* Calendar */}
            <div className={cn(PANEL, "flex-[1_1_560px] min-w-0 p-5 md:px-6 md:py-[22px]")}>
              <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
                <div className="flex flex-wrap items-center gap-x-3.5 gap-y-2">
                  <h2 className={H2}>Activity Calendar</h2>
                  <span className={CAP}>Expense <b className={LOSS}>{formatCurrency(mExpense, currency, false)}</b></span>
                  <span className={CAP}>Payout <b className={WIN}>{formatCurrency(mPayout, currency, false)}</b></span>
                  <span className={cn("inline-flex items-center h-[22px] px-[9px] rounded-full text-[11px] font-bold border", mNet >= 0 ? "bg-emerald-400/15 text-emerald-600 border-emerald-400/30 dark:text-emerald-300" : "bg-red-400/15 text-red-600 border-red-400/30 dark:text-red-300")}>
                    Net {formatCurrency(mNet, currency)}
                  </span>
                </div>
                <div className="flex items-center gap-2.5">
                  <button aria-label="Bulan sebelumnya" onClick={() => setCalMonth(m => new Date(m.getFullYear(), m.getMonth() - 1))} className="w-[34px] h-[34px] rounded-[10px] border border-border dark:border-white/10 flex items-center justify-center hover:bg-[#4f6bff]/10 hover:border-[#4f6bff]/50 transition-colors"><ChevronLeft className="w-4 h-4" /></button>
                  <b className="text-sm min-w-[110px] text-center">{format(calMonth, "MMMM yyyy")}</b>
                  <button aria-label="Bulan berikutnya" onClick={() => setCalMonth(m => new Date(m.getFullYear(), m.getMonth() + 1))} className="w-[34px] h-[34px] rounded-[10px] border border-border dark:border-white/10 flex items-center justify-center hover:bg-[#4f6bff]/10 hover:border-[#4f6bff]/50 transition-colors"><ChevronRight className="w-4 h-4" /></button>
                </div>
              </div>
              <div className="grid grid-cols-7 gap-1.5 mb-1.5">
                {["Min", "Sen", "Sel", "Rab", "Kam", "Jum", "Sab"].map(d => (
                  <div key={d} className="text-[10px] md:text-[11px] font-bold tracking-[0.08em] uppercase text-muted-foreground dark:text-[#7d88bd] px-1">{d}</div>
                ))}
              </div>
              {weeks.map((wk, wi) => (
                <div key={wi} className="grid grid-cols-7 gap-1.5 mb-1.5">
                  {wk.map((day, di) => {
                    if (!day) return <div key={di} className="h-[56px] md:h-[70px] rounded-[11px] border border-dashed border-border/40 dark:border-[#7a8cff]/10" />;
                    const key = format(day, "yyyy-MM-dd");
                    const data = calMap.get(key);
                    const isToday = key === format(new Date(), "yyyy-MM-dd");
                    const hasPayout = data && data.payout > 0;
                    const hasExpense = data && data.expense > 0;
                    const bg = hasPayout && hasExpense ? "rgba(99,102,241,0.25)" : hasPayout ? "rgba(34,197,94,0.2)" : hasExpense ? "rgba(239,68,68,0.2)" : undefined;
                    const border = hasPayout && hasExpense ? "rgba(129,140,248,0.55)" : hasPayout ? "rgba(74,222,128,0.55)" : hasExpense ? "rgba(248,113,113,0.5)" : isToday ? "#5b74ff" : undefined;
                    const cell = (
                      <div className={cn("h-[56px] md:h-[70px] min-w-0 rounded-[11px] border p-1.5 md:px-2.5 md:py-2 flex flex-col gap-0.5 border-border bg-secondary/30 dark:border-[#7a8cff]/10 dark:bg-white/[0.02] transition-[transform,box-shadow,filter] duration-200 ease-out hover:scale-[1.03] hover:brightness-125 hover:shadow-[0_0_16px_rgba(79,107,255,0.4)] motion-reduce:transform-none motion-reduce:transition-none", isToday && "shadow-[0_0_0_3px_rgba(79,107,255,0.18)]")}
                        style={{ background: bg, borderColor: border }}>
                        <span className={cn("text-[11.5px] font-bold", isToday ? "text-[#4f6bff] dark:text-[#c7d0ff]" : "text-muted-foreground dark:text-[#9aa4d2]")}>{format(day, "d")}</span>
                        {hasPayout && <span className={cn("text-[10px] md:text-[11px] font-bold font-mono truncate", WIN)}>+{(data!.payout/1000000).toFixed(1)}M</span>}
                        {hasExpense && <span className={cn("text-[10px] md:text-[11px] font-bold font-mono truncate", LOSS)}>-{(data!.expense/1000000).toFixed(1)}M</span>}
                      </div>
                    );
                    if (!data) return <div key={di} className="min-w-0">{cell}</div>;
                    return (
                      <HoverTip key={di} block className="min-w-0" side={wi < 2 ? "bottom" : "top"} align={di < 2 ? "left" : di > 4 ? "right" : "center"}
                        title={format(day, "EEE, dd MMM yyyy")}
                        rows={[
                          { label: "Expense", value: idr(data.expense), tone: data.expense > 0 ? "loss" : "muted" },
                          { label: "Payout", value: idr(data.payout), tone: data.payout > 0 ? "win" : "muted" },
                          { label: "Net", value: formatCurrency(data.payout - data.expense, currency), tone: tn(data.payout - data.expense) },
                          { label: "Entries", value: String(data.count), tone: "muted" },
                        ]}>
                        {cell}
                      </HoverTip>
                    );
                  })}
                </div>
              ))}
              <div className="flex flex-wrap gap-[18px] mt-4 pt-3.5 border-t dark:border-[#7a8cff]/10">
                <span className={LG}><i className="inline-block w-3 h-3 rounded-[4px] border bg-[#22c55e]/30 border-[#4ade80]/55" />Payout</span>
                <span className={LG}><i className="inline-block w-3 h-3 rounded-[4px] border bg-[#ef4444]/30 border-[#f87171]/50" />Expense</span>
                <span className={LG}><i className="inline-block w-3 h-3 rounded-[4px] border bg-[#6366f1]/35 border-[#818cf8]/55" />Both</span>
              </div>
            </div>

            {/* Entry list */}
            <div className={cn(PANEL, "flex-[1_1_400px] min-w-0")}>
              <div className="flex items-center justify-between px-5 md:px-6 pt-5 pb-3.5 border-b dark:border-[#7a8cff]/10">
                <h2 className={H2}>Transaction History</h2>
                <span className="inline-flex items-center h-6 px-2.5 rounded-full text-[11px] font-bold border bg-[#4f6bff]/15 text-[#3b57e8] border-[#4f6bff]/40 dark:bg-[#4f6bff]/20 dark:text-[#a5b4ff] dark:border-[#7a8cff]/40">{allEntries.length} entries</span>
              </div>
              <div className="max-h-[560px] overflow-y-auto rounded-b-2xl">
                {sortedDesc.length === 0 ? (
                  <div className="py-10 text-center text-sm text-muted-foreground">No entries yet</div>
                ) : sortedDesc.map((e, idx) => (
                  <div key={e.id} className="group flex flex-wrap items-center gap-4 px-5 md:px-6 py-[13px] border-b last:border-b-0 dark:border-[#7a8cff]/[0.08] transition-[background-color,box-shadow] duration-200 ease-out hover:bg-[#2a3a9f]/10 dark:hover:bg-[#2a3a9f]/[0.14] hover:shadow-[inset_3px_0_0_0_#4f6bff] motion-reduce:transition-none">
                    <HoverTip side={idx < 2 ? "bottom" : "top"} align="left" title={e.firmName}
                      rows={[
                        { label: "Tipe", value: e.type === "payout" ? "Payout" : "Expense", tone: e.type === "payout" ? "win" : "loss" },
                        { label: "Tanggal", value: format(new Date(e.date), "dd MMM yyyy") },
                        { label: "Jumlah", value: `${e.type === "payout" ? "+" : "-"}${formatCurrency(e.amount, currency, false)}`, tone: e.type === "payout" ? "win" : "loss" },
                        ...(e.note ? [{ label: "Catatan", value: String(e.note), tone: "muted" as const }] : []),
                      ]}>
                    <span className={cn("inline-flex items-center justify-center w-[74px] py-1 rounded-[7px] text-[10.5px] font-extrabold tracking-[0.06em] border",
                      e.type === "payout" ? "bg-emerald-400/15 text-emerald-700 border-emerald-400/30 dark:text-[#6ee7b7]" : "bg-red-400/15 text-red-700 border-red-400/30 dark:text-[#fca5a5]")}>
                      {e.type === "payout" ? "PAYOUT" : "EXPENSE"}
                    </span>
                    </HoverTip>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold truncate">{e.firmName}</p>
                      {e.note && <p className={cn(CAP, "mt-0.5 truncate")}>{e.note}</p>}
                    </div>
                    <div className="text-right">
                      <p className={cn("text-sm font-bold font-mono tabular-nums", e.type === "payout" ? WIN : LOSS)}>
                        {e.type === "payout" ? "+" : "-"}{formatCurrency(e.amount, currency, false)}
                      </p>
                      <p className={cn(CAP, "mt-0.5")}>{format(new Date(e.date), "dd MMM yyyy")}</p>
                    </div>
                    <button aria-label="Hapus" onClick={() => deleteEntry(e.id)} className="w-8 h-8 rounded-[9px] flex items-center justify-center text-muted-foreground dark:text-[#7d88bd] hover:bg-red-400/15 hover:text-red-500 dark:hover:text-[#f87171] transition-all duration-200 ease-out md:opacity-0 md:group-hover:opacity-100 focus-visible:opacity-100 motion-reduce:transition-none">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </>
      )}

      {/* Add Firm Modal */}
      {showAddFirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={() => setShowAddFirm(false)}>
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />
          <div className={cn(PANEL, "relative p-6 w-full max-w-sm shadow-2xl")} onClick={e => e.stopPropagation()}>
            <h2 className={cn(H2, "mb-4")}>Add Prop Firm</h2>
            <input type="text" value={newFirmName} onChange={e => setNewFirmName(e.target.value)}
              placeholder="e.g. FTMO, MyForexFunds, The5ers"
              className={cn(INPUT, "mt-0 mb-4")} autoFocus />
            <div className="flex gap-2.5">
              <button onClick={() => setShowAddFirm(false)} className={cn(BTN, BTN_GHOST, "flex-1 justify-center")}>Cancel</button>
              <button onClick={addFirm} disabled={!newFirmName.trim() || saving}
                className={cn(BTN, BTN_PRIMARY, "flex-1 justify-center disabled:opacity-50")}>
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
          <div className={cn(PANEL, "relative p-6 w-full max-w-sm shadow-2xl")} onClick={e => e.stopPropagation()}>
            <h2 className={cn(H2, "mb-4")}>Add Entry</h2>
            <div className="space-y-3.5">
              <div>
                <label className={MODAL_LBL}>Prop Firm</label>
                <select value={entryForm.propFirmId} onChange={e => setEntryForm(f => ({ ...f, propFirmId: e.target.value }))}
                  className={INPUT}>
                  {firms.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
                </select>
              </div>
              <div className="flex gap-2">
                {(["expense", "payout"] as const).map(t => (
                  <button key={t} onClick={() => setEntryForm(f => ({ ...f, type: t }))}
                    className={cn("flex-1 h-10 rounded-xl text-[13px] font-semibold capitalize transition-colors",
                      entryForm.type === t ? t === "expense" ? "bg-[#dc2626] text-white" : "bg-[#16a34a] text-white" : "bg-muted text-muted-foreground")}>
                    {t}
                  </button>
                ))}
              </div>
              <div>
                <label className={MODAL_LBL}>Amount (IDR)</label>
                <input type="number" value={entryForm.amount} onChange={e => setEntryForm(f => ({ ...f, amount: e.target.value }))}
                  placeholder="0" className={cn(INPUT, "font-mono")} />
              </div>
              <div>
                <label className={MODAL_LBL}>Note (optional)</label>
                <input type="text" value={entryForm.note} onChange={e => setEntryForm(f => ({ ...f, note: e.target.value }))}
                  placeholder="e.g. Phase 1 challenge" className={INPUT} />
              </div>
              <div>
                <label className={MODAL_LBL}>Date</label>
                <input type="date" value={entryForm.date} onChange={e => setEntryForm(f => ({ ...f, date: e.target.value }))}
                  className={INPUT} />
              </div>
            </div>
            <div className="flex gap-2.5 mt-5">
              <button onClick={() => setShowAddEntry(false)} className={cn(BTN, BTN_GHOST, "flex-1 justify-center")}>Cancel</button>
              <button onClick={addEntry} disabled={!entryForm.propFirmId || !entryForm.amount || saving}
                className={cn(BTN, BTN_PRIMARY, "flex-1 justify-center disabled:opacity-50")}>
                {saving ? "..." : "Add"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
