"use client";
import { useEffect, useState, useCallback } from "react";
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, Tooltip,
  ResponsiveContainer, CartesianGrid, ReferenceLine, Cell,
} from "recharts";
import { ChevronLeft, ChevronRight, Info } from "lucide-react";
import { cn, formatCurrency, formatR } from "@/lib/utils";
import Link from "next/link";
import {
  format, startOfMonth, endOfMonth, eachDayOfInterval,
  getDay, addMonths, subMonths,
} from "date-fns";

const PERIODS = [
  { label: "7D", value: "7d" },
  { label: "1M", value: "1m" },
  { label: "3M", value: "3m" },
  { label: "YTD", value: "ytd" },
  { label: "All", value: "all" },
];

const CURVE_COLOR = "#6366f1";
const DAYS_OF_WEEK_FULL = ["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"];

const TOOLTIP_STYLE = {
  fontSize: 11,
  borderRadius: 8,
  backgroundColor: '#0f0f1a',
  border: '1px solid rgba(255,255,255,0.12)',
  color: '#ffffff',
  boxShadow: '0 4px 16px rgba(0,0,0,0.6)',
};

function StatCard({ label, value, sub, color }: { label: string; value: string; sub?: string; color?: string }) {
  return (
    <div className="bg-card border rounded-xl p-3">
      <p className="text-[10px] text-muted-foreground mb-0.5">{label}</p>
      <p className={cn("text-base font-semibold tracking-tight truncate", color ?? "text-foreground")}>{value}</p>
      {sub && <p className="text-[10px] text-muted-foreground mt-0.5 truncate">{sub}</p>}
    </div>
  );
}

