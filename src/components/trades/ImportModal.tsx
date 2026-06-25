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

  async function handleImport() {
    if (!file || !accountId) return;
    setLoading(true);

    const fd = new FormData();
    fd.append("file", file);
    fd.append("accountId", accountId);

    const res = await fetch("/api/trades/import", { method: "POST", body: fd });
    const data = await res.json();
    setResult(data);
    setLoading(false);

    if (data.imported > 0) {
      setTimeout(onImported, 2000);
    }
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
