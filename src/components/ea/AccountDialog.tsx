"use client";
import { useState } from "react";
import { Trash2 } from "lucide-react";
import { Modal, FIELD, FIELD_LABEL } from "./Modal";
import { BTN_PRIMARY } from "@/lib/theme";
import { cn } from "@/lib/utils";

export type EaAcc = { id: string; name: string; symbol: string | null; magic: string | null; login: string | null; unit: string; color: string; lastUploadAt: string | null };

export default function AccountDialog({ account, onClose, onSaved }: { account?: EaAcc | null; onClose: () => void; onSaved: (id?: string) => void }) {
  const [name, setName] = useState(account?.name ?? "");
  const [symbol, setSymbol] = useState(account?.symbol ?? "");
  const [magic, setMagic] = useState(account?.magic ?? "");
  const [login, setLogin] = useState(account?.login ?? "");
  const [unit, setUnit] = useState(account?.unit ?? "USD");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  async function save() {
    if (!name.trim()) { setErr("Nama EA wajib diisi"); return; }
    setBusy(true); setErr("");
    const res = await fetch(account ? `/api/ea/accounts/${account.id}` : "/api/ea/accounts", {
      method: account ? "PATCH" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, symbol, magic, login, unit }),
    });
    const j = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) { setErr(j.error ?? "Gagal menyimpan"); return; }
    onSaved(j.id);
  }

  async function remove() {
    if (!account) return;
    if (!window.confirm(`Hapus "${account.name}" beserta semua trade dan arus dananya? Tindakan ini tidak bisa dibatalkan.`)) return;
    setBusy(true);
    const res = await fetch(`/api/ea/accounts/${account.id}`, { method: "DELETE" });
    setBusy(false);
    if (res.ok) onSaved(undefined);
    else setErr("Gagal menghapus");
  }

  return (
    <Modal title={account ? "Ubah akun EA" : "Tambah akun EA"} subtitle="Satu akun MT5 yang menjalankan satu atau beberapa EA." onClose={onClose}>
      <div className="flex flex-col gap-4">
        <label className="flex flex-col gap-2"><span className={FIELD_LABEL}>Nama EA</span>
          <input className={FIELD} value={name} onChange={(e) => setName(e.target.value)} placeholder="mis. EA Gold Scalper" autoFocus /></label>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <label className="flex flex-col gap-2"><span className={FIELD_LABEL}>Simbol (opsional)</span>
            <input className={FIELD} value={symbol} onChange={(e) => setSymbol(e.target.value)} placeholder="XAUUSD" /></label>
          <label className="flex flex-col gap-2"><span className={FIELD_LABEL}>Magic number (opsional)</span>
            <input className={FIELD} value={magic} onChange={(e) => setMagic(e.target.value)} placeholder="10021" /></label>
        </div>
        <label className="flex flex-col gap-2"><span className={FIELD_LABEL}>Nomor akun MT5 (opsional)</span>
          <input className={FIELD} value={login} onChange={(e) => setLogin(e.target.value)} placeholder="mis. 10021" /></label>
        <div className="flex flex-col gap-2">
          <span className={FIELD_LABEL}>Satuan saldo akun</span>
          <div className="grid grid-cols-2 gap-3">
            {[{ id: "USD", t: "USD", s: "Akun dolar biasa" }, { id: "USC", t: "USC (cent)", s: "100 USC = 1 USD" }].map((o) => (
              <button key={o.id} type="button" onClick={() => setUnit(o.id)}
                className={cn("text-left rounded-xl border px-4 py-3 transition-colors", unit === o.id ? "border-[#7a8cff] bg-[#4f6bff]/20" : "border-border dark:border-[#7a8cff]/20 bg-secondary/30 dark:bg-white/[0.04] hover:border-[#7a8cff]/60")}>
                <div className="text-sm font-bold">{o.t}</div>
                <div className="text-xs text-muted-foreground dark:text-[#8a94c4] mt-0.5">{o.s}</div>
              </button>
            ))}
          </div>
          <p className="text-xs text-muted-foreground dark:text-[#8a94c4]">Akun cent otomatis dikonversi ke USD (dibagi 100) di seluruh halaman.</p>
        </div>
        {err && <p className="text-sm font-semibold text-red-500 dark:text-[#f87171]" role="alert">{err}</p>}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
          {account ? (
            <button type="button" onClick={remove} disabled={busy} className="inline-flex items-center gap-2 h-11 px-4 rounded-xl border border-red-400/40 text-red-500 dark:text-[#f87171] text-sm font-semibold hover:bg-red-400/10 disabled:opacity-50">
              <Trash2 className="w-4 h-4" />Hapus akun
            </button>
          ) : <span />}
          <div className="flex gap-3">
            <button type="button" onClick={onClose} className="h-11 px-5 rounded-xl border border-border dark:border-[#7a8cff]/30 bg-secondary/40 dark:bg-white/5 text-sm font-bold">Batal</button>
            <button type="button" onClick={save} disabled={busy} className={cn("h-11 px-6 rounded-xl text-sm font-bold disabled:opacity-60", BTN_PRIMARY)}>{busy ? "Menyimpan..." : "Simpan"}</button>
          </div>
        </div>
      </div>
    </Modal>
  );
}
