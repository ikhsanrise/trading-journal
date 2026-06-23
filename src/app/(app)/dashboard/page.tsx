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

  const fmtPnl = (v: number) => Math.abs(v) >= 1000
    ? `${v < 0 ? "-" : "+"}$${(Math.abs(v) / 1000).toFixed(1)}K`
    : `${v >= 0 ? "+" : ""}${formatCurrency(v)}`;

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
        const { pnl: wPnl, tradeDays: wDays } = summarizeWeek(wk);
        const wColors = wDays > 0 ? getCellColors(wPnl) : null;
        return (
          <div key={wi} className="grid grid-cols-8 gap-1 mb-1">
            {wk.map((day, di) => {
              if (!day) return <div key={di} className="rounded-xl border border-dashed border-border/30 h-10" />;
              const key = format(day, "yyyy-MM-dd");
              const entry = dataMap.get(key);
              const c = entry ? getCellColors(entry.pnl) : null;
              const isToday = key === format(new Date(), "yyyy-MM-dd");
              return (
                <div key={di}
                  className="rounded-xl border h-10 p-1 flex flex-col justify-between transition-all"
                  style={c
                    ? { background: c.bg, borderColor: c.border }
                    : { background: "var(--card)", borderColor: isToday ? "#6366f1" : "hsl(var(--border))" }
                  }>
                  <p className={cn("text-[9px] font-semibold leading-none", isToday && !c ? "text-indigo-500" : "text-muted-foreground")}>
                    {format(day, "d")}
                  </p>
                  {entry && (
                    <p className="text-[7px] font-bold leading-none truncate" style={{ color: c?.text }}>
                      {fmtPnl(entry.pnl)}
                    </p>
                  )}
                </div>
              );
            })}
            {/* Week summary */}
            <div className="rounded-xl border h-10 p-1 flex flex-col justify-between"
              style={wColors ? { background: wColors.bg, borderColor: wColors.border } : { borderColor: "hsl(var(--border))" }}>
              <p className="text-[7px] text-muted-foreground leading-none">W{wi + 1}</p>
              <p className="text-[7px] font-bold leading-none truncate" style={{ color: wColors ? wColors.text : "hsl(var(--muted-foreground))" }}>
                {wDays > 0 ? fmtPnl(wPnl) : "$0"}
              </p>
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

  const bestDay = calendar.length ? calendar.reduce((a: any, b: any) => b.pnl > a.pnl ? b : a, calendar[0]) : null;
  const worstDay = calendar.length ? calendar.reduce((a: any, b: any) => b.pnl < a.pnl ? b : a, calendar[0]) : null;

  const cumulativeCurve = equityCurve.length > 0
    ? equityCurve.map((p: any) => ({
        date: p.date.slice(5),
        pnl: Math.round((p.balance - (data?.account?.initialBalance ?? 0)) * 100) / 100,
      }))
    : (() => {
        let running = 0;
        return calendar
          .slice()
          .sort((a: any, b: any) => a.date.localeCompare(b.date))
          .map((d: any) => { running += d.pnl; return { date: d.date.slice(5), pnl: Math.round(running * 100) / 100 }; });
      })();

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
          {data?.account && (
            <span className="text-xs px-2 py-0.5 rounded bg-indigo-50 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800 truncate max-w-[120px]">
              {data.account.name}
            </span>
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
            <StatCard label="Net P&L" value={stats ? formatCurrency(stats.netPnL) : "—"} sub={`${stats?.closedTrades ?? 0} trades closed`} color={stats?.netPnL > 0 ? "text-[#16a34a]" : stats?.netPnL < 0 ? "text-[#dc2626]" : undefined} />
            <StatCard label="Win Rate" value={stats ? `${stats.winRate.toFixed(1)}%` : "—"} sub={`of ${stats?.closedTrades ?? 0} trades`} />
            <StatCard label="Avg R-Multiple" value={stats ? formatR(stats.avgR) : "—"} sub="per trade" color={stats?.avgR > 0 ? "text-[#16a34a]" : stats?.avgR < 0 ? "text-[#dc2626]" : undefined} />
            <StatCard label="Profit Factor" value={stats ? stats.profitFactor.toFixed(2) : "—"} sub="gross win / loss" color={stats?.profitFactor >= 1 ? "text-[#16a34a]" : "text-[#dc2626]"} />
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
            <StatCard label="Best Day" value={bestDay ? formatCurrency(bestDay.pnl) : "—"} sub={bestDay ? format(new Date(bestDay.date), "EEE, MMM d") : undefined} color={bestDay?.pnl > 0 ? "text-[#16a34a]" : undefined} />
            <StatCard label="Worst Day" value={worstDay ? formatCurrency(worstDay.pnl) : "—"} sub={worstDay ? format(new Date(worstDay.date), "EEE, MMM d") : undefined} color={worstDay?.pnl < 0 ? "text-[#dc2626]" : undefined} />
            <StatCard label="Most Profitable Day" value={mostProfitableDoW ? DAYS_OF_WEEK_FULL[parseInt(mostProfitableDoW[0])] : "—"} sub={mostProfitableDoW ? formatCurrency(mostProfitableDoW[1].pnl) : undefined} color="text-[#16a34a]" />
            <StatCard label="Most Active Day" value={mostActiveDoW ? DAYS_OF_WEEK_FULL[parseInt(mostActiveDoW[0])] : "—"} sub={mostActiveDoW ? `${mostActiveDoW[1].count} total trades` : undefined} />
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
            <StatCard label="Avg Win" value={stats?.avgWin != null ? formatCurrency(stats.avgWin) : "—"} sub="per winning trade" color="text-[#16a34a]" />
            <StatCard label="Avg Loss" value={stats?.avgLoss != null ? formatCurrency(stats.avgLoss) : "—"} sub="per losing trade" color="text-[#dc2626]" />
            <StatCard label="Avg Trade Duration" value={avgDuration ?? "—"} sub="across recent trades" />
            <StatCard label="Current Streak" value={stats?.streak ? `${stats.streak.current} ${stats.streak.type === 'win' ? '🔥' : '❄️'}` : "—"} sub={stats?.streak ? `Max win: ${stats.streak.maxWin} · Max loss: ${stats.streak.maxLoss}` : undefined} color={stats?.streak?.type === 'win' ? 'text-[#16a34a]' : 'text-[#dc2626]'} />
          </div>

          {/* Charts */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="bg-card border rounded-xl p-3">
              <div className="flex items-center gap-1.5 mb-2">
                <p className="text-xs font-medium">Daily Net Cumulative P&L</p>
                <Info className="w-3 h-3 text-muted-foreground" />
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
                    <YAxis tick={{ fontSize: 9, fill: "hsl(var(--muted-foreground))" }} width={44} axisLine={false} tickLine={false} tickFormatter={(v) => v >= 1000 ? `$${(v/1000).toFixed(1)}K` : `$${v}`} />
                    <Tooltip formatter={(v: number) => [formatCurrency(v, "USD", true), "Cumulative P&L"]} contentStyle={TOOLTIP_STYLE} labelStyle={{ color: 'hsl(var(--muted-foreground))' }} itemStyle={{ color: 'hsl(var(--foreground))' }} />
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
                    <YAxis tick={{ fontSize: 9, fill: "hsl(var(--muted-foreground))" }} width={44} axisLine={false} tickLine={false} tickFormatter={(v) => v >= 1000 ? `$${(v/1000).toFixed(1)}K` : `$${v}`} />
                    <ReferenceLine y={0} stroke="hsl(var(--border))" />
                    <Tooltip formatter={(v: number) => [formatCurrency(v, "USD", true), "Daily P&L"]} contentStyle={TOOLTIP_STYLE} labelStyle={{ color: 'hsl(var(--muted-foreground))' }} itemStyle={{ color: 'hsl(var(--foreground))' }} cursor={{ fill: 'rgba(255,255,255,0.04)' }} />
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

          <CalendarHeatmap calendarData={calendar} />

          <div className="bg-card border rounded-xl p-3 mb-2">
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
                      {formatCurrency(t.pnl)}
                    </span>
                  ) : <span className="text-[10px] text-muted-foreground">open</span>}
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
