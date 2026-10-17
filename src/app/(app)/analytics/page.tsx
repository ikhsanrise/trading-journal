"use client";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, Tooltip,
  ResponsiveContainer, CartesianGrid, ReferenceLine, Cell,
} from "recharts";
import { cn, formatCurrency, formatR } from "@/lib/utils";
import AccountSwitcher from "@/components/layout/AccountSwitcher";
import { HoverTip, type TipRow } from "@/components/ui/HoverTip";
import { PANEL, PAGE, H1, SUB, H2, CAP, CHIP, CHIP_B, CHIP_G, CHIP_R, TABS, TAB, TAB_ON, BTN, BTN_PRIMARY, pnlColor } from "@/lib/theme";

const TICK = { fontSize: 11, fill: "hsl(var(--muted-foreground))" };

const WIN_TXT = "text-emerald-600 dark:text-[#4ade80]";
const LOSS_TXT = "text-red-600 dark:text-[#f87171]";
const PROFIT = "#16a34a";
const LOSS = "#dc2626";
const DAYS = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];
const HOURS = Array.from({ length: 24 }, (_, i) => i);

const SESSION_LABELS: Record<string, string> = {
  london: "London", newyork: "New York", asia: "Asia", sydney: "Sydney", unknown: "Unknown",
};

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"];
const WEEKDAYS = ["Min", "Sen", "Sel", "Rab", "Kam", "Jum", "Sab"];
const parseYmd = (d: string) => {
  const [y, m, dd] = d.split("-").map(Number);
  return new Date(y, (m || 1) - 1, dd || 1);
};
const fmtDayLabel = (d?: string) => {
  if (!d) return "";
  const dt = parseYmd(d);
  return `${WEEKDAYS[dt.getDay()]}, ${dt.getDate()} ${MONTHS[dt.getMonth()]}`;
};
const trimNum = (n: number, dec: number) =>
  n.toFixed(dec).replace(/\.?0+$/, "").replace(".", ",");
const groupId = (n: number) => Math.round(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".");
// Compact money: IDR => "Rp 3.391", "Rp 326rb", "Rp 10,1jt", "Rp 1,2M"; others => "$1.2K"
function fmtMoney(v: number, currency: string, signed = false): string {
  const a = Math.abs(v);
  const sign = v < 0 ? "-" : signed && v > 0 ? "+" : "";
  if (currency === "IDR") {
    let body: string;
    if (a >= 1e9) body = `${trimNum(a / 1e9, 2)}M`;
    else if (a >= 1e6) body = `${trimNum(a / 1e6, a >= 1e7 ? 1 : 2)}jt`;
    else if (a >= 1e4) body = `${trimNum(a / 1e3, a >= 1e5 ? 0 : 1)}rb`;
    else body = groupId(a);
    return `${sign}Rp ${body}`;
  }
  const sym = currency === "USD" ? "$" : `${currency} `;
  let body: string;
  if (a >= 1e6) body = `${+(a / 1e6).toFixed(2)}M`;
  else if (a >= 1e4) body = `${+(a / 1e3).toFixed(1)}K`;
  else body = a.toLocaleString("en-US", { maximumFractionDigits: 2 });
  return `${sign}${sym}${body}`;
}
const fmtAxis = (v: number, currency: string) => (v === 0 ? (currency === "IDR" ? "Rp 0" : `${currency === "USD" ? "$" : ""}0`) : fmtMoney(v, currency));
const SESSION_ORDER = ["london", "asia", "newyork", "sydney"];
const NEG_SHADES = ["#b91c1c", "#dc2626", "#ef4444", "#f87171"];
const POS_SHADES = ["#86efac", "#4ade80", "#22c55e", "#16a34a"];
const RANGES: { key: string; label: string; days: number | null }[] = [
  { key: "1B", label: "1B", days: 30 },
  { key: "3B", label: "3B", days: 90 },
  { key: "1T", label: "1T", days: 365 },
  { key: "all", label: "Semua", days: null },
];
const TIP_STYLE = {
  fontSize: 12, borderRadius: 12, padding: "10px 14px", backgroundColor: "rgba(12,19,48,0.96)",
  border: "1px solid rgba(122,140,255,0.25)", color: "#e8ecff", boxShadow: "0 18px 40px -12px rgba(0,0,0,0.7)",
};
const TIP_LABEL = { color: "#8a94c4", fontWeight: 600, marginBottom: 4 };
const TIP_ITEM = { color: "#e8ecff", fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace", fontVariantNumeric: "tabular-nums" as const };
const CURSOR_LINE = { stroke: "rgba(122,140,255,0.35)", strokeDasharray: "3 3" };
const CURSOR_BAR = { fill: "rgba(122,140,255,0.08)" };
const BAR_HOVER =
  "[&_.recharts-bar-rectangle]:[transition:filter_.2s_ease-out] [&_.recharts-bar-rectangle:hover]:[filter:brightness(1.25)_drop-shadow(0_0_6px_rgba(79,107,255,0.55))] motion-reduce:[&_.recharts-bar-rectangle]:[transition:none]";
const tn = (v: number | null | undefined): TipRow["tone"] => (v == null || v === 0 ? "muted" : v > 0 ? "win" : "loss");

function Icon({ children }: { children: React.ReactNode }) {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {children}
    </svg>
  );
}

function InsightCard({ icon, title, text }: { icon: React.ReactNode; title: string; text: string }) {
  return (
    <div className={cn(PANEL, "group p-5 flex gap-3.5 min-w-0")}>
      <div className="h-9 w-9 shrink-0 rounded-[10px] grid place-items-center border border-[#7a8cff]/30 bg-[#4f6bff]/15 text-[#4f6bff] dark:text-[#9db0ff] transition-[transform,box-shadow,border-color] duration-300 ease-out group-hover:scale-[1.03] group-hover:border-[#7a8cff]/60 group-hover:shadow-[0_0_18px_rgba(79,107,255,0.5)] motion-reduce:transform-none motion-reduce:transition-none">{icon}</div>
      <div className="min-w-0">
        <h3 className="text-[14px] font-bold tracking-[-0.01em]">{title}</h3>
        <p className="mt-1.5 text-[13px] leading-relaxed text-muted-foreground dark:text-[#8a94c4]">{text}</p>
      </div>
    </div>
  );
}

function StatRow({ label, value, value2, color }: { label: string; value: string; value2?: string; color?: string }) {
  return (
    <div className="flex items-center justify-between py-[11px] border-b last:border-0 dark:border-[#7a8cff]/10 gap-3 rounded-md transition-colors duration-200 ease-out hover:bg-[#4f6bff]/[0.07] motion-reduce:transition-none">
      <div className="min-w-0">
        <div className="text-[13px] font-semibold">{label}</div>
        {value2 && <div className={cn(CAP, "mt-0.5")}>{value2}</div>}
      </div>
      <span className={cn("text-[13px] font-bold font-mono tabular-nums shrink-0", color)}>{value}</span>
    </div>
  );
}

