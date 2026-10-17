"use client";
import { useEffect, useState, useCallback } from "react";
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, Tooltip,
  ResponsiveContainer, CartesianGrid, ReferenceLine, Cell,
} from "recharts";
import { ChevronLeft, ChevronRight, Plus, X } from "lucide-react";
import { cn, formatCurrency, formatR } from "@/lib/utils";
import Link from "next/link";
import type { ComponentProps } from "react";
import { HoverTip, type TipRow } from "@/components/ui/HoverTip";
import {
  PANEL, BTN_PRIMARY, PAGE, H1, SUB, H2, CAP, CHIP, CHIP_G, CHIP_R, CHIP_B,
  TABS, TAB, TAB_ON, BTN, pnlColor, WIN, LOSS,
} from "@/lib/theme";
import { KpiRow, TradeScoreCard } from "@/components/dashboard/KpiCards";
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

const CURVE_COLOR = "#7c93ff";
const CAL_GRID = "grid grid-cols-[repeat(7,minmax(0,1fr))_56px] md:grid-cols-[repeat(7,minmax(0,1fr))_112px] gap-1 md:gap-1.5";
const DAYS_OF_WEEK_FULL = ["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"];

// Matches the HoverTip popover look so chart + card tooltips feel like one system.
const TOOLTIP_STYLE = {
  fontSize: 11.5,
  borderRadius: 12,
  backgroundColor: 'rgba(12,19,48,0.95)',
  border: '1px solid rgba(122,140,255,0.25)',
  color: '#e8ecff',
  padding: '10px 14px',
  boxShadow: '0 18px 40px -12px rgba(0,0,0,0.7)',
  backdropFilter: 'blur(8px)',
};

type TipProps = Omit<ComponentProps<typeof HoverTip>, "children">;
const tone = (v: number): TipRow["tone"] => (v > 0 ? "win" : v < 0 ? "loss" : "muted");
// Hover treatments (200-300ms ease-out, reduced-motion safe)
const MOTION = "motion-reduce:transform-none motion-reduce:transition-none";
const ROW_FX = `rounded-lg -mx-2 px-2 transition-[background-color,transform] duration-200 ease-out hover:bg-[#4f6bff]/[0.09] hover:translate-x-[3px] ${MOTION}`;
const BAR_FX = "transition-[filter,box-shadow] duration-200 ease-out group-hover/tip:brightness-125 group-hover/tip:shadow-[0_0_12px_rgba(79,107,255,0.55)] motion-reduce:transition-none";
const TILE_FX = `transition-[transform,box-shadow,border-color] duration-200 ease-out hover:-translate-y-0.5 hover:border-[#5b74ff]/50 hover:shadow-[0_10px_26px_-12px_rgba(79,107,255,0.5)] ${MOTION}`;

function StatCard({ label, value, sub, color, tip }: { label: string; value: string; sub?: string; color?: string; tip?: TipProps }) {
  const card = (
    <div className={cn(PANEL, "min-w-0 px-6 py-5 flex flex-col gap-1.5 card-hover", tip ? "w-full h-full" : "flex-[1_1_200px]", MOTION)}>
      <span className="text-xs font-medium text-muted-foreground dark:text-[#8a94c4]">{label}</span>
      <div className={cn("text-2xl font-extrabold tracking-[-0.02em] truncate", color ?? "text-foreground")}>{value}</div>
      {sub ? <span className={CAP}>{sub}</span> : <span className={CAP}>&nbsp;</span>}
    </div>
  );
  if (!tip) return card;
  return <HoverTip block className="flex-[1_1_200px] min-w-0" {...tip}>{card}</HoverTip>;
}

