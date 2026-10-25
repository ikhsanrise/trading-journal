"use client";
import { useCallback, useRef, useState } from "react";
import { UploadCloud, FileText, CheckCircle2, AlertTriangle } from "lucide-react";
import { Modal, FIELD, FIELD_LABEL } from "./Modal";
import type { EaAcc } from "./AccountDialog";
import { BTN_PRIMARY } from "@/lib/theme";
import { cn } from "@/lib/utils";
import { makeFmt } from "@/lib/ea-fmt";
import { dayShort } from "@/lib/ea-calc";

type Preview = {
  format: string; unit: string; accountName: string; newTrades: number; newDeals: number; dupDeals: number;
  newFlows: number; dupFlows: number; netUsd: number; withdrawUsd: number; depositUsd: number;
  periodFrom: string | null; periodTo: string | null; totalRows: number; warnings: string[];
  sample: { kind: string; ticket: string; time: string; symbol: string | null; side: string | null; amountUsd: number }[];
};

export default function UploadDialog({ accounts, defaultAccountId, onClose, onDone, onNewAccount }: {
  accounts: EaAcc[]; defaultAccountId?: string; onClose: () => void; onDone: () => void; onNewAccount: () => void;
}) {
  const [accountId, setAccountId] = useState(defaultAccountId && accounts.some((a) => a.id === defaultAccountId) ? defaultAccountId : accounts[0]?.id ?? "");
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [drag, setDrag] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const usd = makeFmt("usd", 1);

  const run = useCallback(async (f: File, accId: string, mode: "preview" | "commit") => {
    const fd = new FormData();
    fd.append("file", f); fd.append("accountId", accId); fd.append("mode", mode);
    const res = await fetch("/api/ea/upload", { method: "POST", body: fd });
    const j = await res.json().catch(() => ({}));
    return { ok: res.ok, j };
  }, []);

  async function pick(f: File | null, accId = accountId) {
    setFile(f); setPreview(null); setErr("");
    if (!f) return;
    if (!accId) { setErr("Pilih akun EA terlebih dulu"); return; }
    setBusy(true);
    const { ok, j } = await run(f, accId, "preview");
    setBusy(false);
    if (!ok) { setErr(j.error ?? "File tidak bisa dibaca"); return; }
    setPreview(j);
  }

  async function commit() {
    if (!file || !accountId) return;
    setBusy(true); setErr("");
    const { ok, j } = await run(file, accountId, "commit");
    setBusy(false);
    if (!ok) { setErr(j.error ?? "Gagal menyimpan"); return; }
    onDone();
  }

  const nothingNew = preview && preview.newDeals === 0 && preview.newFlows === 0;

  return (
    <Modal wide title="Unggah Laporan EA" subtitle="Pilih akun, unggah file CSV riwayat deal dari MetaTrader 5, lalu cek hasil bacanya sebelum disimpan." onClose={onClose}>
      <div className="flex flex-col gap-5">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <label className="flex flex-col gap-2">
            <span className={FIELD_LABEL}>Akun EA</span>
            <select className={FIELD} value={accountId} onChange={(e) => { setAccountId(e.target.value); if (file) pick(file, e.target.value); }}>
              {accounts.length === 0 && <option value="">Belum ada akun</option>}
              {accounts.map((a) => <option key={a.id} value={a.id}>{a.name}{a.unit === "USC" ? " (USC)" : ""}</option>)}
            </select>
            <button type="button" onClick={onNewAccount} className="self-start text-xs font-bold text-[#3b57e8] dark:text-[#9db0ff] hover:underline">+ Akun baru</button>
          </label>
          <div className="flex flex-col gap-2">
            <span className={FIELD_LABEL}>File laporan</span>
            <button type="button" onClick={() => inputRef.current?.click()}
              onDragOver={(e) => { e.preventDefault(); setDrag(true); }} onDragLeave={() => setDrag(false)}
              onDrop={(e) => { e.preventDefault(); setDrag(false); const f = e.dataTransfer.files?.[0]; if (f) pick(f); }}
              className={cn("h-12 w-full rounded-xl border border-dashed px-3.5 flex items-center gap-2.5 text-sm font-semibold transition-colors text-left",
                drag ? "border-[#7a8cff] bg-[#4f6bff]/20" : file ? "border-emerald-400/50 bg-emerald-400/10" : "border-[#7a8cff]/40 bg-secondary/40 dark:bg-white/5 hover:border-[#7a8cff]")}>
              {file ? <FileText className="w-[18px] h-[18px] text-emerald-500 dark:text-[#4ade80] shrink-0" /> : <UploadCloud className="w-[18px] h-[18px] text-[#4f6bff] shrink-0" />}
              <span className="flex-1 truncate font-mono text-[13px]">{file ? file.name : "Pilih atau tarik file .csv ke sini"}</span>
              {file && <span className="text-xs text-muted-foreground">{Math.max(1, Math.round(file.size / 1024))} KB</span>}
            </button>
            <input ref={inputRef} type="file" accept=".csv,text/csv,.txt" className="hidden" onChange={(e) => { pick(e.target.files?.[0] ?? null); e.target.value = ""; }} />
            <span className="text-xs text-muted-foreground dark:text-[#8a94c4]">CSV dari MT5. Deposit dan withdraw dibaca dari baris balance.</span>
          </div>
        </div>

        {busy && !preview && <p className="text-sm text-muted-foreground dark:text-[#8a94c4]">Membaca file...</p>}

        {err && (
          <div role="alert" className="flex items-start gap-2.5 rounded-xl border border-red-400/40 bg-red-400/10 p-3.5 text-sm font-semibold text-red-600 dark:text-[#fca5a5]">
            <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" /><span>{err}</span>
          </div>
        )}

        {preview && (
          <div className="flex flex-col gap-3.5 rounded-2xl border border-border dark:border-[#7a8cff]/20 bg-secondary/30 dark:bg-white/[0.04] p-4 md:p-[18px]">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className={cn("flex items-center gap-2 text-sm font-bold", nothingNew ? "text-amber-500 dark:text-[#facc15]" : "text-emerald-600 dark:text-[#4ade80]")}>
                <CheckCircle2 className="w-[18px] h-[18px]" />{nothingNew ? "Semua data di file ini sudah pernah diunggah" : "Laporan terbaca dengan baik"}
              </span>
              <span className="text-[12.5px] text-muted-foreground dark:text-[#8a94c4]">
                {preview.periodFrom && preview.periodTo ? `Periode ${dayShort(preview.periodFrom)} – ${dayShort(preview.periodTo)}` : ""} · akun {preview.unit}
              </span>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {[
                { l: "Trade baru", v: String(preview.newTrades) },
                { l: "Duplikat dilewati", v: String(preview.dupDeals) },
                { l: "Profit data baru", v: usd.moneyS(preview.netUsd), c: preview.netUsd >= 0 ? "text-emerald-600 dark:text-[#4ade80]" : "text-red-600 dark:text-[#f87171]" },
                { l: "Deposit / withdraw", v: `${preview.newFlows} baru` },
              ].map((x) => (
                <div key={x.l} className="rounded-xl bg-card/60 dark:bg-white/[0.04] p-3">
                  <div className="text-[11px] font-bold uppercase tracking-[0.08em] text-muted-foreground dark:text-[#8a94c4]">{x.l}</div>
                  <div className={cn("mt-1 font-mono text-[17px] font-bold tabular-nums", x.c)}>{x.v}</div>
                </div>
              ))}
            </div>
            {preview.sample.length > 0 && (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[460px] text-[13px]">
                  <thead><tr className="text-left text-[11px] font-bold tracking-[0.08em] uppercase text-muted-foreground dark:text-[#8a94c4]">
                    <th className="py-2 pr-3 font-bold">Deal</th><th className="py-2 pr-3 font-bold">Waktu</th><th className="py-2 pr-3 font-bold">Tipe</th><th className="py-2 pl-3 text-right font-bold">Hasil</th>
                  </tr></thead>
                  <tbody>
                    {preview.sample.map((s) => (
                      <tr key={s.kind + s.ticket} className="border-t border-border/60 dark:border-[#7a8cff]/12">
                        <td className="py-2 pr-3 font-mono">{s.ticket}</td>
                        <td className="py-2 pr-3 font-mono text-muted-foreground">{s.time.slice(0, 16).replace("T", " ")}</td>
                        <td className="py-2 pr-3">{s.kind === "trade" ? `${s.symbol ?? ""} ${s.side ?? ""}` : s.kind === "deposit" ? "Deposit" : "Withdraw"}</td>
                        <td className={cn("py-2 pl-3 text-right font-mono font-bold tabular-nums", s.kind === "withdraw" ? "text-amber-500 dark:text-[#facc15]" : s.amountUsd >= 0 ? "text-emerald-600 dark:text-[#4ade80]" : "text-red-600 dark:text-[#f87171]")}>{usd.moneyS(s.amountUsd)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <p className="pt-2 text-xs text-muted-foreground dark:text-[#8a94c4]">Menampilkan sebagian dari {preview.newDeals + preview.newFlows} baris baru.</p>
              </div>
            )}
            {preview.warnings.map((w) => (
              <p key={w} className="flex items-start gap-2 text-xs text-amber-600 dark:text-[#facc15]"><AlertTriangle className="w-3.5 h-3.5 mt-0.5 shrink-0" />{w}</p>
            ))}
          </div>
        )}

        <p className="text-[13px] text-muted-foreground dark:text-[#a9b3da]">Data digabung dengan yang sudah ada. Tiket yang sama dilewati, jadi unggahan ulang tidak menggandakan trade.</p>

        <div className="flex flex-wrap justify-end gap-3">
          <button type="button" onClick={onClose} className="h-[46px] px-5 rounded-xl border border-border dark:border-[#7a8cff]/30 bg-secondary/40 dark:bg-white/5 text-sm font-bold">Batal</button>
          <button type="button" onClick={commit} disabled={!preview || busy || !!nothingNew} className={cn("h-[46px] px-6 rounded-xl text-sm font-bold disabled:opacity-50 disabled:cursor-not-allowed", BTN_PRIMARY)}>
            {busy && preview ? "Menyimpan..." : preview ? `Simpan ${preview.newTrades} trade` : "Simpan"}
          </button>
        </div>
      </div>
    </Modal>
  );
}