function PerfTable({ title, rows, keyLabel, currency }: { title: string; rows: any[]; keyLabel: string; currency: string }) {
  return (
    <div className={cn(PANEL, "overflow-hidden")}>
      <div className="px-5 md:px-6 pt-5 pb-3.5">
        <h2 className={H2}>{title}</h2>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-[13px] min-w-[480px]">
          <thead>
            <tr className="border-y bg-muted/40 dark:bg-white/[0.03] dark:border-[#7a8cff]/10">
              <th className="text-left px-5 md:px-6 py-3 text-[11px] uppercase tracking-wider font-bold text-muted-foreground dark:text-[#7d88bd]">{keyLabel}</th>
              <th className="text-right px-3 py-3 text-[11px] uppercase tracking-wider font-bold text-muted-foreground dark:text-[#7d88bd]">Trades</th>
              <th className="text-right px-3 py-3 text-[11px] uppercase tracking-wider font-bold text-muted-foreground dark:text-[#7d88bd]">Win%</th>
              <th className="text-right px-3 py-3 text-[11px] uppercase tracking-wider font-bold text-muted-foreground dark:text-[#7d88bd]">Avg R</th>
              <th className="text-right px-5 md:px-6 py-3 text-[11px] uppercase tracking-wider font-bold text-muted-foreground dark:text-[#7d88bd]">Net P&L</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr><td colSpan={5} className="text-center py-8 text-muted-foreground">No data</td></tr>
            ) : rows.map((row, i) => (
              <tr key={i} className="group border-b last:border-0 dark:border-[#7a8cff]/10 transition-colors duration-200 ease-out hover:bg-[#4f6bff]/[0.08] motion-reduce:transition-none">
                <td className="px-5 md:px-6 py-3.5 font-semibold transition-shadow duration-200 ease-out group-hover:shadow-[inset_3px_0_0_0_#4f6bff] motion-reduce:transition-none">{row.name ?? row.category ?? row.session ?? row.day}</td>
                <td className="px-3 py-3.5 text-right font-mono tabular-nums text-muted-foreground">{row.totalTrades}</td>
                <td className="px-3 py-3.5 text-right font-mono tabular-nums">
                  <span className={cn("font-semibold", row.winRate >= 50 ? "text-emerald-600 dark:text-[#4ade80]" : "text-red-600 dark:text-[#f87171]")}>
                    {row.winRate.toFixed(1)}%
                  </span>
                </td>
                <td className="px-3 py-3.5 text-right font-mono tabular-nums">
                  <span className={cn("font-semibold", (row.avgR ?? 0) > 0 ? "text-emerald-600 dark:text-[#4ade80]" : "text-red-600 dark:text-[#f87171]")}>
                    {row.avgR != null ? formatR(row.avgR) : "—"}
                  </span>
                </td>
                <td className="px-5 md:px-6 py-3.5 text-right">
                  <span className={cn("font-bold font-mono tabular-nums text-[13px]", pnlColor(row.netPnL))}>
                    {formatCurrency(row.netPnL, currency)}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function HeatmapCell({ pnl, trades, winRate, currency, day, hour, side, align }: {
  pnl: number; trades: number; winRate: number; currency: string; day: string; hour: number;
  side: "top" | "bottom"; align: "center" | "left" | "right";
}) {
  const intensity = Math.min(1, Math.abs(pnl) / 500);
  const bg = pnl > 0
    ? `rgba(22,163,74,${0.15 + intensity * 0.7})`
    : pnl < 0
    ? `rgba(220,38,38,${0.15 + intensity * 0.7})`
    : "transparent";
  const cell = (
    <div
      className={cn(
        "rounded flex flex-col items-center justify-center h-12 cursor-default border border-transparent transition-[transform,box-shadow,border-color] duration-200 ease-out motion-reduce:transform-none motion-reduce:transition-none",
        trades > 0 ? "hover:scale-[1.03] hover:border-[#9db0ff]/70 hover:shadow-[0_0_14px_rgba(79,107,255,0.5)]" : "hover:border-indigo-400/50",
      )}
      style={{ background: bg }}
    >
      {trades > 0 && <span className="text-xs font-bold" style={{ color: intensity > 0.4 ? "#ffffff" : pnl > 0 ? "#15803d" : pnl < 0 ? "#b91c1c" : "hsl(var(--muted-foreground))" }}>
        {trades}
      </span>}
    </div>
  );
  if (trades <= 0) return cell;
  return (
    <HoverTip block side={side} align={align} title={`${day} · ${String(hour).padStart(2, "0")}:00`}
      rows={[
        { label: "Trades", value: String(trades) },
        { label: "Win rate", value: `${Math.round(winRate)}%`, tone: winRate >= 50 ? "win" : "loss" },
        { label: "P&L", value: formatCurrency(pnl, currency), tone: tn(pnl) },
      ]}>
      {cell}
    </HoverTip>
  );
}

export default function AnalyticsPage() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [accountId, setAccountId] = useState("");

// Load default account on mount
  useEffect(() => {
    fetch("/api/dashboard")
      .then(r => r.json())
      .then(d => { if (d.account?.id) setAccountId(d.account.id); });
  }, []);

  useEffect(() => {
    if (!accountId) return;
    setLoading(true);
    setData(null);
    fetch(`/api/analytics?accountId=${accountId}`)
      .then((r) => r.json())
      .then((d) => { setData(d); setLoading(false); })
      .catch(() => setLoading(false));
  }, [accountId]);

  const [range, setRange] = useState("all");

  const curve: any[] = data?.drawdownCurve ?? [];
  const series = useMemo(() => {
    const def = RANGES.find((r) => r.key === range);
    let rows = curve;
    if (def?.days && curve.length) {
      const last = parseYmd(curve[curve.length - 1].date).getTime();
      const cutoff = last - def.days * 86400000;
      rows = curve.filter((d: any) => parseYmd(d.date).getTime() >= cutoff);
    }
    return rows.map((d: any, i: number) => ({ ...d, i }));
  }, [curve, range]);
  const monthTicks = useMemo(() => {
    const out: number[] = [];
    let prev = "";
    for (const d of series) {
      const k = String(d.date).slice(0, 7);
      if (k !== prev) { out.push(d.i); prev = k; }
    }
    // thin out when there are too many months
    const step = Math.ceil(out.length / 8) || 1;
    return out.filter((_, idx) => idx % step === 0);
  }, [series]);

  const header = (
    <div className={cn(PAGE, "pb-0")}>
      <div className="flex items-center gap-3 flex-wrap">
        <h1 className={H1}>Analytics</h1>
        <AccountSwitcher value={accountId} onChange={setAccountId} />
      </div>
    </div>
  );

  if (loading || !accountId) return (
    <div>
      {header}
      <div className="flex items-center justify-center h-64 text-sm text-muted-foreground">Loading analytics...</div>
    </div>
  );

  if (!data || data.totalTrades === 0) return (
    <div>
      {header}
      <div className="p-8 flex flex-col items-center justify-center h-64 text-center">
        <p className="text-sm font-medium mb-1">No data yet</p>
        <p className="text-xs text-muted-foreground">Add and close some trades to see analytics</p>
      </div>
    </div>
  );

  const { heatmapData, bySetup, byCategory, bySession, byDow } = data;
  const currency: string = data.currency ?? "USD";
  const sm = data.summary ?? {};
  const ls = data.longShort ?? { long: { trades: 0, winRate: 0, pnl: 0 }, short: { trades: 0, winRate: 0, pnl: 0 } };
  const dist: { label: string; count: number; positive: boolean }[] = data.pnlDistribution ?? [];
  const money = (v: number, signed = false) => fmtMoney(v, currency, signed);
  const fullMoney = (v: number) => formatCurrency(v, currency);

  // Build heatmap grid
  const heatGrid: Record<string, Record<number, any>> = {};
  for (const d of DAYS) { heatGrid[d] = {}; }
  for (const cell of heatmapData) { heatGrid[cell.day][cell.hour] = cell; }

  const sessions = (bySession as any[])
    .filter((x) => x.session !== "unknown" || (bySession as any[]).length === 1)
    .sort((a, b) => {
      const ia = SESSION_ORDER.indexOf(a.session), ib = SESSION_ORDER.indexOf(b.session);
      return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib);
    });
  const sessName = (k: string) => SESSION_LABELS[k] ?? k;

  const decidedN = (sm.winCount ?? 0) + (sm.lossCount ?? 0);
  const kpis: { label: string; value: string; sub: string; color: string; title: string; rows: TipRow[]; note: string }[] = [
    {
      label: "Expectancy", value: money(sm.expectancy ?? 0), sub: "per trade", color: pnlColor(sm.expectancy ?? 0),
      title: "Expectancy", note: "(Win% × Rata-rata win) − (Loss% × Rata-rata loss). Rata-rata hasil bersih setiap trade.",
      rows: [
        { label: "Win / Loss", value: `${sm.winCount ?? 0} / ${sm.lossCount ?? 0}` },
        { label: "Rata-rata win", value: fullMoney(sm.avgWin ?? 0), tone: "win" },
        { label: "Rata-rata loss", value: fullMoney(sm.avgLoss ?? 0), tone: "loss" },
        { label: "Expectancy", value: fullMoney(sm.expectancy ?? 0), tone: tn(sm.expectancy ?? 0) },
      ],
    },
    {
      label: "Rata-rata Win", value: money(sm.avgWin ?? 0), sub: `${sm.winCount ?? 0} trade`, color: WIN_TXT,
      title: "Rata-rata Win", note: "Total profit dari trade menang ÷ jumlah trade menang.",
      rows: [
        { label: "Trade menang", value: String(sm.winCount ?? 0), tone: "win" },
        { label: "Rata-rata", value: fullMoney(sm.avgWin ?? 0), tone: "win" },
        { label: "Total profit", value: fullMoney((sm.avgWin ?? 0) * (sm.winCount ?? 0)), tone: "win" },
      ],
    },
    {
      label: "Rata-rata Loss", value: money(sm.avgLoss ?? 0), sub: `${sm.lossCount ?? 0} trade`, color: LOSS_TXT,
      title: "Rata-rata Loss", note: "Total kerugian dari trade kalah ÷ jumlah trade kalah.",
      rows: [
        { label: "Trade kalah", value: String(sm.lossCount ?? 0), tone: "loss" },
        { label: "Rata-rata", value: fullMoney(sm.avgLoss ?? 0), tone: "loss" },
        { label: "Total loss", value: fullMoney((sm.avgLoss ?? 0) * (sm.lossCount ?? 0)), tone: "loss" },
      ],
    },
    {
      label: "Payoff Ratio", value: (sm.payoffRatio ?? 0).toFixed(2), sub: "win ÷ loss", color: "",
      title: "Payoff Ratio", note: "Rata-rata win ÷ |rata-rata loss|. Di atas 1.0 berarti win rata-rata lebih besar dari loss rata-rata.",
      rows: [
        { label: "Rata-rata win", value: fullMoney(sm.avgWin ?? 0), tone: "win" },
        { label: "Rata-rata loss", value: fullMoney(sm.avgLoss ?? 0), tone: "loss" },
        { label: "Payoff", value: (sm.payoffRatio ?? 0).toFixed(2) },
        { label: "Trade selesai", value: String(decidedN), tone: "muted" },
      ],
    },
    {
      label: "Hari Terbaik", value: sm.bestDay ? money(sm.bestDay.pnl, true) : "—", sub: fmtDayLabel(sm.bestDay?.date), color: sm.bestDay ? pnlColor(sm.bestDay.pnl) : "",
      title: "Hari Terbaik", note: "Hari dengan total P&L harian tertinggi.",
      rows: sm.bestDay
        ? [{ label: "Tanggal", value: fmtDayLabel(sm.bestDay.date) }, { label: "P&L", value: fullMoney(sm.bestDay.pnl), tone: tn(sm.bestDay.pnl) }]
        : [{ label: "Data", value: "Belum ada", tone: "muted" }],
    },
    {
      label: "Hari Terburuk", value: sm.worstDay ? money(sm.worstDay.pnl, true) : "—", sub: fmtDayLabel(sm.worstDay?.date), color: sm.worstDay ? pnlColor(sm.worstDay.pnl) : "",
      title: "Hari Terburuk", note: "Hari dengan total P&L harian terendah.",
      rows: sm.worstDay
        ? [{ label: "Tanggal", value: fmtDayLabel(sm.worstDay.date) }, { label: "P&L", value: fullMoney(sm.worstDay.pnl), tone: tn(sm.worstDay.pnl) }]
        : [{ label: "Data", value: "Belum ada", tone: "muted" }],
    },
  ];

  // Insights
  const insights: { icon: React.ReactNode; title: string; text: string }[] = [];
  const ranked = sessions.filter((x) => x.session !== "unknown" && x.totalTrades > 0);
  if (ranked.length >= 2) {
    const sorted = [...ranked].sort((a, b) => b.winRate - a.winRate);
    const best = sorted[0], worst = sorted[sorted.length - 1];
    const others = sorted.slice(1).map((x) => `${sessName(x.session)} (${Math.round(x.winRate)}%)`);
    insights.push({
      icon: <Icon><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></Icon>,
      title: `${sessName(best.session)} sesi terkuat, ${sessName(worst.session)} terlemah`,
      text: `Win rate sesi ${sessName(best.session)} mencapai ${Math.round(best.winRate)}%, di atas ${others.join(", ")}. Sesi ${sessName(worst.session)} paling lemah dengan ${worst.totalTrades} trade.`,
    });
  } else if (ranked.length === 1) {
    insights.push({
      icon: <Icon><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></Icon>,
      title: `Semua trade di sesi ${sessName(ranked[0].session)}`,
      text: `Win rate sesi ${sessName(ranked[0].session)} ${Math.round(ranked[0].winRate)}% dari ${ranked[0].totalTrades} trade. Coba uji sesi lain untuk perbandingan.`,
    });
  }
  if (ls.long.trades + ls.short.trades > 0) {
    const shortWins = ls.short.pnl > ls.long.pnl;
    const [w, l, wn, ln] = shortWins ? [ls.short, ls.long, "Short", "Long"] : [ls.long, ls.short, "Long", "Short"];
    const phrase = (x: any, n: string) => `${n} ${x.pnl >= 0 ? "untung" : "rugi"} ${money(Math.abs(x.pnl))}`;
    insights.push({
      icon: <Icon><path d="M3 7l6 6 4-4 8 8M21 17v-5M21 17h-5" /></Icon>,
      title: ls.long.pnl === ls.short.pnl ? "Long dan Short seimbang" : `${wn} lebih unggul dari ${ln}`,
      text: `Posisi ${phrase(w, wn.toLowerCase())} sedangkan ${phrase(l, ln.toLowerCase())}, dengan ${ls.long.trades} trade long dan ${ls.short.trades} trade short.`,
    });
  }
  if ((sm.winCount ?? 0) + (sm.lossCount ?? 0) > 0) {
    const winRate = ((sm.winCount ?? 0) / Math.max(1, data.totalTrades)) * 100;
    const pf = sm.profitFactor ?? 0, po = sm.payoffRatio ?? 0;
    const good = pf >= 1.5 && (sm.expectancy ?? 0) > 0;
    const marginal = pf >= 1 && (sm.expectancy ?? 0) > 0;
    insights.push({
      icon: <Icon><path d="M12 3l10 18H2z" /><path d="M12 10v4M12 17.5h.01" /></Icon>,
      title: good ? "Edge sudah solid" : marginal ? "Edge masih tipis" : "Edge belum terbukti",
      text: `Win rate ${winRate.toFixed(1)}% ditopang payoff ${po.toFixed(2)}. Profit factor ${pf.toFixed(2)} ${good ? "menunjukkan hasil bersih yang cukup sehat dibanding total kerugian." : marginal ? "berarti beberapa loss besar bisa menghapus hasil dengan cepat." : "berarti kerugian masih lebih besar dari keuntungan; evaluasi ulang entry dan manajemen risiko."}`,
    });
  }

  const activeHours = ([...new Set(heatmapData.map((d: any) => d.hour))] as number[]).sort((a, b) => a - b);

  // ── Heatmap summary (day × hour activity) ──
  const hmTotal = heatmapData.reduce((a: number, c: any) => a + c.trades, 0);
  const dayAgg = DAYS.map((d) => {
    const cs = heatmapData.filter((c: any) => c.day === d);
    return { day: d, trades: cs.reduce((a: number, c: any) => a + c.trades, 0), pnl: cs.reduce((a: number, c: any) => a + c.pnl, 0) };
  });
  const hourAgg = activeHours.map((h) => {
    const cs = heatmapData.filter((c: any) => c.hour === h);
    return { hour: h, trades: cs.reduce((a: number, c: any) => a + c.trades, 0), pnl: cs.reduce((a: number, c: any) => a + c.pnl, 0) };
  });
  const busiestDayAgg = dayAgg.reduce((a, b) => (b.trades > a.trades ? b : a), dayAgg[0]);
  const busiestHourAgg = hourAgg.length ? hourAgg.reduce((a, b) => (b.trades > a.trades ? b : a)) : null;
  const bestSlot = heatmapData.length ? heatmapData.reduce((a: any, b: any) => (b.pnl > a.pnl ? b : a)) : null;
  const worstSlot = heatmapData.length ? heatmapData.reduce((a: any, b: any) => (b.pnl < a.pnl ? b : a)) : null;
  const windows = [
    { label: "Dini hari", range: "00–05", from: 0, to: 5 },
    { label: "Pagi", range: "06–11", from: 6, to: 11 },
    { label: "Siang", range: "12–17", from: 12, to: 17 },
    { label: "Malam", range: "18–23", from: 18, to: 23 },
  ].map((w) => {
    const cs = heatmapData.filter((c: any) => c.hour >= w.from && c.hour <= w.to);
    return { ...w, trades: cs.reduce((a: number, c: any) => a + c.trades, 0), pnl: cs.reduce((a: number, c: any) => a + c.pnl, 0) };
  });
  const maxWin = Math.max(1, ...windows.map((w) => w.trades));
  const dowOrder = [1, 2, 3, 4, 5, 6, 0].map((i) => DAYS[i]);
  const dowLocal: Record<string, string> = { Sun: "Min", Mon: "Sen", Tue: "Sel", Wed: "Rab", Thu: "Kam", Fri: "Jum", Sat: "Sab" };
  const dowDays = dowOrder.map((d) => {
    const r = (byDow ?? []).find((x: any) => x.day === d) ?? { day: d, totalTrades: 0, winRate: 0, netPnL: 0 };
    return { ...r, label: dowLocal[d] };
  });
  const dowMax = Math.max(1, ...dowDays.map((d: any) => Math.abs(d.netPnL)));
  const dowActive = dowDays.filter((d: any) => d.totalTrades > 0);
  const dowBest = dowActive.length ? dowActive.reduce((a: any, b: any) => (b.netPnL > a.netPnL ? b : a)) : null;
  const dowWorst = dowActive.length ? dowActive.reduce((a: any, b: any) => (b.netPnL < a.netPnL ? b : a)) : null;
  const dowTotal = dowDays.reduce((a: number, d: any) => a + d.netPnL, 0);
  const ddAmt = data.maxDrawdownAmt ?? 0;
  const last = series.length ? series[series.length - 1] : null;
  const total = ls.long.trades + ls.short.trades;
  const longPct = total ? (ls.long.trades / total) * 100 : 50;
  const axisW = 64;
  const distMax = Math.max(1, ...dist.map((d) => d.count));
  const distTotal = dist.reduce((a, d) => a + d.count, 0);
  let ni = -1, pi = -1;

  return (
    <div className={PAGE}>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className={H1}>Analytics</h1>
            <AccountSwitcher value={accountId} onChange={setAccountId} />
          </div>
          <p className={SUB}>Pahami pola, kekuatan, dan kelemahan trading Anda dari {data.totalTrades} transaksi</p>
        </div>
        <Link href="/reports" className={cn(BTN, BTN_PRIMARY)}>
          <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 4v11M7 11l5 5 5-5M4 20h16" /></svg>
          Export Laporan
        </Link>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3 md:gap-4">
        {kpis.map((k, ki) => (
          <HoverTip key={k.label} block side="bottom" align={ki % 2 === 0 ? "left" : "right"} className="min-w-0 h-full" title={k.title} rows={k.rows} note={k.note}>
          <div className={cn(PANEL, "h-full p-4 md:px-[18px] md:py-4 min-w-0")}>
            <p className="text-xs font-medium text-muted-foreground dark:text-[#8a94c4]">{k.label}</p>
            <p className={cn("mt-2 truncate font-mono text-[22px] md:text-[26px] font-extrabold tracking-[-0.025em] tabular-nums leading-[1.05]", k.color)}>{k.value}</p>
            <p className={cn(CAP, "mt-1.5 truncate")}>{k.sub || "\u00A0"}</p>
          </div>
          </HoverTip>
        ))}
      </div>

      {/* Equity & drawdown */}
      <div className={cn(PANEL, "p-5 md:px-6 md:py-[22px]")}>
        <div className="flex flex-wrap items-start justify-between gap-3 mb-3">
          <div>
            <h2 className={H2}>Ekuitas &amp; Drawdown</h2>
            <p className={cn(CAP, "mt-1")}>
              Akumulasi P&amp;L dan penurunan dari puncak · Max drawdown{" "}
              <b className={cn("font-mono", LOSS_TXT)}>{money(ddAmt)}</b>
              {typeof data.maxDrawdown === "number" && data.maxDrawdown < 0 && data.maxDrawdown >= -100 ? ` (${data.maxDrawdown.toFixed(1)}%)` : ""}
            </p>
          </div>
          <div className="flex items-center gap-4 flex-wrap">
            <div className={cn("flex items-center gap-3.5", CAP)}>
              <span className="inline-flex items-center gap-1.5"><i className="inline-block h-[3px] w-3.5 rounded bg-[#7a8cff]" />Ekuitas</span>
              <span className="inline-flex items-center gap-1.5"><i className="inline-block h-[3px] w-3.5 rounded bg-[#f87171]" />Drawdown</span>
            </div>
            <div className={TABS}>
              {RANGES.map((r) => (
                <button key={r.key} type="button" onClick={() => setRange(r.key)} className={cn(TAB, range === r.key && TAB_ON)}>{r.label}</button>
              ))}
            </div>
          </div>
        </div>
        {series.length === 0 ? (
          <div className="h-[200px] grid place-items-center text-[13px] text-muted-foreground">Tidak ada data pada rentang ini</div>
        ) : (
          <>
            <ResponsiveContainer width="100%" height={250}>
              <AreaChart data={series} syncId="eq" margin={{ top: 10, right: 12, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="eqGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#4f6bff" stopOpacity={0.4} />
                    <stop offset="100%" stopColor="#4f6bff" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="eqLine" x1="0" y1="0" x2="1" y2="0">
                    <stop offset="0%" stopColor="#7a8cff" />
                    <stop offset="100%" stopColor="#9db0ff" />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                <XAxis dataKey="i" type="number" domain={["dataMin", "dataMax"]} ticks={monthTicks}
                  tick={TICK} axisLine={false} tickLine={false}
                  tickFormatter={(v) => { const d = series[v]?.date; return d ? MONTHS[parseYmd(d).getMonth()] : ""; }} />
                <YAxis tick={TICK} width={axisW} axisLine={false} tickLine={false} tickCount={4}
                  tickFormatter={(v) => fmtAxis(Number(v), currency)} />
                <ReferenceLine y={0} stroke="var(--border)" strokeDasharray="4 4" />
                <Tooltip
                  formatter={(v: number) => [fullMoney(v), "Ekuitas"]}
                  labelFormatter={(_, p: any) => (p?.[0]?.payload?.date ? fmtDayLabel(p[0].payload.date) : "")}
                  contentStyle={TIP_STYLE}
                  labelStyle={TIP_LABEL}
                  itemStyle={TIP_ITEM}
                  cursor={CURSOR_LINE}
                />
                <Area type="monotone" dataKey="balance" stroke="url(#eqLine)" strokeWidth={2.4} fill="url(#eqGrad)"
                  dot={(p: any) => last && p.index === series.length - 1 && p.cx != null ? (
                    <g key="last-dot">
                      <circle cx={p.cx} cy={p.cy} r={8} fill="#4f6bff" fillOpacity={0.35} />
                      <circle cx={p.cx} cy={p.cy} r={4.5} fill="#ffffff" stroke="#4f6bff" strokeWidth={2} />
                    </g>
                  ) : <g key={`d-${p.index}`} />}
                  activeDot={{ r: 4 }} />
              </AreaChart>
            </ResponsiveContainer>
            <ResponsiveContainer width="100%" height={110}>
              <AreaChart data={series} syncId="eq" margin={{ top: 4, right: 12, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="ddGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#f87171" stopOpacity={0} />
                    <stop offset="100%" stopColor="#f87171" stopOpacity={0.4} />
                  </linearGradient>
                </defs>
                <XAxis dataKey="i" type="number" domain={["dataMin", "dataMax"]} hide />
                <YAxis tick={TICK} width={axisW} axisLine={false} tickLine={false} tickCount={2}
                  domain={[(min: number) => Math.min(min, -1), 0]}
                  tickFormatter={(v) => (Number(v) === 0 ? "" : fmtMoney(Number(v), currency))} />
                <ReferenceLine y={0} stroke="var(--border)" />
                <Tooltip
                  formatter={(v: number) => [fullMoney(v), "Drawdown"]}
                  labelFormatter={(_, p: any) => (p?.[0]?.payload?.date ? fmtDayLabel(p[0].payload.date) : "")}
                  contentStyle={TIP_STYLE}
                  labelStyle={TIP_LABEL}
                  itemStyle={TIP_ITEM}
                  cursor={CURSOR_LINE}
                />
                <Area type="monotone" dataKey="drawdownAmt" stroke="#f87171" strokeWidth={2} fill="url(#ddGrad)" dot={false} />
              </AreaChart>
            </ResponsiveContainer>
          </>
        )}
      </div>

      {/* Session / Long-Short / Distribution */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className={cn(PANEL, "p-5 md:px-6 md:py-[22px] min-w-0")}>
          <h2 className={H2}>Performa per Sesi</h2>
          <p className={cn(CAP, "mt-1 mb-4")}>Win rate berdasarkan sesi entry</p>
          <div className="flex flex-col gap-3.5">
            {sessions.length === 0 && <p className="text-[13px] text-muted-foreground">Belum ada data sesi</p>}
            {sessions.map((x) => (
              <HoverTip key={x.session} block align="left" title={`Sesi ${sessName(x.session)}`}
                rows={[
                  { label: "Trades", value: String(x.totalTrades ?? 0) },
                  { label: "Win rate", value: `${(x.winRate ?? 0).toFixed(1)}%`, tone: (x.winRate ?? 0) >= 50 ? "win" : "loss" },
                  { label: "Net P&L", value: fullMoney(x.netPnL ?? 0), tone: tn(x.netPnL ?? 0) },
                ]}>
                <div className="grid grid-cols-[72px_1fr_40px] items-center gap-3 text-[13px]">
                  <span className="font-semibold truncate transition-colors duration-200 group-hover/tip:text-[#9db0ff]">{sessName(x.session)}</span>
                  <div className="h-2 rounded-full bg-secondary dark:bg-white/[0.07] overflow-hidden">
                    <div className="h-full rounded-full bg-gradient-to-r from-[#4f6bff] to-[#9db0ff] transition-[filter,box-shadow] duration-200 ease-out group-hover/tip:brightness-125 group-hover/tip:shadow-[0_0_10px_rgba(79,107,255,0.55)] motion-reduce:transition-none" style={{ width: `${Math.min(100, Math.max(2, x.winRate))}%` }} />
                  </div>
                  <span className="text-right font-mono font-bold tabular-nums">{Math.round(x.winRate)}%</span>
                </div>
              </HoverTip>
            ))}
          </div>
        </div>

        <div className={cn(PANEL, "p-5 md:px-6 md:py-[22px] min-w-0")}>
          <h2 className={H2}>Long vs Short</h2>
          <p className={cn(CAP, "mt-1 mb-4")}>Perbandingan arah posisi</p>
          <div className="flex h-2 gap-[3px] rounded-full overflow-hidden">
            <div className="bg-gradient-to-r from-[#4f6bff] to-[#7a8cff]" style={{ width: `${longPct}%` }} />
            <div className="bg-gradient-to-r from-[#a78bfa] to-[#c4b5fd]" style={{ width: `${100 - longPct}%` }} />
          </div>
          <div className="mt-4 grid grid-cols-2 gap-3">
            {([["Long", ls.long, CHIP_G], ["Short", ls.short, CHIP_R]] as [string, any, string][]).map(([name, st, chip]) => (
              <HoverTip key={name} block className="min-w-0 h-full" side="top" align={name === "Long" ? "left" : "right"} title={`${name} positions`}
                rows={[
                  { label: "Trades", value: String(st.trades) },
                  { label: "Win rate", value: `${st.winRate.toFixed(1)}%`, tone: st.winRate >= 50 ? "win" : "loss" },
                  { label: "P&L", value: fullMoney(st.pnl), tone: tn(st.pnl) },
                  { label: "Share", value: `${(total ? (st.trades / total) * 100 : 0).toFixed(1)}%` },
                ]}>
              <div className="h-full rounded-xl border p-3.5 min-w-0 dark:border-[#7a8cff]/20 dark:bg-white/[0.03] transition-[transform,box-shadow,border-color] duration-200 ease-out hover:-translate-y-0.5 hover:border-[#5b74ff]/50 hover:shadow-[0_10px_24px_-12px_rgba(79,107,255,0.5)] motion-reduce:transform-none motion-reduce:transition-none">
                <span className={cn(CHIP, chip, "!min-w-0 !h-5 !px-2 !text-[10.5px]")}>{name}</span>
                <p className={cn("mt-3 truncate font-mono text-[18px] md:text-[20px] font-extrabold tracking-[-0.02em] tabular-nums", pnlColor(st.pnl))}>{money(st.pnl, true)}</p>
                <p className={cn(CAP, "mt-1.5")}>{st.trades} trade · Win rate {st.winRate.toFixed(1)}%</p>
              </div>
              </HoverTip>
            ))}
          </div>
        </div>

        <div className={cn(PANEL, "p-5 md:px-6 md:py-[22px] min-w-0")}>
          <h2 className={H2}>Distribusi P&amp;L</h2>
          <p className={cn(CAP, "mt-1 mb-2")}>Jumlah trade per rentang hasil</p>
          <div className={BAR_HOVER}>
          <ResponsiveContainer width="100%" height={190}>
            <BarChart data={dist} margin={{ top: 8, right: 0, left: 0, bottom: 0 }} barCategoryGap="12%">
              <XAxis dataKey="label" tick={{ fontSize: 9, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} interval={0} height={30}
                tickFormatter={(v: string) => v.replace("...", "…")} />
              <YAxis hide domain={[0, distMax]} />
              <Tooltip
                formatter={(v: number) => [`${v} trade · ${distTotal ? ((v / distTotal) * 100).toFixed(1) : "0.0"}%`, "Jumlah"]}
                contentStyle={TIP_STYLE}
                labelStyle={TIP_LABEL}
                itemStyle={TIP_ITEM}
                cursor={CURSOR_BAR}
              />
              <Bar dataKey="count" radius={[5, 5, 0, 0]}>
                {dist.map((d, i) => {
                  const fill = d.positive ? POS_SHADES[++pi % 4] : NEG_SHADES[++ni % 4];
                  return <Cell key={i} fill={fill} />;
                })}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Insights */}
      <div className="flex items-center gap-3 mt-2">
        <h2 className={H2}>Wawasan</h2>
        <span className={cn(CHIP, CHIP_B, "!h-[20px] !text-[10.5px]")}>Otomatis dari data</span>
      </div>
      {insights.length === 0 ? (
        <div className={cn(PANEL, "p-5 text-[13px] text-muted-foreground")}>Belum cukup data untuk membuat wawasan.</div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {insights.map((ins, i) => <InsightCard key={i} {...ins} />)}
        </div>
      )}

      {/* Detail */}
      <div className="mt-4">
        <h2 className={H2}>Detail</h2>
        <p className={cn(CAP, "mt-1")}>Aktivitas per jam, hari, kategori, dan setup</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)] gap-4">
        {/* P&L by Day of Week */}
        <div className={cn(PANEL, "p-5 md:px-6 md:py-[22px] min-w-0")}>
          <div className="flex flex-wrap items-center justify-between gap-4 mb-1.5">
            <div>
              <h2 className={H2}>P&L by Day of Week</h2>
              <div className={cn(CAP, "mt-1")}>Rekap P&L per hari dalam seminggu</div>
            </div>
            <div className="text-right">
              <div className={CAP}>Total</div>
              <b className={cn("font-mono tabular-nums text-xl tracking-[-0.02em]", pnlColor(dowTotal))}>{fullMoney(dowTotal)}</b>
            </div>
          </div>

          {/* Diverging bars */}
          <div className="relative h-[200px] md:h-[240px] mt-3.5 mb-1">
            <div className="pointer-events-none absolute inset-x-0 top-1/2 h-px bg-[#7a8cff]/30" />
            <div className="absolute inset-0 flex gap-1.5 md:gap-3">
              {dowDays.map((d: any, di: number) => {
                const h = Math.max((Math.abs(d.netPnL) / dowMax) * 43, 1);
                const pos = d.netPnL >= 0;
                return (
                  <HoverTip key={d.day} block side="top" align={di < 1 ? "left" : di >= 6 ? "right" : "center"}
                    title={d.label} rows={[
                      { label: "Net P&L", value: fullMoney(d.netPnL), tone: pos ? "win" : "loss" },
                      { label: "Trade", value: String(d.totalTrades) },
                      { label: "Win rate", value: `${Number(d.winRate).toFixed(0)}%` },
                    ]}
                    className="flex-1 min-w-0 h-full rounded-lg transition-colors duration-200 ease-out hover:bg-[#4f6bff]/[0.07] motion-reduce:transition-none">
                    <div className="relative w-full h-full">
                      {d.totalTrades > 0 ? (
                        <>
                          <div className={cn("absolute inset-x-[14%] transition-[filter,box-shadow] duration-200 ease-out group-hover/tip:brightness-125 group-hover/tip:shadow-[0_0_16px_rgba(79,107,255,0.5)] motion-reduce:transition-none", pos ? "bottom-1/2 rounded-t-lg rounded-b-[3px] bg-gradient-to-b from-[#4ade80] to-[#16a34a]" : "top-1/2 rounded-b-lg rounded-t-[3px] bg-gradient-to-b from-[#f87171] to-[#b91c1c]")}
                            style={{ height: `${h}%` }} />
                          <span className={cn("absolute -inset-x-2 text-center text-[9px] md:text-[11px] font-bold font-mono whitespace-nowrap", pos ? "text-emerald-600 dark:text-[#4ade80]" : "text-red-600 dark:text-[#f87171]")}
                            style={pos ? { bottom: `calc(50% + ${h}% + 4px)` } : { top: `calc(50% + ${h}% + 4px)` }}>
                            {fmtMoney(d.netPnL, currency, true)}
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
          <div className="flex gap-1.5 md:gap-3 text-[10px] md:text-xs text-muted-foreground dark:text-[#8a94c4] font-semibold mt-1">
            {dowDays.map((d: any) => <span key={d.day} className="flex-1 text-center">{d.label}</span>)}
          </div>

          {/* Day tiles */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 mt-[22px] pt-5 border-t dark:border-[#7a8cff]/10">
            {dowDays.map((d: any, i: number) => {
              const has = d.totalTrades > 0;
              const pos = d.netPnL >= 0;
              return (
                <HoverTip key={d.day} block className="min-w-0" side="top" align={i % 4 === 0 ? "left" : i % 4 === 3 ? "right" : "center"}
                  title={d.label} rows={[{ label: "Trade", value: String(d.totalTrades) }, { label: "Win rate", value: `${Number(d.winRate).toFixed(0)}%` }]}>
                  <div className={cn("h-full rounded-[13px] border px-3.5 py-3 flex flex-col gap-1.5 min-w-0 transition-[transform,box-shadow,border-color] duration-200 ease-out hover:-translate-y-0.5 hover:border-[#7a8cff]/50 hover:shadow-[0_10px_24px_-12px_rgba(79,107,255,0.55)] motion-reduce:transform-none motion-reduce:transition-none",
                    !has ? "border-dashed dark:border-[#7a8cff]/15" : pos ? "bg-emerald-500/10 border-emerald-500/30" : "bg-red-500/10 border-red-500/30")}>
                    <span className={cn("text-xs font-bold", has ? "text-foreground dark:text-[#dfe4ff]" : "text-muted-foreground dark:text-[#7d88bd]")}>{d.label}</span>
                    {has ? (
                      <b className={cn("text-[13px] font-mono tabular-nums tracking-[-0.03em] truncate", pos ? "text-[#4ade80]" : "text-[#f87171]")}>{fullMoney(d.netPnL)}</b>
                    ) : (
                      <span className={cn(CAP, "opacity-60")}>Tanpa trade</span>
                    )}
                  </div>
                </HoverTip>
              );
            })}
          </div>

          <div className="flex flex-wrap gap-x-6 gap-y-2 mt-[18px] text-[12.5px]">
            {dowBest && <span className={CAP}>Hari terbaik <b className="ml-1.5 text-[#4ade80]">{dowBest.label} · {fullMoney(dowBest.netPnL)}</b></span>}
            {dowWorst && dowWorst.netPnL < 0 && <span className={CAP}>Hari terburuk <b className="ml-1.5 text-[#f87171]">{dowWorst.label} · {fullMoney(dowWorst.netPnL)}</b></span>}
            <span className={CAP}>Hari profit <b className="ml-1.5 text-foreground dark:text-[#dfe4ff]">{dowActive.filter((d: any) => d.netPnL > 0).length} dari {dowActive.length}</b></span>
          </div>
        </div>

        {/* Session list */}
        <div className={cn(PANEL, "p-5 md:px-6 md:py-[22px] min-w-0")}>
          <h2 className={H2}>Net P&L by Session</h2>
          <p className={cn(CAP, "mt-1 mb-2")}>Net P&L and win rate per trading session</p>
          <div>
            {bySession.map((s: any) => (
              <StatRow
                key={s.session}
                label={SESSION_LABELS[s.session] ?? s.session}
                value={fullMoney(s.netPnL)}
                value2={`${s.totalTrades} trades · ${s.winRate.toFixed(0)}% win rate`}
                color={pnlColor(s.netPnL)}
              />
            ))}
          </div>
        </div>
      </div>

      {/* Heatmap */}
      <div className={cn(PANEL, "p-5 md:px-6 md:py-[22px] grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_300px] gap-6")}>
        <div className="min-w-0">
        <h2 className={H2}>Trade Activity Heatmap</h2>
        <p className={cn(CAP, "mt-1 mb-4")}>Day × Hour (WIB) · number = trade count</p>
        {activeHours.length === 0 ? (
          <p className="text-[13px] text-muted-foreground">No data with entry times</p>
        ) : (
          <div className="overflow-x-auto">
            <div style={{ minWidth: activeHours.length * 52 + 60 }}>
              {/* Hour headers */}
              <div className="flex gap-1 mb-1.5 ml-[52px]">
                {activeHours.map((h) => (
                  <div key={h} className="w-12 shrink-0 text-center text-[11px] text-muted-foreground dark:text-[#7d88bd]">{String(h).padStart(2,"0")}</div>
                ))}
              </div>
              {/* Day rows */}
              {DAYS.map((day) => (
                <div key={day} className="flex items-center gap-1 mb-1">
                  <div className="w-12 text-[12px] font-semibold text-muted-foreground dark:text-[#8a94c4] pr-2 shrink-0">{day}</div>
                  {activeHours.map((h) => {
                    const cell = heatGrid[day]?.[h];
                    return (
                      <div key={h} className="w-12 shrink-0">
                        <HeatmapCell
                          day={day}
                          hour={h}
                          side={DAYS.indexOf(day) < 3 ? "bottom" : "top"}
                          align={activeHours.indexOf(h) < 2 ? "left" : activeHours.indexOf(h) >= activeHours.length - 2 ? "right" : "center"}
                          pnl={cell?.pnl ?? 0}
                          trades={cell?.trades ?? 0}
                          winRate={cell?.winRate ?? 0}
                          currency={currency}
                        />
                      </div>
                    );
                  })}
                </div>
              ))}
              {/* Legend */}
              <div className="flex items-center gap-2 mt-4 ml-[52px]">
                <span className={CAP}>Loss</span>
                {[0.8, 0.5, 0.2, 0, 0.2, 0.5, 0.8].map((v, i) => (
                  <div key={i} className="w-6 h-3.5 rounded-sm" style={{
                    background: i < 3 ? `rgba(220,38,38,${v})` : i === 3 ? "hsl(var(--muted))" : `rgba(22,163,74,${v})`
                  }} />
                ))}
                <span className={CAP}>Profit</span>
              </div>
            </div>
          </div>
        )}
        </div>

        {/* Ringkasan aktivitas */}
        <aside className="min-w-0 xl:border-l xl:pl-6 dark:border-[#7a8cff]/12 flex flex-col gap-4">
          <div>
            <h3 className="text-[13px] font-bold">Ringkasan Aktivitas</h3>
            <p className={cn(CAP, "mt-0.5")}>Pola kapan Anda paling aktif</p>
          </div>
          <div className="grid grid-cols-2 gap-2.5">
            {[
              { l: "Total trade", v: String(hmTotal), s: `${heatmapData.length} slot aktif` },
              { l: "Hari tersibuk", v: busiestDayAgg ? dowLocal[busiestDayAgg.day] : "—", s: busiestDayAgg ? `${busiestDayAgg.trades} trade` : "" },
              { l: "Jam tersibuk", v: busiestHourAgg ? `${String(busiestHourAgg.hour).padStart(2, "0")}:00` : "—", s: busiestHourAgg ? `${busiestHourAgg.trades} trade` : "" },
              { l: "Jam aktif", v: String(activeHours.length), s: "dari 24 jam" },
            ].map((t) => (
              <div key={t.l} className="rounded-xl border dark:border-[#7a8cff]/14 bg-foreground/[0.03] px-3 py-2.5 transition-colors duration-200 hover:bg-[#4f6bff]/[0.08] hover:border-[#7a8cff]/40">
                <div className={CAP}>{t.l}</div>
                <div className="text-lg font-extrabold font-mono tabular-nums mt-0.5">{t.v}</div>
                <div className={cn(CAP, "text-[11px]")}>{t.s}</div>
              </div>
            ))}
          </div>

          <div>
            <p className={cn(CAP, "mb-2 font-semibold")}>Trade per waktu (WIB)</p>
            <div className="flex flex-col gap-2.5">
              {windows.map((w) => (
                <HoverTip key={w.label} block align="left" title={`${w.label} · ${w.range}`}
                  rows={[{ label: "Trade", value: String(w.trades) }, { label: "Share", value: hmTotal ? `${((w.trades / hmTotal) * 100).toFixed(0)}%` : "0%" }, { label: "Net P&L", value: fullMoney(w.pnl), tone: w.pnl >= 0 ? "win" : "loss" }]}>
                  <div className="flex items-center gap-2.5 text-[12.5px] rounded-md px-1 -mx-1 transition-colors duration-200 hover:bg-[#4f6bff]/[0.07]">
                    <span className="w-[66px] shrink-0 font-semibold">{w.label}</span>
                    <div className="flex-1 h-2 rounded-full bg-foreground/[0.07] overflow-hidden">
                      <div className="h-full rounded-full bg-gradient-to-r from-[#4f6bff] to-[#8ea2ff]" style={{ width: `${(w.trades / maxWin) * 100}%` }} />
                    </div>
                    <span className="w-8 text-right font-mono tabular-nums text-muted-foreground">{w.trades}</span>
                  </div>
                </HoverTip>
              ))}
            </div>
          </div>

          <div className="flex flex-col gap-2 text-[12.5px] pt-3 border-t dark:border-[#7a8cff]/10">
            {bestSlot && (
              <div className="flex items-center justify-between gap-3">
                <span className={CAP}>Slot terbaik</span>
                <span className="text-right"><b className="font-mono text-[#4ade80]">{fullMoney(bestSlot.pnl)}</b><span className={cn(CAP, "block text-[11px]")}>{dowLocal[bestSlot.day]} {String(bestSlot.hour).padStart(2, "0")}:00 · {bestSlot.trades} trade</span></span>
              </div>
            )}
            {worstSlot && worstSlot.pnl < 0 && (
              <div className="flex items-center justify-between gap-3">
                <span className={CAP}>Slot terburuk</span>
                <span className="text-right"><b className="font-mono text-[#f87171]">{fullMoney(worstSlot.pnl)}</b><span className={cn(CAP, "block text-[11px]")}>{dowLocal[worstSlot.day]} {String(worstSlot.hour).padStart(2, "0")}:00 · {worstSlot.trades} trade</span></span>
              </div>
            )}
          </div>
        </aside>
      </div>

      {/* Setup category table */}
      <PerfTable
        title="Performance by Setup Category (A / A+ / A++ / B)"
        rows={byCategory.map((r: any) => ({ ...r, name: r.category }))}
        keyLabel="Category"
        currency={currency}
      />

      {/* By setup table */}
      <PerfTable
        title="Performance by Setup / Strategy"
        rows={bySetup}
        keyLabel="Setup"
        currency={currency}
      />
    </div>
  );
}