function CalendarHeatmap({ calendarData, currency }: { calendarData: any[]; currency?: string }) {
  const [current, setCurrent] = useState(new Date());
  const dataMap = new Map(calendarData.map((d) => [d.date, d]));

  const start = startOfMonth(current);
  const end = endOfMonth(current);
  const days = eachDayOfInterval({ start, end });
  const startDow = getDay(start);

  function summarizeWeek(wdays: any[]) {
    let pnl = 0, tradeDays = 0, tradeCount = 0;
    for (const d of wdays) {
      if (!d) continue;
      const entry = dataMap.get(format(d, "yyyy-MM-dd"));
      if (entry) { pnl += entry.pnl; tradeDays++; tradeCount += entry.tradeCount; }
    }
    return { pnl, tradeDays, tradeCount };
  }

  const weeks: (Date | null)[][] = [];
  let week: (Date | null)[] = Array(startDow).fill(null);
  for (const day of days) {
    week.push(day);
    if (week.length === 7) { weeks.push(week); week = []; }
  }
  if (week.length > 0) { while (week.length < 7) week.push(null); weeks.push(week); }

  const totalPnl = calendarData
    .filter((d) => d.date.startsWith(format(current, "yyyy-MM")))
    .reduce((s, d) => s + d.pnl, 0);
  const totalTradeDays = calendarData.filter((d) => d.date.startsWith(format(current, "yyyy-MM"))).length;

  function getCellColors(pnl: number) {
    const isDark = typeof window !== "undefined" && document.documentElement.classList.contains("dark");
    if (pnl > 0) return isDark
      ? { bg: "rgba(22,163,74,0.2)", border: "rgba(22,163,74,0.6)", text: "#86efac" }
      : { bg: "#f0fdf4", border: "#86efac", text: "#15803d" };
    if (pnl < 0) return isDark
      ? { bg: "rgba(220,38,38,0.2)", border: "rgba(220,38,38,0.6)", text: "#fca5a5" }
      : { bg: "#fff1f2", border: "#fca5a5", text: "#b91c1c" };
    return { bg: "transparent", border: "hsl(var(--border))", text: "#64748b" };
  }

  const fmtPnl = (v: number) => formatCurrency(v, currency ?? "USD");

  return (
    <div className="bg-card border rounded-xl p-3">
      {/* Header */}
      <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
        <div className="flex items-center gap-1.5">
          <button onClick={() => setCurrent(subMonths(current, 1))} className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-muted transition-colors border">
            <ChevronLeft className="w-3.5 h-3.5" />
          </button>
          <span className="text-xs font-semibold min-w-[110px] text-center">{format(current, "MMMM yyyy")}</span>
          <button onClick={() => setCurrent(addMonths(current, 1))} className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-muted transition-colors border">
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
          <button onClick={() => setCurrent(new Date())} className="text-[10px] px-2 py-1 rounded-lg border text-muted-foreground hover:bg-muted transition-colors">
            Now
          </button>
        </div>
        <div className="flex items-center gap-2">
          <span className={cn("font-semibold text-xs", totalPnl >= 0 ? "text-[#16a34a]" : "text-[#dc2626]")}>{fmtPnl(totalPnl)}</span>
          <span className="text-[10px] text-muted-foreground">{totalTradeDays}d</span>
        </div>
      </div>

      {/* Day headers */}
      <div className="grid grid-cols-8 gap-1 mb-1.5">
        {["S","M","T","W","T","F","S","Wk"].map((d, i) => (
          <div key={i} className="text-center text-[9px] font-medium text-muted-foreground">{d}</div>
        ))}
      </div>

      {/* Weeks */}
      {weeks.map((wk, wi) => {
        const { pnl: wPnl, tradeDays: wDays, tradeCount: wTrades } = summarizeWeek(wk);
        const wColors = wDays > 0 ? getCellColors(wPnl) : null;
        return (
          <div key={wi} className="grid grid-cols-8 gap-1 mb-1">
            {wk.map((day, di) => {
              if (!day) return <div key={di} className="rounded-xl border border-dashed border-border/30 h-10 md:h-16" />;
              const key = format(day, "yyyy-MM-dd");
              const entry = dataMap.get(key);
              const c = entry ? getCellColors(entry.pnl) : null;
              const isToday = key === format(new Date(), "yyyy-MM-dd");
              return (
                <div key={di}
                  className="rounded-xl border h-10 md:h-16 p-1 md:p-2 flex flex-col justify-between transition-all"
                  style={c
                    ? { background: c.bg, borderColor: c.border }
                    : { background: "var(--card)", borderColor: isToday ? "#6366f1" : "hsl(var(--border))" }
                  }>
                  <p className={cn("text-[9px] font-semibold leading-none", isToday && !c ? "text-indigo-500" : "text-muted-foreground")}>
                    {format(day, "d")}
                  </p>
                  {entry && (
                    <>
                      <p className="text-[7px] md:text-[11px] font-bold leading-none truncate" style={{ color: c?.text }}>
                        {fmtPnl(entry.pnl)}
                      </p>
                      <p className="text-[6px] md:text-[9px] leading-none" style={{ color: c?.text, opacity: 0.7 }}>
                        {entry.tradeCount} {entry.tradeCount === 1 ? "Trade" : "Trades"}
                      </p>
                    </>
                  )}
                </div>
              );
            })}
            {/* Week summary */}
            <div className="rounded-xl border h-10 md:h-16 p-1 md:p-2 flex flex-col justify-between"
              style={wColors ? { background: wColors.bg, borderColor: wColors.border } : { borderColor: "hsl(var(--border))" }}>
              <p className="text-[7px] md:text-[10px] text-muted-foreground leading-none">W{wi + 1}</p>
              <p className="text-[7px] md:text-[11px] font-bold leading-none truncate" style={{ color: wColors ? wColors.text : "hsl(var(--muted-foreground))" }}>
                {wDays > 0 ? fmtPnl(wPnl) : "$0"}
              </p>
              {wTrades > 0 && (
                <p className="text-[6px] md:text-[9px] leading-none" style={{ color: wColors ? wColors.text : "hsl(var(--muted-foreground))", opacity: 0.7 }}>
                  {wTrades} {wTrades === 1 ? "Trade" : "Trades"}
                </p>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

export default function DashboardPage() {
  const [period, setPeriod] = useState("all");
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [selectedAccountId, setSelectedAccountId] = useState<string>("");
  const [accountOpen, setAccountOpen] = useState(false);
  const [equityView, setEquityView] = useState<"daily"|"weekly"|"monthly">("daily");
  const [goalInput, setGoalInput] = useState("");
  const [editingGoal, setEditingGoal] = useState(false);
  const [savingGoal, setSavingGoal] = useState(false);

  const fetchData = useCallback(() => {
    setLoading(true);
    const params = new URLSearchParams({ period });
    if (selectedAccountId) params.set("accountId", selectedAccountId);
    fetch(`/api/dashboard?${params}`)
      .then((r) => r.json())
      .then((d) => { setData(d); setLoading(false); })
      .catch(() => setLoading(false));
  }, [period, selectedAccountId]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const stats = data?.stats;
  const equityCurve = data?.equityCurve ?? [];
  const bySymbol = data?.bySymbol ?? [];
  const bySession = data?.bySession ?? [];
  const recentTrades = data?.recentTrades ?? [];
  const calendar = data?.calendar ?? [];

  const bestDay = calendar.length ? calendar.reduce((a: any, b: any) => b.pnl > a.pnl ? b : a, calendar[0]) : null;
  const worstDay = calendar.length ? calendar.reduce((a: any, b: any) => b.pnl < a.pnl ? b : a, calendar[0]) : null;

  const rawCurve = equityCurve.length > 0
    ? equityCurve.map((p: any) => ({
        date: p.date,
        pnl: Math.round((p.balance - (data?.account?.initialBalance ?? 0)) * 100) / 100,
      }))
    : (() => {
        let running = 0;
        return calendar
          .slice()
          .sort((a: any, b: any) => a.date.localeCompare(b.date))
          .map((d: any) => { running += d.pnl; return { date: d.date, pnl: Math.round(running * 100) / 100 }; });
      })();

  // Aggregate equity curve by view
  const aggregateEquity = (view: "daily"|"weekly"|"monthly") => {
    if (!rawCurve.length) return [];
    if (view === "daily") return rawCurve.map((p: any) => ({ ...p, date: p.date.slice(5) }));
    const map = new Map<string, number>();
    for (const p of rawCurve) {
      const d = new Date(p.date);
      let key = "";
      if (view === "weekly") {
        const weekStart = new Date(d);
        weekStart.setDate(d.getDate() - d.getDay());
        key = weekStart.toISOString().slice(0, 10).slice(5);
      } else {
        key = p.date.slice(0, 7).replace("-", "/");
      }
      map.set(key, p.pnl); // ambil nilai terakhir per period
    }
    return Array.from(map.entries()).map(([date, pnl]) => ({ date, pnl }));
  };

  const cumulativeCurve = aggregateEquity(equityView);

  // Earnings stats
  const now = new Date();
  const todayStr = now.toISOString().slice(0, 10);
  const weekStart = new Date(now); weekStart.setDate(now.getDate() - now.getDay());
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);
  const weekStartStr = weekStart.toISOString().slice(0, 10);

  const sumPnl = (from: string, to?: string) => calendar
    .filter((d: any) => d.date >= from && (!to || d.date <= (to ?? todayStr)))
    .reduce((s: number, d: any) => s + d.pnl, 0);

  const todayPnl = sumPnl(todayStr);
  const weekPnl = sumPnl(weekStartStr);
  const monthPnl = sumPnl(monthStart);

  // Prev period for % change
  const prevDayStr = new Date(now.getTime() - 86400000).toISOString().slice(0, 10);
  const prevWeekStart = new Date(weekStart.getTime() - 7 * 86400000).toISOString().slice(0, 10);
  const prevMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString().slice(0, 10);
  const prevMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0).toISOString().slice(0, 10);

  const prevDayPnl = sumPnl(prevDayStr, prevDayStr);
  const prevWeekPnl = sumPnl(prevWeekStart, new Date(weekStart.getTime() - 1).toISOString().slice(0, 10));
  const prevMonthPnl = sumPnl(prevMonthStart, prevMonthEnd);

  const pctChange = (cur: number, prev: number) => prev === 0 ? null : ((cur - prev) / Math.abs(prev)) * 100;

  const monthlyGoal = data?.account?.monthlyGoal ?? 0;
  const goalPct = monthlyGoal > 0 ? Math.min(100, (monthPnl / monthlyGoal) * 100) : 0;

  async function saveGoal() {
    if (!data?.account?.id) return;
    setSavingGoal(true);
    await fetch(`/api/accounts/${data.account.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ monthlyGoal: parseFloat(goalInput) || 0 }),
    });
    setSavingGoal(false);
    setEditingGoal(false);
    fetchData();
  }

  const dailyBarData = calendar
    .slice()
    .sort((a: any, b: any) => a.date.localeCompare(b.date))
    .map((d: any) => ({ date: d.date.slice(5), pnl: Math.round(d.pnl * 100) / 100 }));

  const dowPnl: Record<number, { pnl: number; count: number }> = {};
  for (const d of calendar) {
    const dow = getDay(new Date(d.date));
    if (!dowPnl[dow]) dowPnl[dow] = { pnl: 0, count: 0 };
    dowPnl[dow].pnl += d.pnl;
    dowPnl[dow].count += d.tradeCount;
  }
  const dowEntries = Object.entries(dowPnl);
  const mostProfitableDoW = dowEntries.length ? dowEntries.reduce((a, b) => b[1].pnl > a[1].pnl ? b : a) : null;
  const mostActiveDoW = dowEntries.length ? dowEntries.reduce((a, b) => b[1].count > a[1].count ? b : a) : null;

  const avgDuration = (() => {
    const withDuration = recentTrades.filter((t: any) => t.exitDate && t.entryDate);
    if (!withDuration.length) return null;
    const avgMs = withDuration.reduce((s: number, t: any) =>
      s + (new Date(t.exitDate).getTime() - new Date(t.entryDate).getTime()), 0
    ) / withDuration.length;
    const h = Math.floor(avgMs / 3600000);
    const m = Math.floor((avgMs % 3600000) / 60000);
    return h > 0 ? `${h}h ${m}m` : `${m}m`;
  })();

  const sessionLabel: Record<string, string> = {
    london: "London", newyork: "New York", asia: "Asia", sydney: "Sydney", unknown: "Unknown",
  };

  return (
    <div className="p-3 space-y-3">
      {/* Top bar */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold">Dashboard</span>
          {/* Account Switcher Dropdown */}
          {data?.accounts && data.accounts.length > 0 && (
            <div className="relative">
              <button
                onClick={() => setAccountOpen(!accountOpen)}
                className="flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-lg bg-indigo-50 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800 hover:border-indigo-400 transition-colors max-w-[160px]"
              >
                <span className="truncate">{data.account?.name ?? "Select Account"}</span>
                <svg className="w-3 h-3 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>
              {accountOpen && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setAccountOpen(false)} />
                  <div className="absolute left-0 top-8 z-50 min-w-[180px] border rounded-xl shadow-xl py-1 overflow-hidden" style={{ backgroundColor: "hsl(var(--card))" }}>
                    {data.accounts.map((acc: any) => (
                      <button
                        key={acc.id}
                        onClick={() => {
                          setSelectedAccountId(acc.id);
                          setAccountOpen(false);
                        }}
                        className={cn(
                          "w-full text-left px-3 py-2 text-xs hover:bg-muted transition-colors flex items-center justify-between gap-2",
                          (selectedAccountId === acc.id || (!selectedAccountId && acc.isDefault)) && "text-indigo-500 font-medium"
                        )}
                      >
                        <span className="truncate">{acc.name}</span>
                        {(selectedAccountId === acc.id || (!selectedAccountId && acc.isDefault)) && (
                          <svg className="w-3 h-3 shrink-0 text-indigo-500" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                          </svg>
                        )}
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>
          )}
        </div>
        <div className="flex items-center gap-1 flex-wrap">
          {PERIODS.map((p) => (
            <button key={p.value} onClick={() => setPeriod(p.value)}
              className={cn("text-[11px] px-2 py-1 rounded-lg transition-colors",
                period === p.value ? "bg-indigo-600 text-white" : "border text-muted-foreground hover:text-foreground"
              )}>{p.label}</button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="h-64 flex items-center justify-center text-sm text-muted-foreground">Loading...</div>
      ) : (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
            <StatCard label="Net P&L" value={stats ? formatCurrency(stats.netPnL, data?.account?.currency) : "—"} sub={`${stats?.closedTrades ?? 0} trades closed`} color={stats?.netPnL > 0 ? "text-[#16a34a]" : stats?.netPnL < 0 ? "text-[#dc2626]" : undefined} />
            <StatCard label="Win Rate" value={stats ? `${stats.winRate.toFixed(1)}%` : "—"} sub={`of ${stats?.closedTrades ?? 0} trades`} />
            <StatCard label="Avg R-Multiple" value={stats ? formatR(stats.avgR) : "—"} sub="per trade" color={stats?.avgR > 0 ? "text-[#16a34a]" : stats?.avgR < 0 ? "text-[#dc2626]" : undefined} />
            <StatCard label="Profit Factor" value={stats ? stats.profitFactor.toFixed(2) : "—"} sub="gross win / loss" color={stats?.profitFactor >= 1 ? "text-[#16a34a]" : "text-[#dc2626]"} />
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
            <StatCard label="Best Day" value={bestDay ? formatCurrency(bestDay.pnl, data?.account?.currency) : "—"} sub={bestDay ? format(new Date(bestDay.date), "EEE, MMM d") : undefined} color={bestDay?.pnl > 0 ? "text-[#16a34a]" : undefined} />
            <StatCard label="Worst Day" value={worstDay ? formatCurrency(worstDay.pnl, data?.account?.currency) : "—"} sub={worstDay ? format(new Date(worstDay.date), "EEE, MMM d") : undefined} color={worstDay?.pnl < 0 ? "text-[#dc2626]" : undefined} />
            <StatCard label="Most Profitable Day" value={mostProfitableDoW ? DAYS_OF_WEEK_FULL[parseInt(mostProfitableDoW[0])] : "—"} sub={mostProfitableDoW ? formatCurrency(mostProfitableDoW[1].pnl, data?.account?.currency) : undefined} color="text-[#16a34a]" />
            <StatCard label="Most Active Day" value={mostActiveDoW ? DAYS_OF_WEEK_FULL[parseInt(mostActiveDoW[0])] : "—"} sub={mostActiveDoW ? `${mostActiveDoW[1].count} total trades` : undefined} />
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
            <StatCard label="Avg Win" value={stats?.avgWin != null ? formatCurrency(stats.avgWin, data?.account?.currency) : "—"} sub="per winning trade" color="text-[#16a34a]" />
            <StatCard label="Avg Loss" value={stats?.avgLoss != null ? formatCurrency(stats.avgLoss, data?.account?.currency) : "—"} sub="per losing trade" color="text-[#dc2626]" />
            <StatCard label="Avg Trade Duration" value={avgDuration ?? "—"} sub="across recent trades" />
            <StatCard label="Current Streak" value={stats?.streak ? `${stats.streak.current} ${stats.streak.type === 'win' ? '🔥' : '❄️'}` : "—"} sub={stats?.streak ? `Max win: ${stats.streak.maxWin} · Max loss: ${stats.streak.maxLoss}` : undefined} color={stats?.streak?.type === 'win' ? 'text-[#16a34a]' : 'text-[#dc2626]'} />
          </div>

          {/* Earnings + Monthly Goal */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {/* Earnings Card */}
            <div className="bg-card border rounded-xl p-4">
              <p className="text-xs font-semibold mb-3">Earnings</p>
              <div className="grid grid-cols-3 gap-3">
                {[
                  { label: "Today", pnl: todayPnl, prev: prevDayPnl },
                  { label: "This Week", pnl: weekPnl, prev: prevWeekPnl },
                  { label: "This Month", pnl: monthPnl, prev: prevMonthPnl },
                ].map(({ label, pnl, prev }) => {
                  const pct = pctChange(pnl, prev);
                  return (
                    <div key={label} className="bg-muted/40 rounded-lg p-3">
                      <p className="text-[10px] text-muted-foreground mb-1">{label}</p>
                      <p className={`text-xs font-bold ${pnl >= 0 ? "text-[#16a34a]" : "text-[#dc2626]"}`}>
                        {formatCurrency(pnl, data?.account?.currency)}
                      </p>
                      {pct !== null && (
                        <p className={`text-[10px] mt-0.5 font-medium ${pct >= 0 ? "text-[#16a34a]" : "text-[#dc2626]"}`}>
                          {pct >= 0 ? "▲" : "▼"} {Math.abs(pct).toFixed(1)}% vs prev
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Monthly Goal Card */}
            <div className="bg-card border rounded-xl p-4">
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs font-semibold">Monthly Profit Goal</p>
                <button onClick={() => { setEditingGoal(true); setGoalInput(String(monthlyGoal || "")); }}
                  className="text-[10px] text-indigo-500 hover:underline">
                  {monthlyGoal > 0 ? "Edit" : "Set Goal"}
                </button>
              </div>
              {editingGoal ? (
                <div className="flex items-center gap-2 mt-2">
                  <input
                    type="number"
                    value={goalInput}
                    onChange={e => setGoalInput(e.target.value)}
                    placeholder="e.g. 10000000"
                    className="flex-1 text-xs border rounded-lg px-2 py-1.5 bg-background"
                  />
                  <button onClick={saveGoal} disabled={savingGoal}
                    className="text-[10px] px-2.5 py-1.5 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50">
                    {savingGoal ? "..." : "Save"}
                  </button>
                  <button onClick={() => setEditingGoal(false)} className="text-[10px] text-muted-foreground hover:text-foreground">Cancel</button>
                </div>
              ) : monthlyGoal > 0 ? (
                <div className="flex flex-col items-center">
                  {/* Gauge setengah lingkaran */}
                  <div className="relative w-40 h-20 mt-1">
                    <svg viewBox="0 0 160 80" className="w-full h-full">
                      <path d="M 10 80 A 70 70 0 0 1 150 80" fill="none" stroke="hsl(var(--muted))" strokeWidth="12" strokeLinecap="round" />
                      <path d="M 10 80 A 70 70 0 0 1 150 80" fill="none"
                        stroke={goalPct >= 100 ? "#16a34a" : goalPct >= 50 ? "#6366f1" : "#f59e0b"}
                        strokeWidth="12" strokeLinecap="round"
                        strokeDasharray={`${goalPct * 2.198} 219.8`}
                      />
                      <text x="80" y="72" textAnchor="middle" fontSize="16" fontWeight="bold"
                        fill={goalPct >= 100 ? "#16a34a" : "hsl(var(--foreground))"}>
                        {goalPct.toFixed(0)}%
                      </text>
                    </svg>
                  </div>
                  <div className="flex justify-between w-full text-[10px] text-muted-foreground mt-1">
                    <span>{formatCurrency(monthPnl, data?.account?.currency)}</span>
                    <span>Goal: {formatCurrency(monthlyGoal, data?.account?.currency, false)}</span>
                  </div>
                  <p className="text-[10px] text-muted-foreground mt-1">
                    {goalPct >= 100 ? "🎉 Goal achieved!" : `${formatCurrency(monthlyGoal - monthPnl, data?.account?.currency, false)} remaining`}
                  </p>
                </div>
              ) : (
                <div className="h-24 flex items-center justify-center text-xs text-muted-foreground">
                  Set a monthly profit goal to track your progress
                </div>
              )}
            </div>
          </div>

          {/* Charts */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="bg-card border rounded-xl p-3">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-1.5">
                  <p className="text-xs font-medium">Daily Net Cumulative P&L</p>
                  <Info className="w-3 h-3 text-muted-foreground" />
                </div>
                <div className="flex items-center gap-0.5 bg-muted rounded-md p-0.5">
                  {(["daily","weekly","monthly"] as const).map(v => (
                    <button key={v} onClick={() => setEquityView(v)}
                      className={`text-[9px] px-1.5 py-0.5 rounded font-medium transition-colors capitalize ${equityView === v ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
                    >{v.slice(0,1).toUpperCase() + v.slice(1,3)}</button>
                  ))}
                </div>
              </div>
              {cumulativeCurve.length > 0 ? (
                <ResponsiveContainer width="100%" height={140}>
                  <AreaChart data={cumulativeCurve} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
                    <defs>
                      <linearGradient id="pnlGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor={CURVE_COLOR} stopOpacity={0.3} />
                        <stop offset="100%" stopColor={CURVE_COLOR} stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                    <XAxis dataKey="date" tick={{ fontSize: 9, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize: 9, fill: "hsl(var(--muted-foreground))" }} width={44} axisLine={false} tickLine={false} tickFormatter={(v) => { const cur = data?.account?.currency ?? "USD"; const sym = cur === "IDR" ? "Rp" : "$"; return Math.abs(v) >= 1000000 ? `${sym}${(v/1000000).toFixed(1)}M` : Math.abs(v) >= 1000 ? `${sym}${(v/1000).toFixed(0)}K` : `${sym}${v}`; }} />
                    <ReferenceLine y={0} stroke="hsl(var(--border))" strokeDasharray="4 2" />
                    <Tooltip formatter={(v: number) => [formatCurrency(v, data?.account?.currency ?? "USD", true), "Cumulative P&L"]} contentStyle={TOOLTIP_STYLE} labelStyle={{ color: "hsl(var(--muted-foreground))" }} itemStyle={{ color: "hsl(var(--foreground))" }} />
                    <Area type="monotone" dataKey="pnl" stroke={CURVE_COLOR} strokeWidth={2} fill="url(#pnlGrad)" dot={{ r: 3, fill: CURVE_COLOR }} activeDot={{ r: 5 }} />
                  </AreaChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-32 flex items-center justify-center text-xs text-muted-foreground">No data yet</div>
              )}
            </div>

            <div className="bg-card border rounded-xl p-3">
              <div className="flex items-center gap-1.5 mb-2">
                <p className="text-xs font-medium">Net Daily P&L</p>
                <Info className="w-3 h-3 text-muted-foreground" />
              </div>
              {dailyBarData.length > 0 ? (
                <ResponsiveContainer width="100%" height={140}>
                  <BarChart data={dailyBarData} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                    <XAxis dataKey="date" tick={{ fontSize: 9, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize: 9, fill: "hsl(var(--muted-foreground))" }} width={44} axisLine={false} tickLine={false} tickFormatter={(v) => { const cur = data?.account?.currency ?? 'USD'; const sym = cur === 'IDR' ? 'Rp' : '$'; return v >= 1000 ? `${sym}${(v/1000).toFixed(0)}K` : `${sym}${v}`; }} />
                    <ReferenceLine y={0} stroke="hsl(var(--border))" />
                    <Tooltip formatter={(v: number) => [formatCurrency(v, data?.account?.currency ?? "USD", true), "Daily P&L"]} contentStyle={TOOLTIP_STYLE} labelStyle={{ color: 'hsl(var(--muted-foreground))' }} itemStyle={{ color: 'hsl(var(--foreground))' }} cursor={{ fill: 'rgba(255,255,255,0.04)' }} />
                    <Bar dataKey="pnl" radius={[3, 3, 0, 0]}>
                      {dailyBarData.map((entry: any, i: number) => (
                        <Cell key={i} fill={entry.pnl >= 0 ? "#16a34a" : "#dc2626"} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-32 flex items-center justify-center text-xs text-muted-foreground">No data yet</div>
              )}
            </div>

            <div className="bg-card border rounded-xl p-3">
              <p className="text-xs font-medium mb-2">Win Rate by Instrument</p>
              <div className="space-y-2">
                {bySymbol.length === 0 && <p className="text-xs text-muted-foreground">No data</p>}
                {bySymbol.slice(0, 4).map((s: any) => (
                  <div key={s.symbol} className="flex items-center gap-2">
                    <span className="text-[11px] text-muted-foreground w-14 truncate">{s.symbol}</span>
                    <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
                      <div className="h-full rounded-full" style={{ width: `${s.winRate}%`, background: "#16a34a" }} />
                    </div>
                    <span className="text-[11px] font-medium w-8 text-right">{s.winRate}%</span>
                  </div>
                ))}
              </div>
              {bySession.length > 0 && (
                <>
                  <div className="border-t my-2" />
                  <p className="text-xs font-medium mb-2">By Session</p>
                  <div className="space-y-2">
                    {bySession.map((s: any) => (
                      <div key={s.session} className="flex items-center gap-2">
                        <span className="text-[11px] text-muted-foreground w-14 truncate">{sessionLabel[s.session] ?? s.session}</span>
                        <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
                          <div className="h-full rounded-full" style={{ width: `${s.winRate}%`, background: "#6366f1" }} />
                        </div>
                        <span className="text-[11px] font-medium w-8 text-right">{s.winRate}%</span>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Desktop: side by side, Mobile: stacked */}
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-3">
            <div className="lg:col-span-3">
              <CalendarHeatmap calendarData={calendar} />
            </div>
            <div className="bg-card border rounded-xl p-3">
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs font-medium">Recent Trades</p>
              <Link href="/trades" className="text-[11px] text-indigo-600 hover:underline">View all ↗</Link>
            </div>
            <div className="grid grid-cols-2 text-[10px] text-muted-foreground border-b pb-1 mb-1">
              <span>Symbol</span><span className="text-right">Net P&L</span>
            </div>
            {recentTrades.length === 0 ? (
              <p className="text-xs text-muted-foreground py-4 text-center">No trades yet</p>
            ) : recentTrades.map((t: any) => (
              <div key={t.id} className="grid grid-cols-2 items-center py-1.5 border-b last:border-0">
                <div>
                  <p className="text-[11px] font-medium">{t.symbol}</p>
                  <p className="text-[10px] text-muted-foreground">{format(new Date(t.entryDate), "MM-dd-yyyy")}</p>
                </div>
                <div className="text-right">
                  {t.pnl !== null ? (
                    <span className={cn("text-[11px] font-semibold", t.pnl >= 0 ? "text-[#16a34a]" : "text-[#dc2626]")}>
                      {formatCurrency(t.pnl, data?.account?.currency)}
                    </span>
                  ) : <span className="text-[10px] text-muted-foreground">open</span>}
                </div>
              </div>
            ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
