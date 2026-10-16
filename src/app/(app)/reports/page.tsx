"use client";
import { useEffect, useState, useCallback } from "react";
import { Download, Printer, FileText } from "lucide-react";
import { cn, formatCurrency } from "@/lib/utils";
import { PANEL, BTN_PRIMARY, PILL, PILL_ON, PILL_OFF, LABEL, pnlColor } from "@/lib/theme";
import { PageHeader } from "@/components/ui/PageHeader";
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
const HISTORY_KEY = "tj-report-history";

type Hist = { at: string; period: string; format: string; account: string };

export default function ReportsPage() {
  const [accountId, setAccountId] = useState("");
  const [period, setPeriod] = useState("1m");
  const [include, setInclude] = useState<string[]>(SECTIONS.map(s => s.id));
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [history, setHistory] = useState<Hist[]>([]);

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

  const kpis = stats ? [
    { label: "Net P&L", value: formatCurrency(stats.netPnL, cur), color: pnlColor(stats.netPnL) },
    { label: "Win Rate", value: `${Number(stats.winRate).toFixed(1)}%`, color: "" },
    { label: "Profit Factor", value: Number(stats.profitFactor).toFixed(2), color: "" },
    { label: "Total Trade", value: String(stats.closedTrades ?? stats.totalTrades), color: "" },
  ] : [];

  return (
    <div className="pb-6">
      <div className="print:hidden">
        <PageHeader title="Laporan" subtitle="Susun dan ekspor laporan performa trading" />
      </div>
      <div className="px-4 md:px-6 grid grid-cols-1 xl:grid-cols-[320px_1fr] gap-4">
        {/* Form */}
        <div className={cn(PANEL, "p-4 space-y-4 self-start print:hidden")}>
          <div>
            <p className={cn(LABEL, "mb-2")}>Akun</p>
            <AccountSwitcher value={accountId} onChange={setAccountId} />
          </div>
          <div>
            <p className={cn(LABEL, "mb-2")}>Periode</p>
            <div className="flex flex-wrap gap-1.5">
              {PERIODS.map(p => (
                <button key={p.id} onClick={() => setPeriod(p.id)} className={cn(PILL, period === p.id ? PILL_ON : PILL_OFF)}>{p.label}</button>
              ))}
            </div>
          </div>
          <div>
            <p className={cn(LABEL, "mb-2")}>Sertakan</p>
            <div className="flex flex-wrap gap-1.5">
              {SECTIONS.map(s => (
                <button key={s.id} onClick={() => toggle(s.id)} className={cn(PILL, has(s.id) ? PILL_ON : PILL_OFF)}>{s.label}</button>
              ))}
            </div>
          </div>
          <div className="flex gap-2 pt-1">
            <button onClick={exportPdf} className={cn("flex-1 flex items-center justify-center gap-1.5 text-xs py-2 rounded-xl", BTN_PRIMARY)}><Printer className="w-3.5 h-3.5" />PDF</button>
            <button onClick={exportCsv} className="flex-1 flex items-center justify-center gap-1.5 text-xs py-2 rounded-xl border hover:bg-muted"><Download className="w-3.5 h-3.5" />CSV</button>
          </div>
          <p className="text-[10px] text-muted-foreground">CSV berisi semua trade akun terpilih. PDF dibuat dari preview lewat dialog cetak browser (pilih “Simpan sebagai PDF”).</p>
        </div>

        {/* Preview */}
        <div className={cn(PANEL, "p-6 min-h-[420px] print:border-0 print:bg-white print:text-black")}>
          <div className="flex items-start justify-between mb-5">
            <div>
              <p className="text-lg font-semibold">Laporan Performa</p>
              <p className="text-xs text-muted-foreground">{data?.account?.name ?? "—"} · {PERIODS.find(p => p.id === period)?.label}</p>
            </div>
            <FileText className="w-5 h-5 text-[#9db0ff]" />
          </div>
          {loading || !stats ? <p className="text-sm text-muted-foreground">{loading ? "Memuat..." : "Tidak ada data"}</p> : (
            <div className="space-y-6">
              {has("summary") && (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  {kpis.map(k => (
                    <div key={k.label} className="rounded-xl border dark:border-[#27358a]/40 p-3">
                      <p className={LABEL}>{k.label}</p>
                      <p className={cn("text-base font-semibold font-mono tabular-nums mt-1", k.color)}>{k.value}</p>
                    </div>
                  ))}
                </div>
              )}
              {has("session") && (
                <Table title="Per Sesi" head={["Sesi", "Trade", "Win Rate", "P&L"]}
                  rows={(data.bySession ?? []).map((s: any) => [s.session, s.trades ?? s.totalTrades ?? "-", `${s.winRate}%`, s.pnl ?? s.netPnL])} cur={cur} />
              )}
              {has("symbol") && (
                <Table title="Per Simbol" head={["Simbol", "Trade", "Win Rate", "P&L"]}
                  rows={(data.bySymbol ?? []).slice(0, 8).map((s: any) => [s.symbol, s.trades ?? s.count ?? "-", s.winRate != null ? `${s.winRate}%` : "-", s.pnl])} cur={cur} />
              )}
              {has("recent") && (
                <Table title="Trade Terbaru" head={["Tanggal", "Simbol", "Arah", "P&L"]}
                  rows={(data.recentTrades ?? []).slice(0, 10).map((t: any) => [String(t.entryDate).slice(0, 10), t.symbol, t.direction, t.pnl])} cur={cur} />
              )}
            </div>
          )}
        </div>
      </div>

      <div className="px-4 md:px-6 mt-4 print:hidden">
        <div className={cn(PANEL, "p-4")}>
          <p className="text-xs font-semibold mb-3">Riwayat Ekspor</p>
          {history.length === 0 ? <p className="text-xs text-muted-foreground">Belum ada ekspor.</p> : (
            <ul className="divide-y dark:divide-[#27358a]/30">
              {history.map((h, i) => (
                <li key={i} className="flex items-center justify-between py-2 text-xs">
                  <span>{h.format} · {h.account} · {PERIODS.find(p => p.id === h.period)?.label}</span>
                  <span className="text-muted-foreground font-mono">{new Date(h.at).toLocaleString("id-ID")}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}

function Table({ title, head, rows, cur }: { title: string; head: string[]; rows: any[][]; cur: string }) {
  return (
    <div>
      <p className="text-xs font-semibold mb-2">{title}</p>
      {rows.length === 0 ? <p className="text-xs text-muted-foreground">Tidak ada data</p> : (
        <table className="w-full text-xs">
          <thead><tr className="text-left text-muted-foreground">{head.map((h, i) => <th key={h} className={cn("py-1.5 font-medium", i === head.length - 1 && "text-right")}>{h}</th>)}</tr></thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={i} className="border-t dark:border-[#27358a]/30">
                {r.map((c, j) => j === r.length - 1 && typeof c === "number"
                  ? <td key={j} className={cn("py-1.5 text-right font-mono tabular-nums", pnlColor(c))}>{formatCurrency(c, cur)}</td>
                  : <td key={j} className={cn("py-1.5 capitalize", j === r.length - 1 && "text-right")}>{c ?? "-"}</td>)}
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
