"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  format, startOfMonth, endOfMonth, eachDayOfInterval, startOfWeek, endOfWeek,
  isSameMonth, getYear, getMonth, getDay,
} from "date-fns";
import { ChevronLeft, ChevronRight, Plus } from "lucide-react";
import { cn, formatCurrency, getDurationString } from "@/lib/utils";
import AccountSwitcher from "@/components/layout/AccountSwitcher";
import { HoverTip, type TipRow } from "@/components/ui/HoverTip";
import {
  PANEL, PAGE, H1, SUB, H2, CAP, KPI, TABS, TAB, TAB_ON, BTN, BTN_PRIMARY, LABEL,
  pnlColor, WIN, LOSS,
} from "@/lib/theme";

const GRID = "grid grid-cols-[repeat(7,minmax(0,1fr))_56px] sm:grid-cols-[repeat(7,minmax(0,1fr))_88px] md:grid-cols-[repeat(7,minmax(0,1fr))_124px] gap-1 md:gap-2";

const WEEKDAYS = ["Sen", "Sel", "Rab", "Kam", "Jum", "Sab", "Min"];
const DAY_NAMES = ["Minggu", "Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"];
const MONTHS_FULL = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"];
const MONTHS_SHORT = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"];

const MOTION = "motion-reduce:transform-none motion-reduce:transition-none";
const GLOW = "hover:shadow-[0_0_18px_rgba(79,107,255,0.45)]";
const tone = (v: number): TipRow["tone"] => (v > 0 ? "win" : v < 0 ? "loss" : "muted");

const fk = (d: Date) => format(d, "yyyy-MM-dd");
const parseKey = (k: string) => new Date(k + "T00:00:00");
const plural = (n: number) => `${n} ${n === 1 ? "trade" : "trades"}`;

function getCellColors(pnl: number, isDark: boolean, level: number) {
  const strong = level >= 2;
  if (pnl > 0) return isDark
    ? { bg: strong ? "rgba(34,197,94,0.24)" : "rgba(34,197,94,0.1)", border: strong ? "rgba(74,222,128,0.55)" : "rgba(34,197,94,0.28)", text: "#bbf7d0", sub: "#4ade80" }
    : { bg: strong ? "#dcfce7" : "#f0fdf4", border: strong ? "#86efac" : "#bbf7d0", text: "#15803d", sub: "#16a34a" };
  if (pnl < 0) return isDark
    ? { bg: strong ? "rgba(239,68,68,0.2)" : "rgba(239,68,68,0.12)", border: strong ? "rgba(248,113,113,0.45)" : "rgba(248,113,113,0.3)", text: "#fecaca", sub: "#f87171" }
    : { bg: strong ? "#fee2e2" : "#fff1f2", border: strong ? "#fca5a5" : "#fecdd3", text: "#b91c1c", sub: "#dc2626" };
  return null;
}

// Plain signed number without currency symbol, e.g. +7.584.877
function fmtNum(v: number, currency?: string) {
  const idr = currency === "IDR";
  const dec = idr || currency === "JPY" ? 0 : 2;
  const s = new Intl.NumberFormat(idr ? "id-ID" : "en-US", { minimumFractionDigits: dec, maximumFractionDigits: dec }).format(Math.abs(v));
  return `${v > 0 ? "+" : v < 0 ? "-" : ""}${s}`;
}

// Compact Indonesian style: +3,5jt / −6,4jt
function fmtCompact(v: number, currency?: string) {
  const sign = v >= 0 ? "+" : "−";
  const a = Math.abs(v);
  const n = (x: number) => x.toFixed(1).replace(".", ",").replace(/,0$/, "");
  if (currency === "IDR" || !currency) {
    if (a >= 1e9) return `${sign}${n(a / 1e9)}M`;
    if (a >= 1e6) return `${sign}${n(a / 1e6)}jt`;
    if (a >= 1e3) return `${sign}${Math.round(a / 1e3)}rb`;
    return `${sign}${Math.round(a)}`;
  }
  if (a >= 1e6) return `${sign}${n(a / 1e6)}M`;
  if (a >= 1e3) return `${sign}${n(a / 1e3)}k`;
  return `${sign}${Math.round(a)}`;
}

