"use client";
// src/components/trades/ImportModal.tsx
import { useState, useRef } from "react";
import { X, Upload, FileText, CheckCircle, AlertCircle } from "lucide-react";

interface Props {
  onClose: () => void;
  onImported: () => void;
}

export default function ImportModal({ onClose, onImported }: Props) {
  const [accounts, setAccounts] = useState<any[]>([]);
  const [accountId, setAccountId] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useState(() => {
    fetch("/api/dashboard")
      .then((r) => r.json())
      .then((d) => {
        setAccounts(d.accounts ?? []);
        if (d.account) setAccountId(d.account.id);
      });
  });

  const [progress, setProgress] = useState({ current: 0, total: 0 });

  function parseNum(val: any): number {
    if (val == null) return 0;
    return parseFloat(String(val).replace(/\s/g, "")) || 0;
  }

  function parseDate(str: string): Date | null {
    if (!str?.trim()) return null;
    const dotFmt = str.match(/^(\d{4})\.(\d{2})\.(\d{2})\s+(\d{2}:\d{2}:\d{2})$/);
    if (dotFmt) return new Date(`${dotFmt[1]}-${dotFmt[2]}-${dotFmt[3]}T${dotFmt[4]}`);
    return new Date(str);
  }

  function detectSession(date: Date): string {
    const wib = new Date(date.getTime() + 7 * 60 * 60 * 1000);
    const hour = wib.getUTCHours();
    if (hour >= 20 || hour < 4) return "newyork";
    if (hour >= 16) return "london";
    if (hour >= 7) return "asia";
    if (hour >= 5) return "sydney";
    return "newyork";
  }

  async function handleImport() {
    if (!file || !accountId) return;
    setLoading(true);
    setProgress({ current: 0, total: 0 });

    const text = await file.text();
    const allLines = text.split(/\r?\n/);

    // Handle deposit/withdraw dari Deals section dulu via server
    const fd = new FormData();
    fd.append("file", file);
    fd.append("accountId", accountId);
    fd.append("dealsOnly", "true");
    await fetch("/api/trades/import", { method: "POST", body: fd }).catch(() => {});

    // Parse Positions section di client
    let dataStart = 0;
    for (let i = 0; i < allLines.length; i++) {
      const l = allLines[i].trim();
      if (l.startsWith("Time,Position") || l.startsWith("Date,Symbol")) { dataStart = i; break; }
      if (l.startsWith("Positions,")) { dataStart = i + 1; break; }
    }

    const headers = allLines[dataStart].split(",").map(h => h.trim());
    const trades: any[] = [];

    for (let i = dataStart + 1; i < allLines.length; i++) {
      const line = allLines[i].replace(/\r$/, "").trim();
      if (!line) continue;
      // Stop di section lain
      if (line.match(/^(Deals|Orders|Results|Time,Deal|Time,Order)/i)) break;
      // Hanya proses baris yang dimulai dengan tanggal format 2026.xx.xx
      if (!line.match(/^\d{4}\.\d{2}\.\d{2}/)) continue;
      const testCols = line.split(",");
      // Pastikan kolom 2 adalah Position ID (numerik panjang)
      const posId = testCols[1]?.trim() ?? "";
      if (!posId.match(/^\d{8,}$/)) continue;
      // Skip Orders: type mengandung limit/stop atau status canceled/filled
      const tradeType = testCols[3]?.trim().toLowerCase() ?? "";
      if (tradeType.includes("limit") || tradeType.includes("stop")) continue;
      if (testCols[9]?.trim() === "canceled" || testCols[9]?.trim() === "filled") continue;
      const cols = line.split(",").map(s => s.trim());
      if (cols.length < 5) continue;

      const row: any = {};
      headers.forEach((h, idx) => { row[h] = cols[idx] ?? ""; });

      const symbol = (row["Symbol"] ?? "").replace(/r$/, "").toUpperCase();
      const lotSize = parseNum(row["Volume"] ?? row["Size"]);
      if (!symbol || !lotSize) continue;

      const entryPrice = parseNum(row["Price"]);
      if (!entryPrice) continue;

      const exitPrice = parseNum(cols[9]) || null;
      const sl = parseNum(row["S / L"]) || null;
      const tp = parseNum(row["T / P"]) || null;
      const pnl = parseNum(cols[12]);
      const commission = parseNum(cols[10]);
      const swap = parseNum(cols[11]);
      const direction = (row["Type"] ?? "").toLowerCase().includes("buy") ? "long" : "short";
      const exitTimeStr = cols[8]?.trim();
      const entryDate = parseDate(row["Time"] ?? row["Open Time"] ?? "") ?? new Date();
      const exitDate = exitTimeStr ? parseDate(exitTimeStr) : null;
      const status = exitDate ? "closed" : "open";
      const outcome = pnl > 0 ? "win" : pnl < 0 ? "loss" : status === "closed" ? "breakeven" : null;
      const session = detectSession(entryDate);

      const positionId = cols[1]?.trim() ?? "";
      // Skip trade yang entry = exit price
      if (exitPrice !== null && exitPrice > 0 && Math.abs(entryPrice - exitPrice) < 0.001) continue;
      trades.push({
        accountId, symbol, direction, entryPrice, exitPrice,
        stopLoss: sl, takeProfit: tp, lotSize,
        entryDate: entryDate.toISOString(),
        exitDate: exitDate?.toISOString() ?? null,
        commission, swap, pnl, status, outcome, session,
        rMultiple: null,
        positionId: positionId || undefined,
      });
    }

    // Kirim dalam batch 50
    const BATCH = 50;
    console.log('Total parsed trades:', trades.length, '| sample positionId:', trades[0]?.positionId);
    setProgress({ current: 0, total: trades.length });
    let totalImported = 0, totalSkipped = 0;

    for (let i = 0; i < trades.length; i += BATCH) {
      const batch = trades.slice(i, i + BATCH);
      const res = await fetch("/api/trades/batch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ accountId, trades: batch }),
      });
      const d = await res.json();
      totalImported += d.imported ?? 0;
      totalSkipped += d.skipped ?? 0;
      setProgress({ current: Math.min(i + BATCH, trades.length), total: trades.length });
    }

    setResult({ imported: totalImported, skipped: totalSkipped, failed: 0 });
    setLoading(false);
    if (totalImported > 0) setTimeout(onImported, 2000);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ backgroundColor: "rgba(0,0,0,0.6)", backdropFilter: "blur(4px)" }}>
      <div className="bg-card border rounded-xl w-full max-w-md shadow-xl" style={{ backgroundColor: "hsl(var(--card))" }}>
        <div className="flex items-center justify-between p-4 border-b">
          <h2 className="text-sm font-medium">Import from CSV</h2>
          <button onClick={onClose} className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-muted">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-4 space-y-4">
          {/* Format info */}
          <div className="bg-muted rounded-lg p-3">
            <p className="text-xs font-medium mb-1">Supported Format</p>
            <p className="text-[11px] text-muted-foreground">
              MT4/MT5 History Export (CSV). Buka MT4/MT5 → Account History → klik kanan → Save as Detailed Report → pilih format CSV.
            </p>
          </div>

          {/* Account select */}
          <div>
            <label className="block text-[11px] text-muted-foreground mb-1">
              Target Account
            </label>
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

          {/* File upload */}
          <div>
            <label className="block text-[11px] text-muted-foreground mb-1">
              File CSV
            </label>
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
                  <p className="text-xs text-muted-foreground">
                    Click or drag CSV file here
                  </p>
                </>
              )}
            </div>
            <input
              ref={fileRef}
              type="file"
              accept=".csv"
              className="hidden"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            />
          </div>

          {/* Progress */}
          {loading && progress.total > 0 && (
            <div className="space-y-1">
              <div className="flex justify-between text-[10px] text-muted-foreground">
                <span>Importing...</span>
                <span>{progress.current}/{progress.total}</span>
              </div>
              <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                <div className="h-full bg-indigo-500 rounded-full transition-all duration-300"
                  style={{ width: `${progress.total > 0 ? (progress.current/progress.total)*100 : 0}%` }} />
              </div>
            </div>
          )}

          {/* Result */}
          {result && (
            <div className={`rounded-lg p-3 flex items-start gap-2 ${result.imported > 0 || result.skipped > 0 ? "bg-green-500/10 text-green-700 dark:text-green-400" : "bg-red-500/10 text-red-700 dark:text-red-400"}`}>
              {result.imported > 0 || result.skipped > 0 ? (
                <CheckCircle className="w-4 h-4 mt-0.5 shrink-0" />
              ) : (
                <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
              )}
              <div className="space-y-0.5">
                {result.imported > 0 && (
                  <p className="text-xs font-medium">{result.imported} trades imported successfully!</p>
                )}
                {result.skipped > 0 && (
                  <p className="text-xs text-muted-foreground">{result.skipped} duplicate trades skipped.</p>
                )}
                {result.imported === 0 && result.skipped === 0 && (
                  <p className="text-xs font-medium">No new trades found.</p>
                )}
                {result.failed > 0 && (
                  <p className="text-[11px] text-muted-foreground">{result.failed} rows failed.</p>
                )}
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
