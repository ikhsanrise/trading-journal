"use client";
// src/components/trades/ImportModal.tsx
import { useEffect, useState, useRef } from "react";
import { Upload, FileText, CheckCircle2, AlertCircle, Info, Loader2 } from "lucide-react";
import { Modal, FIELD, FIELD_LABEL } from "@/components/ea/Modal";
import { BTN_PRIMARY } from "@/lib/theme";
import { cn } from "@/lib/utils";

interface Props {
  onClose: () => void;
  onImported: () => void;
}

function parseNum(val: any): number {
  if (val == null) return 0;
  return parseFloat(String(val).replace(/\s/g, "")) || 0;
}

// Waktu di report broker = GMT+0. Parse eksplisit sebagai UTC supaya tidak
// bergeser mengikuti zona waktu browser.
function parseBrokerDate(str: any): Date | null {
  if (!str || typeof str !== "string") return null;
  const m = str.trim().match(/^(\d{4})\.(\d{2})\.(\d{2})\s+(\d{2}):(\d{2}):(\d{2})$/);
  if (m) return new Date(Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5], +m[6]));
  const d = new Date(str);
  return isNaN(d.getTime()) ? null : d;
}

// Session berdasarkan jam WIB (GMT+7)
function detectSession(date: Date): string {
  const hour = (date.getUTCHours() + 7) % 24;
  if (hour >= 20 || hour < 4) return "newyork";
  if (hour >= 16) return "london";
  if (hour >= 7) return "asia";
  if (hour >= 5) return "sydney";
  return "newyork";
}

function parseReport(text: string, accountId: string) {
  const lines = text.split(/\r?\n/);
  const trades: any[] = [];
  const transactions: any[] = [];

  // ── Positions: Time,Position,Symbol,Type,Volume,Price,S/L,T/P,Time,Price,Commission,Swap,Profit
  const posHeader = lines.findIndex((l) => l.startsWith("Time,Position"));
  if (posHeader >= 0) {
    for (let i = posHeader + 1; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;
      if (/^(Orders|Deals|Results)/i.test(line)) break;
      if (!/^\d{4}\.\d{2}\.\d{2}/.test(line)) continue;

      const c = line.split(",").map((s) => s.trim());
      const positionId = c[1] ?? "";
      if (!/^\d{6,}$/.test(positionId)) continue;

      const type = (c[3] ?? "").toLowerCase();
      if (type !== "buy" && type !== "sell") continue;

      const symbol = (c[2] ?? "").replace(/r$/, "").toUpperCase();
      const lotSize = parseNum(c[4]);
      const entryPrice = parseNum(c[5]);
      if (!symbol || !lotSize || !entryPrice) continue;

      const entryDate = parseBrokerDate(c[0]);
      if (!entryDate) continue;
      const exitDate = parseBrokerDate(c[8]);
      const exitPrice = parseNum(c[9]) || null;

      // Lewati trade yang entry = exit price
      if (exitPrice && Math.abs(entryPrice - exitPrice) < 0.001) continue;

      const pnl = parseNum(c[12]);
      const status = exitDate ? "closed" : "open";
      const outcome = pnl > 0 ? "win" : pnl < 0 ? "loss" : status === "closed" ? "breakeven" : null;

      trades.push({
        accountId,
        symbol,
        direction: type === "buy" ? "long" : "short",
        entryPrice,
        exitPrice,
        stopLoss: parseNum(c[6]) || null,
        takeProfit: parseNum(c[7]) || null,
        lotSize,
        entryDate: entryDate.toISOString(),
        exitDate: exitDate ? exitDate.toISOString() : null,
        commission: parseNum(c[10]),
        swap: parseNum(c[11]),
        pnl,
        status,
        outcome,
        session: detectSession(entryDate),
        rMultiple: null,
        positionId,
      });
    }
  }

  // ── Deals: baris bertipe "balance" = deposit / withdraw
  // Time,Deal,Symbol,Type,Direction,Volume,Price,Order,Commission,Fee,Swap,Profit,Balance,Comment
  const dealHeader = lines.findIndex((l) => l.startsWith("Time,Deal"));
  if (dealHeader >= 0) {
    for (let i = dealHeader + 1; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;
      if (/^(Results|Total)/i.test(line)) break;
      if (!/^\d{4}\.\d{2}\.\d{2}/.test(line)) continue;

      const c = line.split(",").map((s) => s.trim());
      if ((c[3] ?? "").toLowerCase() !== "balance") continue;

      const note = c[13] ?? "";
      if (/compensation/i.test(note)) continue; // kredit dari broker, bukan deposit

      const amount = parseNum(c[11]);
      const date = parseBrokerDate(c[0]);
      if (!amount || !date) continue;

      transactions.push({
        type: amount > 0 ? "deposit" : "withdraw",
        amount: Math.abs(amount),
        note,
        date: date.toISOString(),
      });
    }
  }

  return { trades, transactions };
}

