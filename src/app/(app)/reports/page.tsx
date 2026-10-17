"use client";
import { useEffect, useState, useCallback } from "react";
import { Download, Printer, FileText, TrendingUp } from "lucide-react";
import { cn, formatCurrency } from "@/lib/utils";
import { PANEL, BTN_PRIMARY, PAGE, H1, SUB, H2, CAP, BTN, pnlColor } from "@/lib/theme";
import AccountSwitcher from "@/components/layout/AccountSwitcher";

const PERIODS = [
  { id: "7d", label: "7 Hari" },
  { id: "1m", label: "Bulan Ini" },
  { id: "3m", label: "3 Bulan" },
  { id: "ytd", label: "YTD" },
  { id: "all", label: "Semua" },
];
const SECTIONS = [
  { id: "summary", label: "Ringkasan KPI" },
  { id: "session", label: "Per Sesi" },
  { id: "symbol", label: "Per Simbol" },
  { id: "recent", label: "Trade Terbaru" },
];
const SESSION_NAMES: Record<string, string> = { newyork: "New York", london: "London", asia: "Asia", sydney: "Sydney" };
const sessionName = (v: any) => (typeof v === "string" ? SESSION_NAMES[v.toLowerCase().replace(/[\s_-]/g, "")] ?? v : v);
const FP = "h-[38px] px-4 rounded-full border text-xs font-semibold inline-flex items-center justify-center gap-2 transition-colors";
const FP_ON = "border-transparent text-white bg-gradient-to-b from-[#5873ff] to-[#2f4bd8] shadow-[0_0_18px_-4px_rgba(79,107,255,0.75)]";
const FP_OFF = "border-border text-muted-foreground hover:bg-[#4f6bff]/10 hover:border-[#4f6bff]/50 hover:text-foreground dark:border-white/10 dark:text-[#9aa4d2] dark:hover:text-[#e8ecff]";
const FL = "text-[11px] font-bold tracking-[0.1em] uppercase text-muted-foreground dark:text-[#7d88bd] mb-2.5";
const BTN_GHOST = "border border-border bg-transparent text-foreground hover:bg-[#4f6bff]/10 hover:border-[#4f6bff]/60 dark:border-white/15 dark:text-[#dfe4ff]";
const PK_LBL = "text-[11px] font-bold text-[#5b6391] tracking-[0.06em] uppercase";
const HISTORY_KEY = "tj-report-history";

type Hist = { at: string; period: string; format: string; account: string };

