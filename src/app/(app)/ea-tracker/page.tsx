"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Upload, Plus, Pencil, ChevronLeft, ChevronRight, Trash2, Bot } from "lucide-react";
import { HoverTip, TipRow } from "@/components/ui/HoverTip";
import AccountDialog, { EaAcc } from "@/components/ea/AccountDialog";
import UploadDialog from "@/components/ea/UploadDialog";
import { cn } from "@/lib/utils";
import { PANEL, BTN_PRIMARY, PAGE, H1, SUB, H2, CAP, LABEL, TABS, TAB, TAB_ON, WIN, LOSS } from "@/lib/theme";
import { makeFmt, Cur } from "@/lib/ea-fmt";
import {
  DayRow, FlowRow, Series, Pt, buildSeries, mergeDays, addDays, mondayOf, daysInMonth, fmtDate,
  dayLabel, dayLabelLong, dayShort, BULAN, BULAN_PANJANG, toDate,
} from "@/lib/ea-calc";

type RangeId = "7d" | "1m" | "3m" | "all";
const RANGES: { id: RangeId; label: string; days: number }[] = [
  { id: "7d", label: "7H", days: 7 },
  { id: "1m", label: "1B", days: 30 },
  { id: "3m", label: "3B", days: 90 },
  { id: "all", label: "Semua", days: 0 },
];
const CUR_KEY = "tj-ea-cur";
const TIP_ROW = "dark:bg-white/[0.04] dark:border-[#7a8cff]/16";
const INNER = "rounded-[14px] border bg-secondary/40 dark:bg-white/[0.04] dark:border-[#7a8cff]/16 p-3.5";
const GREEN = "#4ade80", RED = "#f87171", AMBER = "#facc15", MUTED = "#8a94c4";
const TILE = "transition-[transform,box-shadow,border-color] duration-200 ease-out hover:-translate-y-0.5 hover:border-[#5b74ff]/50 hover:shadow-[0_10px_26px_-12px_rgba(79,107,255,0.5)] motion-reduce:transform-none";
const tone = (v: number) => (v > 0 ? "text-emerald-600 dark:text-[#4ade80]" : v < 0 ? "text-red-600 dark:text-[#f87171]" : "");

const ageDays = (iso: string | null) => (iso ? Math.floor((Date.now() - new Date(iso).getTime()) / 86400000) : null);
const todayLocal = () => { const t = new Date(); return `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, "0")}-${String(t.getDate()).padStart(2, "0")}`; };

function statusOf(a: EaAcc) {
  const age = ageDays(a.lastUploadAt);
  if (age === null) return { text: "belum ada data", stale: true, short: "Belum ada" };
  if (age === 0) return { text: "update hari ini", stale: false, short: "Hari ini" };
  if (age >= 7) return { text: `update ${age} hari lalu, perlu update`, stale: true, short: `${age} hari lalu` };
  return { text: `update ${age} hari lalu`, stale: false, short: `${age} hari lalu` };
}

