"use client";
import { useEffect, useState, useCallback, useRef, Fragment } from "react";
import {
  Plus, Upload, Search, Pencil, Trash2, ChevronDown, ChevronLeft, ChevronRight,
  MoreVertical, Download, CalendarDays, TrendingUp, Trophy, BarChart3,
} from "lucide-react";
import { format, startOfMonth, endOfMonth, subMonths, subDays, startOfYear } from "date-fns";
import { cn, formatCurrency, formatR, formatDate, getDurationString } from "@/lib/utils";
import TradeFormModal from "@/components/trades/TradeFormModal";
import ImportModal from "@/components/trades/ImportModal";
import AccountSwitcher from "@/components/layout/AccountSwitcher";
import { PANEL, BTN_PRIMARY, PAGE, H1, SUB, BTN, CAP, WIN, LOSS } from "@/lib/theme";
import { HoverTip, type TipRow } from "@/components/ui/HoverTip";

const OUTCOME_FILTERS = [
  { label: "All", value: "" },
  { label: "Win", value: "win" },
  { label: "Loss", value: "loss" },
  { label: "B/E", value: "breakeven" },
];
const DIR_FILTERS = [{ label: "Long", value: "long" }, { label: "Short", value: "short" }];
const SETUP_CATS = ["A", "A+", "A++", "B"];
const MOODS = ["😖", "😕", "😐", "🙂", "😎"];
const PAGE_SIZES = [10, 25, 50, 100];

/* ── tema navy (shared constants in @/lib/theme) ── */
const PILL_ON =
  "bg-gradient-to-b from-[#5873ff] to-[#2f4bd8] text-white border-transparent shadow-[0_0_18px_-4px_rgba(79,107,255,0.75)]";
const PILL_OFF =
  "text-muted-foreground dark:text-[#9aa4d2] border-border dark:border-white/10 hover:text-foreground dark:hover:text-[#e8ecff] hover:border-[#4f6bff]/50 hover:bg-[#4f6bff]/10";
const FP = "h-9 px-[15px] rounded-full border text-xs font-semibold transition-all duration-200 ease-out hover:-translate-y-0.5 hover:shadow-[0_6px_16px_-6px_rgba(79,107,255,0.5)] active:translate-y-0 motion-reduce:transform-none motion-reduce:transition-none";
const BTN_O = "border border-border dark:border-white/[0.14] bg-transparent dark:bg-white/[0.02] text-foreground/80 dark:text-[#dfe4ff] hover:border-[#4f6bff]/60 hover:bg-[#4f6bff]/10 transition-colors";
const TH = "px-4 py-[13px] text-[11px] font-bold uppercase tracking-[0.08em] text-muted-foreground dark:text-[#7d88bd] whitespace-nowrap";
const SEC = "text-[10px] font-bold uppercase tracking-[0.1em] text-muted-foreground dark:text-[#7d88bd] mb-2";

/* ── date range ── */
type DateRangeValue = { key: string; from: string; to: string };
const PRESETS = [
  { key: "all", label: "Semua waktu" },
  { key: "today", label: "Hari ini" },
  { key: "7d", label: "7 hari terakhir" },
  { key: "month", label: "Bulan ini" },
  { key: "lastmonth", label: "Bulan lalu" },
  { key: "year", label: "Tahun ini" },
];
const fmtDay = (d: Date) => format(d, "yyyy-MM-dd");
function presetRange(key: string): DateRangeValue {
  const now = new Date();
  switch (key) {
    case "today": return { key, from: fmtDay(now), to: fmtDay(now) };
    case "7d": return { key, from: fmtDay(subDays(now, 6)), to: fmtDay(now) };
    case "month": return { key, from: fmtDay(startOfMonth(now)), to: fmtDay(endOfMonth(now)) };
    case "lastmonth": {
      const m = subMonths(now, 1);
      return { key, from: fmtDay(startOfMonth(m)), to: fmtDay(endOfMonth(m)) };
    }
    case "year": return { key, from: fmtDay(startOfYear(now)), to: fmtDay(now) };
    default: return { key: "all", from: "", to: "" };
  }
}