export default function ReportsPage() {
  const [accountId, setAccountId] = useState("");
  const [period, setPeriod] = useState("1m");
  const [include, setInclude] = useState<string[]>(SECTIONS.map(s => s.id));
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [history, setHistory] = useState<Hist[]>([]);
  const [fmt, setFmt] = useState<"PDF" | "CSV">("PDF");

  useEffect(() => {
    try { const v = localStorage.getItem(HISTORY_KEY); if (v) setHistory(JSON.parse(v)); } catch {}
    fetch("/api/dashboard").then(r => r.json()).then(d => { if (d.account?.id) setAccountId(d.account.id); });
  }, []);

  const load = useCallback(() => {
    if (!accountId) return;
    setLoading(true);
    fetch(`/api/dashboard?period=${period}&accountId=${accountId}`)
      .then(r => r.json()).then(setData).finally(() => setLoading(false));
  }, [accountId, period]);
  useEffect(load, [load]);

  const cur = data?.account?.currency ?? "IDR";
  const stats = data?.stats;
  const has = (id: string) => include.includes(id);
  const toggle = (id: string) => setInclude(i => i.includes(id) ? i.filter(x => x !== id) : [...i, id]);

  function record(format: string) {
    const next = [{ at: new Date().toISOString(), period, format, account: data?.account?.name ?? "" }, ...history].slice(0, 10);
    setHistory(next);
    try { localStorage.setItem(HISTORY_KEY, JSON.stringify(next)); } catch {}
  }
  function exportCsv() {
    window.location.href = `/api/export?type=csv&accountId=${accountId}`;
    record("CSV");
  }
  function exportPdf() {
    record("PDF");
    window.print();
  }

  const periodLabel = PERIODS.find(p => p.id === period)?.label;
  const download = () => (fmt === "PDF" ? exportPdf() : exportCsv());
  const kpis = stats ? [
    { label: "Net P&L", value: formatCurrency(stats.netPnL, cur), color: pnlColor(stats.netPnL) },
    { label: "Win Rate", value: `${Number(stats.winRate).toFixed(1)}%`, color: "" },
    { label: "Profit Factor", value: Number(stats.profitFactor).toFixed(2), color: "" },
    { label: "Total Trade", value: String(stats.closedTrades ?? stats.totalTrades), color: "" },
  ] : [];

  return (
    <div className={PAGE}>
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4 print:hidden">
        <div>
          <div className="flex flex-wrap items-center gap-3">
            <h1 className={H1}>Laporan</h1>
            <AccountSwitcher value={accountId} onChange={setAccountId} />
          </div>
          <p className={SUB}>Susun dan unduh laporan performa yang rapi untuk evaluasi atau arsip</p>
        </div>
      </div>

      <div className="flex flex-wrap gap-4 items-start">
        {/* Form */}
        <div className="flex-[1_1_320px] max-w-full lg:max-w-[420px] min-w-0 flex flex-col gap-4 print:hidden">
          <div className={cn(PANEL, "p-5 md:px-6 md:py-[22px]")}>
            <h2 className={cn(H2, "mb-[18px]")}>Buat Laporan</h2>
            <div className={FL}>Periode</div>
            <div className="flex flex-wrap gap-2 mb-5">
              {PERIODS.map(p => (
                <button key={p.id} onClick={() => setPeriod(p.id)} className={cn(FP, period === p.id ? FP_ON : FP_OFF)}>{p.label}</button>
              ))}
            </div>
            <div className={FL}>Format</div>
            <div className="flex gap-2 mb-5">
              {(["PDF", "CSV"] as const).map(f => (
                <button key={f} onClick={() => setFmt(f)} className={cn(FP, "flex-1", fmt === f ? FP_ON : FP_OFF)}>{f}</button>
              ))}
            </div>
            <div className={FL}>Sertakan</div>
            <div>
              {SECTIONS.map(s => (
                <button key={s.id} type="button" role="switch" aria-checked={has(s.id)} onClick={() => toggle(s.id)}
                  className="w-full flex items-center justify-between gap-3 text-[13px] py-[11px] border-b last:border-b-0 dark:border-[#7a8cff]/10 text-left">
                  <span>{s.label}</span>
                  <span className={cn("relative w-[38px] h-[22px] rounded-full shrink-0 transition-colors", has(s.id) ? "bg-gradient-to-b from-[#5873ff] to-[#2f4bd8]" : "bg-black/15 dark:bg-white/[0.12]")}>
                    <span className={cn("absolute top-[3px] w-4 h-4 rounded-full transition-all", has(s.id) ? "left-[19px] bg-white" : "left-[3px] bg-[#c7cdee]")} />
                  </span>
                </button>
              ))}
            </div>
            <button onClick={download} className={cn(BTN, BTN_PRIMARY, "w-full justify-center mt-5 h-11 transition")}>
              {fmt === "PDF" ? <Printer className="w-4 h-4" /> : <Download className="w-4 h-4" />}Unduh Laporan
            </button>
            <p className={cn(CAP, "mt-3 text-[11px]")}>CSV berisi semua trade akun terpilih. PDF dibuat dari preview lewat dialog cetak browser (pilih “Simpan sebagai PDF”).</p>
          </div>
        </div>

        {/* Preview */}
        <div className="flex-[2_1_560px] min-w-0 flex flex-col gap-4 print:flex-none print:w-full">
          <div className="bg-[#f6f7fb] text-[#12163a] rounded-[14px] px-[18px] py-[22px] md:px-[38px] md:py-[34px] shadow-[0_30px_60px_-24px_rgba(0,0,0,0.7),0_0_0_1px_rgba(255,255,255,0.08)] min-h-[420px] print:shadow-none print:rounded-none print:p-0 print:bg-white">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <div className="flex items-center gap-2 text-[#2f4bd8] font-extrabold text-[13px] tracking-[0.04em]"><TrendingUp className="w-4 h-4" />TRADING JOURNAL</div>
                <h2 className="mt-3.5 mb-1 text-[22px] md:text-[26px] font-extrabold tracking-[-0.02em]">Laporan Performa</h2>
                <div className="text-[13px] text-[#5b6391]">{periodLabel} · Akun {data?.account?.name ?? "—"}</div>
              </div>
              <div className="flex items-start gap-3 text-right text-xs text-[#5b6391] leading-relaxed">
                <div>Dibuat {new Date().toLocaleDateString("id-ID", { day: "2-digit", month: "short", year: "numeric" })}</div>
                <FileText className="w-5 h-5 text-[#2f4bd8] print:hidden" />
              </div>
            </div>
            <div className="h-px bg-[#d9ddf0] my-[22px]" />
            {loading || !stats ? <p className="text-sm text-[#5b6391]">{loading ? "Memuat..." : "Tidak ada data"}</p> : (
              <div className="space-y-6">
                {has("summary") && (
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5">
                    {kpis.map(k => (
                      <div key={k.label} className="flex flex-col gap-[3px] px-3.5 py-3 rounded-[10px] bg-[#e9ecf8] min-w-0">
                        <span className={PK_LBL}>{k.label}</span>
                        <b className={cn("text-[15px] font-mono tabular-nums truncate", k.label === "Net P&L" ? (stats.netPnL > 0 ? "text-[#15803d]" : stats.netPnL < 0 ? "text-[#b91c1c]" : "") : "")}>{k.value}</b>
                      </div>
                    ))}
                  </div>
                )}
                {has("session") && (
                  <Table title="Per Sesi" head={["Sesi", "Trade", "Win Rate", "P&L"]} monoCols={[1, 2, 3]}
                    rows={(data.bySession ?? []).map((s: any) => [sessionName(s.session), s.trades ?? s.totalTrades ?? "-", `${s.winRate}%`, s.pnl ?? s.netPnL])} cur={cur} />
                )}
                {has("symbol") && (
                  <Table title="Per Simbol" head={["Simbol", "Trade", "Win Rate", "P&L"]} monoCols={[1, 2, 3]}
                    rows={(data.bySymbol ?? []).slice(0, 8).map((s: any) => [s.symbol, s.trades ?? s.count ?? "-", s.winRate != null ? `${s.winRate}%` : "-", s.pnl])} cur={cur} />
                )}
                {has("recent") && (
                  <Table title="Trade Terbaru" head={["Tanggal", "Simbol", "Arah", "P&L"]} monoCols={[0, 3]} capCols={[2]}
                    rows={(data.recentTrades ?? []).slice(0, 10).map((t: any) => [String(t.entryDate).slice(0, 10), t.symbol, t.direction, t.pnl])} cur={cur} />
                )}
              </div>
            )}
          </div>
          <div className={cn(CAP, "text-center print:hidden")}>Pratinjau laporan · {periodLabel}</div>
        </div>
      </div>

      {/* History */}
      <div className={cn(PANEL, "overflow-hidden print:hidden")}>
        <div className="px-5 md:px-6 pt-5 pb-4">
          <h2 className={H2}>Riwayat Ekspor</h2>
          <p className={cn(CAP, "mt-1")}>Laporan yang pernah diunduh</p>
        </div>
        {history.length === 0 ? <p className={cn(CAP, "px-5 md:px-6 pb-6")}>Belum ada ekspor.</p> : (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-[13px]">
              <thead>
                <tr className="text-left text-[11px] font-bold tracking-[0.08em] uppercase text-muted-foreground dark:text-[#7d88bd] bg-secondary/60 dark:bg-[#0f1a45]/40">
                  {["Nama file", "Periode", "Format", "Dibuat", "Aksi"].map((h, i) => (
                    <th key={h} className={cn("px-4 py-3 border-y dark:border-[#7a8cff]/[0.14] whitespace-nowrap", i === 4 && "text-right")}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {history.map((h, i) => (
                  <tr key={i} className="border-b last:border-b-0 dark:border-[#7a8cff]/[0.07] hover:bg-[#2a3a9f]/10 dark:hover:bg-[#2a3a9f]/[0.14]">
                    <td className="px-4 py-3.5 whitespace-nowrap">
                      <span className="inline-flex items-center gap-2.5">
                        <span className="w-9 h-9 rounded-[11px] flex items-center justify-center border border-[#5b74ff]/30 bg-[#4f6bff]/10 text-[#4f6bff] dark:text-[#9fb0ff]"><FileText className="w-4 h-4" /></span>
                        <b>{h.account || "laporan"}-{h.at.slice(0, 10)}</b>
                      </span>
                    </td>
                    <td className="px-4 py-3.5 whitespace-nowrap text-muted-foreground dark:text-[#aab3df]">{PERIODS.find(p => p.id === h.period)?.label ?? h.period}</td>
                    <td className="px-4 py-3.5 whitespace-nowrap">
                      <span className={cn("inline-flex items-center px-[9px] py-[3px] rounded-[7px] text-[11px] font-bold border", h.format === "PDF" ? "bg-emerald-400/15 text-emerald-700 border-emerald-400/30 dark:text-[#6ee7b7]" : "bg-black/5 text-muted-foreground border-border dark:bg-white/[0.06] dark:text-[#aab3df] dark:border-white/10")}>{h.format}</span>
                    </td>
                    <td className="px-4 py-3.5 whitespace-nowrap font-mono text-muted-foreground dark:text-[#aab3df]">{new Date(h.at).toLocaleString("id-ID")}</td>
                    <td className="px-4 py-3.5 whitespace-nowrap text-right">
                      <button onClick={() => (h.format === "CSV" ? exportCsv() : exportPdf())} className={cn(BTN, BTN_GHOST, "h-8 text-xs px-3.5")}>Unduh lagi</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

function Table({ title, head, rows, cur, monoCols = [], capCols = [] }: { title: string; head: string[]; rows: any[][]; cur: string; monoCols?: number[]; capCols?: number[] }) {
  const last = head.length - 1;
  return (
    <div>
      <div className="text-xs font-bold text-[#5b6391] tracking-[0.08em] uppercase">{title}</div>
      {rows.length === 0 ? <p className="text-xs text-[#5b6391] mt-2">Tidak ada data</p> : (
        <table className="w-full border-collapse mt-2 text-[12.5px]">
          <thead><tr className="text-left text-[#7a82ad]">{head.map((h, i) => <th key={h} className={cn("py-2 font-semibold", i === last && "text-right")}>{h}</th>)}</tr></thead>
          <tbody>
            {rows.map((r, ri) => (
              <tr key={ri} className="border-t border-[#e1e4f2]">
                {r.map((c, j) => {
                  if (j === last && typeof c === "number")
                    return <td key={j} className={cn("py-2.5 text-right font-mono tabular-nums font-bold", c > 0 ? "text-[#15803d]" : c < 0 ? "text-[#b91c1c]" : "text-[#5b6391]")}>{formatCurrency(c, cur)}</td>;
                  return <td key={j} className={cn("py-2.5", j === 0 && "font-semibold", monoCols.includes(j) && "font-mono tabular-nums", capCols.includes(j) && "capitalize", j === last && "text-right")}>{c ?? "-"}</td>;
                })}
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