export default function CalendarPage() {
  const [current, setCurrent] = useState(new Date());
  const [calendarData, setCalendarData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isDark, setIsDark] = useState(false);
  const [accountId, setAccountId] = useState("");
  const [account, setAccount] = useState<any>(null);
  const [view, setView] = useState<"month" | "week">("month");
  const [selected, setSelected] = useState("");
  const [dayTrades, setDayTrades] = useState<any[]>([]);
  const [dayLoading, setDayLoading] = useState(false);
  const selRef = useRef<string | null>(null);

  useEffect(() => {
    setIsDark(document.documentElement.classList.contains("dark"));
    const obs = new MutationObserver(() => {
      setIsDark(document.documentElement.classList.contains("dark"));
    });
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
    return () => obs.disconnect();
  }, []);

  useEffect(() => {
    setLoading(true);
    fetch(`/api/dashboard?period=all${accountId ? `&accountId=${accountId}` : ""}`)
      .then((r) => r.json())
      .then((d) => {
        setCalendarData(d.calendar ?? []);
        setAccount(d.account ?? null);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [accountId]);

  const cur: string | undefined = account?.currency;
  const dataMap = new Map(calendarData.map((d: any) => [d.date, d]));
  const todayKey = fk(new Date());
  const monthKey = format(current, "yyyy-MM");

  // Default selected day: pending click target, else latest trading day in month, else today / first of month.
  useEffect(() => {
    if (selRef.current && selRef.current.startsWith(monthKey)) {
      setSelected(selRef.current);
      selRef.current = null;
      return;
    }
    selRef.current = null;
    const tradeDates = calendarData
      .filter((d: any) => d.date.startsWith(monthKey) && d.tradeCount > 0)
      .map((d: any) => d.date as string)
      .sort();
    if (tradeDates.length) setSelected(tradeDates[tradeDates.length - 1]);
    else if (todayKey.startsWith(monthKey)) setSelected(todayKey);
    else setSelected(`${monthKey}-01`);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [monthKey, calendarData]);

  // Fetch the selected day's trades.
  useEffect(() => {
    if (!selected) return;
    if (!calendarData.some((d: any) => d.date === selected)) {
      setDayTrades([]);
      setDayLoading(false);
      return;
    }
    let cancelled = false;
    setDayLoading(true);
    const qs = `${accountId ? `accountId=${accountId}&` : ""}from=${selected}&to=${selected}&pageSize=50`;
    fetch(`/api/trades?${qs}`)
      .then((r) => r.json())
      .then((d) => { if (!cancelled) { setDayTrades(Array.isArray(d.trades) ? d.trades : []); setDayLoading(false); } })
      .catch(() => { if (!cancelled) { setDayTrades([]); setDayLoading(false); } });
    return () => { cancelled = true; };
  }, [selected, accountId, calendarData]);

  // Grid (Monday-first), including adjacent-month days.
  const start = startOfMonth(current);
  const end = endOfMonth(current);
  const gridDays = eachDayOfInterval({
    start: startOfWeek(start, { weekStartsOn: 1 }),
    end: endOfWeek(end, { weekStartsOn: 1 }),
  });
  const weeks: Date[][] = [];
  for (let i = 0; i < gridDays.length; i += 7) weeks.push(gridDays.slice(i, i + 7));
  const selWeek = weeks.find((w) => w.some((d) => fk(d) === selected)) ?? weeks[0];
  const visibleWeeks = view === "week" ? [selWeek] : weeks;

  function weekSummary(wk: Date[]) {
    let pnl = 0, tradeDays = 0, tradeCount = 0;
    for (const d of wk) {
      if (!isSameMonth(d, current)) continue;
      const entry = dataMap.get(fk(d));
      if (entry) { pnl += entry.pnl; tradeDays++; tradeCount += entry.tradeCount; }
    }
    return { pnl, tradeDays, tradeCount };
  }

  // Monthly summary
  const monthData = calendarData.filter((d: any) => d.date.startsWith(monthKey));
  const monthPnL = monthData.reduce((s: number, d: any) => s + d.pnl, 0);
  const monthTradeDays = monthData.length;
  const monthTradeCount = monthData.reduce((s: number, d: any) => s + d.tradeCount, 0);
  const monthBest = monthData.length ? Math.max(...monthData.map((d: any) => d.pnl)) : 0;
  const monthWorst = monthData.length ? Math.min(...monthData.map((d: any) => d.pnl)) : 0;
  const monthAvg = monthTradeCount > 0 ? monthPnL / monthTradeCount : 0;
  const dayMax = Math.max(1, ...monthData.map((d: any) => Math.abs(d.pnl)));
  const levelOf = (pnl: number) => (Math.abs(pnl) / dayMax > 0.5 ? 2 : 1);

  // Year overview
  const year = getYear(current);
  const yearSet = new Set<number>([year, getYear(new Date())]);
  for (const d of calendarData) yearSet.add(parseInt(String(d.date).slice(0, 4), 10));
  const years = Array.from(yearSet).filter((y) => !isNaN(y)).sort((a, b) => a - b);
  const yearMonthly = MONTHS_SHORT.map((name, i) => {
    const key = `${year}-${String(i + 1).padStart(2, "0")}`;
    const mData = calendarData.filter((d: any) => d.date.startsWith(key));
    return { name, full: MONTHS_FULL[i], pnl: mData.reduce((s: number, d: any) => s + d.pnl, 0), tradeDays: mData.length };
  });
  const yearPnL = yearMonthly.reduce((s, m) => s + m.pnl, 0);
  const activeMonths = yearMonthly.filter((m) => m.tradeDays > 0);
  const bestMonth = activeMonths.length ? activeMonths.reduce((a, b) => (b.pnl > a.pnl ? b : a)) : null;
  const worstMonth = activeMonths.length ? activeMonths.reduce((a, b) => (b.pnl < a.pnl ? b : a)) : null;
  const monthMax = Math.max(1, ...yearMonthly.map((m) => Math.abs(m.pnl)));
  const avgMonthPnl = activeMonths.length ? yearPnL / activeMonths.length : 0;
  const monthTip = (m: (typeof yearMonthly)[number]): { title: string; rows: TipRow[]; note: string } => {
    const diff = m.pnl - avgMonthPnl;
    const hasAvg = activeMonths.length > 1;
    return {
      title: `${m.full} ${year}`,
      rows: m.tradeDays > 0 ? [
        { label: "Net P&L", value: formatCurrency(m.pnl, cur), tone: tone(m.pnl) },
        { label: "Hari trading", value: String(m.tradeDays) },
        { label: "vs rata-rata", value: hasAvg ? formatCurrency(diff, cur) : "—", tone: hasAvg ? tone(diff) : "muted" },
      ] : [{ label: "Hari trading", value: "0" }],
      note: m.tradeDays > 0 ? "Rata-rata dihitung dari bulan aktif tahun ini." : "Tidak ada trade bulan ini.",
    };
  };
  const profitMonths = activeMonths.filter((m) => m.pnl > 0).length;

  // Selected day
  const selDate = selected ? parseKey(selected) : new Date();
  const selEntry = dataMap.get(selected);
  const selTitle = `${DAY_NAMES[getDay(selDate)]}, ${selDate.getDate()} ${MONTHS_SHORT[selDate.getMonth()]} ${selDate.getFullYear()}`;

  function jumpMonth(y: number, m: number) {
    selRef.current = null;
    setCurrent(new Date(y, m, 1));
  }

  function selectDay(day: Date) {
    const key = fk(day);
    if (!isSameMonth(day, current)) {
      selRef.current = key;
      setCurrent(new Date(day.getFullYear(), day.getMonth(), 1));
    }
    setSelected(key);
  }

  function selectWeek(wk: Date[]) {
    const inMonth = wk.filter((d) => isSameMonth(d, current));
    const withTrades = inMonth.filter((d) => dataMap.has(fk(d)));
    const pick = withTrades.length ? withTrades[withTrades.length - 1] : inMonth[0];
    if (pick) setSelected(fk(pick));
    setView("week");
  }

  const navBtn = "w-9 h-9 flex items-center justify-center rounded-[10px] border dark:border-white/10 text-muted-foreground dark:text-[#c7d0ff] hover:bg-[#4f6bff]/10 hover:border-[#4f6bff]/50 transition-colors";
  const rowLbl = "text-xs font-medium text-muted-foreground dark:text-[#8a94c4]";
  const dayDir = (t: any) => {
    const d = String(t.direction ?? "").toLowerCase();
    return d.includes("short") || d.includes("sell") ? "Short" : "Long";
  };

  return (
    <div className={PAGE}>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className={H1}>Calendar</h1>
            <AccountSwitcher value={accountId} onChange={setAccountId} />
          </div>
          <p className={SUB}>Lihat hasil trading harian dan konsistensi Anda dalam satu pandangan</p>
        </div>
        <Link href="/trades" className={cn(BTN, BTN_PRIMARY)}>
          <Plus className="w-4 h-4" />
          Add Trade
        </Link>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-64 text-sm text-muted-foreground">Loading...</div>
      ) : (
        <>
          <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_350px] gap-4 items-start">
            {/* Calendar card */}
            <div className={cn(PANEL, "p-4 md:px-6 md:py-[22px] min-w-0")}>
              <div className="flex flex-wrap items-center justify-between gap-3 mb-[18px]">
                <div className="flex items-center gap-2.5">
                  <button type="button" onClick={() => jumpMonth(year, getMonth(current) - 1)} aria-label="Bulan sebelumnya" className={navBtn}>
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <h2 className="m-0 text-lg md:text-[22px] font-extrabold tracking-[-0.02em] min-w-[140px] md:min-w-[170px] text-center">
                    {MONTHS_FULL[getMonth(current)]} {year}
                  </h2>
                  <button type="button" onClick={() => jumpMonth(year, getMonth(current) + 1)} aria-label="Bulan berikutnya" className={navBtn}>
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
                <div className="flex items-center gap-2.5">
                  <button type="button"
                    onClick={() => { selRef.current = todayKey; setCurrent(new Date()); setSelected(todayKey); }}
                    className="h-9 px-4 rounded-xl border dark:border-white/15 text-xs font-semibold hover:bg-[#4f6bff]/10 hover:border-[#4f6bff]/50 transition-colors">
                    Hari ini
                  </button>
                  <div className={TABS}>
                    <button type="button" onClick={() => setView("month")} className={cn(TAB, view === "month" && TAB_ON)}>Bulan</button>
                    <button type="button" onClick={() => setView("week")} className={cn(TAB, view === "week" && TAB_ON)}>Minggu</button>
                  </div>
                </div>
              </div>

              {/* Day headers */}
              <div className={cn(GRID, "mb-2")}>
                {WEEKDAYS.map((d) => (
                  <div key={d} className="text-[10px] md:text-[11px] font-bold tracking-[0.08em] uppercase text-muted-foreground dark:text-[#7d88bd] px-1 pb-0.5">{d}</div>
                ))}
                <div className="text-right text-[10px] md:text-[11px] font-bold tracking-[0.08em] uppercase text-muted-foreground dark:text-[#7d88bd] px-1 pb-0.5">
                  <span className="md:hidden">Mgg</span><span className="hidden md:inline">Minggu</span>
                </div>
              </div>

              {/* Weeks */}
              <div className="flex flex-col gap-1 md:gap-2">
                {visibleWeeks.map((wk, vi) => {
                  const wi = weeks.indexOf(wk);
                  const { pnl: wPnl, tradeDays: wDays, tradeCount: wCount } = weekSummary(wk);
                  const wColors = wDays > 0 ? getCellColors(wPnl, isDark, 1) : null;
                  const wSel = wk === selWeek && view === "week";
                  return (
                    <div key={wi} className={GRID}>
                      {wk.map((day, di) => {
                        const key = fk(day);
                        const outside = !isSameMonth(day, current);
                        const isToday = key === todayKey;
                        const isSel = selected === key;
                        if (outside) {
                          return (
                            <button type="button" key={di} onClick={() => selectDay(day)}
                              className="rounded-[13px] border border-dashed border-border/50 dark:border-[#7a8cff]/[0.07] min-h-[58px] md:min-h-[108px] p-1.5 md:px-3 md:py-2.5 flex flex-col items-start min-w-0 text-left hover:border-[#7a8cff]/30 transition-colors"
                              style={isSel ? { boxShadow: "0 0 0 2px #8ea2ff" } : undefined}>
                              <span className="text-[11px] md:text-xs font-bold text-muted-foreground/60 dark:text-[#5b6591]">{format(day, "d")}</span>
                            </button>
                          );
                        }
                        const entry = dataMap.get(key);
                        const c = entry ? getCellColors(entry.pnl, isDark, levelOf(entry.pnl)) : null;
                        const dim = !entry && !isToday && (di >= 5 || key > todayKey);
                        const cell = (
                          <button type="button" key={di}
                            className={cn("relative w-full h-full rounded-[13px] border min-h-[58px] md:min-h-[108px] p-1.5 md:px-3 md:py-2.5 flex flex-col items-stretch text-left gap-0.5 md:gap-1 min-w-0 transition-[transform,box-shadow,filter,border-color,background-color] duration-200 ease-out active:scale-[0.97]", MOTION,
                              entry && cn("hover:scale-[1.03] hover:z-20 hover:brightness-110", GLOW),
                              !c && "hover:border-[#7a8cff]/40 hover:bg-[#4f6bff]/5",
                              dim && "opacity-60")}
                            onClick={() => selectDay(day)}
                            style={{
                              ...(c
                                ? { background: c.bg, borderColor: c.border }
                                : { background: isDark ? "rgba(255,255,255,0.02)" : "var(--card)", borderColor: isDark ? "rgba(122,140,255,0.1)" : "hsl(var(--border))" }),
                              ...(isToday ? { borderColor: "#5b74ff", boxShadow: "0 0 0 3px rgba(79,107,255,0.18)" } : {}),
                              ...(isSel ? { boxShadow: "0 0 0 2px #8ea2ff, 0 10px 30px -10px rgba(79,107,255,0.8)" } : {}),
                            }}>
                            <span className={cn("text-[11px] md:text-xs font-bold", isToday && !c ? "text-[#5b74ff] dark:text-[#c7d0ff]" : "text-muted-foreground dark:text-[#9aa4d2]")}
                              style={c ? { color: c.text } : undefined}>
                              {format(day, "d")}
                            </span>
                            {entry ? (
                              <>
                                <span className="mt-auto text-[10px] md:text-[13px] font-bold font-mono tabular-nums tracking-[-0.02em] truncate" style={{ color: c?.sub }}>
                                  {fmtNum(entry.pnl, cur)}
                                </span>
                                <span className="text-[9px] md:text-[11px] text-muted-foreground dark:text-[#aab3df] truncate">
                                  {plural(entry.tradeCount)}
                                </span>
                              </>
                            ) : isToday ? (
                              <span className="mt-auto text-[9px] md:text-[11px] font-bold text-[#5b74ff] dark:text-[#a5b4ff]">Hari ini</span>
                            ) : null}
                          </button>
                        );
                        if (!entry) return cell;
                        return (
                          <HoverTip key={di} block className="min-w-0" side={vi < 2 ? "bottom" : "top"} align={di < 2 ? "left" : di >= 5 ? "right" : "center"}
                            title={`${DAY_NAMES[getDay(day)]}, ${day.getDate()} ${MONTHS_SHORT[day.getMonth()]} ${day.getFullYear()}`}
                            rows={[
                              { label: "Net P&L", value: formatCurrency(entry.pnl, cur), tone: tone(entry.pnl) },
                              { label: "Trades", value: String(entry.tradeCount) },
                              { label: "Result", value: entry.pnl > 0 ? "Win day" : entry.pnl < 0 ? "Loss day" : "Break even", tone: tone(entry.pnl) },
                            ]}
                            note="Click to see this day's trades.">
                            {cell}
                          </HoverTip>
                        );
                      })}

                      {/* Week summary */}
                      {(() => {
                        const inMonth = wk.filter((d) => isSameMonth(d, current));
                        const weekBtn = (
                          <button type="button" onClick={() => selectWeek(wk)}
                            className={cn("relative w-full h-full rounded-[13px] border min-h-[58px] md:min-h-[108px] p-1.5 md:px-3 md:py-2.5 flex flex-col items-stretch text-left gap-0.5 md:gap-1 min-w-0 overflow-hidden transition-[transform,box-shadow,border-color] duration-200 ease-out hover:border-[#7a8cff]/40", MOTION,
                              wDays > 0 && cn("hover:-translate-y-0.5", GLOW),
                              !wColors && "dark:border-[#7a8cff]/15 dark:bg-gradient-to-br dark:from-[#18265c]/55 dark:to-[#0a1028]/70",
                              wDays === 0 && "opacity-60")}
                            style={{
                              ...(wColors ? { background: wColors.bg, borderColor: wColors.border } : {}),
                              ...(wSel ? { boxShadow: "0 0 0 2px #8ea2ff" } : {}),
                            }}>
                            <span className="text-[9px] md:text-[11px] font-bold tracking-[0.06em] uppercase text-muted-foreground dark:text-[#7d88bd] truncate">
                              <span className="md:hidden">M{wi + 1}</span><span className="hidden md:inline">Minggu {wi + 1}</span>
                            </span>
                            <span className="mt-0.5 md:mt-1.5 text-[10px] md:text-[13px] font-bold font-mono tabular-nums tracking-[-0.02em] truncate"
                              style={{ color: wColors ? wColors.sub : "hsl(var(--muted-foreground))" }}>
                              {wDays > 0 ? fmtNum(wPnl, cur) : "—"}
                            </span>
                            {wDays > 0 && (
                              <span className="text-[9px] md:text-[11px] text-muted-foreground dark:text-[#aab3df] truncate">{wCount} trade</span>
                            )}
                          </button>
                        );
                        if (wDays === 0 || inMonth.length === 0) return weekBtn;
                        const f = inMonth[0], l = inMonth[inMonth.length - 1];
                        return (
                          <HoverTip block className="min-w-0" side={vi < 2 ? "bottom" : "top"} align="right"
                            title={`Minggu ${wi + 1} · ${f.getDate()} ${MONTHS_SHORT[f.getMonth()]} – ${l.getDate()} ${MONTHS_SHORT[l.getMonth()]}`}
                            rows={[
                              { label: "Net P&L", value: formatCurrency(wPnl, cur), tone: tone(wPnl) },
                              { label: "Hari trading", value: String(wDays) },
                              { label: "Trades", value: String(wCount) },
                            ]}
                            note="Click to focus this week.">
                            {weekBtn}
                          </HoverTip>
                        );
                      })()}
                    </div>
                  );
                })}
              </div>

              {/* Legend */}
              <div className="flex flex-wrap items-center gap-[18px] mt-5 pt-4 border-t dark:border-[#7a8cff]/10">
                <span className={CAP}>Intensitas</span>
                <span className={cn(CAP, "inline-flex items-center gap-1.5")}><span className="w-3.5 h-3.5 rounded bg-red-500/30 border border-red-400/50" />Rugi</span>
                <span className={cn(CAP, "inline-flex items-center gap-1.5")}><span className="w-3.5 h-3.5 rounded bg-foreground/5 border border-[#7a8cff]/20" />Tanpa trade</span>
                <span className={cn(CAP, "inline-flex items-center gap-1.5")}><span className="w-3.5 h-3.5 rounded bg-green-500/30 border border-green-400/55" />Untung</span>
              </div>
            </div>

            {/* Right column */}
            <div className="min-w-0 flex flex-col gap-4">
              <div className={cn(PANEL, "p-5 md:px-6 md:py-[22px]")}>
                <h2 className={H2}>Ringkasan {MONTHS_FULL[getMonth(current)]}</h2>
                <div className="mt-3.5">
                  <div className={rowLbl}>Net P&L bulan ini</div>
                  <div className={cn(KPI, "mt-1 truncate", pnlColor(monthPnL))}>
                    {formatCurrency(monthPnL, cur)}
                  </div>
                </div>
                <div className="mt-2.5">
                  {[
                    { l: "Total trade", v: String(monthTradeCount), c: "" },
                    { l: "Hari trading", v: String(monthTradeDays), c: "" },
                    { l: "Rata-rata per trade", v: monthTradeCount ? fmtNum(monthAvg, cur) : "—", c: monthTradeCount ? pnlColor(monthAvg) : "" },
                    { l: "Hari terbaik", v: monthData.length ? fmtNum(monthBest, cur) : "—", c: monthData.length ? pnlColor(monthBest) : "" },
                    { l: "Hari terburuk", v: monthData.length ? fmtNum(monthWorst, cur) : "—", c: monthData.length ? pnlColor(monthWorst) : "" },
                  ].map((r) => (
                    <div key={r.l} className={cn("flex items-center justify-between gap-3 text-[13px] py-[11px] border-b last:border-0 dark:border-[#7a8cff]/10 rounded-lg -mx-2 px-2 transition-colors duration-200 ease-out hover:bg-[#4f6bff]/[0.09]", MOTION)}>
                      <span className={rowLbl}>{r.l}</span>
                      <b className={cn("font-mono tabular-nums", r.c)}>{r.v}</b>
                    </div>
                  ))}
                </div>
              </div>

              <div className={cn(PANEL, "p-5 md:px-6 md:py-[22px]")}>
                <div className="flex items-center justify-between gap-2.5">
                  <h2 className={H2}>{selTitle}</h2>
                  {selEntry && selEntry.pnl !== 0 && (
                    <span className={cn("inline-flex items-center px-[9px] py-[3px] rounded-[7px] text-[11px] font-bold border",
                      selEntry.pnl > 0
                        ? "bg-emerald-400/15 text-emerald-700 border-emerald-500/30 dark:text-emerald-300 dark:border-emerald-400/30"
                        : "bg-red-400/15 text-red-700 border-red-500/30 dark:text-red-300 dark:border-red-400/30")}>
                      {selEntry.pnl > 0 ? "Win" : "Loss"}
                    </span>
                  )}
                </div>

                <div className="mt-4 flex flex-col gap-2.5 max-h-[340px] overflow-y-auto overscroll-contain pr-1.5 -mr-1.5 [scrollbar-width:thin] [scrollbar-color:rgba(122,140,255,0.4)_transparent]">
                  {dayLoading ? (
                    <>
                      <div className="h-[100px] rounded-[14px] bg-foreground/5 animate-pulse" />
                      <div className="h-[100px] rounded-[14px] bg-foreground/5 animate-pulse" />
                    </>
                  ) : dayTrades.length === 0 ? (
                    <div className="rounded-[14px] border border-dashed dark:border-[#7a8cff]/15 py-8 text-center text-[13px] text-muted-foreground dark:text-[#8a94c4]">
                      Tidak ada trade
                    </div>
                  ) : (
                    dayTrades.map((t: any) => {
                      const short = dayDir(t) === "Short";
                      const pnl = Number(t.pnl ?? 0);
                      const hold = t.entryDate && t.exitDate ? getDurationString(new Date(t.entryDate), new Date(t.exitDate)) : "—";
                      return (
                        <div key={t.id ?? `${t.symbol}-${t.entryDate}`}
                          className={cn("rounded-[14px] border dark:border-[#7a8cff]/15 bg-foreground/[0.03] px-4 py-3.5 flex flex-col gap-2.5 transition-[transform,box-shadow,border-color] duration-200 ease-out hover:-translate-y-0.5 hover:border-[#5b74ff]/50 hover:shadow-[0_8px_22px_-12px_rgba(79,107,255,0.55)]", MOTION)}>
                          <div className="flex items-center justify-between gap-2">
                            <div className="flex items-center gap-2 min-w-0">
                              <b className="truncate">{t.symbol}</b>
                              <span className={cn("inline-flex items-center px-[9px] py-[3px] rounded-[7px] text-[11px] font-bold border",
                                short
                                  ? "bg-red-400/15 text-red-700 border-red-500/30 dark:text-red-300 dark:border-red-400/30"
                                  : "bg-emerald-400/15 text-emerald-700 border-emerald-500/30 dark:text-emerald-300 dark:border-emerald-400/30")}>
                                {short ? "Short" : "Long"}
                              </span>
                            </div>
                            <b className={cn("font-mono tabular-nums text-[13px] whitespace-nowrap", pnlColor(pnl))}>{formatCurrency(pnl, cur)}</b>
                          </div>
                          <div className="flex flex-wrap gap-x-[18px] gap-y-1 text-xs text-muted-foreground dark:text-[#aab3df]">
                            <span>Entry <b className="font-mono text-foreground dark:text-[#e8ecff]">{t.entryPrice ?? "—"}</b></span>
                            <span>Exit <b className="font-mono text-foreground dark:text-[#e8ecff]">{t.exitPrice ?? "—"}</b></span>
                            <span>Lot <b className="font-mono text-foreground dark:text-[#e8ecff]">{t.lotSize ?? "—"}</b></span>
                          </div>
                          <div className={CAP}>Hold {hold}</div>
                        </div>
                      );
                    })
                  )}
                </div>

                <Link href="/trades"
                  className="w-full mt-3.5 h-[38px] inline-flex items-center justify-center gap-2 rounded-xl border dark:border-white/15 text-xs font-semibold hover:bg-[#4f6bff]/10 hover:border-[#4f6bff]/50 transition-colors">
                  Buka di Trade Log
                  <ChevronRight className="w-4 h-4" />
                </Link>
              </div>
            </div>
          </div>

          {/* Year overview */}
          <div className={cn(PANEL, "p-5 md:px-6 md:py-[22px]")}>
            <div className="flex flex-wrap items-center justify-between gap-4 mb-1.5">
              <div>
                <h2 className={H2}>Profit by Month</h2>
                <div className={cn(CAP, "mt-1")}>Rekap P&L bulanan sepanjang tahun</div>
              </div>
              <div className="flex items-center gap-5 flex-wrap">
                <div className="text-right">
                  <div className={rowLbl}>Total {year}</div>
                  <b className={cn("font-mono tabular-nums text-xl tracking-[-0.02em]", pnlColor(yearPnL))}>{formatCurrency(yearPnL, cur)}</b>
                </div>
                <div className={TABS}>
                  {years.map((y) => (
                    <button type="button" key={y} onClick={() => jumpMonth(y, getMonth(current))} className={cn(TAB, y === year && TAB_ON)}>{y}</button>
                  ))}
                </div>
              </div>
            </div>

            {/* Diverging bars */}
            <div className="relative h-[200px] md:h-[240px] mt-3.5 mb-1">
              <div className="pointer-events-none absolute inset-x-0 top-1/2 h-px bg-[#7a8cff]/30" />
              <div className="absolute inset-0 flex gap-1 md:gap-2">
                {yearMonthly.map((m, mi) => {
                  const h = Math.max((Math.abs(m.pnl) / monthMax) * 43, 1);
                  const pos = m.pnl >= 0;
                  return (
                    <HoverTip key={m.name} block {...monthTip(m)} side="top" align={mi < 2 ? "left" : mi >= 10 ? "right" : "center"}
                      className="flex-1 min-w-0 h-full rounded-lg transition-colors duration-200 ease-out hover:bg-[#4f6bff]/[0.07] motion-reduce:transition-none">
                    <div className="relative w-full h-full">
                      {m.tradeDays > 0 ? (
                        <>
                          <div className={cn("absolute inset-x-[14%] transition-[filter,box-shadow] duration-200 ease-out group-hover/tip:brightness-125 group-hover/tip:shadow-[0_0_16px_rgba(79,107,255,0.5)] motion-reduce:transition-none", pos ? "bottom-1/2 rounded-t-lg rounded-b-[3px] bg-gradient-to-b from-[#4ade80] to-[#16a34a]" : "top-1/2 rounded-b-lg rounded-t-[3px] bg-gradient-to-b from-[#f87171] to-[#b91c1c]")}
                            style={{ height: `${h}%` }} />
                          <span className={cn("absolute -inset-x-2 text-center text-[9px] md:text-[11px] font-bold font-mono whitespace-nowrap", pos ? "text-emerald-600 dark:text-[#4ade80]" : "text-red-600 dark:text-[#f87171]")}
                            style={pos ? { bottom: `calc(50% + ${h}% + 4px)` } : { top: `calc(50% + ${h}% + 4px)` }}>
                            {fmtCompact(m.pnl, cur)}
                          </span>
                        </>
                      ) : (
                        <span className="absolute top-[calc(50%-8px)] inset-x-0 text-center text-xs text-muted-foreground opacity-50">—</span>
                      )}
                    </div>
                    </HoverTip>
                  );
                })}
              </div>
            </div>
            <div className="flex gap-1 md:gap-2 text-[10px] md:text-xs text-muted-foreground dark:text-[#8a94c4] font-semibold mt-1">
              {yearMonthly.map((m) => <span key={m.name} className="flex-1 text-center">{m.name}</span>)}
            </div>

            {/* Month tiles */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5 mt-[22px] pt-5 border-t dark:border-[#7a8cff]/10">
              {yearMonthly.map((m, i) => {
                const c = m.tradeDays > 0 ? getCellColors(m.pnl, isDark, 1) : null;
                const isCurrent = i === getMonth(current);
                return (
                  <HoverTip key={m.name} block {...monthTip(m)} className="min-w-0" side="top" align={i % 6 === 0 ? "left" : i % 6 === 5 ? "right" : "center"}>
                  <button
                    type="button"
                    onClick={() => jumpMonth(year, i)}
                    className={cn("w-full h-full rounded-[13px] border px-3.5 py-3 text-left flex flex-col gap-1.5 transition-[transform,box-shadow,border-color] duration-200 ease-out hover:border-[#7a8cff]/50 hover:-translate-y-0.5 hover:shadow-[0_10px_24px_-12px_rgba(79,107,255,0.55)] overflow-hidden min-w-0", MOTION, !c && "border-dashed dark:border-[#7a8cff]/15")}
                    style={{
                      ...(c ? { background: c.bg, borderColor: c.border } : {}),
                      ...(isCurrent ? { boxShadow: "0 0 0 2px #8ea2ff" } : {}),
                    }}
                  >
                    <span className={cn("text-xs font-bold", c ? "text-foreground dark:text-[#dfe4ff]" : "text-muted-foreground dark:text-[#7d88bd]")}>{m.name}</span>
                    {m.tradeDays > 0 ? (
                      <b className="text-[13px] font-mono tabular-nums tracking-[-0.03em] truncate" style={{ color: c?.sub }}>
                        {formatCurrency(m.pnl, cur)}
                      </b>
                    ) : (
                      <span className={cn(CAP, "opacity-60")}>Tanpa trade</span>
                    )}
                  </button>
                  </HoverTip>
                );
              })}
            </div>

            <div className="flex flex-wrap gap-x-6 gap-y-2 mt-[18px] text-[12.5px]">
              {bestMonth && <span className={rowLbl}>Bulan terbaik <b className={cn("ml-1.5", WIN)}>{bestMonth.full} · {formatCurrency(bestMonth.pnl, cur)}</b></span>}
              {worstMonth && worstMonth.pnl < 0 && <span className={rowLbl}>Bulan terburuk <b className={cn("ml-1.5", LOSS)}>{worstMonth.full} · {formatCurrency(worstMonth.pnl, cur)}</b></span>}
              <span className={rowLbl}>Bulan profit <b className="ml-1.5 text-foreground dark:text-[#dfe4ff]">{profitMonths} dari {activeMonths.length}</b></span>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