function CalendarHeatmap({ calendarData, currency }: { calendarData: any[]; currency?: string }) {
  const [current, setCurrent] = useState(new Date());
  const [selectedDay, setSelectedDay] = useState<{ date: string; entry: any } | null>(null);
  const [selectedWeek, setSelectedWeek] = useState<{ week: number; pnl: number; days: number; count: number } | null>(null);
  const dataMap = new Map(calendarData.map((d) => [d.date, d]));

  const start = startOfMonth(current);
  const end = endOfMonth(current);
  const days = eachDayOfInterval({ start, end });
  const startDow = (getDay(start) + 6) % 7; // minggu dimulai Senin

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
      ? { bg: "rgba(34,197,94,0.16)", border: "rgba(74,222,128,0.4)", text: "#4ade80" }
      : { bg: "#f0fdf4", border: "#86efac", text: "#15803d" };
    if (pnl < 0) return isDark
      ? { bg: "rgba(239,68,68,0.18)", border: "rgba(248,113,113,0.42)", text: "#f87171" }
      : { bg: "#fff1f2", border: "#fca5a5", text: "#b91c1c" };
    return { bg: "transparent", border: "hsl(var(--border))", text: "#64748b" };
  }

  const fmtPnl = (v: number) => formatCurrency(v, currency ?? "USD");

  return (
    <div className={cn(PANEL, "px-4 md:px-6 py-[22px] min-w-0")}>
      {/* Header */}
      <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
        <div className="flex items-center gap-2.5">
          <button aria-label="Bulan sebelumnya" onClick={() => setCurrent(subMonths(current, 1))} className="w-[34px] h-[34px] flex items-center justify-center rounded-[10px] border dark:border-white/[0.12] dark:text-[#c7d0ff] hover:bg-[#4f6bff]/10 hover:border-[#4f6bff]/50 transition-colors">
            <ChevronLeft className="w-4 h-4" />
          </button>
          <h2 className={cn(H2, "min-w-[120px] text-center")}>{format(current, "MMMM yyyy")}</h2>
          <button aria-label="Bulan berikutnya" onClick={() => setCurrent(addMonths(current, 1))} className="w-[34px] h-[34px] flex items-center justify-center rounded-[10px] border dark:border-white/[0.12] dark:text-[#c7d0ff] hover:bg-[#4f6bff]/10 hover:border-[#4f6bff]/50 transition-colors">
            <ChevronRight className="w-4 h-4" />
          </button>
          <button onClick={() => setCurrent(new Date())} className="h-8 px-3 rounded-[10px] border text-xs font-semibold dark:border-white/[0.14] dark:text-[#dfe4ff] hover:bg-[#4f6bff]/10 hover:border-[#4f6bff]/50 transition-colors">
            Now
          </button>
        </div>
        <div className="flex items-center gap-2.5">
          <b className={cn("font-mono text-sm", pnlColor(totalPnl))}>{(totalPnl > 0 ? "+" : "") + fmtPnl(totalPnl)}</b>
          <span className={cn(CHIP, CHIP_B)}>{totalTradeDays}d</span>
        </div>
      </div>

      {/* Day headers */}
      <div className={CAL_GRID + " mb-1.5"}>
        {["Sen","Sel","Rab","Kam","Jum","Sab","Min","Wk"].map((d, i) => (
          <div key={i} className={cn("text-[10px] md:text-[11px] font-bold uppercase tracking-[0.08em] text-muted-foreground dark:text-[#7d88bd] px-1 pb-0.5", i === 7 && "text-right")}>{d}</div>
        ))}
      </div>

      {/* Weeks */}
      <div className="flex flex-col gap-1.5">
      {weeks.map((wk, wi) => {
        const { pnl: wPnl, tradeDays: wDays, tradeCount: wTrades } = summarizeWeek(wk);
        return (
          <div key={wi} className={CAL_GRID}>
            {wk.map((day, di) => {
              if (!day) return <div key={di} className="rounded-[11px] border border-dashed border-border/40 dark:border-[#7a8cff]/[0.07] min-h-[52px] md:min-h-[70px]" />;
              const key = format(day, "yyyy-MM-dd");
              const entry = dataMap.get(key);
              const c = entry ? getCellColors(entry.pnl) : null;
              const isToday = key === format(new Date(), "yyyy-MM-dd");
              const cell = (
                <div key={di}
                  role={entry ? "button" : undefined}
                  onClick={() => { if (entry) setSelectedDay({ date: key, entry }); }}
                  className={cn(
                    "relative h-full w-full rounded-[11px] border min-h-[52px] md:min-h-[70px] min-w-0 px-1.5 py-1.5 md:px-2.5 md:py-2 flex flex-col gap-[3px]",
                    "transition-[transform,box-shadow,filter,border-color,background-color] duration-200 ease-out", MOTION,
                    entry && "hover:scale-[1.03] hover:z-20 hover:brightness-110 hover:shadow-[0_0_16px_rgba(79,107,255,0.45)]",
                    !c && "dark:bg-white/[0.02] dark:border-[#7a8cff]/10 hover:dark:border-[#7a8cff]/40 hover:dark:bg-[#4f6bff]/[0.07]",
                    !c && di >= 5 && !isToday && "opacity-60"
                  )}
                  style={c
                    ? { background: c.bg, borderColor: c.border, cursor: "pointer" }
                    : { borderColor: isToday ? "#5b74ff" : undefined, boxShadow: isToday ? "0 0 0 3px rgba(79,107,255,0.18)" : undefined, cursor: entry ? "pointer" : "default" }
                  }>
                  <span className={cn("text-[10px] md:text-[11.5px] font-bold leading-none", isToday && !c ? "text-[#4f6bff] dark:text-[#c7d0ff]" : "text-muted-foreground dark:text-[#9aa4d2]")} style={c ? { color: c.text } : undefined}>
                    {format(day, "d")}
                  </span>
                  {entry && (
                    <>
                      <span className="font-mono tabular-nums text-[8px] md:text-xs font-bold leading-tight tracking-[-0.03em] mt-auto break-words" style={{ color: c?.text }}>
                        {fmtPnl(entry.pnl)}
                      </span>
                      <span className="text-[8px] md:text-[10.5px] leading-none" style={{ color: c?.text, opacity: 0.75 }}>
                        {entry.tradeCount} {entry.tradeCount === 1 ? "trade" : "trades"}
                      </span>
                    </>
                  )}
                </div>
              );
              if (!entry) return cell;
              return (
                <HoverTip key={di} block className="min-w-0" side="top" align={di < 2 ? "left" : di >= 5 ? "right" : "center"}
                  title={format(day, "EEEE, d MMM yyyy")}
                  rows={[
                    { label: "Net P&L", value: fmtPnl(entry.pnl), tone: tone(entry.pnl) },
                    { label: "Trades", value: String(entry.tradeCount) },
                    { label: "Avg / trade", value: entry.tradeCount > 0 ? fmtPnl(entry.pnl / entry.tradeCount) : "—", tone: tone(entry.pnl) },
                    { label: "Result", value: entry.pnl > 0 ? "Profit day" : entry.pnl < 0 ? "Loss day" : "Break even", tone: tone(entry.pnl) },
                  ]}
                  note="Click for the day summary.">
                  {cell}
                </HoverTip>
              );
            })}
            {/* Week summary */}
            {(() => {
              const first = wk.find(Boolean) as Date | undefined;
              const last = [...wk].reverse().find(Boolean) as Date | undefined;
              const summary = (
                <div className={cn("h-full w-full rounded-[11px] border min-h-[52px] md:min-h-[70px] min-w-0 px-1.5 py-1.5 md:px-2.5 md:py-2 flex flex-col gap-[3px] dark:border-[#7a8cff]/[0.16] dark:bg-gradient-to-br dark:from-[#18265c]/55 dark:to-[#0a1028]/70",
                  "transition-[transform,box-shadow,border-color] duration-200 ease-out", MOTION,
                  wDays > 0 && "hover:-translate-y-0.5 hover:border-[#5b74ff]/50 hover:shadow-[0_10px_22px_-12px_rgba(79,107,255,0.55)]")}
                  role={wDays > 0 ? "button" : undefined}
                  onClick={() => { if (wDays > 0) setSelectedWeek({ week: wi + 1, pnl: wPnl, days: wDays, count: wTrades }); }}
                  style={{ cursor: wDays > 0 ? "pointer" : "default" }}>
                  <span className="text-[9px] md:text-[10.5px] font-bold uppercase tracking-[0.06em] text-muted-foreground dark:text-[#7d88bd] leading-none">W{wi + 1}</span>
                  <span className={cn("font-mono tabular-nums text-[8px] md:text-xs font-bold leading-tight tracking-[-0.03em] mt-auto break-words", wDays > 0 ? pnlColor(wPnl) : "text-muted-foreground dark:text-[#8a94c4]")}>
                    {fmtPnl(wDays > 0 ? wPnl : 0)}
                  </span>
                  {wTrades > 0 && (
                    <span className="text-[8px] md:text-[10.5px] leading-none text-muted-foreground dark:text-[#aab3df]">
                      {wTrades} {wTrades === 1 ? "trade" : "trades"}
                    </span>
                  )}
                </div>
              );
              if (wDays === 0 || !first || !last) return summary;
              return (
                <HoverTip block className="min-w-0" side="top" align="right"
                  title={`Week ${wi + 1} · ${format(first, "d MMM")} – ${format(last, "d MMM")}`}
                  rows={[
                    { label: "Net P&L", value: fmtPnl(wPnl), tone: tone(wPnl) },
                    { label: "Trading days", value: String(wDays) },
                    { label: "Trades", value: String(wTrades) },
                  ]}
                  note="Click for the week summary.">
                  {summary}
                </HoverTip>
              );
            })()}
          </div>
        );
      })}
      </div>
      {/* Day popup */}
      {selectedDay && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4" onClick={() => setSelectedDay(null)}>
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm anim-fade" />
          <div className="relative rounded-2xl border bg-card dark:border-[#27358a]/50 dark:bg-[#0c1330] p-5 w-full max-w-sm shadow-2xl anim-pop" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <div>
                <p className="text-xs text-muted-foreground">Trading Day</p>
                <p className="text-sm font-semibold">{format(new Date(selectedDay.date + "T00:00:00"), "EEEE, d MMMM yyyy")}</p>
              </div>
              <button onClick={() => setSelectedDay(null)} className="w-7 h-7 flex items-center justify-center rounded-full hover:bg-muted text-muted-foreground">✕</button>
            </div>
            <div className="grid grid-cols-2 gap-3 mb-4">
              <div className="bg-muted/40 rounded-xl p-3">
                <p className="text-[10px] text-muted-foreground mb-1">Net P&L</p>
                <p className={cn("text-sm font-bold", selectedDay.entry.pnl > 0 ? "text-[#16a34a]" : "text-[#dc2626]")}>
                  {formatCurrency(selectedDay.entry.pnl, currency)}
                </p>
              </div>
              <div className="bg-muted/40 rounded-xl p-3">
                <p className="text-[10px] text-muted-foreground mb-1">Total Trades</p>
                <p className="text-sm font-bold">{selectedDay.entry.tradeCount}</p>
              </div>
            </div>
            <div className={cn("rounded-xl p-3 text-center", selectedDay.entry.pnl > 0 ? "bg-[#16a34a]/10" : "bg-[#dc2626]/10")}>
              <p className={cn("text-xs font-semibold", selectedDay.entry.pnl > 0 ? "text-[#16a34a]" : "text-[#dc2626]")}>
                {selectedDay.entry.pnl > 0 ? "✓ Profitable Day" : selectedDay.entry.pnl < 0 ? "✗ Loss Day" : "Break Even"}
              </p>
            </div>
            <button onClick={() => setSelectedDay(null)} className="w-full mt-3 py-2 text-xs text-muted-foreground">Close</button>
          </div>
        </div>
      )}

      {/* Week popup */}
      {selectedWeek && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4" onClick={() => setSelectedWeek(null)}>
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm anim-fade" />
          <div className="relative rounded-2xl border bg-card dark:border-[#27358a]/50 dark:bg-[#0c1330] p-5 w-full max-w-sm shadow-2xl anim-pop" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <div>
                <p className="text-xs text-muted-foreground">{format(current, "MMMM yyyy")}</p>
                <p className="text-sm font-semibold">Week {selectedWeek.week}</p>
              </div>
              <button onClick={() => setSelectedWeek(null)} className="w-7 h-7 flex items-center justify-center rounded-full hover:bg-muted text-muted-foreground">✕</button>
            </div>
            <div className="grid grid-cols-3 gap-3 mb-4">
              <div className="bg-muted/40 rounded-xl p-3">
                <p className="text-[10px] text-muted-foreground mb-1">Net P&L</p>
                <p className={cn("text-sm font-bold", selectedWeek.pnl > 0 ? "text-[#16a34a]" : "text-[#dc2626]")}>
                  {formatCurrency(selectedWeek.pnl, currency)}
                </p>
              </div>
              <div className="bg-muted/40 rounded-xl p-3">
                <p className="text-[10px] text-muted-foreground mb-1">Trade Days</p>
                <p className="text-sm font-bold">{selectedWeek.days}</p>
              </div>
              <div className="bg-muted/40 rounded-xl p-3">
                <p className="text-[10px] text-muted-foreground mb-1">Trades</p>
                <p className="text-sm font-bold">{selectedWeek.count}</p>
              </div>
            </div>
            <div className={cn("rounded-xl p-3 text-center", selectedWeek.pnl > 0 ? "bg-[#16a34a]/10" : "bg-[#dc2626]/10")}>
              <p className={cn("text-xs font-semibold", selectedWeek.pnl > 0 ? "text-[#16a34a]" : "text-[#dc2626]")}>
                {selectedWeek.pnl > 0 ? "✓ Profitable Week" : selectedWeek.pnl < 0 ? "✗ Loss Week" : "Break Even"}
              </p>
            </div>
            <button onClick={() => setSelectedWeek(null)} className="w-full mt-3 py-2 text-xs text-muted-foreground">Close</button>
          </div>
        </div>
      )}
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
  const [showTxModal, setShowTxModal] = useState(false);
  const [txType, setTxType] = useState<"deposit"|"withdraw">("deposit");
  const [txAmount, setTxAmount] = useState("");
  const [txNote, setTxNote] = useState("");
  const [txDate, setTxDate] = useState("");
  const [txList, setTxList] = useState<any[]>([]);
  const [savingTx, setSavingTx] = useState(false);
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
  useEffect(() => {
    if (Array.isArray(data?.transactions)) setTxList(data.transactions);
  }, [data]);

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

  async function fetchTransactions(accId: string) {
    const res = await fetch(`/api/transactions?accountId=${accId}`);
    const d = await res.json();
    setTxList(Array.isArray(d) ? d : []);
  }

  async function saveTx() {
    if (!data?.account?.id || !txAmount) return;
    setSavingTx(true);
    await fetch("/api/transactions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        accountId: data.account.id,
        type: txType,
        amount: parseFloat(txAmount.replace(/[^0-9.]/g, "")),
        note: txNote,
        date: txDate || undefined,
      }),
    });
    setSavingTx(false);
    setTxAmount("");
    setTxNote("");
    setTxDate("");
    setShowTxModal(false);
    fetchData();
    fetchTransactions(data.account.id);
  }

  async function deleteTx(id: string) {
    await fetch(`/api/transactions?id=${id}`, { method: "DELETE" });
    if (data?.account?.id) fetchTransactions(data.account.id);
    fetchData();
  }

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
  const dowLabels = ["Min","Sen","Sel","Rab","Kam","Jum","Sab"];
  const dowRows = [1,2,3,4,5,6,0]
    .filter(d => dowPnl[d] || (d >= 1 && d <= 5))
    .map(d => ({ dow: d, label: dowLabels[d], pnl: dowPnl[d]?.pnl ?? 0, count: dowPnl[d]?.count ?? 0 }));
  const dowAbsTotal = dowRows.reduce((t, r) => t + Math.abs(r.pnl), 0);
  const dowMax = Math.max(1, ...dowRows.map(r => Math.abs(r.pnl)));
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

  const fmtNum = (v: number) => `${v >= 0 ? "+" : "-"}${Math.abs(Math.round(v)).toLocaleString(cur === "IDR" ? "id-ID" : "en-US")}`;

  const sessionLabel: Record<string, string> = {
    london: "London", newyork: "New York", asia: "Asia", sydney: "Sydney", unknown: "Unknown",
  };

  const cur = data?.account?.currency ?? "USD";
  const sym = cur === "IDR" ? "Rp" : "$";
  const fmtK = (v: number) => {
    const abs = Math.abs(v);
    const sign = v >= 0 ? "+" : "-";
    if (abs >= 1_000_000_000) return `${sign}${sym}${(abs/1_000_000_000).toFixed(1)}B`;
    if (abs >= 1_000_000) return `${sign}${sym}${(abs/1_000_000).toFixed(1)}M`;
    if (abs >= 1_000) return `${sign}${sym}${(abs/1_000).toFixed(0)}K`;
    return formatCurrency(v, cur);
  };

  // ── Tooltip data ──
  const dayTip = (d: any, note: string): TipProps | undefined => d ? {
    title: format(new Date(d.date), "EEEE, d MMM yyyy"),
    rows: [
      { label: "Net P&L", value: fmtK(d.pnl), tone: tone(d.pnl) },
      { label: "Trades that day", value: String(d.tradeCount ?? 0) },
    ],
    note, side: "bottom",
  } : undefined;
  const holdSample = recentTrades.filter((t: any) => t.exitDate && t.entryDate).length;
  const netTip: TipProps | undefined = stats ? {
    title: "Net P&L breakdown",
    rows: [
      { label: "Gross profit", value: fmtK(stats.grossProfit ?? 0), tone: "win" },
      { label: "Gross loss", value: fmtK(-(stats.grossLoss ?? 0)), tone: "loss" },
      { label: "Wins", value: String(stats.winCount ?? 0), tone: "win" },
      { label: "Losses", value: String(stats.lossCount ?? 0), tone: "loss" },
      { label: "Closed trades", value: String(stats.closedTrades ?? 0) },
    ],
    note: "Gross profit minus gross loss across closed trades in the selected period.",
    side: "bottom", align: "left",
  } : undefined;
  const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  const daysLeft = daysInMonth - now.getDate() + 1; // including today
  const goalRemaining = Math.max(0, monthlyGoal - monthPnl);
  const goalTip: TipProps = {
    title: "Monthly goal progress",
    rows: [
      { label: "Progress", value: `${goalPct.toFixed(1)}%`, tone: goalPct >= 100 ? "win" : undefined },
      { label: "Achieved", value: fmtK(monthPnl), tone: tone(monthPnl) },
      { label: "Remaining", value: goalRemaining > 0 ? fmtK(goalRemaining).replace("+", "") : "Done", tone: goalRemaining > 0 ? "muted" : "win" },
      { label: "Days left", value: String(daysLeft) },
      { label: "Needed / day", value: goalRemaining > 0 ? fmtK(goalRemaining / Math.max(1, daysLeft)).replace("+", "") : "—" },
    ],
    note: "Days left includes today.",
    side: "top",
  };
  const sessionTradeTotal = bySession.slice(0, 4).reduce((t: number, s: any) => t + (s.trades ?? 0), 0);
  const depositTotal = data?.account?.totalDeposit ?? 0;
  const withdrawTotal = data?.account?.totalWithdraw ?? 0;
  const flowTotal = depositTotal + withdrawTotal;
  const flowShare = (v: number) => (flowTotal > 0 ? `${((v / flowTotal) * 100).toFixed(0)}%` : "—");
  const dirLabel = (t: any) => {
    const d = String(t.direction ?? "").toLowerCase();
    return d.includes("short") || d.includes("sell") ? "Short" : "Long";
  };

  const periodTabs = (
    <div className={TABS}>
      {PERIODS.map((p) => (
        <button key={p.value} onClick={() => setPeriod(p.value)} className={cn(TAB, period === p.value && TAB_ON)}>
          {p.label}
        </button>
      ))}
    </div>
  );

  const todayLabel = now.toLocaleDateString("id-ID", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
  const curveFrom = rawCurve.length ? String(rawCurve[0].date).slice(5) : "";
  const curveTo = rawCurve.length ? String(rawCurve[rawCurve.length - 1].date).slice(5) : "";
  const TILE = "rounded-[14px] border bg-secondary/40 dark:border-[#7a8cff]/[0.14] dark:bg-white/[0.03] px-4 py-[14px] flex flex-col gap-1.5 min-w-0 w-full h-full " + TILE_FX;
  const TILE_LABEL = "text-[10.5px] font-bold tracking-[0.08em] uppercase text-muted-foreground dark:text-[#8a94c4]";

  return (
    <div className={cn(PAGE, "min-h-screen")}>
      {/* ── HEADER ── */}
      <div className="flex flex-wrap items-start justify-between gap-4 mb-1">
        <div className="min-w-0">
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className={H1}>Dashboard</h1>
            {data?.accounts && data.accounts.length > 0 && (
              <div className="relative">
                <button onClick={() => setAccountOpen(!accountOpen)}
                  className="inline-flex items-center gap-2 h-[30px] px-3 rounded-[9px] border border-[#7a8cff]/35 bg-[#4f6bff]/[0.14] text-[#4f6bff] dark:text-[#c7d0ff] text-xs font-semibold hover:border-[#7a8cff] transition-colors">
                  <span className="truncate max-w-[160px]">{data.account?.name ?? "Select"}</span>
                  <svg className="w-3.5 h-3.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                </button>
                {accountOpen && (
                  <>
                    <div className="fixed inset-0 z-40" onClick={() => setAccountOpen(false)} />
                    <div className="absolute left-0 top-9 z-50 min-w-[180px] border rounded-xl shadow-2xl py-1 overflow-hidden" style={{ backgroundColor: "hsl(var(--card))" }}>
                      {data.accounts.map((acc: any) => (
                        <button key={acc.id} onClick={() => { setSelectedAccountId(acc.id); setAccountOpen(false); }}
                          className={cn("w-full text-left px-3 py-2 text-xs hover:bg-muted transition-colors flex items-center justify-between gap-2",
                            (selectedAccountId === acc.id || (!selectedAccountId && acc.isDefault)) && "text-indigo-400 font-medium")}>
                          <span className="truncate">{acc.name}</span>
                          {(selectedAccountId === acc.id || (!selectedAccountId && acc.isDefault)) && (
                            <svg className="w-3 h-3 shrink-0 text-indigo-400" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" /></svg>
                          )}
                        </button>
                      ))}
                    </div>
                  </>
                )}
              </div>
            )}
          </div>
          <p className={SUB}>Ringkasan performa akun {data?.account?.name ?? ""} · {todayLabel}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2.5">
          {periodTabs}
          <Link href="/trades" className={cn(BTN, BTN_PRIMARY)}>
            <Plus className="w-4 h-4" />Add Trade
          </Link>
        </div>
      </div>

      {loading ? (
        <div className="flex flex-col gap-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
            {[0, 1, 2, 3].map((i) => <div key={i} className="skeleton h-[148px] rounded-2xl" />)}
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_340px] gap-4">
            <div className="skeleton h-[330px] rounded-2xl" />
            <div className="skeleton h-[330px] rounded-2xl" />
          </div>
        </div>
      ) : (
        <>
          {/* ── ROW 1: KPI (Win %, Avg W/L, Profit Factor, Streak) ── */}
          <KpiRow stats={stats} calendar={calendar} currency={cur} />

          {/* ── ROW 2: NET P&L + DAY EXTREMES ── */}
          <div className="flex flex-wrap gap-4 stagger">
            <HoverTip block className="flex-[1.5_1_300px] min-w-0" {...(netTip ?? { note: "No trades yet." })}>
            <div className={cn(
              "w-full h-full min-w-0 rounded-2xl border px-6 py-5 flex flex-col gap-1.5 relative overflow-hidden card-hover", MOTION,
              stats?.netPnL >= 0
                ? "border-emerald-500/35 bg-emerald-500/[0.07] dark:bg-gradient-to-br dark:from-[#166534]/30 dark:to-[#0a1028]/80"
                : "border-red-500/35 bg-red-500/[0.07] dark:bg-gradient-to-br dark:from-[#7f1d1d]/30 dark:to-[#0a1028]/80"
            )}>
              <span className={cn("text-[11px] font-bold tracking-[0.08em] uppercase", stats?.netPnL >= 0 ? "text-emerald-700 dark:text-[#86efac]" : "text-red-700 dark:text-[#fca5a5]")}>Net P&amp;L</span>
              <div className={cn("text-[36px] font-extrabold tracking-[-0.025em] tabular-nums leading-[1.05] mt-1 break-words", stats?.netPnL >= 0 ? "text-emerald-600 dark:text-[#4ade80]" : "text-red-600 dark:text-[#f87171]")}>
                {stats ? formatCurrency(stats.netPnL, cur) : "—"}
              </div>
              <span className={CAP}>{stats?.closedTrades ?? 0} trades closed</span>
            </div>
            </HoverTip>
            <StatCard label="Best Day" value={bestDay ? fmtK(bestDay.pnl) : "—"} sub={bestDay ? format(new Date(bestDay.date), "EEE, MMM d") : undefined} color={bestDay?.pnl > 0 ? WIN : undefined}
              tip={dayTip(bestDay, "Highest single-day P&L in the selected period.")} />
            <StatCard label="Worst Day" value={worstDay ? fmtK(worstDay.pnl) : "—"} sub={worstDay ? format(new Date(worstDay.date), "EEE, MMM d") : undefined} color={worstDay?.pnl < 0 ? LOSS : undefined}
              tip={dayTip(worstDay, "Lowest single-day P&L in the selected period.")} />
            <StatCard label="Avg Hold" value={avgDuration ?? "—"} sub="per trade"
              tip={{ title: "Average holding time", rows: [{ label: "Avg hold", value: avgDuration ?? "—" }, { label: "Sample", value: `${holdSample} trades` }], note: "Mean time between entry and exit of recent closed trades.", side: "bottom", align: "right" }} />
          </div>

          {/* ── ROW 3: EQUITY CURVE + TRADE SCORE ── */}
          <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_340px] gap-4 items-stretch stagger">
            <div className={cn(PANEL, "min-w-0 px-4 md:px-6 py-5 card-hover")}>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className={H2}>Equity Curve</h2>
                  <div className={cn(CAP, "mt-1")}>Akumulasi P&amp;L per trade{curveFrom ? ` · ${curveFrom} sampai ${curveTo}` : ""}</div>
                </div>
                <div className={TABS}>
                  {([["daily", "Day"], ["weekly", "Week"], ["monthly", "Month"]] as const).map(([v, lbl]) => (
                    <button key={v} onClick={() => setEquityView(v)} className={cn(TAB, equityView === v && TAB_ON)}>
                      {lbl}
                    </button>
                  ))}
                </div>
              </div>
              <div className="mt-2.5">
              {cumulativeCurve.length > 0 ? (
                <ResponsiveContainer width="100%" height={224}>
                  <AreaChart data={cumulativeCurve} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                    <defs>
                      <linearGradient id="eqGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#4f6bff" stopOpacity={0.4} />
                        <stop offset="100%" stopColor="#4f6bff" stopOpacity={0.02} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 5" stroke="rgba(122,140,255,0.13)" vertical={false} />
                    <XAxis dataKey="date" tick={{ fontSize: 10.5, fill: "#7d88bd" }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize: 10.5, fill: "#7d88bd" }} width={60} axisLine={false} tickLine={false}
                      tickFormatter={(v) => { const a = Math.abs(v); return a >= 1e9 ? `${sym}${(v / 1e9).toFixed(1)}B` : a >= 1e6 ? `${sym}${(v / 1e6).toFixed(1)}M` : a >= 1e3 ? `${sym}${(v / 1e3).toFixed(0)}K` : `${sym}${v}`; }} />
                    <ReferenceLine y={0} stroke="rgba(165,180,255,0.35)" strokeDasharray="4 4" />
                    <Tooltip formatter={(v: number) => [formatCurrency(v, cur, true), "Equity"]} contentStyle={TOOLTIP_STYLE} labelStyle={{ color: "#8a94c4", fontWeight: 700, marginBottom: 4 }} cursor={{ stroke: "rgba(165,180,255,0.4)", strokeDasharray: "4 4" }} itemStyle={{ color: CURVE_COLOR }} />
                    <Area type="monotone" dataKey="pnl" stroke={CURVE_COLOR} strokeWidth={2.4} fill="url(#eqGrad)" isAnimationActive animationDuration={1400} animationEasing="ease-out" dot={false} activeDot={{ r: 4.5, fill: "#fff", stroke: "#4f6bff", strokeWidth: 2 }} />
                  </AreaChart>
                </ResponsiveContainer>
              ) : <div className="h-44 flex items-center justify-center text-xs text-muted-foreground">No data yet</div>}
              </div>
            </div>
            <TradeScoreCard className="" stats={stats} calendar={calendar} account={data?.account} />
          </div>

          {/* ── ROW 4: EARNINGS + GOAL + SESSION/DAY ── */}
          <div className="flex flex-wrap gap-4 items-stretch stagger">
            {/* Earnings */}
            <div className={cn(PANEL, "flex-[1_1_280px] min-w-0 px-6 py-[22px] flex flex-col gap-4 card-hover")}>
              <h2 className={H2}>Earnings</h2>
              <div className="grid grid-cols-2 gap-2.5">
                {[
                  { label: "Today", pnl: todayPnl, prev: prevDayPnl, prevLabel: "Yesterday" },
                  { label: "This Week", pnl: weekPnl, prev: prevWeekPnl, prevLabel: "Last week" },
                  { label: "This Month", pnl: monthPnl, prev: prevMonthPnl, prevLabel: "Last month" },
                ].map(({ label, pnl, prev, prevLabel }) => {
                  const pct = pctChange(pnl, prev);
                  const isMonth = label === "This Month";
                  return (
                    <HoverTip key={label} block className={cn("min-w-0", isMonth && "col-span-2")} side="top" align={isMonth ? "center" : label === "Today" ? "left" : "right"}
                      title={label}
                      rows={[
                        { label: "P&L", value: fmtK(pnl), tone: tone(pnl) },
                        { label: prevLabel, value: fmtK(prev), tone: tone(prev) },
                        { label: "Change", value: pct === null ? "n/a" : `${pct >= 0 ? "+" : ""}${pct.toFixed(1)}%`, tone: pct === null ? "muted" : tone(pct) },
                      ]}
                      note={pct === null ? "No previous-period P&L to compare against." : "Compared with the previous equivalent period."}>
                    <div className={cn(TILE, isMonth && "border-emerald-500/30 bg-emerald-500/[0.07] dark:border-[#22c55e]/30 dark:bg-[#22c55e]/[0.07]")}>
                      <span className={TILE_LABEL}>{label}</span>
                      <b className={cn("text-lg", pnl >= 0 ? WIN : LOSS)}>{fmtK(pnl)}</b>
                      {pct !== null ? (
                        <span className={cn(CHIP, "self-start !h-5 !text-[10.5px]", pct >= 0 ? CHIP_G : CHIP_R)}>
                          {pct >= 0 ? "▲" : "▼"} {Math.abs(pct).toFixed(0)}%
                        </span>
                      ) : pnl === 0 ? (
                        <span className="text-[11px] text-muted-foreground dark:text-[#8a94c4]">belum ada trade</span>
                      ) : null}
                    </div>
                    </HoverTip>
                  );
                })}
              </div>
            </div>

            {/* Monthly Goal */}
            <div className={cn(PANEL, "flex-[1_1_280px] min-w-0 px-6 py-[22px] flex flex-col gap-3 card-hover")}>
              <div className="flex items-center justify-between">
                <h2 className={H2}>Monthly Goal</h2>
                <button onClick={() => { setEditingGoal(true); setGoalInput(String(monthlyGoal || "")); }}
                  className="text-xs font-bold text-indigo-600 dark:text-[#8ea2ff] hover:underline">{monthlyGoal > 0 ? "Edit" : "Set Goal"}</button>
              </div>
              {editingGoal ? (
                <div className="flex items-center gap-2 mt-2">
                  <input type="number" value={goalInput} onChange={e => setGoalInput(e.target.value)} placeholder="e.g. 10000000"
                    className="flex-1 min-w-0 text-sm border rounded-xl px-3 py-2 bg-background" />
                  <button onClick={saveGoal} disabled={savingGoal} className={cn("text-xs font-semibold px-3 py-2 rounded-xl disabled:opacity-50", BTN_PRIMARY)}>{savingGoal ? "..." : "Save"}</button>
                  <button onClick={() => setEditingGoal(false)} className="text-xs text-muted-foreground">✕</button>
                </div>
              ) : monthlyGoal > 0 ? (
                <div className="flex flex-col items-center gap-3 text-center">
                  <HoverTip block className="shrink-0" {...goalTip}>
                  <div className="relative w-[168px] h-[100px] shrink-0">
                    <svg width="168" height="100" viewBox="0 0 128 76" aria-hidden="true" className={cn("transition-[transform,filter] duration-300 ease-out group-hover/tip:scale-[1.03] group-hover/tip:brightness-110", MOTION)}>
                      <path d="M12,68 A52,52 0 0 1 116,68" fill="none" stroke="hsl(var(--muted))" strokeWidth="10" strokeLinecap="round" />
                      {goalPct > 0 && (
                        <path d="M12,68 A52,52 0 0 1 116,68" fill="none" stroke={goalPct >= 100 ? "#4ade80" : "#6f86ff"} strokeWidth="10" strokeLinecap="round"
                          pathLength={100} strokeDasharray={`${Math.min(goalPct, 100)} 100`} style={{ filter: "drop-shadow(0 0 6px rgba(79,107,255,0.7))" }} />
                      )}
                    </svg>
                    <div className="absolute inset-x-0 bottom-0.5 text-center text-[17px] font-extrabold" style={{ color: goalPct >= 100 ? "#4ade80" : "#a5b4ff" }}>{goalPct.toFixed(0)}%</div>
                  </div>
                  </HoverTip>
                  <div className="flex flex-col items-center gap-1 min-w-0">
                    <div className={cn("text-2xl font-extrabold tracking-[-0.02em]", pnlColor(monthPnl))}>{fmtK(monthPnl)}</div>
                    <span className={CAP}>of {formatCurrency(monthlyGoal, cur, false)}</span>
                    <span className={cn(CHIP, CHIP_B, "mt-1 !h-5 !text-[10.5px]")}>{goalPct >= 100 ? "🎉 Achieved!" : `${fmtK(monthlyGoal - monthPnl).replace("+","")} left`}</span>
                  </div>
                </div>
              ) : (
                <div className="h-16 flex items-center justify-center text-sm text-muted-foreground">Set a monthly profit goal</div>
              )}
            </div>

            {/* By Session | Performance by Day */}
            <div className={cn(PANEL, "flex-[2.6_1_620px] min-w-0 px-6 py-[22px] flex flex-wrap gap-6 card-hover")}>
              <div className="flex-[1_1_260px] min-w-0 flex flex-col gap-3.5">
                <div className="flex items-baseline justify-between">
                  <h2 className={H2}>By Session</h2>
                  <span className={CAP}>win rate</span>
                </div>
                <div className="flex flex-col gap-[15px]">
                  {bySession.length === 0 && <p className="text-sm text-muted-foreground">No data</p>}
                  {bySession.slice(0, 4).map((s: any) => (
                    <HoverTip key={s.session} block side="top" align="left"
                      title={`${sessionLabel[s.session] ?? s.session} session`}
                      rows={[
                        { label: "Win rate", value: `${s.winRate}%`, tone: s.winRate >= 50 ? "win" : "loss" },
                        { label: "Trades", value: String(s.trades ?? 0) },
                        ...(s.pnl != null ? [{ label: "Net P&L", value: fmtK(s.pnl), tone: tone(s.pnl) } as TipRow] : []),
                        ...(sessionTradeTotal > 0 ? [{ label: "Share of trades", value: `${Math.round(((s.trades ?? 0) / sessionTradeTotal) * 100)}%` } as TipRow] : []),
                      ]}>
                    <div className={cn("flex items-center gap-3.5 text-[13px]", ROW_FX)}>
                      <span className="w-[72px] shrink-0 font-semibold truncate capitalize">{sessionLabel[s.session] ?? s.session}</span>
                      <div className="flex-1 min-w-0 h-2 rounded-full bg-secondary dark:bg-white/[0.07]">
                        <div className={cn("h-2 rounded-full bg-gradient-to-r from-[#4f6bff] to-[#8ea2ff]", BAR_FX)} style={{ width: `${Math.max(0, Math.min(100, s.winRate))}%` }} />
                      </div>
                      <b className="font-mono tabular-nums w-10 shrink-0 text-right">{s.winRate}%</b>
                    </div>
                    </HoverTip>
                  ))}
                </div>
              </div>
              <div className="flex-[1.3_1_300px] min-w-0 flex flex-col gap-3.5 md:border-l md:pl-6 dark:border-[#7a8cff]/[0.14]">
                <div className="flex items-baseline justify-between">
                  <h2 className={H2}>Performance by Day</h2>
                  <span className={CAP}>total P&amp;L</span>
                </div>
                {dowRows.length === 0 ? <p className="text-sm text-muted-foreground">No data</p> : (
                  <div className="flex flex-col gap-[15px]">
                    {dowRows.map(r => (
                      <HoverTip key={r.dow} block side="top" align="right"
                        title={DAYS_OF_WEEK_FULL[r.dow]}
                        rows={[
                          { label: "Total P&L", value: fmtK(r.pnl), tone: tone(r.pnl) },
                          { label: "Trades", value: String(r.count) },
                          { label: "Share of P&L swing", value: dowAbsTotal > 0 ? `${Math.round((Math.abs(r.pnl) / dowAbsTotal) * 100)}%` : "—" },
                        ]}
                        note="Share is this weekday's absolute P&L out of all weekdays.">
                      <div className={cn("flex items-center gap-3 text-[13px]", ROW_FX)}>
                        <span className="w-[34px] shrink-0 font-semibold">{r.label}</span>
                        <div className="flex-1 min-w-0 relative h-2 rounded-full bg-secondary dark:bg-white/[0.07]">
                          <div className="absolute left-1/2 -top-[3px] -bottom-[3px] w-px bg-[#a5b4ff]/40" />
                          <div className={cn("absolute top-0 bottom-0", BAR_FX, r.pnl >= 0 ? "left-1/2 rounded-r-full bg-gradient-to-r from-[#16a34a] to-[#4ade80]" : "right-1/2 rounded-l-full bg-gradient-to-l from-[#b91c1c] to-[#f87171]")}
                            style={{ width: `${(Math.abs(r.pnl) / dowMax) * 50}%` }} />
                        </div>
                        <b className={cn("font-mono tabular-nums text-[12.5px] tracking-[-0.03em] text-right shrink-0 min-w-[72px] sm:w-24", pnlColor(r.pnl))}>{fmtNum(r.pnl)}</b>
                      </div>
                      </HoverTip>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* ── ROW 5: CALENDAR + RECENT TRADES ── */}
          <div className="flex flex-wrap gap-4 items-stretch stagger">
            <div className="flex-[3_1_720px] min-w-0 flex flex-col [&>div]:flex-1">
              <CalendarHeatmap calendarData={calendar} currency={data?.account?.currency} />
            </div>
            <div className={cn(PANEL, "flex-[1_1_320px] min-w-0 px-6 py-[22px] flex flex-col card-hover")}>
              <div className="flex items-center justify-between mb-1.5">
                <h2 className={H2}>Recent Trades</h2>
                <Link href="/trades" className="text-xs font-bold text-indigo-600 dark:text-[#8ea2ff] hover:underline">View all →</Link>
              </div>
              <div className="flex-1">
                {recentTrades.length === 0 ? (
                  <p className="text-sm text-muted-foreground py-4 text-center">No trades yet</p>
                ) : recentTrades.map((t: any, i: number) => (
                  <HoverTip key={t.id} block side={i < 2 ? "bottom" : "top"} align="left"
                    className="border-b dark:border-[#7a8cff]/[0.09] last:border-0"
                    title={t.symbol}
                    rows={[
                      { label: "Direction", value: dirLabel(t), tone: dirLabel(t) === "Short" ? "loss" : "win" },
                      { label: "Entry date", value: format(new Date(t.entryDate), "d MMM yyyy") },
                      { label: "P&L", value: t.pnl !== null && t.pnl !== undefined ? fmtK(t.pnl) : "Open", tone: t.pnl !== null && t.pnl !== undefined ? tone(t.pnl) : "muted" },
                    ]}>
                  <div className={cn("flex items-center justify-between gap-3 py-[13px]", ROW_FX)}>
                    <div className="min-w-0">
                      <b className="text-[13.5px]">{t.symbol}</b>
                      <div className={cn(CAP, "mt-0.5")}>{format(new Date(t.entryDate), "dd MMM")}</div>
                    </div>
                    {t.pnl !== null ? (
                      <span className={cn("inline-block px-2.5 py-[5px] rounded-lg font-semibold text-[12.5px] font-mono tabular-nums",
                        t.pnl > 0 ? "bg-[#16a34a]/20 text-emerald-600 dark:text-[#4ade80]" : t.pnl < 0 ? "bg-[#dc2626]/20 text-red-600 dark:text-[#f87171]" : "bg-muted text-muted-foreground")}>
                        {fmtK(t.pnl)}
                      </span>
                    ) : <span className="text-xs text-muted-foreground">open</span>}
                  </div>
                  </HoverTip>
                ))}
              </div>
            </div>
          </div>

          {/* ── ROW 6: DEPOSIT & WITHDRAW ── */}
          <div className={cn(PANEL, "px-4 md:px-6 py-[22px] card-hover anim-up")} style={{ animationDelay: ".3s" }}>
            <div className="flex items-center justify-between gap-3 mb-4">
              <h2 className={H2}>Deposit &amp; Withdraw</h2>
              <button onClick={() => setShowTxModal(true)} className={cn("inline-flex items-center gap-1.5 h-8 px-3 rounded-[10px] text-xs font-semibold", BTN_PRIMARY)}>
                <Plus className="w-3.5 h-3.5" />Add
              </button>
            </div>
            <div className="flex flex-wrap gap-3.5">
              <HoverTip block className="flex-[1_1_320px] min-w-0" side="top" align="left" title="Total deposit"
                rows={[
                  { label: "Amount", value: formatCurrency(depositTotal, cur, false), tone: "win" },
                  { label: "Transactions", value: String(txList.filter((x: any) => x.type === "deposit").length) },
                  { label: "Share of flow", value: flowShare(depositTotal) },
                ]}
                note="Count covers the latest transactions listed below.">
              <div className={cn("w-full h-full rounded-[14px] border border-emerald-500/30 bg-emerald-500/[0.06] dark:bg-gradient-to-br dark:from-[#166534]/30 dark:to-[#0a1028]/60 px-5 py-4", TILE_FX)}>
                <div className="text-xs font-medium text-muted-foreground dark:text-[#8a94c4]">Total Deposit</div>
                <div className={cn("text-[22px] font-extrabold tracking-[-0.02em] mt-1.5 break-words", WIN)}>{formatCurrency(data?.account?.totalDeposit ?? 0, cur, false)}</div>
              </div>
              </HoverTip>
              <HoverTip block className="flex-[1_1_320px] min-w-0" side="top" align="right" title="Total withdraw"
                rows={[
                  { label: "Amount", value: formatCurrency(withdrawTotal, cur, false), tone: "loss" },
                  { label: "Transactions", value: String(txList.filter((x: any) => x.type === "withdraw").length) },
                  { label: "Share of flow", value: flowShare(withdrawTotal) },
                ]}
                note="Count covers the latest transactions listed below.">
              <div className={cn("w-full h-full rounded-[14px] border border-red-500/30 bg-red-500/[0.06] dark:bg-gradient-to-br dark:from-[#7f1d1d]/30 dark:to-[#0a1028]/60 px-5 py-4", TILE_FX)}>
                <div className="text-xs font-medium text-muted-foreground dark:text-[#8a94c4]">Total Withdraw</div>
                <div className={cn("text-[22px] font-extrabold tracking-[-0.02em] mt-1.5 break-words", LOSS)}>{formatCurrency(data?.account?.totalWithdraw ?? 0, cur, false)}</div>
              </div>
              </HoverTip>
            </div>
            {txList.length > 0 && (
              <div className="mt-2">
                {txList.slice(0, 5).map((tx: any) => (
                  <HoverTip key={tx.id} block side="top" align="left"
                    className="border-b dark:border-[#7a8cff]/[0.09] last:border-0"
                    title={tx.type === "deposit" ? "Deposit" : "Withdraw"}
                    rows={[
                      { label: "Amount", value: formatCurrency(tx.amount, cur, false), tone: tx.type === "deposit" ? "win" : "loss" },
                      { label: "Date", value: format(new Date(tx.date), "d MMM yyyy") },
                    ]}
                    note={tx.note ? tx.note : undefined}>
                  <div className={cn("flex items-center gap-3.5 py-[13px]", ROW_FX)}>
                    <span className={cn(CHIP, "!min-w-0 w-12 !h-auto !rounded-[7px] py-[3px] shrink-0", tx.type === "deposit" ? CHIP_G : CHIP_R)}>
                      {tx.type === "deposit" ? "DEP" : "WDR"}
                    </span>
                    <div className="flex-1 min-w-0">
                      <b className="font-mono tabular-nums text-sm">{formatCurrency(tx.amount, cur, false)}</b>
                      {tx.note && <div className={cn(CAP, "mt-0.5 truncate")}>{tx.note}</div>}
                    </div>
                    <span className={cn(CAP, "shrink-0")}>{new Date(tx.date).toLocaleDateString("id-ID", { day: "2-digit", month: "short" })}</span>
                    <button onClick={() => deleteTx(tx.id)} aria-label="Hapus" className="w-[30px] h-[30px] shrink-0 flex items-center justify-center rounded-lg text-muted-foreground hover:bg-secondary hover:text-foreground dark:hover:bg-white/[0.08] dark:hover:text-white transition-colors">
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                  </HoverTip>
                ))}
              </div>
            )}
          </div>
        </>
      )}

      {/* Add Transaction Modal */}
      {showTxModal && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4" onClick={() => setShowTxModal(false)}>
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm anim-fade" />
          <div className="relative rounded-2xl border bg-card dark:border-[#27358a]/50 dark:bg-[#0c1330] p-5 w-full max-w-sm shadow-2xl anim-pop" onClick={e => e.stopPropagation()}>
            <p className="text-sm font-semibold mb-4">Add Transaction</p>
            <div className="flex gap-2 mb-4">
              {(["deposit","withdraw"] as const).map(t => (
                <button key={t} onClick={() => setTxType(t)}
                  className={cn("flex-1 py-2 rounded-xl text-xs font-medium capitalize transition-colors", txType === t ? t === "deposit" ? "bg-[#16a34a] text-white" : "bg-[#dc2626] text-white" : "bg-muted text-muted-foreground")}>
                  {t}
                </button>
              ))}
            </div>
            <div className="space-y-3">
              <div><label className="text-[10px] text-muted-foreground">Amount ({cur})</label>
                <input type="number" value={txAmount} onChange={e => setTxAmount(e.target.value)} placeholder="0" className="w-full mt-1 text-sm border rounded-xl px-3 py-2 bg-background" /></div>
              <div><label className="text-[10px] text-muted-foreground">Note (optional)</label>
                <input type="text" value={txNote} onChange={e => setTxNote(e.target.value)} placeholder="e.g. Initial deposit" className="w-full mt-1 text-xs border rounded-xl px-3 py-2 bg-background" /></div>
              <div><label className="text-[10px] text-muted-foreground">Date (optional)</label>
                <input type="date" value={txDate} onChange={e => setTxDate(e.target.value)} className="w-full mt-1 text-xs border rounded-xl px-3 py-2 bg-background" /></div>
            </div>
            <button onClick={saveTx} disabled={savingTx || !txAmount} className="w-full mt-4 py-2.5 bg-gradient-to-b from-[#4f6bff] to-[#2f4bd8] shadow-[0_8px_24px_-8px_rgba(79,107,255,0.8)] text-white text-xs font-medium rounded-xl hover:brightness-110 disabled:opacity-50">
              {savingTx ? "Saving..." : `Add ${txType}`}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
