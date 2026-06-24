"use client";
import { useEffect, useState } from "react";
import {
  format, startOfMonth, endOfMonth, eachDayOfInterval,
  getDay, addMonths, subMonths, getYear, getMonth,
} from "date-fns";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn, formatCurrency } from "@/lib/utils";
import AccountSwitcher from "@/components/layout/AccountSwitcher";

const DAYS = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];

function getCellColors(pnl: number, isDark: boolean) {
  if (pnl > 0) return isDark
    ? { bg: "rgba(22,163,74,0.18)", border: "rgba(22,163,74,0.5)", text: "#86efac", sub: "#4ade80" }
    : { bg: "#f0fdf4", border: "#86efac", text: "#15803d", sub: "#16a34a" };
  if (pnl < 0) return isDark
    ? { bg: "rgba(220,38,38,0.18)", border: "rgba(220,38,38,0.5)", text: "#fca5a5", sub: "#f87171" }
    : { bg: "#fff1f2", border: "#fca5a5", text: "#b91c1c", sub: "#dc2626" };
  return null;
}

export default function CalendarPage() {
  const [current, setCurrent] = useState(new Date());
  const [calendarData, setCalendarData] = useState<any[]>([]);
  const [yearData, setYearData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isDark, setIsDark] = useState(false);
  const [accountId, setAccountId] = useState("");
  const [account, setAccount] = useState<any>(null);
  const [selectedDay, setSelectedDay] = useState<{ date: string; entry: any } | null>(null);
  const [selectedWeek, setSelectedWeek] = useState<{ week: number; pnl: number; days: number; count: number } | null>(null);

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

  const dataMap = new Map(calendarData.map((d: any) => [d.date, d]));

  const start = startOfMonth(current);
  const end = endOfMonth(current);
  const days = eachDayOfInterval({ start, end });
  const startDow = getDay(start);

  // Build weeks
  const weeks: (Date | null)[][] = [];
  let week: (Date | null)[] = Array(startDow).fill(null);
  for (const day of days) {
    week.push(day);
    if (week.length === 7) { weeks.push(week); week = []; }
  }
  if (week.length > 0) { while (week.length < 7) week.push(null); weeks.push(week); }

  function weekSummary(wk: (Date | null)[]) {
    let pnl = 0, tradeDays = 0, tradeCount = 0;
    for (const d of wk) {
      if (!d) continue;
      const entry = dataMap.get(format(d, "yyyy-MM-dd"));
      if (entry) { pnl += entry.pnl; tradeDays++; tradeCount += entry.tradeCount; }
    }
    return { pnl, tradeDays, tradeCount };
  }

  // Monthly summary
  const monthKey = format(current, "yyyy-MM");
  const monthData = calendarData.filter((d: any) => d.date.startsWith(monthKey));
  const monthPnL = monthData.reduce((s: number, d: any) => s + d.pnl, 0);
  const monthTradeDays = monthData.length;
  const monthTradeCount = monthData.reduce((s: number, d: any) => s + d.tradeCount, 0);
  const monthWinDays = monthData.filter((d: any) => d.pnl > 0).length;
  const monthLossDays = monthData.filter((d: any) => d.pnl < 0).length;

  // Year monthly summary
  const year = getYear(current);
  const monthNames = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  const yearMonthly = monthNames.map((name, i) => {
    const key = `${year}-${String(i + 1).padStart(2, "0")}`;
    const mData = calendarData.filter((d: any) => d.date.startsWith(key));
    return {
      name,
      pnl: mData.reduce((s: number, d: any) => s + d.pnl, 0),
      tradeDays: mData.length,
    };
  });
  const yearPnL = yearMonthly.reduce((s, m) => s + m.pnl, 0);

  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center gap-2">
        <span className="text-sm font-semibold">Calendar</span>
        <AccountSwitcher value={accountId} onChange={setAccountId} />
      </div>
      <div className="flex items-center justify-between">
        <h1 className="text-sm font-semibold">P&L Calendar</h1>
        <span className="text-xs text-muted-foreground">Full trading history</span>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-64 text-sm text-muted-foreground">Loading...</div>
      ) : (
        <>
          {/* Monthly calendar */}
          <div className="bg-card border rounded-xl p-4">
            {/* Header */}
            <div className="flex flex-col gap-3 mb-4">
              {/* Nav row */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <button onClick={() => setCurrent(subMonths(current, 1))}
                    className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-muted border transition-colors">
                    <ChevronLeft className="w-3.5 h-3.5" />
                  </button>
                  <span className="text-sm font-semibold min-w-[110px] text-center">{format(current, "MMMM yyyy")}</span>
                  <button onClick={() => setCurrent(addMonths(current, 1))}
                    className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-muted border transition-colors">
                    <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                </div>
                <button onClick={() => setCurrent(new Date())}
                  className="text-[11px] px-2.5 py-1 rounded-lg border text-muted-foreground hover:bg-muted transition-colors">
                  This month
                </button>
              </div>

              {/* Monthly stats row - horizontal scroll */}
              <div className="flex items-center gap-3 overflow-x-auto pb-1 text-xs">
                <div className="shrink-0 bg-muted/40 rounded-lg px-3 py-1.5 text-center">
                  <p className="text-[10px] text-muted-foreground">Monthly P&L</p>
                  <p className={cn("text-xs font-semibold", monthPnL > 0 ? "text-[#16a34a]" : monthPnL < 0 ? "text-[#dc2626]" : "")}>
                    {formatCurrency(monthPnL, account?.currency)}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-muted-foreground">Trade Days</p>
                  <p className="font-semibold">{monthTradeDays}</p>
                </div>
                <div className="text-right">
                  <p className="text-muted-foreground">Total Trades</p>
                  <p className="font-semibold">{monthTradeCount}</p>
                </div>
                <div className="shrink-0 bg-muted/40 rounded-lg px-3 py-1.5 text-center">
                  <p className="text-[10px] text-muted-foreground">Win/Loss</p>
                  <p className="text-xs font-semibold">
                    <span className="text-[#16a34a]">{monthWinDays}W</span>
                    {" · "}
                    <span className="text-[#dc2626]">{monthLossDays}L</span>
                  </p>
                </div>
              </div>
            </div>

            {/* Day headers */}
            <div className="grid grid-cols-8 gap-0.5 sm:gap-1.5 mb-1.5">
              {DAYS.map((d) => (
                <div key={d} className="text-center text-[10px] font-medium text-muted-foreground py-1">{d}</div>
              ))}
              <div className="text-center text-[10px] font-medium text-muted-foreground py-1">Week</div>
            </div>

            {/* Weeks */}
            {weeks.map((wk, wi) => {
              const { pnl: wPnl, tradeDays: wDays, tradeCount: wCount } = weekSummary(wk);
              const wColors = wDays > 0 ? getCellColors(wPnl, isDark) : null;
              return (
                <div key={wi} className="grid grid-cols-8 gap-0.5 sm:gap-1.5 mb-1.5">
                  {wk.map((day, di) => {
                    if (!day) return <div key={di} className="rounded-xl border border-dashed border-border/30 min-h-[72px]" />;
                    const key = format(day, "yyyy-MM-dd");
                    const entry = dataMap.get(key);
                    const c = entry ? getCellColors(entry.pnl, isDark) : null;
                    const isToday = key === format(new Date(), "yyyy-MM-dd");
                    return (
                      <div key={di}
                        className={cn("rounded-xl border min-h-[52px] sm:min-h-[72px] p-1 sm:p-2 transition-all", entry ? "cursor-pointer active:scale-95" : "")}
                        role={entry ? "button" : undefined}
                        tabIndex={entry ? 0 : undefined}
                        onClick={() => { if (entry) setSelectedDay({ date: key, entry }); }}
                        style={c
                          ? { background: c.bg, borderColor: c.border }
                          : { background: "var(--card)", borderColor: isToday ? "#6366f1" : "hsl(var(--border))" }
                        }>
                        <p className={cn("text-[10px] font-medium mb-0.5", isToday && !c ? "text-indigo-500" : "text-muted-foreground")}>
                          {format(day, "d")}
                        </p>
                        {entry && (
                          <>
                            <p className="text-[9px] sm:text-[11px] font-bold leading-tight truncate" style={{ color: c?.text }}>
                              {formatCurrency(entry.pnl, account?.currency)}
                            </p>
                            <p className="text-[8px] sm:text-[9px] mt-0.5 truncate" style={{ color: c?.sub }}>
                              {entry.tradeCount}t
                            </p>
                          </>
                        )}
                      </div>
                    );
                  })}

                  {/* Week summary */}
                  <div className="rounded-xl border min-h-[52px] sm:min-h-[72px] p-1 sm:p-2 flex flex-col justify-center overflow-hidden"
                    role={wDays > 0 ? "button" : undefined}
                    tabIndex={wDays > 0 ? 0 : undefined}
                    onClick={() => { if (wDays > 0) setSelectedWeek({ week: wi + 1, pnl: wPnl, days: wDays, count: wCount }); }}
                    style={wColors
                      ? { background: wColors.bg, borderColor: wColors.border, cursor: wDays > 0 ? "pointer" : "default" }
                      : { borderColor: "hsl(var(--border))", cursor: wDays > 0 ? "pointer" : "default" }
                    }>
                    <p className="text-[9px] text-muted-foreground">Wk{wi + 1}</p>
                    <p className="text-[10px] sm:text-[12px] font-bold truncate" style={{ color: wColors ? wColors.text : "hsl(var(--muted-foreground))" }}>
                      {wDays > 0
                        ? formatCurrency(wPnl, account?.currency)
                        : <span className="text-muted-foreground">—</span>}
                    </p>
                    <p className="text-[9px] text-muted-foreground">{wDays}d · {wCount}t</p>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Year overview */}
          <div className="bg-card border rounded-xl p-4">
            <div className="flex items-center justify-between mb-3">
              <p className="text-xs font-semibold">{year} — Monthly Overview</p>
              <p className={cn("text-xs font-semibold", yearPnL > 0 ? "text-[#16a34a]" : yearPnL < 0 ? "text-[#dc2626]" : "")}>
                YTD: {formatCurrency(yearPnL, account?.currency)}
              </p>
            </div>
            <div className="grid grid-cols-6 md:grid-cols-12 gap-1.5">
              {yearMonthly.map((m, i) => {
                const c = m.tradeDays > 0 ? getCellColors(m.pnl, isDark) : null;
                const isCurrent = i === getMonth(current);
                return (
                  <button
                    key={m.name}
                    onClick={() => setCurrent(new Date(year, i, 1))}
                    className="rounded-lg border p-2 text-center transition-all hover:border-indigo-400"
                    style={c
                      ? { background: c.bg, borderColor: isCurrent ? "#6366f1" : c.border }
                      : { borderColor: isCurrent ? "#6366f1" : "hsl(var(--border))" }
                    }
                  >
                    <p className="text-[10px] text-muted-foreground mb-1">{m.name}</p>
                    {m.tradeDays > 0 ? (
                      <>
                        <p className="text-[10px] font-bold" style={{ color: c?.text }}>
                          {formatCurrency(m.pnl, account?.currency)}
                        </p>
                        <p className="text-[9px] text-muted-foreground">{m.tradeDays}d</p>
                      </>
                    ) : (
                      <p className="text-[10px] text-muted-foreground">—</p>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        </>
      )}
      {/* Week detail popup */}
      {selectedWeek && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4"
          onClick={() => setSelectedWeek(null)}>
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />
          <div className="relative bg-card border rounded-2xl p-5 w-full max-w-sm shadow-2xl"
            onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <div>
                <p className="text-xs text-muted-foreground">{format(current, "MMMM yyyy")}</p>
                <p className="text-sm font-semibold">Week {selectedWeek.week}</p>
              </div>
              <button onClick={() => setSelectedWeek(null)}
                className="w-7 h-7 flex items-center justify-center rounded-full hover:bg-muted text-muted-foreground">
                ✕
              </button>
            </div>
            <div className="grid grid-cols-3 gap-3 mb-4">
              <div className="bg-muted/40 rounded-xl p-3">
                <p className="text-[10px] text-muted-foreground mb-1">Net P&L</p>
                <p className={cn("text-sm font-bold", selectedWeek.pnl > 0 ? "text-[#16a34a]" : selectedWeek.pnl < 0 ? "text-[#dc2626]" : "")}>
                  {formatCurrency(selectedWeek.pnl, account?.currency)}
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
            <button onClick={() => setSelectedWeek(null)}
              className="w-full mt-3 py-2 text-xs text-muted-foreground hover:text-foreground transition-colors">
              Close
            </button>
          </div>
        </div>
      )}

      {/* Day detail popup */}
      {selectedDay && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4"
          onClick={() => setSelectedDay(null)}>
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />
          <div className="relative bg-card border rounded-2xl p-5 w-full max-w-sm shadow-2xl"
            onClick={e => e.stopPropagation()}>
            {/* Header */}
            <div className="flex items-center justify-between mb-4">
              <div>
                <p className="text-xs text-muted-foreground">Trading Day</p>
                <p className="text-sm font-semibold">{format(new Date(selectedDay.date + "T00:00:00"), "EEEE, d MMMM yyyy")}</p>
              </div>
              <button onClick={() => setSelectedDay(null)}
                className="w-7 h-7 flex items-center justify-center rounded-full hover:bg-muted text-muted-foreground">
                ✕
              </button>
            </div>

            {/* Stats grid */}
            <div className="grid grid-cols-2 gap-3 mb-4">
              <div className="bg-muted/40 rounded-xl p-3">
                <p className="text-[10px] text-muted-foreground mb-1">Net P&L</p>
                <p className={cn("text-sm font-bold", selectedDay.entry.pnl > 0 ? "text-[#16a34a]" : selectedDay.entry.pnl < 0 ? "text-[#dc2626]" : "")}>
                  {formatCurrency(selectedDay.entry.pnl, account?.currency)}
                </p>
              </div>
              <div className="bg-muted/40 rounded-xl p-3">
                <p className="text-[10px] text-muted-foreground mb-1">Total Trades</p>
                <p className="text-sm font-bold">{selectedDay.entry.tradeCount}</p>
              </div>
            </div>

            {/* Status */}
            <div className={cn("rounded-xl p-3 text-center", selectedDay.entry.pnl > 0 ? "bg-[#16a34a]/10" : "bg-[#dc2626]/10")}>
              <p className={cn("text-xs font-semibold", selectedDay.entry.pnl > 0 ? "text-[#16a34a]" : "text-[#dc2626]")}>
                {selectedDay.entry.pnl > 0 ? "✓ Profitable Day" : selectedDay.entry.pnl < 0 ? "✗ Loss Day" : "Break Even"}
              </p>
            </div>

            <button onClick={() => setSelectedDay(null)}
              className="w-full mt-3 py-2 text-xs text-muted-foreground hover:text-foreground transition-colors">
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