function DateRange({ value, onChange }: { value: DateRangeValue; onChange: (r: DateRangeValue) => void }) {
  const [open, setOpen] = useState(false);
  const [cf, setCf] = useState("");
  const [ct, setCt] = useState("");
  const d = (s: string) => format(new Date(s + "T00:00:00"), "d MMM yyyy");
  const label =
    value.key === "custom" && (value.from || value.to)
      ? `${value.from ? d(value.from) : "…"} – ${value.to ? d(value.to) : "…"}`
      : PRESETS.find((p) => p.key === value.key)?.label ?? "Semua waktu";

  function apply() {
    if (!cf && !ct) return;
    let from = cf, to = ct;
    if (from && to && from > to) { from = ct; to = cf; }
    onChange({ key: "custom", from, to });
    setOpen(false);
  }

  return (
    <div className="relative">
      <button
        onClick={() => { setCf(value.from); setCt(value.to); setOpen(!open); }}
        className={cn(BTN, BTN_O)}
      >
        <CalendarDays className="w-4 h-4 text-[#8ea2ff]" />
        <span>{label}</span>
        <ChevronDown className={cn("w-4 h-4 text-muted-foreground transition-transform", open && "rotate-180")} />
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div
            className="absolute right-0 top-full mt-2 z-50 w-64 rounded-xl border p-1.5 shadow-2xl anim-pop"
            style={{ backgroundColor: "hsl(var(--card))" }}
          >
            {PRESETS.map((p) => (
              <button
                key={p.key}
                onClick={() => { onChange(presetRange(p.key)); setOpen(false); }}
                className={cn(
                  "w-full text-left text-xs px-3 py-2 rounded-lg transition-colors flex items-center justify-between",
                  value.key === p.key ? "bg-[#4f6bff]/15 text-[#a5b4ff] font-medium" : "hover:bg-muted"
                )}
              >
                {p.label}
                {value.key === p.key && <span className="w-1.5 h-1.5 rounded-full bg-[#4f6bff]" />}
              </button>
            ))}
            <div className="border-t mt-1.5 pt-2 px-2 pb-1">
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1.5">Kustom</p>
              <div className="flex items-center gap-1.5">
                <input type="date" value={cf} onChange={(e) => setCf(e.target.value)}
                  className="flex-1 min-w-0 text-[11px] rounded-lg border bg-background px-2 py-1.5" />
                <span className="text-muted-foreground text-xs">–</span>
                <input type="date" value={ct} onChange={(e) => setCt(e.target.value)}
                  className="flex-1 min-w-0 text-[11px] rounded-lg border bg-background px-2 py-1.5" />
              </div>
              <button onClick={apply} disabled={!cf && !ct}
                className={cn("w-full mt-2 text-xs py-2 rounded-lg font-medium disabled:opacity-40", BTN_PRIMARY)}>
                Terapkan
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

/* ── dekorasi header ── */
const CANDLES: [number, number, number, number][] = [
  [30, 34, 38, 27], [34, 31, 36, 28], [31, 38, 41, 30], [38, 42, 45, 36], [42, 40, 46, 38], [40, 47, 50, 39],
  [47, 52, 55, 45], [52, 49, 54, 47], [49, 55, 58, 48], [55, 60, 63, 53], [60, 57, 62, 55], [57, 64, 67, 56],
  [64, 70, 73, 62], [70, 66, 71, 64], [66, 73, 77, 65], [73, 79, 82, 71], [79, 76, 81, 74], [76, 84, 88, 75],
];

function Backdrop() {
  const y = (v: number) => 112 - v * 1.05;
  return (
    <div aria-hidden className="pointer-events-none absolute inset-x-0 -top-6 h-[300px] -z-10 overflow-hidden">
      <div className="absolute -top-24 left-1/3 w-[620px] h-[420px] rounded-full blur-3xl opacity-60"
        style={{ background: "radial-gradient(closest-side, rgba(59,91,255,0.28), transparent)" }} />
      <div className="absolute -top-16 -right-10 w-[520px] h-[300px] rounded-full blur-3xl opacity-50"
        style={{ background: "radial-gradient(closest-side, rgba(99,102,241,0.22), transparent)" }} />
      <svg viewBox="0 0 360 120" preserveAspectRatio="none" className="absolute right-0 top-24 w-[45%] h-[170px]"
        style={{ opacity: 0.2, WebkitMaskImage: "linear-gradient(to left, black 25%, transparent)", maskImage: "linear-gradient(to left, black 25%, transparent)" }}>
        {CANDLES.map(([o, c, h, l], i) => {
          const x = 10 + i * 19;
          const up = c >= o;
          const top = y(Math.max(o, c));
          const bodyH = Math.max(3, Math.abs(y(o) - y(c)));
          return (
            <g key={i}>
              <line x1={x} x2={x} y1={y(h)} y2={y(l)} stroke={up ? "#4f6bff" : "#2a3a9f"} strokeWidth={1.5} />
              <rect x={x - 4} y={top} width={8} height={bodyH} rx={1.5} fill={up ? "#4f6bff" : "#1b2a78"} stroke={up ? "#7c9bff" : "#2a3a9f"} strokeWidth={0.8} />
            </g>
          );
        })}
      </svg>
    </div>
  );
}

/* ── komponen kecil ── */
function useCountUp(target: number, ms = 700) {
  const [v, setV] = useState(0);
  const from = useRef(0);
  useEffect(() => {
    let raf = 0;
    const start = from.current;
    const t0 = performance.now();
    const tick = (t: number) => {
      const p = Math.min(1, (t - t0) / ms);
      const val = start + (target - start) * (1 - Math.pow(1 - p, 3));
      from.current = val;
      setV(val);
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, ms]);
  return v;
}

function IconTile({ children }: { children: React.ReactNode }) {
  return (
    <div className="w-[46px] h-[46px] rounded-[13px] flex items-center justify-center shrink-0 border border-[#5b74ff]/30 bg-gradient-to-br from-[#2b3f9e]/50 to-[#13204f]/60 text-[#8ea2ff] shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]">
      {children}
    </div>
  );
}

function WinRing({ pct }: { pct: number }) {
  const [on, setOn] = useState(false);
  useEffect(() => {
    const id = requestAnimationFrame(() => setOn(true));
    return () => cancelAnimationFrame(id);
  }, []);
  const f = Math.max(0, Math.min(1, pct / 100));
  return (
    <svg viewBox="0 0 64 64" className="w-[46px] h-[46px] shrink-0 -rotate-90" style={{ filter: "drop-shadow(0 0 6px rgba(79,107,255,0.55))" }}>
      <defs>
        <linearGradient id="wrGrad" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#8ea2ff" />
          <stop offset="100%" stopColor="#3b5bff" />
        </linearGradient>
      </defs>
      <circle cx="32" cy="32" r="26" fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="6" />
      <circle cx="32" cy="32" r="26" fill="none" stroke="url(#wrGrad)" strokeWidth="6" strokeLinecap="round" pathLength={1}
        style={{ strokeDasharray: on ? `${f} ${1 - f}` : "0 1", transition: "stroke-dasharray 1s cubic-bezier(.22,1,.36,1)" }} />
    </svg>
  );
}

function SideBadge({ direction }: { direction: string }) {
  const long = direction === "long";
  return (
    <span className={cn("inline-flex items-center rounded-[7px] border px-[9px] py-[3px] text-[11px] font-bold",
      long ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-300 border-emerald-500/30"
           : "bg-red-500/15 text-red-600 dark:text-red-300 border-red-500/30")}>
      {long ? "Long" : "Short"}
    </span>
  );
}

function StatusBadge({ outcome }: { outcome: string | null }) {
  const cfg: Record<string, { label: string; cls: string }> = {
    win: { label: "Win", cls: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-300 border-emerald-500/30" },
    loss: { label: "Loss", cls: "bg-red-500/15 text-red-600 dark:text-red-300 border-red-500/30" },
    breakeven: { label: "B/E", cls: "bg-amber-500/15 text-amber-600 dark:text-amber-300 border-amber-500/30" },
  };
  const c = outcome ? cfg[outcome] : undefined;
  if (!c) {
    return <span className="inline-flex items-center rounded-[7px] border border-border dark:border-white/10 bg-muted px-[9px] py-[3px] text-[11px] font-bold text-muted-foreground">Open</span>;
  }
  return <span className={cn("inline-flex items-center rounded-[7px] border px-[9px] py-[3px] text-[11px] font-bold", c.cls)}>{c.label}</span>;
}

function PnLPill({ value, currency }: { value: number | null; currency: string }) {
  const base = "inline-block px-2.5 py-[5px] rounded-lg font-semibold text-[12.5px] font-mono tabular-nums";
  if (value === null) return <span className="inline-block px-2.5 py-[5px] rounded-lg text-[11px] bg-muted text-muted-foreground font-semibold">Open</span>;
  if (value > 0) return <span className={cn(base, "bg-[#16a34a]/20", WIN)}>{formatCurrency(value, currency)}</span>;
  if (value < 0) return <span className={cn(base, "bg-[#dc2626]/20", LOSS)}>{formatCurrency(value, currency)}</span>;
  return <span className={cn(base, "bg-muted text-muted-foreground")}>{formatCurrency(0, currency)}</span>;
}

function SetupCatBadge({ cat }: { cat: string | null }) {
  if (!cat) return <span className="text-muted-foreground">—</span>;
  const colors: Record<string, string> = {
    "A++": "bg-indigo-100 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 border-indigo-300 dark:border-indigo-700",
    "A+": "bg-violet-100 dark:bg-violet-950 text-violet-700 dark:text-violet-300 border-violet-300 dark:border-violet-700",
    "A": "bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-300 border-blue-300 dark:border-blue-700",
    "B": "bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 border-zinc-300 dark:border-zinc-600",
  };
  return <span className={cn("text-[11px] font-bold px-2 py-[3px] rounded-md border", colors[cat] ?? "")}>{cat}</span>;
}

const money = (v: number | null | undefined, c: string) => (v == null ? "—" : formatCurrency(v, c));
const tone = (v: number | null | undefined): TipRow["tone"] => (v == null || v === 0 ? "muted" : v > 0 ? "win" : "loss");

function tradeRows(t: any, tc: string, duration: string): TipRow[] {
  const rows: TipRow[] = [
    { label: "Entry", value: String(t.entryPrice ?? "—") },
    { label: "Exit", value: String(t.exitPrice ?? "—") },
    { label: "Lot", value: String(t.lotSize ?? "—") },
    { label: "Hold", value: duration },
    { label: "R multiple", value: formatR(t.rMultiple ?? null), tone: tone(t.rMultiple) },
    { label: "P&L", value: t.pnl == null ? "Open" : money(t.pnl, tc), tone: tone(t.pnl) },
  ];
  if (t.commission != null) rows.push({ label: "Commission", value: money(t.commission, tc), tone: "muted" });
  if (t.swap != null) rows.push({ label: "Swap", value: money(t.swap, tc), tone: "muted" });
  return rows;
}

function pageList(cur: number, total: number): (number | "…")[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
  const out: (number | "…")[] = [1];
  const start = Math.max(2, cur - 1);
  const end = Math.min(total - 1, cur + 1);
  if (start > 2) out.push("…");
  for (let i = start; i <= end; i++) out.push(i);
  if (end < total - 1) out.push("…");
  out.push(total);
  return out;
}

/* ── halaman ── */
export default function TradesPage() {
  const [trades, setTrades] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);
  const [loading, setLoading] = useState(true);
  const [loaded, setLoaded] = useState(false);
  const [summary, setSummary] = useState<any>(null);
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [outcome, setOutcome] = useState("");
  const [direction, setDirection] = useState("");
  const [setupCat, setSetupCat] = useState("");
  const [range, setRange] = useState<DateRangeValue>({ key: "all", from: "", to: "" });
  const [accountId, setAccountId] = useState("");
  const [allowNoAccount, setAllowNoAccount] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [editTrade, setEditTrade] = useState<any>(null);
  const [expandedRow, setExpandedRow] = useState<string | null>(null);
  const [showDeleteAll, setShowDeleteAll] = useState(false);
  const [deletingAll, setDeletingAll] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [menu, setMenu] = useState<{ id: string; x: number; y: number } | null>(null);
  const reqId = useRef(0);

  // search di-debounce
  useEffect(() => {
    const t = setTimeout(() => { setSearch(searchInput); setPage(1); }, 250);
    return () => clearTimeout(t);
  }, [searchInput]);

  // fallback bila akun tidak pernah ter-set
  useEffect(() => {
    const t = setTimeout(() => setAllowNoAccount(true), 2500);
    return () => clearTimeout(t);
  }, []);

  // tutup menu titik tiga saat scroll / resize
  useEffect(() => {
    if (!menu) return;
    const close = () => setMenu(null);
    window.addEventListener("scroll", close, true);
    window.addEventListener("resize", close);
    return () => {
      window.removeEventListener("scroll", close, true);
      window.removeEventListener("resize", close);
    };
  }, [menu]);

  const buildParams = useCallback(() => {
    const p = new URLSearchParams();
    if (search) p.set("search", search);
    if (outcome) p.set("outcome", outcome);
    if (direction) p.set("direction", direction);
    if (setupCat) p.set("setupCategory", setupCat);
    if (accountId) p.set("accountId", accountId);
    if (range.from) p.set("from", range.from);
    if (range.to) p.set("to", range.to);
    return p;
  }, [search, outcome, direction, setupCat, accountId, range.from, range.to]);

  const fetchAll = useCallback(async () => {
    if (!accountId && !allowNoAccount) return;
    const id = ++reqId.current;
    setLoading(true);
    const base = buildParams();
    const list = new URLSearchParams(base);
    list.set("page", String(page));
    list.set("pageSize", String(pageSize));
    try {
      const [lr, sr] = await Promise.all([
        fetch(`/api/trades?${list}`),
        fetch(`/api/trades/summary?${base}`),
      ]);
      const ld = await lr.json();
      const sd = sr.ok ? await sr.json() : null;
      if (id !== reqId.current) return;
      setTrades(ld.trades ?? []);
      setTotal(ld.total ?? 0);
      setTotalPages(Math.max(1, ld.totalPages ?? 1));
      if (sd) setSummary(sd);
    } catch {
      if (id !== reqId.current) return;
      setTrades([]);
    } finally {
      if (id === reqId.current) { setLoading(false); setLoaded(true); }
    }
  }, [buildParams, page, pageSize, accountId, allowNoAccount]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  /* ringkasan: dari endpoint summary, fallback dari halaman yang tampil */
  const fallback = {
    total,
    accountTotal: total,
    netPnL: trades.reduce((s: number, t: any) => s + (t.pnl ?? 0), 0),
    wins: trades.filter((t: any) => t.outcome === "win").length,
    losses: trades.filter((t: any) => t.outcome === "loss").length,
    be: 0,
    winRate: 0,
    profitFactor: 0,
    currency: trades[0]?.account?.currency ?? "USD",
  };
  const sm = summary ?? fallback;
  const cur: string = sm.currency ?? "USD";
  const cTotal = useCountUp(sm.total ?? 0);
  const cNet = useCountUp(sm.netPnL ?? 0);
  const cWin = useCountUp(sm.winRate ?? 0);
  const cPF = useCountUp(Math.min(sm.profitFactor ?? 0, 999));
  const pfv: number = sm.profitFactor ?? 0;
  const netv: number = sm.netPnL ?? 0;
  const gross = (() => {
    if (!(pfv > 0 && pfv < 999) || Math.abs(pfv - 1) < 1e-6) return null;
    const gl = netv / (pfv - 1);
    return gl > 0 ? { gp: gl * pfv, gl } : null;
  })();
  const openCount = summary ? Math.max(0, (sm.total ?? 0) - (sm.wins ?? 0) - (sm.losses ?? 0) - (sm.be ?? 0)) : 0;
  const filtersActive = !!(search || outcome || direction || setupCat || range.key !== "all");

  function resetPage<T>(setter: (v: T) => void, v: T) { setter(v); setPage(1); }

  async function deleteAllTrades() {
    if (!accountId) return;
    setDeletingAll(true);
    await fetch(`/api/trades/all?accountId=${accountId}`, { method: "DELETE" });
    setDeletingAll(false);
    setShowDeleteAll(false);
    setPage(1);
    fetchAll();
  }

  async function deleteTrade(id: string) {
    setMenu(null);
    if (!confirm("Delete this trade?")) return;
    await fetch(`/api/trades/${id}`, { method: "DELETE" });
    fetchAll();
  }

  function openMenu(e: React.MouseEvent<HTMLButtonElement>, id: string) {
    e.stopPropagation();
    const r = e.currentTarget.getBoundingClientRect();
    const h = 132;
    const top = r.bottom + h > window.innerHeight ? r.top - h - 6 : r.bottom + 6;
    setMenu({ id, x: Math.max(8, r.right - 176), y: top });
  }

  async function exportCsv() {
    setExporting(true);
    try {
      const p = buildParams();
      p.set("page", "1");
      p.set("pageSize", "10000");
      const res = await fetch(`/api/trades?${p}`);
      const d = await res.json();
      const rows: any[] = d.trades ?? [];
      const esc = (v: any) => {
        const s = v == null ? "" : String(v);
        return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
      };
      const head = ["Date", "Symbol", "Side", "Entry", "Exit", "Lot", "Hold", "R", "P&L", "Setup", "Category", "Status", "Notes"];
      const lines = rows.map((t: any) => [
        new Date(t.entryDate).toISOString().slice(0, 16).replace("T", " "),
        t.symbol,
        t.direction,
        t.entryPrice,
        t.exitPrice ?? "",
        t.lotSize,
        t.exitDate ? getDurationString(new Date(t.entryDate), new Date(t.exitDate)) : "",
        t.rMultiple ?? "",
        t.pnl ?? "",
        t.setup?.name ?? "",
        t.setupCategory ?? "",
        t.outcome ?? "open",
        t.notes ?? "",
      ].map(esc).join(","));
      const csv = "\uFEFF" + [head.join(","), ...lines].join("\n");
      const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `trade-log-${format(new Date(), "yyyy-MM-dd")}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } finally {
      setExporting(false);
    }
  }

  const rangeFrom = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const rangeTo = Math.min(page * pageSize, total);
  const menuTrade = menu ? trades.find((x: any) => x.id === menu.id) : null;

  return (
    <div className={cn(PAGE, "relative isolate gap-5")}>

      {/* ── Header ── */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className={H1}>Trade Log</h1>
            <AccountSwitcher value={accountId} onChange={(id) => { setAccountId(id); setPage(1); }} />
          </div>
          <p className={SUB}>
            Riwayat seluruh transaksi trading Anda secara detail dan terstruktur
          </p>
        </div>
        <div className="flex items-center gap-2.5 flex-wrap">
          <button onClick={() => setShowDeleteAll(true)}
            className={cn(BTN, "border border-red-500/50 text-red-500 dark:text-[#f87171] hover:bg-red-500/10 transition-colors")}>
            <Trash2 className="w-4 h-4" /> Delete All
          </button>
          <button onClick={() => setShowImport(true)}
            className={cn(BTN, BTN_O)}>
            <Upload className="w-4 h-4" /> Import CSV
          </button>
          <button onClick={() => { setEditTrade(null); setShowForm(true); }}
            className={cn(BTN, "transition-all", BTN_PRIMARY)}>
            <Plus className="w-4 h-4" /> Add Trade
          </button>
        </div>
      </div>

      {/* ── Filter ── */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative shrink-0">
          <Search className="w-4 h-4 absolute left-[13px] top-1/2 -translate-y-1/2 text-muted-foreground dark:text-[#8a94c4]" />
          <input value={searchInput} onChange={(e) => setSearchInput(e.target.value.toUpperCase())}
            placeholder="Cari simbol..."
            className="h-10 w-[170px] text-[13px] font-medium pl-[38px] pr-3.5 rounded-xl border border-border dark:border-white/10 bg-transparent dark:bg-white/[0.04] focus:outline-none focus:border-[#4f6bff]/60 focus:ring-4 focus:ring-[#4f6bff]/15 transition-all" />
        </div>
        <div className="hidden md:block w-px h-5 bg-border dark:bg-white/10 mx-1" />
        {OUTCOME_FILTERS.map((f) => (
          <button key={f.value} onClick={() => resetPage(setOutcome, f.value)}
            className={cn(FP, outcome === f.value ? PILL_ON : PILL_OFF)}>
            {f.label}
          </button>
        ))}
        <div className="hidden md:block w-px h-5 bg-border dark:bg-white/10 mx-1" />
        {DIR_FILTERS.map((f) => (
          <button key={f.value} onClick={() => resetPage(setDirection, direction === f.value ? "" : f.value)}
            className={cn(FP, direction === f.value ? PILL_ON : PILL_OFF)}>
            {f.label}
          </button>
        ))}
        <div className="hidden md:block w-px h-5 bg-border dark:bg-white/10 mx-1" />
        <span className={cn(CAP, "mr-0.5")}>Setup:</span>
        {SETUP_CATS.map((cat) => (
          <button key={cat} onClick={() => resetPage(setSetupCat, setupCat === cat ? "" : cat)}
            className={cn(FP, setupCat === cat ? PILL_ON : PILL_OFF)}>
            {cat}
          </button>
        ))}
        <div className="ml-auto">
          <DateRange value={range} onChange={(r) => { setRange(r); setPage(1); }} />
        </div>
      </div>

      {/* ── Kartu statistik ── */}
      {!loaded ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
          {[0, 1, 2, 3].map((i) => <div key={i} className="skeleton h-[104px] rounded-[18px]" />)}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 stagger">
          <HoverTip block side="bottom" align="left" className="h-full" title="Total Trades"
            rows={[
              { label: "Ditampilkan", value: String(sm.total ?? 0) },
              { label: "Win", value: String(sm.wins ?? 0), tone: "win" },
              { label: "Loss", value: String(sm.losses ?? 0), tone: "loss" },
              { label: "Break-even", value: String(sm.be ?? 0), tone: "muted" },
              ...(summary ? [{ label: "Open", value: String(openCount), tone: "muted" as const }] : []),
            ]}
            note="Jumlah trade sesuai filter aktif.">
          <div className={cn(PANEL, "card-hover h-full min-h-[104px] px-[22px] py-5 flex items-center gap-4 rounded-[18px]")}>
            <IconTile><BarChart3 className="w-5 h-5" /></IconTile>
            <div className="min-w-0">
              <p className="text-xs font-medium text-muted-foreground dark:text-[#8a94c4]">Total Trades</p>
              <p className="mt-1 text-[30px] font-extrabold tracking-[-0.02em] leading-[1.1] tabular-nums">{Math.round(cTotal)} <span className="text-[15px] font-semibold text-muted-foreground dark:text-[#8a94c4]">trades</span></p>
              {filtersActive && sm.accountTotal !== sm.total && (
                <p className="text-[11px] text-muted-foreground dark:text-[#8a94c4] mt-0.5">dari {sm.accountTotal} di akun</p>
              )}
            </div>
          </div>
          </HoverTip>

          <HoverTip block side="bottom" align="center" className="h-full" title="Net P&L"
            rows={[
              ...(gross ? [
                { label: "Gross profit", value: formatCurrency(gross.gp, cur), tone: "win" as const },
                { label: "Gross loss", value: formatCurrency(-gross.gl, cur), tone: "loss" as const },
              ] : []),
              { label: "Net P&L", value: formatCurrency(netv, cur), tone: tone(netv) },
              { label: "Rata-rata / trade", value: (sm.total ?? 0) > 0 ? formatCurrency(netv / sm.total, cur) : "—", tone: tone(netv) },
            ]}
            note="Gross profit − gross loss dari seluruh trade pada filter ini.">
          <div className={cn(PANEL, "card-hover h-full min-h-[104px] px-[22px] py-5 flex items-center gap-4 rounded-[18px]")}>
            <IconTile><TrendingUp className="w-5 h-5" /></IconTile>
            <div className="min-w-0">
              <p className="text-xs font-medium text-muted-foreground dark:text-[#8a94c4]">Net P&L</p>
              <p className={cn("mt-1 text-[30px] font-extrabold tracking-[-0.02em] leading-[1.1] tabular-nums truncate", (sm.netPnL ?? 0) >= 0 ? WIN : LOSS)}>
                {formatCurrency(cNet, cur)}
              </p>
            </div>
          </div>
          </HoverTip>

          <HoverTip block side="bottom" align="center" className="h-full" title="Win Rate"
            rows={[
              { label: "Win", value: String(sm.wins ?? 0), tone: "win" },
              { label: "Loss", value: String(sm.losses ?? 0), tone: "loss" },
              { label: "Break-even", value: String(sm.be ?? 0), tone: "muted" },
              { label: "Win rate", value: `${(sm.winRate ?? 0).toFixed(1)}%` },
            ]}
            note="Win ÷ (Win + Loss + B/E) dari trade yang sudah selesai.">
          <div className={cn(PANEL, "card-hover h-full min-h-[104px] px-[22px] py-5 flex items-center gap-4 rounded-[18px]")}>
            <WinRing pct={sm.winRate ?? 0} />
            <div className="min-w-0">
              <p className="text-xs font-medium text-muted-foreground dark:text-[#8a94c4]">Win Rate</p>
              <p className="mt-1 text-[30px] font-extrabold tracking-[-0.02em] leading-[1.1] tabular-nums">{cWin.toFixed(1)}%</p>
              <p className="text-[11px] text-muted-foreground dark:text-[#8a94c4] mt-0.5">{sm.wins ?? 0}W · {sm.losses ?? 0}L{(sm.be ?? 0) > 0 ? ` · ${sm.be}BE` : ""}</p>
            </div>
          </div>
          </HoverTip>

          <HoverTip block side="bottom" align="right" className="h-full" title="Profit Factor"
            rows={[
              ...(gross ? [
                { label: "Gross profit", value: formatCurrency(gross.gp, cur), tone: "win" as const },
                { label: "Gross loss", value: formatCurrency(-gross.gl, cur), tone: "loss" as const },
              ] : []),
              { label: "Profit factor", value: pfv >= 999 ? "∞" : pfv.toFixed(2), tone: pfv >= 1 ? "win" : "loss" },
            ]}
            note="Gross profit ÷ gross loss. Di atas 1.0 berarti total keuntungan melebihi total kerugian.">
          <div className={cn(PANEL, "card-hover h-full min-h-[104px] px-[22px] py-5 flex items-center gap-4 rounded-[18px]")}>
            <IconTile><Trophy className="w-5 h-5" /></IconTile>
            <div className="min-w-0">
              <p className="text-xs font-medium text-muted-foreground dark:text-[#8a94c4]">Profit Factor</p>
              <p className={cn("mt-1 text-[30px] font-extrabold tracking-[-0.02em] leading-[1.1] tabular-nums", (sm.profitFactor ?? 0) >= 1 ? WIN : LOSS)}>
                {(sm.profitFactor ?? 0) >= 999 ? "∞" : cPF.toFixed(2)}
              </p>
            </div>
          </div>
          </HoverTip>
        </div>
      )}

      {/* ── Tabel ── */}
      <div className={PANEL}>
        <div className={cn("overflow-x-auto rounded-t-2xl transition-opacity duration-200", loading && loaded && "opacity-60")}>
          <table className="w-full min-w-[1080px] text-[13px]">
            <thead>
              <tr className="border-b border-border dark:border-[#7a8cff]/[0.14] bg-muted/40 dark:bg-[#0f1a45]/40">
                <th className={cn(TH, "text-left")}>Date</th>
                <th className={cn(TH, "text-left")}>Symbol</th>
                <th className={cn(TH, "text-left")}>Side</th>
                <th className={cn(TH, "text-right")}>Entry</th>
                <th className={cn(TH, "text-right")}>Exit</th>
                <th className={cn(TH, "text-right")}>Lot</th>
                <th className={cn(TH, "text-left")}>Hold</th>
                <th className={cn(TH, "text-right")}>R</th>
                <th className={cn(TH, "text-right")}>P&L</th>
                <th className={cn(TH, "text-left")}>Setup</th>
                <th className={cn(TH, "text-left")}>Cat.</th>
                <th className={cn(TH, "text-left")}>Status</th>
                <th className="w-12 px-2 py-[13px]"></th>
              </tr>
            </thead>
            <tbody>
              {!loaded ? (
                <tr>
                  <td colSpan={13} className="p-4">
                    <div className="space-y-2.5">
                      {Array.from({ length: 8 }, (_, i) => <div key={i} className="skeleton h-9 rounded-lg" />)}
                    </div>
                  </td>
                </tr>
              ) : trades.length === 0 ? (
                <tr>
                  <td colSpan={13} className="py-16 text-center">
                    <div className="mx-auto w-12 h-12 rounded-xl border border-[#3b5bff]/30 bg-[#2b3f9e]/20 flex items-center justify-center text-[#8ea2ff] mb-3">
                      <BarChart3 className="w-5 h-5" />
                    </div>
                    <p className="text-sm font-medium">{filtersActive ? "Tidak ada trade yang cocok dengan filter" : "Belum ada transaksi"}</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {filtersActive ? "Coba ubah atau reset filter di atas." : "Tambahkan trade pertama kamu atau import dari CSV."}
                    </p>
                  </td>
                </tr>
              ) : trades.map((t: any, idx: number) => {
                const duration = t.exitDate ? getDurationString(new Date(t.entryDate), new Date(t.exitDate)) : "—";
                const isExpanded = expandedRow === t.id;
                const tc: string = t.account?.currency ?? cur;
                const tipSide = idx < 2 ? "bottom" : "top";
                return (
                  <Fragment key={t.id}>
                    <tr
                      className={cn("group border-b border-border/60 dark:border-[#7a8cff]/[0.07] hover:bg-[#2a3a9f]/[0.16] cursor-pointer transition-colors duration-200 ease-out motion-reduce:transition-none",
                        isExpanded && "bg-[#2a3a9f]/[0.12] shadow-[inset_2px_0_0_0_#4f6bff]")}
                      onClick={() => setExpandedRow(isExpanded ? null : t.id)}
                    >
                      <td className="px-4 py-[15px] h-[52px] whitespace-nowrap transition-shadow duration-200 ease-out motion-reduce:transition-none group-hover:shadow-[inset_3px_0_0_0_#4f6bff]">
                        <div className={cn("flex items-center gap-2", isExpanded ? "text-foreground dark:text-[#dfe4ff]" : "text-muted-foreground dark:text-[#aab3df]")}>
                          <ChevronRight className={cn("w-3.5 h-3.5 shrink-0 transition-all", isExpanded ? "rotate-90 opacity-100 text-[#8ea2ff]" : "opacity-0 group-hover:opacity-70")} />
                          {formatDate(t.entryDate)}
                        </div>
                      </td>
                      <td className="px-4 py-[15px] font-bold">{t.symbol}</td>
                      <td className="px-4 py-[15px]">
                        <HoverTip side={tipSide} align="left" title={t.direction === "long" ? "Long (Buy)" : "Short (Sell)"}
                          rows={[
                            { label: "Entry", value: String(t.entryPrice ?? "—") },
                            { label: "Exit", value: String(t.exitPrice ?? "—") },
                            { label: "Lot", value: String(t.lotSize ?? "—") },
                          ]}
                          note={t.direction === "long" ? "Profit saat harga naik." : "Profit saat harga turun."}>
                          <SideBadge direction={t.direction} />
                        </HoverTip>
                      </td>
                      <td className="px-4 py-[15px] text-right font-mono tabular-nums">{t.entryPrice}</td>
                      <td className="px-4 py-[15px] text-right font-mono tabular-nums">{t.exitPrice ?? "—"}</td>
                      <td className="px-4 py-[15px] text-right font-mono tabular-nums">{t.lotSize}</td>
                      <td className="px-4 py-[15px] text-muted-foreground dark:text-[#aab3df] whitespace-nowrap">{duration}</td>
                      <td className="px-4 py-[15px] text-right">
                        <span className={cn("font-mono font-medium tabular-nums",
                          (t.rMultiple ?? 0) > 0 ? WIN : (t.rMultiple ?? 0) < 0 ? LOSS : "text-muted-foreground")}>
                          {formatR(t.rMultiple)}
                        </span>
                      </td>
                      <td className="px-4 py-[15px] text-right whitespace-nowrap">
                        {t.pnl == null ? <PnLPill value={t.pnl} currency={tc} /> : (
                          <HoverTip side={tipSide} title={`${t.symbol} · P&L`} rows={tradeRows(t, tc, duration)}>
                            <PnLPill value={t.pnl} currency={tc} />
                          </HoverTip>
                        )}
                      </td>
                      <td className="px-4 py-[15px]">
                        {t.setup
                          ? <span className="text-[11px] font-semibold px-2 py-[3px] rounded-md bg-muted text-muted-foreground border">{t.setup.name}</span>
                          : <span className="text-muted-foreground">—</span>}
                      </td>
                      <td className="px-4 py-[15px]"><SetupCatBadge cat={t.setupCategory} /></td>
                      <td className="px-4 py-[15px]">
                        <HoverTip side={tipSide} align="right" title={`Status · ${t.outcome ? ({ win: "Win", loss: "Loss", breakeven: "Break-even" } as Record<string, string>)[t.outcome] ?? t.outcome : "Open"}`}
                          rows={[
                            { label: "Hold", value: duration },
                            { label: "R multiple", value: formatR(t.rMultiple ?? null), tone: tone(t.rMultiple) },
                            { label: "P&L", value: t.pnl == null ? "Open" : money(t.pnl, tc), tone: tone(t.pnl) },
                          ]}
                          note={t.outcome ? "Hasil trade yang sudah ditutup." : "Trade belum ditutup."}>
                          <StatusBadge outcome={t.outcome} />
                        </HoverTip>
                      </td>
                      <td className="px-2 py-[15px]">
                        <button onClick={(e) => openMenu(e, t.id)} aria-label="Aksi"
                          className="w-8 h-8 rounded-[9px] flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-secondary dark:hover:bg-white/10 transition-colors">
                          <MoreVertical className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                    {isExpanded && (
                      <tr className="border-b border-border/60 dark:border-[#7a8cff]/[0.07] bg-muted/30 dark:bg-[#0f1a45]/35">
                        <td colSpan={13} className="px-6 pt-5 pb-[22px] whitespace-normal">
                          <div className="flex flex-wrap gap-7 text-xs">
                            <div className="flex-1 basis-[320px] min-w-0">
                              <p className={SEC}>Notes & Analysis</p>
                              {t.notes
                                ? <p className="text-[13px] text-foreground/90 dark:text-[#cdd4f5] leading-[1.65]">{t.notes}</p>
                                : <p className="text-muted-foreground italic">No notes for this trade.</p>}
                            </div>
                            {t.tags && t.tags.length > 0 && (
                              <div className="shrink-0">
                                <p className={SEC}>Tags</p>
                                <div className="flex gap-1 flex-wrap">
                                  {t.tags.map((tag: string) => (
                                    <span key={tag} className="text-[11px] font-bold px-[9px] py-[3px] rounded-full bg-indigo-100 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800">{tag}</span>
                                  ))}
                                </div>
                              </div>
                            )}
                            {t.mood && (
                              <div className="shrink-0">
                                <p className={SEC}>Mood</p>
                                <span className="text-lg">{MOODS[t.mood - 1]}</span>
                              </div>
                            )}
                            {(t.screenshotBefore || t.screenshotAfter) && (
                              <div className="shrink-0">
                                <p className={SEC}>Screenshots</p>
                                <div className="flex gap-2">
                                  {t.screenshotBefore && (
                                    <div className="text-center">
                                      <img src={t.screenshotBefore} alt="Before" className="w-24 h-16 object-cover rounded-lg border cursor-pointer hover:opacity-80 transition-opacity" onClick={() => window.open(t.screenshotBefore, "_blank")} />
                                      <p className="text-[11px] text-muted-foreground dark:text-[#8a94c4] mt-0.5">Before</p>
                                    </div>
                                  )}
                                  {t.screenshotAfter && (
                                    <div className="text-center">
                                      <img src={t.screenshotAfter} alt="After" className="w-24 h-16 object-cover rounded-lg border cursor-pointer hover:opacity-80 transition-opacity" onClick={() => window.open(t.screenshotAfter, "_blank")} />
                                      <p className="text-[11px] text-muted-foreground dark:text-[#8a94c4] mt-0.5">After</p>
                                    </div>
                                  )}
                                </div>
                              </div>
                            )}
                          </div>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* ── Footer ── */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border dark:border-[#7a8cff]/[0.14] px-5 py-3.5">
          <span className={CAP}>
            {total === 0 ? "Menampilkan 0 transaksi" : `Menampilkan ${rangeFrom}–${rangeTo} dari ${total} transaksi`}
          </span>

          <div className="flex items-center gap-1.5">
            <button disabled={page === 1} onClick={() => setPage(page - 1)} aria-label="Sebelumnya"
              className="w-9 h-9 rounded-[10px] border border-border dark:border-white/10 flex items-center justify-center disabled:opacity-30 hover:border-[#4f6bff]/50 hover:bg-[#4f6bff]/10 transition-colors">
              <ChevronLeft className="w-4 h-4" />
            </button>
            {pageList(page, totalPages).map((p, i) =>
              p === "…" ? (
                <span key={`e${i}`} className={cn(CAP, "w-6 text-center")}>…</span>
              ) : (
                <button key={p} onClick={() => setPage(p)}
                  className={cn("w-9 h-9 rounded-[10px] border text-xs font-semibold transition-all", page === p ? PILL_ON : PILL_OFF)}>
                  {p}
                </button>
              )
            )}
            <button disabled={page === totalPages} onClick={() => setPage(page + 1)} aria-label="Berikutnya"
              className="w-9 h-9 rounded-[10px] border border-border dark:border-white/10 flex items-center justify-center disabled:opacity-30 hover:border-[#4f6bff]/50 hover:bg-[#4f6bff]/10 transition-colors">
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          <div className="flex items-center gap-2">
            <select value={pageSize} onChange={(e) => { setPageSize(Number(e.target.value)); setPage(1); }}
              className="h-10 text-xs font-semibold rounded-xl border border-border dark:border-white/10 bg-background px-3.5 text-foreground dark:text-[#c7d0ff] focus:outline-none focus:border-[#4f6bff]/60">
              {PAGE_SIZES.map((n) => <option key={n} value={n}>{n} / halaman</option>)}
            </select>
            <button onClick={exportCsv} disabled={exporting || total === 0}
              className={cn(BTN, "border border-[#4f6bff]/50 text-[#3b57e8] dark:text-[#a5b4ff] hover:bg-[#4f6bff]/10 transition-colors disabled:opacity-40")}>
              <Download className="w-4 h-4" /> {exporting ? "Menyiapkan..." : "Export Laporan"}
            </button>
          </div>
        </div>
      </div>

      {/* ── Menu titik tiga ── */}
      {menu && menuTrade && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setMenu(null)} />
          <div className="fixed z-50 w-44 rounded-xl border py-1 shadow-2xl anim-pop"
            style={{ top: menu.y, left: menu.x, backgroundColor: "hsl(var(--card))" }}>
            <button onClick={() => { setEditTrade(menuTrade); setShowForm(true); setMenu(null); }}
              className="w-full flex items-center gap-2.5 px-3 py-2.5 text-xs hover:bg-muted transition-colors">
              <Pencil className="w-3.5 h-3.5 text-muted-foreground" /> Edit trade
            </button>
            <button onClick={() => { setExpandedRow(expandedRow === menuTrade.id ? null : menuTrade.id); setMenu(null); }}
              className="w-full flex items-center gap-2.5 px-3 py-2.5 text-xs hover:bg-muted transition-colors">
              <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" /> Lihat detail
            </button>
            <div className="my-1 border-t" />
            <button onClick={() => deleteTrade(menuTrade.id)}
              className="w-full flex items-center gap-2.5 px-3 py-2.5 text-xs text-red-500 hover:bg-red-500/10 transition-colors">
              <Trash2 className="w-3.5 h-3.5" /> Hapus
            </button>
          </div>
        </>
      )}

      {showForm && (
        <TradeFormModal trade={editTrade} onClose={() => setShowForm(false)} onSaved={() => { setShowForm(false); fetchAll(); }} />
      )}

      {/* ── Delete All ── */}
      {showDeleteAll && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={() => setShowDeleteAll(false)}>
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm anim-fade" />
          <div className="relative bg-card border rounded-2xl p-6 w-full max-w-sm shadow-2xl anim-pop" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-full bg-red-500/10 flex items-center justify-center">
                <Trash2 className="w-5 h-5 text-red-500" />
              </div>
              <div>
                <p className="text-sm font-semibold">Delete All Trades</p>
                <p className="text-xs text-muted-foreground">This action cannot be undone</p>
              </div>
            </div>
            <p className="text-xs text-muted-foreground mb-4">
              Seluruh <span className="font-semibold text-foreground">{sm.accountTotal ?? total} trades</span> di akun ini akan dihapus permanen, termasuk yang tidak tampil karena filter.
            </p>
            <div className="flex gap-2">
              <button onClick={() => setShowDeleteAll(false)} className="flex-1 py-2.5 text-xs border rounded-xl text-muted-foreground hover:bg-muted">Cancel</button>
              <button onClick={deleteAllTrades} disabled={deletingAll}
                className="flex-1 py-2.5 text-xs bg-red-600 text-white rounded-xl hover:bg-red-700 disabled:opacity-50 font-medium">
                {deletingAll ? "Deleting..." : "Delete All"}
              </button>
            </div>
          </div>
        </div>
      )}

      {showImport && (
        <ImportModal onClose={() => setShowImport(false)} onImported={() => { setShowImport(false); fetchAll(); }} />
      )}
    </div>
  );
}
