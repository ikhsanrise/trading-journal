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

/* ── tema navy ── */
const PANEL =
  "rounded-2xl border bg-card dark:border-[#27358a]/40 dark:bg-gradient-to-br dark:from-[#14204d]/55 dark:via-[#0c1330]/55 dark:to-[#0a1024]/70";
const BTN_PRIMARY =
  "bg-gradient-to-b from-[#4f6bff] to-[#2f4bd8] text-white shadow-[0_8px_24px_-8px_rgba(79,107,255,0.8)] hover:brightness-110";
const PILL_ON =
  "bg-gradient-to-b from-[#4f6bff] to-[#2f4bd8] text-white border-transparent shadow-[0_0_18px_-4px_rgba(79,107,255,0.75)]";
const PILL_OFF =
  "text-muted-foreground border-white/10 hover:text-foreground hover:border-[#4f6bff]/50 hover:bg-[#4f6bff]/10";

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
        className="flex items-center gap-2.5 text-xs px-3.5 py-2.5 rounded-xl border border-white/10 bg-white/[0.03] hover:border-[#4f6bff]/50 hover:bg-[#4f6bff]/10 transition-colors"
      >
        <CalendarDays className="w-4 h-4 text-[#8ea2ff]" />
        <span className="font-medium">{label}</span>
        <ChevronDown className={cn("w-3.5 h-3.5 text-muted-foreground transition-transform", open && "rotate-180")} />
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
      <svg viewBox="0 0 360 120" preserveAspectRatio="none" className="absolute right-0 top-8 w-[52%] h-[200px]"
        style={{ opacity: 0.5, WebkitMaskImage: "linear-gradient(to left, black 25%, transparent)", maskImage: "linear-gradient(to left, black 25%, transparent)" }}>
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
    <div className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0 border border-[#3b5bff]/30 bg-gradient-to-br from-[#2b3f9e]/50 to-[#13204f]/60 text-[#8ea2ff] shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]">
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
    <svg viewBox="0 0 64 64" className="w-12 h-12 shrink-0 -rotate-90" style={{ filter: "drop-shadow(0 0 6px rgba(79,107,255,0.55))" }}>
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
    <span className={cn("inline-flex items-center rounded-md border px-2 py-0.5 text-[11px] font-semibold",
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
    return <span className="inline-flex items-center rounded-md border border-white/10 bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground">Open</span>;
  }
  return <span className={cn("inline-flex items-center rounded-md border px-2 py-0.5 text-[11px] font-semibold", c.cls)}>{c.label}</span>;
}

function PnLPill({ value, currency }: { value: number | null; currency: string }) {
  if (value === null) return <span className="text-[11px] px-2 py-0.5 rounded-md bg-muted text-muted-foreground font-medium">Open</span>;
  if (value > 0) return <span className="text-[12px] font-semibold px-2.5 py-1 rounded-md bg-[#16a34a]/20 text-[#4ade80] tabular-nums">{formatCurrency(value, currency)}</span>;
  if (value < 0) return <span className="text-[12px] font-semibold px-2.5 py-1 rounded-md bg-[#dc2626]/20 text-[#f87171] tabular-nums">{formatCurrency(value, currency)}</span>;
  return <span className="text-[12px] font-semibold px-2.5 py-1 rounded-md bg-muted text-muted-foreground tabular-nums">{formatCurrency(0, currency)}</span>;
}

function SetupCatBadge({ cat }: { cat: string | null }) {
  if (!cat) return <span className="text-muted-foreground">—</span>;
  const colors: Record<string, string> = {
    "A++": "bg-indigo-100 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 border-indigo-300 dark:border-indigo-700",
    "A+": "bg-violet-100 dark:bg-violet-950 text-violet-700 dark:text-violet-300 border-violet-300 dark:border-violet-700",
    "A": "bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-300 border-blue-300 dark:border-blue-700",
    "B": "bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 border-zinc-300 dark:border-zinc-600",
  };
  return <span className={cn("text-[10px] font-bold px-1.5 py-0.5 rounded border", colors[cat] ?? "")}>{cat}</span>;
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
    <div className="relative isolate flex flex-col gap-4 p-4 md:p-6">
      <Backdrop />

      {/* ── Header ── */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-2xl md:text-3xl font-bold tracking-tight">Trade Log</h1>
            <AccountSwitcher value={accountId} onChange={(id) => { setAccountId(id); setPage(1); }} />
          </div>
          <p className="text-xs md:text-sm text-muted-foreground mt-1.5">
            Riwayat seluruh transaksi trading Anda secara detail dan terstruktur
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <button onClick={() => setShowDeleteAll(true)}
            className="flex items-center gap-1.5 text-xs font-medium px-3.5 py-2.5 rounded-xl border border-red-500/50 text-red-500 hover:bg-red-500/10 transition-colors">
            <Trash2 className="w-3.5 h-3.5" /> Delete All
          </button>
          <button onClick={() => setShowImport(true)}
            className="flex items-center gap-1.5 text-xs font-medium px-3.5 py-2.5 rounded-xl border border-white/15 text-foreground/80 hover:text-foreground hover:border-[#4f6bff]/50 hover:bg-[#4f6bff]/10 transition-colors">
            <Upload className="w-3.5 h-3.5" /> Import CSV
          </button>
          <button onClick={() => { setEditTrade(null); setShowForm(true); }}
            className={cn("flex items-center gap-1.5 text-xs font-semibold px-4 py-2.5 rounded-xl transition-all", BTN_PRIMARY)}>
            <Plus className="w-4 h-4" /> Add Trade
          </button>
        </div>
      </div>

      {/* ── Filter ── */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative shrink-0">
          <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input value={searchInput} onChange={(e) => setSearchInput(e.target.value.toUpperCase())}
            placeholder="Cari simbol..."
            className="text-xs pl-8 pr-3 py-2.5 rounded-xl border border-white/10 bg-white/[0.03] focus:outline-none focus:border-[#4f6bff]/60 focus:ring-4 focus:ring-[#4f6bff]/15 w-36 transition-all" />
        </div>
        <div className="hidden md:block w-px h-5 bg-white/10 mx-0.5" />
        {OUTCOME_FILTERS.map((f) => (
          <button key={f.value} onClick={() => resetPage(setOutcome, f.value)}
            className={cn("text-xs px-3.5 py-2 rounded-full border transition-all font-medium", outcome === f.value ? PILL_ON : PILL_OFF)}>
            {f.label}
          </button>
        ))}
        <div className="hidden md:block w-px h-5 bg-white/10 mx-0.5" />
        {DIR_FILTERS.map((f) => (
          <button key={f.value} onClick={() => resetPage(setDirection, direction === f.value ? "" : f.value)}
            className={cn("text-xs px-3.5 py-2 rounded-full border transition-all font-medium", direction === f.value ? PILL_ON : PILL_OFF)}>
            {f.label}
          </button>
        ))}
        <div className="hidden md:block w-px h-5 bg-white/10 mx-0.5" />
        <span className="text-xs text-muted-foreground">Setup:</span>
        {SETUP_CATS.map((cat) => (
          <button key={cat} onClick={() => resetPage(setSetupCat, setupCat === cat ? "" : cat)}
            className={cn("text-xs px-3.5 py-2 rounded-full border transition-all font-semibold", setupCat === cat ? PILL_ON : PILL_OFF)}>
            {cat}
          </button>
        ))}
        <div className="ml-auto">
          <DateRange value={range} onChange={(r) => { setRange(r); setPage(1); }} />
        </div>
      </div>

      {/* ── Kartu statistik ── */}
      {!loaded ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
          {[0, 1, 2, 3].map((i) => <div key={i} className="skeleton h-[96px] rounded-2xl" />)}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3 stagger">
          <div className={cn(PANEL, "card-hover p-4 flex items-center gap-4")}>
            <IconTile><BarChart3 className="w-5 h-5" /></IconTile>
            <div className="min-w-0">
              <p className="text-xs text-muted-foreground">Total Trades</p>
              <p className="text-2xl font-bold tracking-tight tabular-nums">{Math.round(cTotal)} <span className="text-base font-semibold text-muted-foreground">trades</span></p>
              {filtersActive && sm.accountTotal !== sm.total && (
                <p className="text-[10px] text-muted-foreground mt-0.5">dari {sm.accountTotal} di akun</p>
              )}
            </div>
          </div>

          <div className={cn(PANEL, "card-hover p-4 flex items-center gap-4")}>
            <IconTile><TrendingUp className="w-5 h-5" /></IconTile>
            <div className="min-w-0">
              <p className="text-xs text-muted-foreground">Net P&L</p>
              <p className={cn("text-2xl font-bold tracking-tight tabular-nums truncate", (sm.netPnL ?? 0) >= 0 ? "text-[#4ade80]" : "text-[#f87171]")}>
                {formatCurrency(cNet, cur)}
              </p>
            </div>
          </div>

          <div className={cn(PANEL, "card-hover p-4 flex items-center gap-4")}>
            <WinRing pct={sm.winRate ?? 0} />
            <div className="min-w-0">
              <p className="text-xs text-muted-foreground">Win Rate</p>
              <p className="text-2xl font-bold tracking-tight tabular-nums">{cWin.toFixed(1)}%</p>
              <p className="text-[10px] text-muted-foreground mt-0.5">{sm.wins ?? 0}W · {sm.losses ?? 0}L{(sm.be ?? 0) > 0 ? ` · ${sm.be}BE` : ""}</p>
            </div>
          </div>

          <div className={cn(PANEL, "card-hover p-4 flex items-center gap-4")}>
            <IconTile><Trophy className="w-5 h-5" /></IconTile>
            <div className="min-w-0">
              <p className="text-xs text-muted-foreground">Profit Factor</p>
              <p className={cn("text-2xl font-bold tracking-tight tabular-nums", (sm.profitFactor ?? 0) >= 1 ? "text-[#4ade80]" : "text-[#f87171]")}>
                {(sm.profitFactor ?? 0) >= 999 ? "∞" : cPF.toFixed(2)}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* ── Tabel ── */}
      <div className={cn(PANEL, "overflow-hidden")}>
        <div className={cn("overflow-x-auto transition-opacity duration-200", loading && loaded && "opacity-60")}>
          <table className="w-full min-w-[980px] text-[13px]">
            <thead>
              <tr className="border-b border-white/10 bg-[#0f1a45]/30 dark:bg-[#0f1a45]/40">
                <th className="text-left px-4 py-3.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground whitespace-nowrap">Date</th>
                <th className="text-left px-3 py-3.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Symbol</th>
                <th className="text-left px-3 py-3.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Side</th>
                <th className="text-right px-3 py-3.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Entry</th>
                <th className="text-right px-3 py-3.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Exit</th>
                <th className="text-right px-3 py-3.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Lot</th>
                <th className="text-left px-3 py-3.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Hold</th>
                <th className="text-right px-3 py-3.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">R</th>
                <th className="text-right px-3 py-3.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">P&L</th>
                <th className="text-left px-3 py-3.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Setup</th>
                <th className="text-left px-3 py-3.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Cat.</th>
                <th className="text-left px-3 py-3.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Status</th>
                <th className="w-12 px-2 py-3.5"></th>
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
              ) : trades.map((t: any) => {
                const duration = t.exitDate ? getDurationString(new Date(t.entryDate), new Date(t.exitDate)) : "—";
                const isExpanded = expandedRow === t.id;
                const tc: string = t.account?.currency ?? cur;
                return (
                  <Fragment key={t.id}>
                    <tr
                      className="group border-b border-white/5 hover:bg-[#2a3a9f]/10 cursor-pointer transition-colors"
                      onClick={() => setExpandedRow(isExpanded ? null : t.id)}
                    >
                      <td className="px-4 py-3.5 whitespace-nowrap transition-shadow group-hover:shadow-[inset_2px_0_0_0_#4f6bff]">
                        <div className="flex items-center gap-2 text-muted-foreground">
                          <ChevronRight className={cn("w-3.5 h-3.5 transition-all", isExpanded ? "rotate-90 opacity-100 text-[#8ea2ff]" : "opacity-0 group-hover:opacity-70")} />
                          {formatDate(t.entryDate)}
                        </div>
                      </td>
                      <td className="px-3 py-3.5 font-semibold">{t.symbol}</td>
                      <td className="px-3 py-3.5"><SideBadge direction={t.direction} /></td>
                      <td className="px-3 py-3.5 text-right tabular-nums">{t.entryPrice}</td>
                      <td className="px-3 py-3.5 text-right tabular-nums">{t.exitPrice ?? "—"}</td>
                      <td className="px-3 py-3.5 text-right tabular-nums">{t.lotSize}</td>
                      <td className="px-3 py-3.5 text-muted-foreground whitespace-nowrap">{duration}</td>
                      <td className="px-3 py-3.5 text-right">
                        <span className={cn("font-medium tabular-nums",
                          (t.rMultiple ?? 0) > 0 ? "text-[#4ade80]" : (t.rMultiple ?? 0) < 0 ? "text-[#f87171]" : "text-muted-foreground")}>
                          {formatR(t.rMultiple)}
                        </span>
                      </td>
                      <td className="px-3 py-3.5 text-right whitespace-nowrap"><PnLPill value={t.pnl} currency={tc} /></td>
                      <td className="px-3 py-3.5">
                        {t.setup
                          ? <span className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground border">{t.setup.name}</span>
                          : <span className="text-muted-foreground">—</span>}
                      </td>
                      <td className="px-3 py-3.5"><SetupCatBadge cat={t.setupCategory} /></td>
                      <td className="px-3 py-3.5"><StatusBadge outcome={t.outcome} /></td>
                      <td className="px-2 py-3.5">
                        <button onClick={(e) => openMenu(e, t.id)} aria-label="Aksi"
                          className="w-8 h-8 rounded-lg flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-white/10 transition-colors">
                          <MoreVertical className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                    {isExpanded && (
                      <tr className="border-b border-white/5 bg-[#0f1a45]/20">
                        <td colSpan={13} className="px-5 py-4">
                          <div className="flex gap-6 text-xs">
                            <div className="flex-1">
                              <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider mb-1">Notes & Analysis</p>
                              {t.notes
                                ? <p className="text-foreground leading-relaxed">{t.notes}</p>
                                : <p className="text-muted-foreground italic">No notes for this trade.</p>}
                            </div>
                            {t.tags && t.tags.length > 0 && (
                              <div className="shrink-0">
                                <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider mb-1">Tags</p>
                                <div className="flex gap-1 flex-wrap">
                                  {t.tags.map((tag: string) => (
                                    <span key={tag} className="text-[10px] px-2 py-0.5 rounded-full bg-indigo-100 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800">{tag}</span>
                                  ))}
                                </div>
                              </div>
                            )}
                            {t.mood && (
                              <div className="shrink-0">
                                <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider mb-1">Mood</p>
                                <span className="text-lg">{MOODS[t.mood - 1]}</span>
                              </div>
                            )}
                            {(t.screenshotBefore || t.screenshotAfter) && (
                              <div className="shrink-0">
                                <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider mb-1">Screenshots</p>
                                <div className="flex gap-2">
                                  {t.screenshotBefore && (
                                    <div className="text-center">
                                      <img src={t.screenshotBefore} alt="Before" className="w-24 h-16 object-cover rounded-lg border cursor-pointer hover:opacity-80 transition-opacity" onClick={() => window.open(t.screenshotBefore, "_blank")} />
                                      <p className="text-[10px] text-muted-foreground mt-0.5">Before</p>
                                    </div>
                                  )}
                                  {t.screenshotAfter && (
                                    <div className="text-center">
                                      <img src={t.screenshotAfter} alt="After" className="w-24 h-16 object-cover rounded-lg border cursor-pointer hover:opacity-80 transition-opacity" onClick={() => window.open(t.screenshotAfter, "_blank")} />
                                      <p className="text-[10px] text-muted-foreground mt-0.5">After</p>
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
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-white/10 px-4 py-3">
          <span className="text-xs text-muted-foreground">
            {total === 0 ? "Menampilkan 0 transaksi" : `Menampilkan ${rangeFrom}–${rangeTo} dari ${total} transaksi`}
          </span>

          <div className="flex items-center gap-1.5">
            <button disabled={page === 1} onClick={() => setPage(page - 1)} aria-label="Sebelumnya"
              className="w-9 h-9 rounded-lg border border-white/10 flex items-center justify-center disabled:opacity-30 hover:border-[#4f6bff]/50 hover:bg-[#4f6bff]/10 transition-colors">
              <ChevronLeft className="w-4 h-4" />
            </button>
            {pageList(page, totalPages).map((p, i) =>
              p === "…" ? (
                <span key={`e${i}`} className="w-6 text-center text-xs text-muted-foreground">…</span>
              ) : (
                <button key={p} onClick={() => setPage(p)}
                  className={cn("w-9 h-9 rounded-lg border text-xs font-medium transition-all", page === p ? PILL_ON : PILL_OFF)}>
                  {p}
                </button>
              )
            )}
            <button disabled={page === totalPages} onClick={() => setPage(page + 1)} aria-label="Berikutnya"
              className="w-9 h-9 rounded-lg border border-white/10 flex items-center justify-center disabled:opacity-30 hover:border-[#4f6bff]/50 hover:bg-[#4f6bff]/10 transition-colors">
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          <div className="flex items-center gap-2">
            <select value={pageSize} onChange={(e) => { setPageSize(Number(e.target.value)); setPage(1); }}
              className="text-xs rounded-lg border border-white/10 bg-background px-2.5 py-2.5 focus:outline-none focus:border-[#4f6bff]/60">
              {PAGE_SIZES.map((n) => <option key={n} value={n}>{n} / halaman</option>)}
            </select>
            <button onClick={exportCsv} disabled={exporting || total === 0}
              className="flex items-center gap-2 text-xs font-medium px-4 py-2.5 rounded-xl border border-[#4f6bff]/50 text-[#a5b4ff] hover:bg-[#4f6bff]/10 transition-colors disabled:opacity-40">
              <Download className="w-3.5 h-3.5" /> {exporting ? "Menyiapkan..." : "Export Laporan"}
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
