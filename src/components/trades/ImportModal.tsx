"use client";
// src/components/trades/ImportModal.tsx
import { useEffect, useState, useRef } from "react";
import { X, Upload, FileText, CheckCircle, AlertCircle } from "lucide-react";

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

export default function ImportModal({ onClose, onImported }: Props) {
  const [accounts, setAccounts] = useState<any[]>([]);
  const [accountId, setAccountId] = useState("");
  const [file, setFile] = useState<File | null>(null);
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

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 anim-fade"
      style={{ backgroundColor: "rgba(0,0,0,0.6)", backdropFilter: "blur(4px)" }}
    >
      <div
        className="bg-card border rounded-xl w-full max-w-md shadow-xl anim-pop"
        style={{ backgroundColor: "hsl(var(--card))" }}
      >
        <div className="flex items-center justify-between p-4 border-b">
          <h2 className="text-sm font-medium">Import from CSV</h2>
          <button onClick={onClose} className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-muted">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-4 space-y-4">
          <div className="bg-muted rounded-lg p-3">
            <p className="text-xs font-medium mb-1">Supported Format</p>
            <p className="text-[11px] text-muted-foreground">
              MT4/MT5 History Export (CSV). Buka MT4/MT5 → Account History → klik kanan → Save as Detailed Report → pilih format CSV.
            </p>
          </div>

          <div>
            <label className="block text-[11px] text-muted-foreground mb-1">Target Account</label>
            <select
              className="w-full text-xs px-2.5 py-1.5 rounded-lg border bg-background focus:outline-none"
              value={accountId}
              onChange={(e) => setAccountId(e.target.value)}
            >
              {accounts.map((a) => (
                <option key={a.id} value={a.id}>{a.name}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-[11px] text-muted-foreground mb-1">File CSV</label>
            <div
              onClick={() => fileRef.current?.click()}
              className="border border-dashed rounded-lg p-6 text-center cursor-pointer hover:bg-muted transition-colors"
            >
              {file ? (
                <div className="flex items-center justify-center gap-2">
                  <FileText className="w-4 h-4 text-blue-700" />
                  <span className="text-xs text-blue-700">{file.name}</span>
                </div>
              ) : (
                <>
                  <Upload className="w-5 h-5 text-muted-foreground mx-auto mb-1" />
                  <p className="text-xs text-muted-foreground">Click or drag CSV file here</p>
                </>
              )}
            </div>
            <input
              ref={fileRef}
              type="file"
              accept=".csv"
              className="hidden"
              onChange={(e) => { setFile(e.target.files?.[0] ?? null); setResult(null); }}
            />
          </div>

          {loading && progress.total > 0 && (
            <div className="space-y-1">
              <div className="flex justify-between text-[10px] text-muted-foreground">
                <span>Importing...</span>
                <span>{progress.current}/{progress.total}</span>
              </div>
              <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                <div
                  className="h-full bg-indigo-500 rounded-full transition-all duration-300"
                  style={{ width: `${(progress.current / progress.total) * 100}%` }}
                />
              </div>
            </div>
          )}

          {result && (
            <div
              className={`rounded-lg p-3 flex items-start gap-2 anim-fade ${
                ok ? "bg-green-500/10 text-green-600 dark:text-green-400" : "bg-red-500/10 text-red-600 dark:text-red-400"
              }`}
            >
              {ok ? <CheckCircle className="w-4 h-4 mt-0.5 shrink-0" /> : <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />}
              <div className="space-y-0.5">
                {result.imported > 0 && <p className="text-xs font-medium">{result.imported} trades imported.</p>}
                {result.skipped > 0 && <p className="text-xs">{result.skipped} trades already existed (skipped).</p>}
                {result.tx && (
                  <p className="text-xs">
                    Deposit/withdraw: {result.tx.imported} new, {result.tx.skipped} already existed.
                  </p>
                )}
                {!ok && <p className="text-xs font-medium">No new trades found.</p>}
                {result.failed > 0 && <p className="text-xs">{result.failed} trades failed to import.</p>}
              </div>
            </div>
          )}

          <div className="flex gap-2 pt-1">
            <button
              onClick={onClose}
              className="flex-1 text-xs py-2 rounded-lg border text-muted-foreground hover:bg-muted transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleImport}
              disabled={!file || !accountId || loading}
              className="flex-1 text-xs py-2 rounded-lg bg-blue-700 text-white hover:bg-blue-800 transition-colors disabled:opacity-60 font-medium"
            >
              {loading ? "Importing..." : "Import"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