export default function EaTrackerPage() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [accId, setAccId] = useState("all");
  const [range, setRange] = useState<RangeId>("all");
  const [cur, setCur] = useState<Cur>("usd");
  const [calMode, setCalMode] = useState<"profit" | "dd">("profit");
  const [month, setMonth] = useState<{ y: number; m0: number } | null>(null);
  const [selDate, setSelDate] = useState<string | null>(null);
  const [upload, setUpload] = useState(false);
  const [accDlg, setAccDlg] = useState<{ edit: EaAcc | null } | null>(null);
  const [editRate, setEditRate] = useState(false);
  const [rateInput, setRateInput] = useState("");
  const [hov, setHov] = useState<number | null>(null);
  const [demoBusy, setDemoBusy] = useState(false);

  useEffect(() => { try { const v = localStorage.getItem(CUR_KEY); if (v === "usd" || v === "idr") setCur(v); } catch {} }, []);
  const chooseCur = (c: Cur) => { setCur(c); try { localStorage.setItem(CUR_KEY, c); } catch {} };

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/ea/data");
      if (!res.ok) throw new Error("Gagal memuat data");
      setData(await res.json());
      setError("");
    } catch (e: any) { setError(e.message ?? "Gagal memuat data"); }
    setLoading(false);
  }, []);
  useEffect(() => { load(); }, [load]);

  const accounts: EaAcc[] = data?.accounts ?? [];
  const rate: number = data?.rate ?? 16250;
  const fmt = useMemo(() => makeFmt(cur, rate), [cur, rate]);

  useEffect(() => { if (accId !== "all" && data && !accounts.some((a) => a.id === accId)) setAccId("all"); }, [data, accounts, accId]);

  const calc = useMemo(() => {
    if (!data) return null;
    const daily: Record<string, DayRow[]> = data.daily;
    const flowsAll: FlowRow[] = (data.flows as any[]).map((f) => ({ d: f.d, type: f.type, amount: f.amount, accountId: f.accountId }));
    const scope = accId === "all" ? accounts : accounts.filter((a) => a.id === accId);
    const scopeIds = new Set(scope.map((a) => a.id));
    const scopeFlows = flowsAll.filter((f) => scopeIds.has(f.accountId));
    const allDays = mergeDays(scope.map((a) => daily[a.id] ?? []));
    let globalLast = "";
    for (const a of accounts) { const arr = daily[a.id] ?? []; if (arr.length && arr[arr.length - 1].d > globalLast) globalLast = arr[arr.length - 1].d; }
    const r = RANGES.find((x) => x.id === range)!;
    const from = r.days && globalLast ? addDays(globalLast, -(r.days - 1)) : "";
    const inRange = (arr: DayRow[]) => (from ? arr.filter((x) => x.d >= from) : arr);
    const S = buildSeries(inRange(allDays), scopeFlows);
    const F = buildSeries(allDays, scopeFlows);
    const per: Record<string, { S: Series; F: Series; dep: number; wd: number }> = {};
    for (const a of accounts) {
      const fl = flowsAll.filter((f) => f.accountId === a.id);
      per[a.id] = {
        S: buildSeries(inRange(daily[a.id] ?? []), fl), F: buildSeries(daily[a.id] ?? [], fl),
        dep: fl.filter((f) => f.type === "deposit").reduce((s, f) => s + f.amount, 0),
        wd: fl.filter((f) => f.type === "withdraw").reduce((s, f) => s + f.amount, 0),
      };
    }
    const dep = scopeFlows.filter((f) => f.type === "deposit").reduce((s, f) => s + f.amount, 0);
    const wd = scopeFlows.filter((f) => f.type === "withdraw").reduce((s, f) => s + f.amount, 0);
    const dayN: Record<string, number> = {};
    for (const x of allDays) dayN[x.d] = x.n;
    const anchor = allDays.length ? allDays[allDays.length - 1].d : "";
    const allNet = mergeDays(accounts.map((a) => daily[a.id] ?? [])).reduce((s, x) => s + x.p, 0);
    return { scope, S, F, per, dep, wd, dayN, anchor, allNet, from, scopeFlows };
  }, [data, accId, range, accounts]);

  // bulan kalender dan hari terpilih mengikuti data terakhir
  useEffect(() => {
    if (!calc) return;
    if (!month) {
      const base = calc.anchor || todayLocal();
      const t = toDate(base);
      setMonth({ y: t.getUTCFullYear(), m0: t.getUTCMonth() });
    }
  }, [calc, month]);

  if (loading) return <div className={PAGE}><div className="h-9 w-48 rounded-lg bg-secondary/60 animate-pulse" /><div className="h-40 rounded-2xl bg-secondary/40 animate-pulse" /><div className="h-72 rounded-2xl bg-secondary/40 animate-pulse" /></div>;
  if (error || !data || !calc) return <div className={PAGE}><div className={cn(PANEL, "p-6 text-sm")}>{error || "Data tidak tersedia"} <button className="ml-2 underline" onClick={() => { setLoading(true); load(); }}>Coba lagi</button></div></div>;

  const { scope, S, F, per, dep, wd, dayN, anchor, allNet } = calc;
  const one = accId === "all" ? null : accounts.find((a) => a.id === accId) ?? null;
  const lastUpload = accounts.map((a) => a.lastUploadAt).filter(Boolean).sort().pop() ?? null;
  const staleCount = accounts.filter((a) => statusOf(a).stale).length;

  const afterSave = async (id?: string) => { setAccDlg(null); setUpload(false); await load(); if (id) setAccId(id); else if (accId !== "all" && one && !id) setAccId("all"); };

  async function saveRate() {
    const v = Number(rateInput.replace(/\./g, "").replace(",", "."));
    if (!Number.isFinite(v) || v < 1000) return;
    await fetch("/api/ea/settings", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ usdIdr: v }) });
    setEditRate(false);
    await load();
  }
  async function demo(on: boolean) {
    if (!on && !window.confirm("Hapus semua akun dan data contoh? Data aslimu tidak ikut terhapus.")) return;
    setDemoBusy(true);
    try { await fetch("/api/ea/demo", { method: on ? "POST" : "DELETE" }); setAccId("all"); setMonth(null); setSelDate(null); await load(); } finally { setDemoBusy(false); }
  }
  async function removeUpload(id: string, name: string) {
    if (!window.confirm(`Batalkan unggahan "${name}"? Trade dan arus dana dari unggahan ini akan dihapus.`)) return;
    await fetch(`/api/ea/upload?id=${id}`, { method: "DELETE" });
    await load();
  }

  // ── Tidak ada akun ──
  if (accounts.length === 0) {
    return (
      <div className={PAGE}>
        <div><h1 className={H1}>EA Tracker</h1><p className={SUB}>Pantau performa expert advisor dari laporan MT5 mingguan.</p></div>
        <div className={cn(PANEL, "p-10 flex flex-col items-center text-center gap-4")}>
          <div className="w-14 h-14 rounded-2xl bg-[#4f6bff]/15 text-[#4f6bff] dark:text-[#9db0ff] flex items-center justify-center"><Bot className="w-7 h-7" /></div>
          <h2 className={H2}>Belum ada akun EA</h2>
          <p className="max-w-md text-sm text-muted-foreground dark:text-[#8a94c4]">Tambahkan akun MT5 yang menjalankan EA, lalu unggah file CSV riwayat deal seminggu sekali.</p>
          <button type="button" onClick={() => setAccDlg({ edit: null })} className={cn("inline-flex items-center gap-2 h-11 px-5 rounded-xl text-sm font-bold", BTN_PRIMARY)}><Plus className="w-4 h-4" />Tambah akun EA</button>
          <button type="button" disabled={demoBusy} onClick={() => demo(true)} className="text-sm font-semibold text-[#3b57e8] dark:text-[#9db0ff] hover:underline disabled:opacity-50">{demoBusy ? "Membuat data contoh..." : "atau coba dengan data contoh"}</button>
        </div>
        {accDlg && <AccountDialog account={accDlg.edit} onClose={() => setAccDlg(null)} onSaved={afterSave} />}
      </div>
    );
  }

  const hasData = F.out.length > 0;
  const hasDemo = accounts.some((a) => a.name.startsWith("[Contoh]"));
  const pf = S.gl > 0 ? S.gw / S.gl : S.gw > 0 ? Infinity : 0;
  const winRate = S.trades ? Math.round((S.wins / S.trades) * 100) : 0;
  const balance = dep - wd + F.net;

  // ── Kartu KPI ──
  const kpis: { label: string; value: string; color: string; sub: string; tip: { title: string; rows: TipRow[]; note: string } }[] = [
    { label: "Net Profit", value: fmt.moneyS(S.net), color: tone(S.net), sub: dep > 0 ? `Return ${fmt.pctS(S.net / dep)} dari total deposit` : "Belum ada deposit tercatat",
      tip: { title: "Net Profit", rows: [{ label: "Profit periode", value: fmt.moneyS(S.net), tone: S.net >= 0 ? "win" : "loss" }, { label: "Total deposit", value: fmt.money(dep) }, { label: "Jumlah trade", value: String(S.trades) }], note: "Jumlah profit dan loss bersih (sudah termasuk komisi dan swap) pada periode terpilih." } },
    { label: "Saldo estimasi", value: fmt.money(balance), color: "", sub: "Deposit − withdraw + net profit",
      tip: { title: "Saldo estimasi", rows: [{ label: "Deposit", value: fmt.money(dep) }, { label: "Withdraw", value: "-" + fmt.money(wd).replace("-", "") }, { label: "Profit seluruh waktu", value: fmt.moneyS(F.net), tone: F.net >= 0 ? "win" : "loss" }], note: "Perkiraan dari data yang sudah diunggah. Bisa berbeda dari saldo MT5 bila ada posisi terbuka." } },
    { label: "Max Drawdown", value: fmt.money(S.minDD), color: "text-red-600 dark:text-[#f87171]", sub: hasData ? `${S.noBase ? "—" : fmt.pct(S.minPct)} dari modal · ${S.minDate ? dayLabel(S.minDate) : "—"}` : "—",
      tip: { title: "Max Drawdown", rows: [{ label: "Nominal", value: fmt.money(S.minDD), tone: "loss" }, { label: "Persentase", value: S.noBase ? "—" : fmt.pct(S.minPct), tone: "loss" }, { label: "Terjadi", value: S.minDate ? dayLabel(S.minDate) : "—" }], note: "Penurunan terdalam dari puncak kurva profit. Dihitung dari trade yang sudah ditutup, bukan equity floating." } },
    { label: "Avg Drawdown / hari", value: S.noBase ? "—" : fmt.pct(S.avg), color: "text-amber-500 dark:text-[#facc15]", sub: "Rata-rata kedalaman drawdown di akhir tiap hari trading",
      tip: { title: "Avg Drawdown / hari", rows: [{ label: "Rata-rata", value: S.noBase ? "—" : fmt.pct(S.avg) }, { label: "Hari trading", value: String(S.out.length) }], note: "Makin kecil makin baik. Hari yang tepat di puncak dihitung 0%." } },
    { label: "Profit Factor", value: pf === Infinity ? "∞" : pf.toFixed(2).replace(".", ","), color: pf >= 1 ? tone(1) : tone(-1), sub: `Win rate ${winRate}% · ${S.trades} trade`,
      tip: { title: "Profit Factor", rows: [{ label: "Gross profit", value: fmt.money(S.gw), tone: "win" }, { label: "Gross loss", value: "-" + fmt.money(S.gl).replace("-", ""), tone: "loss" }, { label: "Win rate", value: `${winRate}%` }], note: "Gross profit dibagi gross loss. Di atas 1 berarti strategi untung." } },
  ];

  // ── Earnings (selalu seluruh data, tidak ikut filter periode) ──
  const sumR = (from: string, to: string) => F.out.filter((o) => o.d >= from && o.d <= to).reduce((s, o) => s + o.p, 0);
  const dlt = (cur2: number, prev: number, lbl: string) => (prev === 0 ? "" : `${cur2 >= prev ? "naik" : "turun"} ${Math.abs(((cur2 - prev) / Math.abs(prev)) * 100).toFixed(0)}% vs ${lbl}`);
  let earn: { label: string; value: string; color: string; sub: string; rows: TipRow[] }[] = [];
  if (anchor) {
    const lastRec = F.byDate[anchor];
    const prevDay = F.out.length > 1 ? F.out[F.out.length - 2] : null;
    const wkFrom = mondayOf(anchor), wkTo = addDays(wkFrom, 6);
    const wk = sumR(wkFrom, wkTo), wkP = sumR(addDays(wkFrom, -7), addDays(wkFrom, -1));
    const at = toDate(anchor);
    const moFrom = `${anchor.slice(0, 8)}01`;
    const prevMonthEnd = addDays(moFrom, -1);
    const prevMonthFrom = `${prevMonthEnd.slice(0, 8)}01`;
    const prevSame = `${prevMonthEnd.slice(0, 8)}${String(Math.min(at.getUTCDate(), toDate(prevMonthEnd).getUTCDate())).padStart(2, "0")}`;
    const mo = sumR(moFrom, anchor), moP = sumR(prevMonthFrom, prevSame);
    earn = [
      { label: "Hari terakhir", value: fmt.moneyS(lastRec?.p ?? 0), color: tone(lastRec?.p ?? 0), sub: dayLabel(anchor) + (prevDay ? ` · sebelumnya ${fmt.compact(prevDay.p)}` : ""), rows: [{ label: "Tanggal", value: dayLabelLong(anchor) }, { label: "Profit", value: fmt.moneyS(lastRec?.p ?? 0), tone: (lastRec?.p ?? 0) >= 0 ? "win" : "loss" }] },
      { label: "Minggu ini", value: fmt.moneyS(wk), color: tone(wk), sub: `${dayShort(wkFrom)} – ${dayShort(wkTo)} · ${dlt(wk, wkP, "minggu lalu") || "belum ada pembanding"}`, rows: [{ label: "Minggu ini", value: fmt.moneyS(wk), tone: wk >= 0 ? "win" : "loss" }, { label: "Minggu lalu", value: fmt.moneyS(wkP), tone: wkP >= 0 ? "win" : "loss" }] },
      { label: "Bulan ini", value: fmt.moneyS(mo), color: tone(mo), sub: `${BULAN_PANJANG[at.getUTCMonth()]} · ${dlt(mo, moP, "bulan lalu") || "belum ada pembanding"}`, rows: [{ label: "Bulan ini", value: fmt.moneyS(mo), tone: mo >= 0 ? "win" : "loss" }, { label: "Bulan lalu (periode sama)", value: fmt.moneyS(moP), tone: moP >= 0 ? "win" : "loss" }] },
      { label: "Best day", value: fmt.moneyS(S.best?.p ?? 0), color: tone(1), sub: S.best ? dayLabel(S.best.d) : "—", rows: [{ label: "Tanggal", value: S.best ? dayLabelLong(S.best.d) : "—" }] },
      { label: "Worst day", value: fmt.moneyS(S.worst?.p ?? 0), color: tone(-1), sub: S.worst ? dayLabel(S.worst.d) : "—", rows: [{ label: "Tanggal", value: S.worst ? dayLabelLong(S.worst.d) : "—" }] },
    ];
  }

  // ── Grafik ──
  const W = 1000, H = 210, PAD = 14;
  const ref = S.out;
  const accLines = accId === "all" && ref.length
    ? accounts.map((a) => {
        const sa = per[a.id].S; let last = 0;
        return { a, v: ref.map((o) => { const r = sa.byDate[o.d]; if (r) last = r.cum; return last; }) };
      })
    : [];
  const eqVals = ref.map((o) => o.cum);
  let mn = 0, mx = 0;
  eqVals.forEach((v) => { if (v < mn) mn = v; if (v > mx) mx = v; });
  accLines.forEach((s) => s.v.forEach((v) => { if (v < mn) mn = v; if (v > mx) mx = v; }));
  if (mx === mn) mx = mn + 1;
  const yOf = (v: number) => H - PAD - ((v - mn) / (mx - mn)) * (H - 2 * PAD);
  const xOf = (i: number, n: number) => (n > 1 ? (i / (n - 1)) * W : W / 2);
  const lp = (vals: number[]) => vals.map((v, i) => `${i ? "L" : "M"}${xOf(i, vals.length).toFixed(1)} ${yOf(v).toFixed(1)}`).join(" ");
  const eqLine = lp(eqVals);
  const eqArea = ref.length ? `${eqLine} L${W} ${H} L0 ${H} Z` : "";
  const gridY = [0, 1, 2, 3].map((k) => mn + ((mx - mn) * k) / 3);
  const hovN = ref.length;
  const hi = hov !== null && hov < hovN ? hov : null;
  const hp = hi !== null ? ref[hi] : null;
  const hFrac = hi !== null ? (hovN > 1 ? hi / (hovN - 1) : 0.5) : 0;
  const onMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!hovN) return;
    const r = e.currentTarget.getBoundingClientRect();
    const f = Math.min(1, Math.max(0, (e.clientX - r.left) / r.width));
    setHov(hovN > 1 ? Math.round(f * (hovN - 1)) : 0);
  };
  const tipPos: React.CSSProperties = hFrac > 0.55 ? { left: `${hFrac * 100}%`, transform: "translateX(calc(-100% - 14px))" } : { left: `calc(${hFrac * 100}% + 14px)` };
  const ddY = (v: number) => (S.minPct === 0 ? 4 : 4 + (v / S.minPct) * 76);
  const ddArea = ref.length ? `M0 4 ${ref.map((o, i) => `L${xOf(i, ref.length).toFixed(1)} ${ddY(o.pct).toFixed(1)}`).join(" ")} L${W} 4 Z` : "";
  const xl: { left: string; t: string }[] = [];
  { let pm = -1; ref.forEach((o, i) => { const m0 = +o.d.slice(5, 7); if (m0 !== pm) { pm = m0; xl.push({ left: `${(xOf(i, ref.length) / 10).toFixed(1)}%`, t: BULAN[m0 - 1] }); } }); }

  // ── Kalender ──
  const mm = month ?? { y: toDate(anchor || todayLocal()).getUTCFullYear(), m0: toDate(anchor || todayLocal()).getUTCMonth() };
  const dim = daysInMonth(mm.y, mm.m0);
  const offset = (new Date(Date.UTC(mm.y, mm.m0, 1)).getUTCDay() + 6) % 7;
  const rows = Math.ceil((offset + dim) / 7);
  const mKey = `${mm.y}-${String(mm.m0 + 1).padStart(2, "0")}`;
  const monthPts = F.out.filter((o) => o.d.startsWith(mKey));
  const maxAbs = Math.max(0.0001, ...monthPts.map((o) => Math.abs(o.p)));
  const maxPct = Math.max(0.0001, ...monthPts.map((o) => Math.abs(o.pct)));
  const today = todayLocal();
  const selD = selDate && F.byDate[selDate] && selDate.startsWith(mKey) ? selDate : (monthPts.length ? monthPts[monthPts.length - 1].d : null);
  const stepMonth = (n: number) => { const t = new Date(Date.UTC(mm.y, mm.m0 + n, 1)); setMonth({ y: t.getUTCFullYear(), m0: t.getUTCMonth() }); setSelDate(null); };

  const dayCell = (dayNum: number) => {
    const date = `${mKey}-${String(dayNum).padStart(2, "0")}`;
    const rec = F.byDate[date];
    const sel = selD === date;
    const isToday = date === today;
    let cls = "border-border/60 bg-secondary/30 dark:border-[#7a8cff]/12 dark:bg-white/[0.03]";
    let style: React.CSSProperties | undefined; let val = ""; let fg = "";
    if (rec) {
      if (calMode === "profit") {
        const a = 0.1 + 0.34 * (Math.abs(rec.p) / maxAbs);
        style = { background: rec.p >= 0 ? `rgba(74,222,128,${a.toFixed(2)})` : `rgba(248,113,113,${a.toFixed(2)})`, borderColor: rec.p >= 0 ? "rgba(74,222,128,.35)" : "rgba(248,113,113,.35)" };
        fg = rec.p >= 0 ? "text-emerald-900 dark:text-[#c8fadb]" : "text-red-900 dark:text-[#fecaca]";
        val = fmt.compact(rec.p);
      } else {
        const a = 0.06 + 0.4 * (Math.abs(rec.pct) / maxPct);
        style = rec.pct === 0 ? { borderColor: "rgba(122,140,255,.16)" } : { background: `rgba(248,113,113,${a.toFixed(2)})`, borderColor: "rgba(248,113,113,.35)" };
        fg = rec.pct === 0 ? "text-muted-foreground" : "text-red-900 dark:text-[#fecaca]";
        val = S.noBase ? "—" : fmt.pct(rec.pct);
      }
    }
    if (isToday && !rec) val = "hari ini";
    const inner = (
      <button type="button" disabled={!rec} onClick={() => rec && setSelDate(date)}
        className={cn("w-full min-h-[68px] flex flex-col justify-between items-start text-left rounded-xl border px-2.5 py-2 transition-[transform,box-shadow,filter] duration-200 ease-out",
          cls, rec ? "cursor-pointer hover:scale-[1.03] hover:brightness-110 hover:shadow-[0_0_16px_rgba(79,107,255,0.45)] hover:z-20" : "cursor-default",
          sel && "!border-2 !border-[#9db0ff]", isToday && !sel && "!border-dashed !border-[#9db0ff]")} style={style}>
        <span className={cn("text-[11px] font-semibold", rec ? "text-foreground/80 dark:text-[#c3cbf0]" : "text-muted-foreground/70")}>{dayNum}</span>
        <span className={cn("font-mono text-xs font-bold tabular-nums", fg || "text-muted-foreground")}>{val}</span>
      </button>
    );
    if (!rec) return <div key={dayNum}>{inner}</div>;
    return (
      <HoverTip key={dayNum} block title={dayLabelLong(date)} rows={[
        { label: "Profit", value: fmt.moneyS(rec.p), tone: rec.p >= 0 ? "win" : "loss" },
        { label: "Drawdown", value: S.noBase ? "—" : fmt.pct(rec.pct), tone: rec.pct < 0 ? "loss" : "muted" },
        { label: "Trade", value: String(dayN[date] ?? 0) },
      ]} note="Klik untuk lihat rincian hari ini.">{inner}</HoverTip>
    );
  };

  const calCells: JSX.Element[] = [];
  for (let r = 0; r < rows; r++) {
    let wSum = 0, wCnt = 0, wMin = 0;
    for (let c = 0; c < 7; c++) {
      const dayNum = r * 7 + c - offset + 1;
      if (dayNum < 1 || dayNum > dim) { calCells.push(<div key={`e${r}-${c}`} />); continue; }
      calCells.push(dayCell(dayNum));
      const rec = F.byDate[`${mKey}-${String(dayNum).padStart(2, "0")}`];
      if (rec) { wSum += rec.p; wCnt++; if (rec.pct < wMin) wMin = rec.pct; }
    }
    const has = wCnt > 0;
    const good = calMode === "profit" && wSum >= 0;
    calCells.push(
      <HoverTip key={`w${r}`} block className="h-full" side="top" align="right" title={`Minggu ${r + 1}`} rows={has ? [{ label: "Total profit", value: fmt.moneyS(wSum), tone: wSum >= 0 ? "win" : "loss" }, { label: "Hari trading", value: String(wCnt) }, { label: "Drawdown terdalam", value: S.noBase ? "—" : fmt.pct(wMin), tone: "loss" }] : [{ label: "Status", value: "belum ada data", tone: "muted" }]}>
      <div className={cn("h-full min-h-[68px] flex flex-col justify-between rounded-xl border px-2.5 py-2",
        has ? (calMode === "profit" ? (good ? "bg-emerald-400/10 border-[#7a8cff]/35" : "bg-red-400/10 border-[#7a8cff]/35") : "bg-red-400/10 border-[#7a8cff]/35") : "bg-secondary/30 border-[#7a8cff]/20 dark:bg-white/[0.03]")}>
        <span className="text-[11px] font-bold text-[#3b57e8] dark:text-[#9db0ff]">Minggu {r + 1}</span>
        <span className={cn("font-mono text-xs font-bold tabular-nums", !has ? "text-muted-foreground" : calMode === "profit" ? (good ? "text-emerald-700 dark:text-[#c8fadb]" : "text-red-700 dark:text-[#fecaca]") : "text-red-700 dark:text-[#fecaca]")}>
          {!has ? "—" : calMode === "profit" ? fmt.compact(wSum) : S.noBase ? "—" : fmt.pct(wMin)}
        </span>
        <span className="text-[10.5px] text-muted-foreground dark:text-[#8a94c4]">{!has ? "belum ada data" : calMode === "profit" ? `${wCnt} hari trading` : "terdalam minggu ini"}</span>
      </div>
      </HoverTip>
    );
  }

  const selRec = selD ? F.byDate[selD] : null;
  const selRows = selD ? scope.map((a) => { const r = per[a.id].F.byDate[selD]; return r ? { a, r } : null; }).filter(Boolean) as { a: EaAcc; r: Pt }[] : [];

  // ── Arus dana ──
  const txs = (data.flows as any[]).filter((f) => accId === "all" || f.accountId === accId).slice().sort((a, b) => (a.d < b.d ? 1 : -1)).slice(0, 5);
  const accName = (id: string) => accounts.find((a) => a.id === id);
  const depW = Math.max(4, (dep / (dep + wd || 1)) * 100), wdW = Math.max(4, (wd / (dep + wd || 1)) * 100);

  const TIPS_NAV = "inline-flex items-center justify-center w-9 h-9 rounded-[10px] border border-border dark:border-[#7a8cff]/25 bg-secondary/40 dark:bg-white/[0.04] text-muted-foreground hover:text-foreground transition-colors";

  return (
    <div className={PAGE}>
      {/* Header */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-0">
          <h1 className={H1}>EA Tracker</h1>
          <p className={SUB}>Performa expert advisor dari laporan MT5 · {lastUpload ? `terakhir diunggah ${dayLabelLong(fmtDate(new Date(lastUpload)))}` : "belum ada unggahan"} · {accounts.length} akun EA · nilai dalam {cur === "usd" ? "USD" : "Rupiah"}</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <div className={TABS} role="group" aria-label="Mata uang tampilan">
            <button type="button" onClick={() => chooseCur("usd")} className={cn(TAB, cur === "usd" && TAB_ON)}>USD</button>
            <button type="button" onClick={() => chooseCur("idr")} className={cn(TAB, cur === "idr" && TAB_ON)}>Rp</button>
          </div>
          {editRate ? (
            <div className="flex items-center gap-2">
              <input autoFocus inputMode="numeric" value={rateInput} onChange={(e) => setRateInput(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") saveRate(); if (e.key === "Escape") setEditRate(false); }}
                aria-label="Kurs USD ke Rupiah" className="h-10 w-28 rounded-xl border border-[#7a8cff]/40 bg-secondary/40 dark:bg-white/5 px-3 text-sm font-mono outline-none focus:border-[#4f6bff]" />
              <button type="button" onClick={saveRate} className={cn("h-10 px-3 rounded-xl text-xs font-bold", BTN_PRIMARY)}>Simpan</button>
              <button type="button" onClick={() => setEditRate(false)} className="h-10 px-3 rounded-xl text-xs font-semibold text-muted-foreground">Batal</button>
            </div>
          ) : (
            <button type="button" onClick={() => { setRateInput(String(Math.round(rate))); setEditRate(true); }}
              className="flex items-center gap-2 h-[42px] px-3.5 rounded-xl border border-border dark:border-[#7a8cff]/25 bg-secondary/40 dark:bg-white/[0.04] text-[12.5px] font-semibold text-muted-foreground dark:text-[#c3cbf0] hover:border-[#7a8cff]/60 transition-colors">
              <span className="font-mono">Kurs 1 USD = Rp {makeFmt("usd", 1).grp(rate, 0)}</span><span className="font-bold text-[#3b57e8] dark:text-[#9db0ff]">Ubah</span>
            </button>
          )}
          <div className={TABS} role="group" aria-label="Periode">
            {RANGES.map((r) => <button key={r.id} type="button" onClick={() => setRange(r.id)} className={cn(TAB, range === r.id && TAB_ON)}>{r.label}</button>)}
          </div>
          <button type="button" onClick={() => setUpload(true)} className={cn("inline-flex items-center gap-2 h-11 px-[18px] rounded-xl text-sm font-bold", BTN_PRIMARY)}><Upload className="w-4 h-4" />Unggah Laporan</button>
        </div>
      </div>

      {/* Tab akun */}
      <div className="flex flex-wrap gap-2.5" role="tablist" aria-label="Pilih akun">
        {[{ id: "all", name: "Semua akun", color: "#ffffff", sub: `${accounts.length} akun digabung`, stale: false }, ...accounts.map((a) => { const st = statusOf(a); return { id: a.id, name: a.name, color: a.color, sub: `${a.symbol ? a.symbol + " · " : ""}${st.text}`, stale: st.stale }; })].map((t) => {
          const on = accId === t.id;
          return (
            <button key={t.id} type="button" role="tab" aria-selected={on} onClick={() => { setAccId(t.id); setSelDate(null); }}
              className={cn("flex items-center gap-2.5 text-left min-h-[52px] px-4 py-2.5 rounded-[14px] border transition-all duration-200 ease-out hover:-translate-y-px motion-reduce:transform-none",
                on ? "border-[#7a8cff] bg-[#4f6bff]/20" : "border-border bg-secondary/30 dark:border-[#7a8cff]/20 dark:bg-white/[0.04] hover:border-[#7a8cff]/60")}>
              <span className="w-2.5 h-2.5 rounded-full shrink-0 ring-1 ring-black/10" style={{ background: t.color }} />
              <span className="flex flex-col gap-0.5">
                <span className="text-sm font-bold">{t.name}</span>
                <span className={cn("text-[11.5px] font-medium", t.stale ? "text-amber-600 dark:text-[#facc15]" : "text-muted-foreground dark:text-[#8a94c4]")}>{t.sub}</span>
              </span>
            </button>
          );
        })}
        <button type="button" onClick={() => setAccDlg({ edit: null })} className="inline-flex items-center gap-2 min-h-[52px] px-4 rounded-[14px] border border-dashed border-[#7a8cff]/40 text-sm font-semibold text-[#3b57e8] dark:text-[#9db0ff] hover:bg-[#4f6bff]/10 transition-colors"><Plus className="w-4 h-4" />Akun</button>
        {one && <button type="button" onClick={() => setAccDlg({ edit: one })} aria-label={`Ubah ${one.name}`} className="inline-flex items-center gap-2 min-h-[52px] px-4 rounded-[14px] border border-border dark:border-[#7a8cff]/20 text-sm font-semibold text-muted-foreground hover:text-foreground transition-colors"><Pencil className="w-4 h-4" />Ubah</button>}
      </div>

      {hasDemo && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-[14px] border border-[#7a8cff]/30 bg-[#4f6bff]/10 px-4 py-3">
          <p className="text-[13px] text-foreground/80 dark:text-[#c3cbf0]">Kamu sedang melihat <b>data contoh</b> (akun berawalan [Contoh]). Aman dihapus kapan saja, data asli tidak ikut terhapus.</p>
          <button type="button" disabled={demoBusy} onClick={() => demo(false)} className="inline-flex items-center gap-2 h-9 px-3.5 rounded-xl border border-red-400/40 text-xs font-bold text-red-600 dark:text-[#f87171] hover:bg-red-400/10 transition-colors disabled:opacity-50"><Trash2 className="w-3.5 h-3.5" />{demoBusy ? "Menghapus..." : "Hapus data contoh"}</button>
        </div>
      )}

      {!hasData && (
        <div className={cn(PANEL, "p-8 flex flex-col items-center text-center gap-3")}>
          <h2 className={H2}>Belum ada trade untuk {one ? one.name : "akun ini"}</h2>
          <p className="max-w-md text-sm text-muted-foreground dark:text-[#8a94c4]">Unggah file CSV riwayat deal dari MT5 untuk mulai melihat performa.</p>
          <button type="button" onClick={() => setUpload(true)} className={cn("inline-flex items-center gap-2 h-11 px-5 rounded-xl text-sm font-bold", BTN_PRIMARY)}><Upload className="w-4 h-4" />Unggah Laporan</button>
        </div>
      )}

      {hasData && (
        <>
          {/* KPI */}
          <div className="grid grid-cols-[repeat(auto-fit,minmax(210px,1fr))] gap-4">
            {kpis.map((k) => (
              <HoverTip key={k.label} block className="h-full" side="bottom" {...k.tip}>
                <div className={cn(PANEL, "h-full p-[22px] flex flex-col gap-2")}>
                  <span className={LABEL}>{k.label}</span>
                  <span className={cn("font-mono text-[25px] font-bold tracking-[-0.03em] tabular-nums", k.color)}>{k.value}</span>
                  <span className="text-[12.5px] leading-snug text-muted-foreground dark:text-[#8a94c4]">{k.sub}</span>
                </div>
              </HoverTip>
            ))}
          </div>

          {/* Earnings */}
          <div className="grid grid-cols-[repeat(auto-fit,minmax(190px,1fr))] gap-4">
            {earn.map((e) => (
              <HoverTip key={e.label} block className="h-full" side="bottom" title={e.label} rows={e.rows}>
                <div className={cn(PANEL, "h-full px-5 py-[18px] flex flex-col gap-1.5")}>
                  <span className={LABEL}>{e.label}</span>
                  <span className={cn("font-mono text-xl font-bold tracking-[-0.02em] tabular-nums", e.color)}>{e.value}</span>
                  <span className="text-xs leading-snug text-muted-foreground dark:text-[#8a94c4]">{e.sub}</span>
                </div>
              </HoverTip>
            ))}
          </div>

          {/* Chart + Arus dana */}
          <div className="flex flex-wrap gap-4 items-stretch">
            <div className={cn(PANEL, "flex-[999_1_560px] min-w-0 p-[22px] flex flex-col gap-3.5")}>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div><h2 className={H2}>Ekuitas &amp; Drawdown</h2><p className={cn(CAP, "mt-1")}>Kumulatif P&amp;L trading. Deposit dan withdraw tidak ikut dihitung.</p></div>
                <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5">
                  {(accId === "all" ? accounts.map((a) => ({ n: a.name, c: a.color })) : []).concat([{ n: accId === "all" ? "Total" : one?.name ?? "", c: "#9db0ff" }]).map((l) => (
                    <span key={l.n} className="flex items-center gap-1.5 text-xs text-muted-foreground dark:text-[#c3cbf0]"><i className="inline-block w-3.5 h-[3px] rounded-sm" style={{ background: l.c }} />{l.n}</span>
                  ))}
                </div>
              </div>
              <div className="relative ml-14" style={{ height: H }}>
                <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className="block w-full" style={{ height: H }} role="img" aria-label="Kurva ekuitas kumulatif">
                  <defs><linearGradient id="eqg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#4f6bff" stopOpacity="0.32" /><stop offset="1" stopColor="#4f6bff" stopOpacity="0.02" /></linearGradient></defs>
                  {gridY.map((v, i) => <line key={i} x1="0" x2={W} y1={yOf(v)} y2={yOf(v)} stroke="rgba(122,140,255,0.13)" strokeDasharray="3 5" vectorEffect="non-scaling-stroke" />)}
                  <line x1="0" x2={W} y1={yOf(0)} y2={yOf(0)} stroke="rgba(165,180,255,0.4)" strokeDasharray="4 4" vectorEffect="non-scaling-stroke" />
                  <path d={eqArea} fill="url(#eqg)" />
                  {accLines.map((s) => <path key={s.a.id} d={lp(s.v)} fill="none" stroke={s.a.color} strokeWidth="1.5" opacity="0.85" vectorEffect="non-scaling-stroke" strokeLinejoin="round" />)}
                  <path d={eqLine} fill="none" stroke="#9db0ff" strokeWidth="2.6" vectorEffect="non-scaling-stroke" strokeLinejoin="round" strokeLinecap="round" />
                </svg>
                <div className="absolute inset-0 cursor-crosshair" onMouseMove={onMove} onMouseLeave={() => setHov(null)} />
                {hp && hi !== null && (
                  <>
                    <div className="pointer-events-none absolute top-0 bottom-0 w-px bg-[#9db0ff]/50" style={{ left: `${hFrac * 100}%` }} />
                    {accLines.map((l) => <span key={l.a.id} className="pointer-events-none absolute h-2 w-2 -translate-x-1/2 -translate-y-1/2 rounded-full ring-2 ring-[#0c1330]" style={{ left: `${hFrac * 100}%`, top: yOf(l.v[hi]), background: l.a.color }} />)}
                    <span className="pointer-events-none absolute h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full bg-[#9db0ff] ring-2 ring-[#0c1330] shadow-[0_0_12px_rgba(157,176,255,0.8)]" style={{ left: `${hFrac * 100}%`, top: yOf(hp.cum) }} />
                    <div className="pointer-events-none absolute top-0 z-40 w-max min-w-[170px] max-w-[260px] rounded-xl border border-[#7a8cff]/25 bg-[#0c1330]/95 px-3.5 py-3 shadow-[0_18px_40px_-12px_rgba(0,0,0,0.7)] backdrop-blur" style={tipPos}>
                      <p className="mb-1.5 text-xs font-bold text-white">{dayLabelLong(hp.d)}</p>
                      <div className="flex flex-col gap-1 text-[11.5px]">
                        <div className="flex justify-between gap-4"><span className="text-[#8a94c4]">Profit hari itu</span><b className={cn("font-mono tabular-nums", hp.p >= 0 ? "text-[#4ade80]" : "text-[#f87171]")}>{fmt.moneyS(hp.p)}</b></div>
                        <div className="flex justify-between gap-4"><span className="text-[#8a94c4]">{accId === "all" ? "Total kumulatif" : "Kumulatif"}</span><b className="font-mono tabular-nums text-[#e8ecff]">{fmt.moneyS(hp.cum)}</b></div>
                        <div className="flex justify-between gap-4"><span className="text-[#8a94c4]">Drawdown</span><b className="font-mono tabular-nums text-[#f87171]">{S.noBase ? "—" : fmt.pct(hp.pct)}</b></div>
                        {accLines.length > 0 && <div className="mt-1 flex flex-col gap-1 border-t border-[#7a8cff]/15 pt-1.5">
                          {accLines.map((l) => <div key={l.a.id} className="flex items-center justify-between gap-4"><span className="flex items-center gap-1.5 text-[#8a94c4]"><i className="inline-block h-2 w-2 rounded-full" style={{ background: l.a.color }} />{l.a.name.replace("[Contoh] ", "")}</span><b className="font-mono tabular-nums text-[#e8ecff]">{fmt.moneyS(l.v[hi])}</b></div>)}
                        </div>}
                      </div>
                    </div>
                  </>
                )}
                {gridY.map((v, i) => <span key={i} className="absolute -left-14 font-mono text-[11px] tabular-nums text-muted-foreground dark:text-[#8a94c4] -translate-y-1/2" style={{ top: yOf(v) }}>{fmt.compact(v)}</span>)}
              </div>
              <div className="flex flex-col gap-1.5">
                <span className="ml-14 text-xs font-semibold text-foreground/80 dark:text-[#c3cbf0]">Drawdown dari puncak <span className="font-medium text-muted-foreground dark:text-[#8a94c4]">· % terhadap modal</span></span>
                <div className="relative ml-14" style={{ height: 90 }}>
                  <svg viewBox={`0 0 ${W} 90`} preserveAspectRatio="none" className="block w-full" style={{ height: 90 }} role="img" aria-label="Grafik drawdown">
                    <defs><linearGradient id="ddg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#f87171" stopOpacity="0.08" /><stop offset="1" stopColor="#f87171" stopOpacity="0.5" /></linearGradient></defs>
                    <line x1="0" x2={W} y1="4" y2="4" stroke="rgba(165,180,255,0.35)" vectorEffect="non-scaling-stroke" />
                    <path d={ddArea} fill="url(#ddg)" stroke="#f87171" strokeWidth="1.6" vectorEffect="non-scaling-stroke" strokeLinejoin="round" />
                  </svg>
                  <div className="absolute inset-0 cursor-crosshair" onMouseMove={onMove} onMouseLeave={() => setHov(null)} />
                  {hp && (
                    <>
                      <div className="pointer-events-none absolute top-0 bottom-0 w-px bg-[#f87171]/50" style={{ left: `${hFrac * 100}%` }} />
                      <span className="pointer-events-none absolute h-2.5 w-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-[#f87171] ring-2 ring-[#0c1330]" style={{ left: `${hFrac * 100}%`, top: ddY(hp.pct) }} />
                      <div className="pointer-events-none absolute top-0 z-40 w-max min-w-[150px] rounded-xl border border-[#7a8cff]/25 bg-[#0c1330]/95 px-3.5 py-3 shadow-[0_18px_40px_-12px_rgba(0,0,0,0.7)] backdrop-blur" style={tipPos}>
                        <p className="mb-1.5 text-xs font-bold text-white">{dayLabelLong(hp.d)}</p>
                        <div className="flex flex-col gap-1 text-[11.5px]">
                          <div className="flex justify-between gap-4"><span className="text-[#8a94c4]">Drawdown</span><b className="font-mono tabular-nums text-[#f87171]">{S.noBase ? "—" : fmt.pct(hp.pct)}</b></div>
                          <div className="flex justify-between gap-4"><span className="text-[#8a94c4]">Nominal</span><b className="font-mono tabular-nums text-[#e8ecff]">{fmt.money(hp.dd)}</b></div>
                        </div>
                      </div>
                    </>
                  )}
                  <span className="absolute -left-14 top-1 -translate-y-1/2 font-mono text-[11px] text-muted-foreground dark:text-[#8a94c4]">0%</span>
                  <span className="absolute -left-14 font-mono text-[11px] text-red-600 dark:text-[#f87171] -translate-y-1/2" style={{ top: 80 }}>{S.noBase ? "—" : fmt.pct(S.minPct)}</span>
                </div>
                <div className="relative ml-14 h-[18px]">
                  {xl.map((x, i) => <span key={i} className="absolute top-0.5 font-mono text-[11px] text-muted-foreground dark:text-[#8a94c4]" style={{ left: x.left }}>{x.t}</span>)}
                </div>
              </div>
            </div>

            <div className={cn(PANEL, "flex-[1_1_340px] min-w-0 p-[22px] flex flex-col gap-4")}>
              <div><h2 className={H2}>Modal &amp; Arus Dana</h2><p className={cn(CAP, "mt-1")}>{one ? one.name : `Semua ${accounts.length} akun`}</p></div>
              <div className="grid grid-cols-2 gap-3">
                <HoverTip block className="h-full" side="bottom" align="left" title="Total Deposit" rows={[...scope.map((a) => ({ label: a.name.replace("[Contoh] ", ""), value: fmt.money(per[a.id].dep) })), { label: "Total", value: fmt.money(dep) }]} note="Dana yang dimasukkan ke akun EA, terbaca dari baris balance di file.">
                  <div className={cn(INNER, "h-full", TILE)}><span className={LABEL}>Total Deposit</span><div className="mt-1 font-mono text-base font-bold tabular-nums text-[#3b57e8] dark:text-[#9db0ff]">{fmt.money(dep)}</div></div>
                </HoverTip>
                <HoverTip block className="h-full" side="bottom" align="right" title="Total Withdraw" rows={[...scope.map((a) => ({ label: a.name.replace("[Contoh] ", ""), value: fmt.money(per[a.id].wd) })), { label: "Total", value: fmt.money(wd) }]} note="Dana yang ditarik dari akun EA.">
                  <div className={cn(INNER, "h-full", TILE)}><span className={LABEL}>Total Withdraw</span><div className="mt-1 font-mono text-base font-bold tabular-nums text-amber-600 dark:text-[#facc15]">{fmt.money(wd)}</div></div>
                </HoverTip>
              </div>
              <div className="flex flex-col gap-2">
                <div className="flex h-2 gap-[3px] overflow-hidden rounded-full">
                  <div className="rounded-full bg-gradient-to-r from-[#4f6bff] to-[#8ea2ff]" style={{ width: `${depW}%` }} />
                  <div className="rounded-full bg-gradient-to-r from-[#d4a90f] to-[#facc15]" style={{ width: `${wdW}%` }} />
                </div>
                <div className="flex justify-between text-[12.5px] text-muted-foreground dark:text-[#c3cbf0]"><span>Modal bersih (deposit − withdraw)</span><b className="font-mono text-foreground tabular-nums">{fmt.money(dep - wd)}</b></div>
              </div>
              <div className="flex flex-col">
                <span className={cn(LABEL, "mb-1.5")}>Transaksi terbaru</span>
                {txs.length === 0 && <p className="text-xs text-muted-foreground dark:text-[#8a94c4] py-2">Belum ada deposit atau withdraw terbaca dari file.</p>}
                {txs.map((x) => {
                  const a = accName(x.accountId);
                  return (
                    <div key={x.id} className="flex items-center gap-2.5 py-[9px] border-t border-border/60 dark:border-[#7a8cff]/12">
                      <span className="w-2 h-2 rounded-full shrink-0" style={{ background: a?.color }} />
                      <span className="flex-1 min-w-0 flex flex-col gap-px"><span className="text-[13px] font-semibold truncate">{a?.name}</span><span className="text-[11.5px] text-muted-foreground dark:text-[#8a94c4]">{dayShort(x.d)} · {x.type === "deposit" ? "Deposit" : "Withdraw"}</span></span>
                      <b className={cn("font-mono text-[13px] tabular-nums", x.type === "deposit" ? "text-[#3b57e8] dark:text-[#9db0ff]" : "text-amber-600 dark:text-[#facc15]")}>{x.type === "deposit" ? "+" : "-"}{fmt.money(x.amount).replace("-", "")}</b>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Kalender + rincian */}
          <div className="flex flex-wrap gap-4 items-stretch">
            <div className={cn(PANEL, "flex-[999_1_560px] min-w-0 p-[22px] flex flex-col gap-4")}>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div><h2 className={H2}>Kalender {BULAN_PANJANG[mm.m0]} {mm.y}</h2>
                  <p className={cn(CAP, "mt-1")}>{calMode === "profit" ? "Profit harian dan total per minggu · dihitung per tanggal trade ditutup" : "Drawdown harian dan terdalam per minggu · kedalaman dari puncak di akhir hari"}</p></div>
                <div className="flex flex-wrap items-center gap-3">
                  <div className={TABS}>
                    <button type="button" onClick={() => setCalMode("profit")} className={cn(TAB, calMode === "profit" && TAB_ON)}>Profit</button>
                    <button type="button" onClick={() => setCalMode("dd")} className={cn(TAB, calMode === "dd" && TAB_ON)}>Drawdown</button>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <button type="button" onClick={() => stepMonth(-1)} aria-label="Bulan sebelumnya" className={TIPS_NAV}><ChevronLeft className="w-4 h-4" /></button>
                    <button type="button" onClick={() => stepMonth(1)} aria-label="Bulan berikutnya" className={TIPS_NAV}><ChevronRight className="w-4 h-4" /></button>
                  </div>
                </div>
              </div>
              <div className="grid grid-cols-[repeat(7,minmax(0,1fr))_minmax(0,1.25fr)] gap-2 text-center text-[11px] font-bold tracking-[0.08em] text-muted-foreground dark:text-[#8a94c4]">
                {["SEN", "SEL", "RAB", "KAM", "JUM", "SAB", "MIN"].map((d) => <span key={d}>{d}</span>)}<span className="text-[#3b57e8] dark:text-[#9db0ff]">MINGGU</span>
              </div>
              <div className="grid grid-cols-[repeat(7,minmax(0,1fr))_minmax(0,1.25fr)] gap-2">{calCells}</div>
              <div className="flex flex-wrap items-center gap-x-[18px] gap-y-2 text-xs text-muted-foreground dark:text-[#8a94c4]">
                <span>Intensitas</span>
                <span className="flex items-center gap-1.5"><i className="inline-block w-3.5 h-3.5 rounded bg-red-400/40 border border-red-400/50" />{calMode === "profit" ? "Rugi" : "Drawdown dalam"}</span>
                <span className="flex items-center gap-1.5"><i className="inline-block w-3.5 h-3.5 rounded bg-secondary/60 dark:bg-white/[0.04] border border-[#7a8cff]/20" />Tanpa trade</span>
                {calMode === "profit" && <span className="flex items-center gap-1.5"><i className="inline-block w-3.5 h-3.5 rounded bg-emerald-400/40 border border-emerald-400/50" />Untung</span>}
              </div>
            </div>

            <div className={cn(PANEL, "flex-[1_1_340px] min-w-0 p-[22px] flex flex-col gap-3.5")}>
              {selD && selRec ? (
                <>
                  <div className="flex items-start justify-between gap-2.5">
                    <div><h2 className={H2}>{dayLabelLong(selD)}</h2><p className={cn(CAP, "mt-1")}>{one ? one.name : `Gabungan ${scope.length} akun`}</p></div>
                    <span className={cn("shrink-0 rounded-full px-2.5 py-1 text-xs font-bold", selRec.p >= 0 ? "bg-emerald-400/15 text-emerald-700 dark:text-[#4ade80]" : "bg-red-400/15 text-red-700 dark:text-[#f87171]")}>{selRec.p >= 0 ? "Hari profit" : "Hari rugi"}</span>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <HoverTip block className="h-full" side="top" align="left" title="Profit hari ini" rows={[{ label: "Profit", value: fmt.moneyS(selRec.p), tone: selRec.p >= 0 ? "win" : "loss" }, { label: "Jumlah trade", value: String(dayN[selD] ?? 0) }, { label: "Kumulatif", value: fmt.moneyS(selRec.cum) }]}>
                      <div className={cn(INNER, "h-full", TILE)}><span className={LABEL}>Profit</span><div className={cn("mt-1 font-mono text-base font-bold tabular-nums", tone(selRec.p))}>{fmt.moneyS(selRec.p)}</div></div>
                    </HoverTip>
                    <HoverTip block className="h-full" side="top" align="right" title="Drawdown hari ini" rows={[{ label: "Persentase", value: S.noBase ? "—" : fmt.pct(selRec.pct), tone: "loss" }, { label: "Nominal", value: fmt.money(selRec.dd), tone: "loss" }]} note="Kedalaman dari puncak kurva profit di akhir hari.">
                      <div className={cn(INNER, "h-full", TILE)}><span className={LABEL}>Drawdown</span><div className="mt-1 font-mono text-base font-bold tabular-nums text-red-600 dark:text-[#f87171]">{S.noBase ? "—" : fmt.pct(selRec.pct)}</div></div>
                    </HoverTip>
                  </div>
                  <div className="flex flex-col">
                    <span className={cn(LABEL, "mb-1.5")}>{one ? "Akun" : "Per akun"}</span>
                    {selRows.map(({ a, r }) => (
                      <div key={a.id} className="flex items-center gap-2.5 py-2.5 border-t border-border/60 dark:border-[#7a8cff]/12">
                        <span className="w-2 h-2 rounded-full shrink-0" style={{ background: a.color }} />
                        <span className="flex-1 min-w-0 truncate text-[13px] font-semibold">{a.name}</span>
                        <span className="font-mono text-xs text-muted-foreground dark:text-[#8a94c4]">{S.noBase ? "—" : fmt.pct(r.pct)}</span>
                        <b className={cn("font-mono text-[13px] min-w-[78px] text-right tabular-nums", tone(r.p))}>{fmt.moneyS(r.p)}</b>
                      </div>
                    ))}
                  </div>
                </>
              ) : <p className="text-sm text-muted-foreground dark:text-[#8a94c4]">Tidak ada trade di bulan ini.</p>}
              <p className="text-xs leading-relaxed text-muted-foreground dark:text-[#8a94c4]">Klik tanggal di kalender untuk melihat rincian hari itu. Sabtu dan Minggu biasanya tidak ada trade.</p>
            </div>
          </div>

          {/* Perbandingan / Detail */}
          {accId === "all" ? (
            <div className={cn(PANEL, "p-[22px] flex flex-col gap-3.5")}>
              <div><h2 className={H2}>Perbandingan Akun EA</h2><p className={cn(CAP, "mt-1")}>Klik satu baris untuk melihat akun itu saja.</p></div>
              <div className="overflow-x-auto">
                <div className="min-w-[980px]">
                  <div className="grid grid-cols-[minmax(200px,1.7fr)_repeat(6,minmax(92px,1fr))_minmax(130px,1.2fr)_minmax(130px,1.1fr)] gap-3 pb-2.5 text-[11px] font-bold tracking-[0.08em] text-muted-foreground dark:text-[#8a94c4]">
                    <span>AKUN / EA</span><span>SALDO</span><span>PROFIT</span><span>RETURN</span><span>MAX DD</span><span>AVG DD/HARI</span><span>PF</span><span>KONTRIBUSI</span><span>UPDATE</span>
                  </div>
                  {accounts.map((a) => {
                    const p = per[a.id]; const st = statusOf(a);
                    const apf = p.S.gl > 0 ? p.S.gw / p.S.gl : p.S.gw > 0 ? Infinity : 0;
                    const share = allNet > 0 ? Math.max(0, Math.min(100, (p.F.net / allNet) * 100)) : 0;
                    return (
                      <button key={a.id} type="button" onClick={() => { setAccId(a.id); setSelDate(null); }}
                        className="group grid w-full grid-cols-[minmax(200px,1.7fr)_repeat(6,minmax(92px,1fr))_minmax(130px,1.2fr)_minmax(130px,1.1fr)] items-center gap-3 border-t border-border/60 dark:border-[#7a8cff]/12 py-3.5 text-left transition-colors hover:bg-[#4f6bff]/[0.06]">
                        <span className="flex min-w-0 items-center gap-2.5"><span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: a.color }} /><span className="flex min-w-0 flex-col gap-0.5"><b className="truncate text-sm font-bold">{a.name}</b><span className="text-[11.5px] text-muted-foreground dark:text-[#8a94c4]">{a.symbol ? a.symbol + " · " : ""}{a.unit}</span></span></span>
                        <span className="font-mono text-[13px] tabular-nums">{fmt.money(p.dep - p.wd + p.F.net)}</span>
                        <b className={cn("font-mono text-[13px] tabular-nums", tone(p.S.net))}>{fmt.moneyS(p.S.net)}</b>
                        <span className={cn("font-mono text-[13px] tabular-nums", tone(p.S.net))}>{p.dep > 0 ? fmt.pctS(p.S.net / p.dep) : "—"}</span>
                        <span className="font-mono text-[13px] tabular-nums text-red-600 dark:text-[#f87171]">{p.S.noBase ? "—" : fmt.pct(p.S.minPct)}</span>
                        <span className="font-mono text-[13px] tabular-nums text-amber-600 dark:text-[#facc15]">{p.S.noBase ? "—" : fmt.pct(p.S.avg)}</span>
                        <span className={cn("font-mono text-[13px] tabular-nums", apf >= 1 ? WIN : LOSS)}>{p.S.trades ? (apf === Infinity ? "∞" : apf.toFixed(2).replace(".", ",")) : "—"}</span>
                        <span className="flex items-center gap-2"><span className="h-1.5 flex-1 overflow-hidden rounded-full bg-secondary dark:bg-white/[0.07]"><span className="block h-1.5 rounded-full" style={{ width: `${share}%`, background: a.color }} /></span><span className="min-w-[34px] text-right font-mono text-xs text-muted-foreground dark:text-[#c3cbf0]">{p.F.net > 0 ? `${share.toFixed(0)}%` : "—"}</span></span>
                        <span className={cn("justify-self-start rounded-full px-2.5 py-1 text-xs font-semibold", st.stale ? "bg-amber-400/15 text-amber-700 dark:text-[#facc15]" : "bg-emerald-400/12 text-emerald-700 dark:text-[#4ade80]")}>{st.short}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          ) : one && (
            <div className={cn(PANEL, "p-[22px] flex flex-col gap-3.5")}>
              <div><h2 className={H2}>Detail EA</h2><p className={cn(CAP, "mt-1")}>{one.name} · kontribusi {allNet > 0 ? Math.max(0, Math.round((per[one.id].F.net / allNet) * 100)) : 0}% dari total profit semua akun</p></div>
              <div className="grid grid-cols-[repeat(auto-fit,minmax(220px,1fr))] gap-3">
                {[
                  { k: "Simbol", v: one.symbol ?? "—", n: "Instrumen yang diperdagangkan EA." }, { k: "Magic number", v: one.magic ?? "—", n: "ID unik EA di MT5." }, { k: "Nomor akun MT5", v: one.login ?? "—", n: "Dipakai untuk mengenali akun saat unggah." },
                  { k: "Mata uang akun", v: one.unit === "USC" ? "USC (cent, 100 USC = $1)" : "USD", n: "Analitik selalu ditampilkan dalam USD." },
                  { k: "Saldo di MT5", v: one.unit === "USC" ? `${makeFmt("usd", 1).grp(balance * 100, 0)} USC` : `$${makeFmt("usd", 1).grp(balance, 2)} USD`, n: "Perkiraan: deposit − withdraw + profit." },
                  { k: "Total trade", v: String(per[one.id].F.trades), n: "Seluruh trade yang sudah ditutup." }, { k: "Win rate", v: `${per[one.id].F.trades ? Math.round((per[one.id].F.wins / per[one.id].F.trades) * 100) : 0}%`, n: "Persentase trade yang untung." },
                  { k: "Profit factor", v: per[one.id].F.gl > 0 ? (per[one.id].F.gw / per[one.id].F.gl).toFixed(2).replace(".", ",") : "—", n: "Gross profit dibagi gross loss." },
                  { k: "Update terakhir", v: statusOf(one).short, n: "Kapan data terakhir diunggah." },
                ].map((x) => (
                  <HoverTip key={x.k} block className="h-full" side="top" title={x.k} rows={[{ label: "Nilai", value: x.v }]} note={x.n}>
                    <div className={cn(INNER, "h-full", TILE)}><span className={LABEL}>{x.k}</span><div className="mt-1 font-mono text-[15px] font-semibold tabular-nums">{x.v}</div></div>
                  </HoverTip>
                ))}
              </div>
            </div>
          )}
        </>
      )}

      {/* Riwayat unggahan */}
      <div className={cn(PANEL, "p-[22px] flex flex-col gap-3.5")}>
        <div className="flex flex-wrap items-center justify-between gap-2.5">
          <div><h2 className={H2}>Riwayat Unggahan</h2><p className={cn(CAP, "mt-1")}>Trade yang sudah pernah masuk tidak dihitung dua kali.</p></div>
          {staleCount > 0 && <span className="rounded-full border border-amber-400/30 bg-amber-400/15 px-3 py-1.5 text-xs font-bold text-amber-700 dark:text-[#facc15]">{staleCount} akun perlu update</span>}
        </div>
        <div className="flex flex-col">
          {(data.uploads as any[]).length === 0 && <p className="text-sm text-muted-foreground dark:text-[#8a94c4]">Belum ada unggahan.</p>}
          {(data.uploads as any[]).slice(0, 8).map((u) => {
            const a = accName(u.accountId);
            return (
              <div key={u.id} className="flex flex-wrap items-center gap-3 border-t border-border/60 dark:border-[#7a8cff]/12 py-3">
                <span className="h-2 w-2 rounded-full" style={{ background: a?.color }} />
                <span className="flex-[1_1_200px] text-[13px] font-semibold">{a?.name ?? "Akun dihapus"}</span>
                <span className="font-mono text-xs text-muted-foreground dark:text-[#8a94c4]">{u.filename}</span>
                <span className="text-xs text-muted-foreground dark:text-[#c3cbf0]">{dayShort(fmtDate(new Date(u.createdAt)))} · {u.newDeals} trade baru{u.newFlows ? ` · ${u.newFlows} arus dana` : ""}</span>
                <button type="button" onClick={() => removeUpload(u.id, u.filename)} aria-label="Batalkan unggahan" className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-red-400/10 hover:text-red-500"><Trash2 className="h-4 w-4" /></button>
              </div>
            );
          })}
        </div>
      </div>

      {upload && <UploadDialog accounts={accounts} defaultAccountId={one?.id} onClose={() => setUpload(false)} onDone={() => { setUpload(false); load(); }} onNewAccount={() => { setUpload(false); setAccDlg({ edit: null }); }} />}
      {accDlg && <AccountDialog account={accDlg.edit} onClose={() => setAccDlg(null)} onSaved={afterSave} />}
    </div>
  );
}
