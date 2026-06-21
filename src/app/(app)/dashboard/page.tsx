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
const DAYS_OF_WEEK = ["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"];

// ── Stat Cards ────────────────────────────────────────────────────────────────
function StatCard({ label, value, sub, color }: { label: string; value: string; sub?: string; color?: string }) {
  return (
    <div className="bg-card border rounded-xl p-4">
      <p className="text-xs text-muted-foreground mb-1">{label}</p>
      <p className={cn("text-xl font-semibold tracking-tight truncate", color ?? "text-foreground")}>{value}</p>
      {sub && <p className="text-[11px] text-muted-foreground mt-0.5">{sub}</p>}
    </div>
  );
}

function DayCard({ label, value, sub, color }: { label: string; value: string; sub?: string; color?: string }) {
  return (
    <div className="bg-card border rounded-xl p-4">
      <p className="text-xs text-muted-foreground mb-1">{label}</p>
      <p className={cn("text-xl font-semibold truncate", color ?? "text-foreground")}>{value}</p>
      {sub && <p className="text-[11px] text-muted-foreground mt-0.5">{sub}</p>}
    </div>
  );
}

// ── Calendar ─────────────────────────────────────────────────────────────────
function CalendarHeatmap({ calendarData }: { calendarData: any[] }) {
  const [current, setCurrent] = useState(new Date());
  const dataMap = new Map(calendarData.map((d) => [d.date, d]));

  const start = startOfMonth(current);
  const end = endOfMonth(current);
  const days = eachDayOfInterval({ start, end });
  const startDow = getDay(start);

  function summarizeWeek(wdays: any[]) {
    let pnl = 0, tradeDays = 0;
    for (const d of wdays) {
      if (!d) continue;
      const entry = dataMap.get(format(d, "yyyy-MM-dd"));
      if (entry) { pnl += entry.pnl; tradeDays++; }
    }
    return { pnl, tradeDays };
  }

  // Build weeks
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
      ? { bg: "rgba(22,163,74,0.18)", border: "rgba(22,163,74,0.5)", text: "#86efac", sub: "#4ade80" }
      : { bg: "#f0fdf4", border: "#86efac", text: "#15803d", sub: "#16a34a" };
    if (pnl < 0) return isDark
      ? { bg: "rgba(220,38,38,0.18)", border: "rgba(220,38,38,0.5)", text: "#fca5a5", sub: "#f87171" }
      : { bg: "#fff1f2", border: "#fca5a5", text: "#b91c1c", sub: "#dc2626" };
    return { bg: "transparent", border: "transparent", text: "#64748b", sub: "#94a3b8" };
  }

  return (
    <div className="bg-card border rounded-xl p-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <button onClick={() => setCurrent(subMonths(current, 1))}
            className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-muted transition-colors border">
            <ChevronLeft className="w-3.5 h-3.5" />
          </button>
          <span className="text-sm font-semibold min-w-[120px] text-center">{format(current, "MMMM yyyy")}</span>
          <button onClick={() => setCurrent(addMonths(current, 1))}
            className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-muted transition-colors border">
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
          <button onClick={() => setCurrent(new Date())}
            className="text-[11px] px-2.5 py-1 rounded-lg border text-muted-foreground hover:bg-muted transition-colors">
            This month
          </button>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs text-muted-foreground">Monthly stats:</span>
          <span className={cn("font-semibold text-sm", totalPnl >= 0 ? "text-[#16a34a]" : "text-[#dc2626]")}>
            {Math.abs(totalPnl) >= 1000
              ? `${totalPnl < 0 ? "-" : ""}$${(Math.abs(totalPnl) / 1000).toFixed(2)}K`
              : formatCurrency(totalPnl)}
          </span>
          <span className="text-xs text-muted-foreground">{totalTradeDays} days</span>
        </div>
      </div>

      {/* Day headers */}
      <div className="grid grid-cols-8 gap-1.5 mb-1.5">
        {["Sun","Mon","Tue","Wed","Thu","Fri","Sat"].map((d) => (
          <div key={d} className="text-center text-[10px] font-medium text-muted-foreground py-1">{d}</div>
        ))}
        <div className="text-center text-[10px] font-medium text-muted-foreground py-1">Week</div>
      </div>

      {/* Weeks */}
      {weeks.map((wk, wi) => {
        const { pnl: wPnl, tradeDays: wDays } = summarizeWeek(wk);
        const wColors = wDays > 0 ? getCellColors(wPnl) : null;
        return (
          <div key={wi} className="grid grid-cols-8 gap-1.5 mb-1.5">
            {wk.map((day, di) => {
              if (!day) return (
                <div key={di} className="rounded-xl border border-dashed border-border/40 min-h-[64px]" />
              );
              const key = format(day, "yyyy-MM-dd");
              const entry = dataMap.get(key);
              const c = entry ? getCellColors(entry.pnl) : null;
              const isToday = key === format(new Date(), "yyyy-MM-dd");
              return (
                <div key={di} className="rounded-xl border min-h-[64px] p-1.5 transition-all"
                  style={c
                    ? { background: c.bg, borderColor: c.border }
                    : { background: "var(--card)", borderColor: isToday ? "#6366f1" : "hsl(var(--border))" }
                  }>
                  <p className={cn("text-[10px] font-medium mb-0.5", isToday && !c ? "text-indigo-600" : "text-muted-foreground")}>
                    {format(day, "d")}
                  </p>
                  {entry && (
                    <>
                      <p className="text-[11px] font-bold leading-tight" style={{ color: c?.text }}>
                        {Math.abs(entry.pnl) >= 1000
                          ? `${entry.pnl < 0 ? "-" : ""}$${(Math.abs(entry.pnl) / 1000).toFixed(2)}K`
                          : formatCurrency(entry.pnl)}
                      </p>
                      <p className="text-[10px]" style={{ color: c?.sub }}>
                        {entry.tradeCount} trade{entry.tradeCount > 1 ? "s" : ""}
                      </p>
                    </>
                  )}
                </div>
              );
            })}
            {/* Week summary */}
            <div className="rounded-xl border min-h-[64px] p-1.5 flex flex-col justify-center"
              style={wColors
                ? { background: wColors.bg, borderColor: wColors.border }
                : { borderColor: "hsl(var(--border))" }
              }>
              <p className="text-[10px] text-muted-foreground dark:text-zinc-400">Week {wi + 1}</p>
              <p className="text-[11px] font-bold" style={{ color: wColors ? wColors.text : "hsl(var(--muted-foreground))" }}>
                {wDays > 0
                  ? (Math.abs(wPnl) >= 1000
                      ? `${wPnl < 0 ? "-" : ""}$${(Math.abs(wPnl) / 1000).toFixed(1)}K`
                      : formatCurrency(wPnl))
                  : "$0"}
              </p>
              <p className="text-[10px] text-muted-foreground dark:text-zinc-400">{wDays} {wDays === 1 ? "day" : "days"}</p>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ── Main ──────────────────────────────────────────────────────────────────────
export default function DashboardPage() {
  const [period, setPeriod] = useState("all");
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(() => {
    setLoading(true);
    fetch(`/api/dashboard?period=${period}`)
      .then((r) => r.json())
      .then((d) => { setData(d); setLoading(false); })
      .catch(() => setLoading(false));
  }, [period]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const stats = data?.stats;
  const equityCurve = data?.equityCurve ?? [];
  const bySymbol = data?.bySymbol ?? [];
  const bySession = data?.bySession ?? [];
  const recentTrades = data?.recentTrades ?? [];
  const calendar = data?.calendar ?? [];

  // Best / worst day
  const bestDay = calendar.length ? calendar.reduce((a: any, b: any) => b.pnl > a.pnl ? b : a, calendar[0]) : null;
  const worstDay = calendar.length ? calendar.reduce((a: any, b: any) => b.pnl < a.pnl ? b : a, calendar[0]) : null;

  // Cumulative P&L curve
  const cumulativeCurve = equityCurve.map((p: any) => ({
    date: p.date.slice(5),
    pnl: Math.round((p.balance - (data?.account?.initialBalance ?? 0)) * 100) / 100,
  }));

  // Net Daily P&L bar chart
  const dailyBarData = calendar
    .slice()
    .sort((a: any, b: any) => a.date.localeCompare(b.date))
    .map((d: any) => ({ date: d.date.slice(5), pnl: Math.round(d.pnl * 100) / 100 }));

  // Avg Win / Avg Loss
  const closedTrades = recentTrades; // we'll compute from calendar approximation
  const avgWin = data?.avgWin ?? null;
  const avgLoss = data?.avgLoss ?? null;

  // Most profitable / active day of week from calendar
  const dowPnl: Record<number, { pnl: number; count: number }> = {};
  for (const d of calendar) {
    const dow = getDay(new Date(d.date));
    if (!dowPnl[dow]) dowPnl[dow] = { pnl: 0, count: 0 };
    dowPnl[dow].pnl += d.pnl;
    dowPnl[dow].count += d.tradeCount;
  }
  const dowEntries = Object.entries(dowPnl);
  const mostProfitableDoW = dowEntries.length
    ? dowEntries.reduce((a, b) => b[1].pnl > a[1].pnl ? b : a)
    : null;
  const mostActiveDoW = dowEntries.length
    ? dowEntries.reduce((a, b) => b[1].count > a[1].count ? b : a)
    : null;

  // Avg trade duration from recentTrades
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
    <div className="p-4 space-y-3">
      {/* Top bar */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold">Dashboard</span>
          {data?.account && (
            <span className="text-xs px-2 py-0.5 rounded bg-indigo-50 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800">
              {data.account.name}
            </span>
          )}
        </div>
        <div className="flex items-center gap-1">
          {PERIODS.map((p) => (
            <button key={p.value} onClick={() => setPeriod(p.value)}
              className={cn("text-[11px] px-2.5 py-1 rounded-lg transition-colors",
                period === p.value ? "bg-indigo-600 text-white" : "border text-muted-foreground hover:text-foreground"
              )}>{p.label}</button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="h-64 flex items-center justify-center text-sm text-muted-foreground">Loading...</div>
      ) : (
        <>
          {/* Row 1: Core stats */}
          <div className="grid grid-cols-4 gap-3">
            <StatCard label="Net P&L"
              value={stats ? formatCurrency(stats.netPnL) : "—"}
              sub={`${stats?.closedTrades ?? 0} trades closed`}
              color={stats?.netPnL > 0 ? "text-[#16a34a]" : stats?.netPnL < 0 ? "text-[#dc2626]" : undefined}
            />
            <StatCard label="Win Rate"
              value={stats ? `${stats.winRate.toFixed(1)}%` : "—"}
              sub={`of ${stats?.closedTrades ?? 0} trades`}
            />
            <StatCard label="Avg R-Multiple"
              value={stats ? formatR(stats.avgR) : "—"}
              sub="per trade"
              color={stats?.avgR > 0 ? "text-[#16a34a]" : stats?.avgR < 0 ? "text-[#dc2626]" : undefined}
            />
            <StatCard label="Profit Factor"
              value={stats ? stats.profitFactor.toFixed(2) : "—"}
              sub="gross win / loss"
              color={stats?.profitFactor >= 1 ? "text-[#16a34a]" : "text-[#dc2626]"}
            />
          </div>

          {/* Row 2: Extended stats */}
          <div className="grid grid-cols-4 gap-3">
            <DayCard label="Best Day"
              value={bestDay ? formatCurrency(bestDay.pnl) : "—"}
              sub={bestDay ? format(new Date(bestDay.date), "EEEE, MMM d") : undefined}
              color={bestDay?.pnl > 0 ? "text-[#16a34a]" : undefined}
            />
            <DayCard label="Worst Day"
              value={worstDay ? formatCurrency(worstDay.pnl) : "—"}
              sub={worstDay ? format(new Date(worstDay.date), "EEEE, MMM d") : undefined}
              color={worstDay?.pnl < 0 ? "text-[#dc2626]" : undefined}
            />
            <DayCard label="Most Profitable Day"
              value={mostProfitableDoW ? DAYS_OF_WEEK[parseInt(mostProfitableDoW[0])] : "—"}
              sub={mostProfitableDoW ? formatCurrency(mostProfitableDoW[1].pnl) : undefined}
              color="text-[#16a34a]"
            />
            <DayCard label="Most Active Day"
              value={mostActiveDoW ? DAYS_OF_WEEK[parseInt(mostActiveDoW[0])] : "—"}
              sub={mostActiveDoW ? `${mostActiveDoW[1].count} total trades` : undefined}
            />
          </div>

          {/* Row 3: Avg win/loss + duration + streak */}
          <div className="grid grid-cols-4 gap-3">
            <StatCard label="Avg Win"
              value={stats?.avgWin != null ? formatCurrency(stats.avgWin) : "—"}
              sub="per winning trade"
              color="text-[#16a34a]"
            />
            <StatCard label="Avg Loss"
              value={stats?.avgLoss != null ? formatCurrency(stats.avgLoss) : "—"}
              sub="per losing trade"
              color="text-[#dc2626]"
            />
            <StatCard label="Avg Trade Duration"
              value={avgDuration ?? "—"}
              sub="across recent trades"
            />
            <StatCard label="Current Streak"
              value={stats?.streak ? `${stats.streak.current} ${stats.streak.type === 'win' ? '🔥' : '❄️'}` : "—"}
              sub={stats?.streak ? `Max win: ${stats.streak.maxWin} · Max loss: ${stats.streak.maxLoss}` : undefined}
              color={stats?.streak?.type === 'win' ? 'text-[#16a34a]' : 'text-[#dc2626]'}
            />
          </div>

          {/* Row 4: Charts */}
          <div className="grid grid-cols-3 gap-3">
            {/* Cumulative P&L */}
            <div className="col-span-1 bg-card border rounded-xl p-4">
              <div className="flex items-center gap-1.5 mb-3">
                <p className="text-xs font-medium">Daily Net Cumulative P&L</p>
                <Info className="w-3 h-3 text-muted-foreground" />
              </div>
              {cumulativeCurve.length > 1 ? (
                <ResponsiveContainer width="100%" height={160}>
                  <AreaChart data={cumulativeCurve} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
                    <defs>
                      <linearGradient id="pnlGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor={CURVE_COLOR} stopOpacity={0.3} />
                        <stop offset="100%" stopColor={CURVE_COLOR} stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                    <XAxis dataKey="date" tick={{ fontSize: 9, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize: 9, fill: "hsl(var(--muted-foreground))" }} width={48} axisLine={false} tickLine={false}
                      tickFormatter={(v) => v >= 1000 ? `$${(v/1000).toFixed(1)}K` : `$${v}`}
                    />
                    <Tooltip formatter={(v: number) => [formatCurrency(v, "USD", true), "Cumulative P&L"]}
                      contentStyle={{ fontSize: 11, borderRadius: 8, backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', color: 'hsl(var(--foreground))', boxShadow: '0 4px 12px rgba(0,0,0,0.15)' }} labelStyle={{ color: 'hsl(var(--muted-foreground))', fontWeight: 500 }} itemStyle={{ color: 'hsl(var(--foreground))' }} cursor={{ fill: 'hsl(var(--muted))', opacity: 0.4 }} />
                    <Area type="monotone" dataKey="pnl" stroke={CURVE_COLOR} strokeWidth={2}
                      fill="url(#pnlGrad)" dot={{ r: 3, fill: CURVE_COLOR }} activeDot={{ r: 5 }} />
                  </AreaChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-40 flex items-center justify-center text-xs text-muted-foreground">No data yet</div>
              )}
            </div>

            {/* Net Daily P&L bar */}
            <div className="col-span-1 bg-card border rounded-xl p-4">
              <div className="flex items-center gap-1.5 mb-3">
                <p className="text-xs font-medium">Net Daily P&L</p>
                <Info className="w-3 h-3 text-muted-foreground" />
              </div>
              {dailyBarData.length > 0 ? (
                <ResponsiveContainer width="100%" height={160}>
                  <BarChart data={dailyBarData} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                    <XAxis dataKey="date" tick={{ fontSize: 9, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize: 9, fill: "hsl(var(--muted-foreground))" }} width={48} axisLine={false} tickLine={false}
                      tickFormatter={(v) => v >= 1000 ? `$${(v/1000).toFixed(1)}K` : `$${v}`}
                    />
                    <ReferenceLine y={0} stroke="var(--border)" />
                    <Tooltip formatter={(v: number) => [formatCurrency(v, "USD", true), "Daily P&L"]}
                      contentStyle={{ fontSize: 11, borderRadius: 8, backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', color: 'hsl(var(--foreground))', boxShadow: '0 4px 12px rgba(0,0,0,0.15)' }} labelStyle={{ color: 'hsl(var(--muted-foreground))', fontWeight: 500 }} itemStyle={{ color: 'hsl(var(--foreground))' }} cursor={{ fill: 'hsl(var(--muted))', opacity: 0.4 }} />
                    <Bar dataKey="pnl" radius={[3, 3, 0, 0]}>
                      {dailyBarData.map((entry: any, i: number) => (
                        <Cell key={i} fill={entry.pnl >= 0 ? "#16a34a" : "#dc2626"} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-40 flex items-center justify-center text-xs text-muted-foreground">No data yet</div>
              )}
            </div>

            {/* Win rate by instrument + session */}
            <div className="bg-card border rounded-xl p-4">
              <p className="text-xs font-medium mb-3">Win Rate by Instrument</p>
              <div className="space-y-2">
                {bySymbol.length === 0 && <p className="text-xs text-muted-foreground">No data</p>}
                {bySymbol.slice(0, 4).map((s: any) => (
                  <div key={s.symbol} className="flex items-center gap-2">
                    <span className="text-[11px] text-muted-foreground w-16 truncate">{s.symbol}</span>
                    <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
                      <div className="h-full rounded-full" style={{ width: `${s.winRate}%`, background: "#16a34a" }} />
                    </div>
                    <span className="text-[11px] font-medium w-8 text-right">{s.winRate}%</span>
                  </div>
                ))}
              </div>
              {bySession.length > 0 && (
                <>
                  <div className="border-t my-3" />
                  <p className="text-xs font-medium mb-2">By Session</p>
                  <div className="space-y-2">
                    {bySession.map((s: any) => (
                      <div key={s.session} className="flex items-center gap-2">
                        <span className="text-[11px] text-muted-foreground w-16 truncate">
                          {sessionLabel[s.session] ?? s.session}
                        </span>
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

          {/* Row 5: Recent trades + Calendar */}
          <div className="grid grid-cols-4 gap-3">
            <div className="bg-card border rounded-xl p-4">
              <div className="flex items-center justify-between mb-3">
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
                        {formatCurrency(t.pnl)}
                      </span>
                    ) : <span className="text-[10px] text-muted-foreground">open</span>}
                  </div>
                </div>
              ))}
            </div>
            <div className="col-span-3">
              <CalendarHeatmap calendarData={calendar} />
            </div>
          </div>
        </>
      )}
    </div>
  );
}