const fmtDay = (iso: string) => new Date(iso).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
const fmtSize = (n: number) => (n > 1048576 ? `${(n / 1048576).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1024))} KB`);

export default function ImportModal({ onClose, onImported }: Props) {
  const [accounts, setAccounts] = useState<any[]>([]);
  const [accountId, setAccountId] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<{ trades: number; tx: number; from: string | null; to: string | null; pnl: number } | null>(null);
  const [drag, setDrag] = useState(false);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [progress, setProgress] = useState({ current: 0, total: 0 });
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetch("/api/dashboard")
      .then((r) => r.json())
      .then((d) => {
        setAccounts(d.accounts ?? []);
        if (d.account) setAccountId(d.account.id);
      });
  }, []);

  async function pick(f: File | null) {
    setFile(f);
    setResult(null);
    setPreview(null);
    if (!f) return;
    try {
      const { trades, transactions } = parseReport(await f.text(), "");
      const times = trades.map((t) => t.entryDate as string).sort();
      setPreview({
        trades: trades.length, tx: transactions.length,
        from: times[0] ?? null, to: times[times.length - 1] ?? null,
        pnl: trades.reduce((a, t) => a + (t.pnl ?? 0), 0),
      });
    } catch { setPreview({ trades: 0, tx: 0, from: null, to: null, pnl: 0 }); }
  }

  async function handleImport() {
    if (!file || !accountId) return;
    setLoading(true);
    setResult(null);
    setProgress({ current: 0, total: 0 });

    try {
      const text = await file.text();
      const { trades, transactions } = parseReport(text, accountId);

      if (trades.length === 0 && transactions.length === 0) {
        setResult({ imported: 0, skipped: 0, failed: 0, tx: null });
        setLoading(false);
        return;
      }

      let imported = 0, skipped = 0, failed = 0;
      const BATCH = 100;
      setProgress({ current: 0, total: trades.length });

      for (let i = 0; i < trades.length; i += BATCH) {
        const batch = trades.slice(i, i + BATCH);
        const res = await fetch("/api/trades/batch", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ accountId, trades: batch }),
        });
        if (res.ok) {
          const d = await res.json();
          imported += d.imported ?? 0;
          skipped += d.skipped ?? 0;
        } else {
          failed += batch.length;
        }
        setProgress({ current: Math.min(i + BATCH, trades.length), total: trades.length });
      }

      let tx: any = null;
      if (transactions.length > 0) {
        const res = await fetch("/api/transactions/batch", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ accountId, transactions }),
        });
        if (res.ok) tx = await res.json();
      }

      setResult({ imported, skipped, failed, tx });
      setLoading(false);
      if (imported > 0 || (tx && tx.imported > 0)) setTimeout(onImported, 2000);
    } catch {
      setResult({ imported: 0, skipped: 0, failed: 1, tx: null });
      setLoading(false);
    }
  }

  const ok =
    result && (result.imported > 0 || result.skipped > 0 || (result.tx && (result.tx.imported > 0 || result.tx.skipped > 0)));
  const empty = preview && preview.trades === 0 && preview.tx === 0;
  const done = !!result && ok;

  return (
    <Modal title="Import CSV" subtitle="Unggah riwayat dari MT4/MT5. Trade yang sudah pernah masuk otomatis dilewati, jadi aman diimpor ulang." onClose={onClose}>
      <div className="flex flex-col gap-5">
        <div className="flex gap-3 rounded-2xl border border-[#7a8cff]/20 bg-[#4f6bff]/[0.08] p-3.5">
          <Info className="mt-0.5 h-4 w-4 shrink-0 text-[#3b57e8] dark:text-[#9db0ff]" />
          <p className="text-[12.5px] leading-relaxed text-muted-foreground dark:text-[#c3cbf0]">
            Di MT4/MT5 buka <b className="text-foreground">Account History</b>, klik kanan, pilih <b className="text-foreground">Save as Detailed Report</b>, lalu format <b className="text-foreground">CSV</b>. Deposit dan withdraw ikut terbaca.
          </p>
        </div>

        <div className="flex flex-col gap-2">
          <label className={FIELD_LABEL} htmlFor="imp-acc">Akun tujuan</label>
          <select id="imp-acc" className={cn(FIELD, "appearance-none")} value={accountId} onChange={(e) => setAccountId(e.target.value)} disabled={loading}>
            {accounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
          </select>
        </div>

        <div className="flex flex-col gap-2">
          <span className={FIELD_LABEL}>File CSV</span>
          <button
            type="button" disabled={loading}
            onClick={() => fileRef.current?.click()}
            onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
            onDragLeave={() => setDrag(false)}
            onDrop={(e) => { e.preventDefault(); setDrag(false); const f = e.dataTransfer.files?.[0]; if (f) pick(f); }}
            className={cn("flex min-h-[132px] w-full flex-col items-center justify-center gap-2 rounded-2xl border border-dashed px-4 py-6 text-center transition-all duration-200",
              drag ? "border-[#9db0ff] bg-[#4f6bff]/20 scale-[1.01]" : file ? "border-emerald-400/40 bg-emerald-400/[0.07]" : "border-[#7a8cff]/40 bg-secondary/30 dark:bg-white/[0.03] hover:border-[#9db0ff] hover:bg-[#4f6bff]/10")}>
            {file ? (
              <>
                <FileText className="h-6 w-6 text-emerald-600 dark:text-[#4ade80]" />
                <span className="max-w-full truncate font-mono text-[13px] font-semibold">{file.name}</span>
                <span className="text-xs text-muted-foreground dark:text-[#8a94c4]">{fmtSize(file.size)} · klik untuk ganti file</span>
              </>
            ) : (
              <>
                <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#4f6bff]/15 text-[#3b57e8] dark:text-[#9db0ff]"><Upload className="h-5 w-5" /></span>
                <span className="text-sm font-bold">Klik atau seret file CSV ke sini</span>
                <span className="text-xs text-muted-foreground dark:text-[#8a94c4]">Hanya file .csv dari MT4/MT5</span>
              </>
            )}
          </button>
          <input ref={fileRef} type="file" accept=".csv,text/csv" className="hidden" onChange={(e) => { pick(e.target.files?.[0] ?? null); e.target.value = ""; }} />
        </div>

        {preview && !result && !loading && (
          empty ? (
            <div className="flex gap-3 rounded-2xl border border-red-400/30 bg-red-400/10 p-3.5 text-[12.5px] text-red-700 dark:text-[#fca5a5]">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              <p>Tidak ada trade atau deposit yang terbaca. Pastikan file adalah Detailed Report MT4/MT5 dalam format CSV.</p>
            </div>
          ) : (
            <div className="flex flex-col gap-3 rounded-2xl border border-[#7a8cff]/20 bg-secondary/30 p-4 dark:bg-white/[0.04]">
              <span className="flex items-center gap-2 text-[13px] font-bold text-emerald-600 dark:text-[#4ade80]"><CheckCircle2 className="h-4 w-4" />File terbaca dengan baik</span>
              <div className="grid grid-cols-3 gap-2.5">
                {[
                  { k: "Trade", v: String(preview.trades) },
                  { k: "Deposit/WD", v: String(preview.tx) },
                  { k: "Total P&L", v: `${preview.pnl >= 0 ? "+" : "-"}${Math.abs(preview.pnl).toLocaleString("id-ID", { maximumFractionDigits: 2 })}`, c: preview.pnl >= 0 ? "text-emerald-600 dark:text-[#4ade80]" : "text-red-600 dark:text-[#f87171]" },
                ].map((x) => (
                  <div key={x.k} className="rounded-xl bg-secondary/50 p-3 dark:bg-white/[0.04]">
                    <span className="text-[11px] font-bold uppercase tracking-[0.08em] text-muted-foreground dark:text-[#8a94c4]">{x.k}</span>
                    <div className={cn("mt-1 font-mono text-base font-bold tabular-nums", x.c)}>{x.v}</div>
                  </div>
                ))}
              </div>
              {preview.from && <p className="text-xs text-muted-foreground dark:text-[#8a94c4]">Periode {fmtDay(preview.from)} – {fmtDay(preview.to!)}</p>}
            </div>
          )
        )}

        {loading && (
          <div className="flex flex-col gap-2">
            <div className="flex justify-between text-xs font-semibold text-muted-foreground dark:text-[#c3cbf0]">
              <span className="flex items-center gap-2"><Loader2 className="h-3.5 w-3.5 animate-spin" />Mengimpor...</span>
              <span className="font-mono">{progress.current}/{progress.total}</span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-secondary dark:bg-white/[0.07]">
              <div className="h-full rounded-full bg-gradient-to-r from-[#4f6bff] to-[#8ea2ff] transition-all duration-300" style={{ width: `${progress.total ? (progress.current / progress.total) * 100 : 5}%` }} />
            </div>
          </div>
        )}

        {result && (
          <div className={cn("flex items-start gap-3 rounded-2xl border p-4 anim-fade", ok ? "border-emerald-400/30 bg-emerald-400/10 text-emerald-700 dark:text-[#4ade80]" : "border-red-400/30 bg-red-400/10 text-red-700 dark:text-[#fca5a5]")}>
            {ok ? <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0" /> : <AlertCircle className="mt-0.5 h-5 w-5 shrink-0" />}
            <div className="flex flex-col gap-1 text-[13px]">
              {result.imported > 0 && <p className="font-bold">{result.imported} trade berhasil diimpor</p>}
              {result.skipped > 0 && <p>{result.skipped} trade sudah ada, dilewati</p>}
              {result.tx && <p>Deposit/withdraw: {result.tx.imported} baru, {result.tx.skipped} sudah ada</p>}
              {!ok && <p className="font-bold">Tidak ada trade baru ditemukan</p>}
              {result.failed > 0 && <p>{result.failed} trade gagal diimpor</p>}
            </div>
          </div>
        )}

        <div className="flex justify-end gap-3">
          <button type="button" onClick={onClose} className="h-11 rounded-xl border border-border px-5 text-sm font-bold transition-colors hover:bg-secondary/60 dark:border-[#7a8cff]/30 dark:bg-white/[0.04]">{done ? "Tutup" : "Batal"}</button>
          {!done && (
            <button type="button" onClick={handleImport} disabled={!file || !accountId || loading || !!empty}
              className={cn("inline-flex h-11 items-center gap-2 rounded-xl px-5 text-sm font-bold disabled:cursor-not-allowed disabled:opacity-50", BTN_PRIMARY)}>
              {loading ? <><Loader2 className="h-4 w-4 animate-spin" />Mengimpor...</> : preview && !empty ? `Impor ${preview.trades} trade` : "Impor"}
            </button>
          )}
        </div>
      </div>
    </Modal>
  );
}
