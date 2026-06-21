"use client";
import { useEffect, useState } from "react";
import { X } from "lucide-react";
import { cn, formatR } from "@/lib/utils";
import { ScreenshotUpload } from "@/components/trades/ScreenshotUpload";

const SESSIONS = [
  { label: "London (07:00–16:00)", value: "london" },
  { label: "New York (14:00–23:00)", value: "newyork" },
  { label: "Asia (00:00–09:00)", value: "asia" },
  { label: "Sydney (04:00–13:00)", value: "sydney" },
];
const TIMEFRAMES = ["M1","M5","M15","M30","H1","H4","D1","W1"];
const MOODS = ["😖","😕","😐","🙂","😎"];
const MOOD_LABELS = ["Very bad","Bad","Neutral","Good","Very confident"];
const SETUP_CATS = ["A","A+","A++","B"];

interface Props {
  trade?: any;
  onClose: () => void;
  onSaved: () => void;
}

export default function TradeFormModal({ trade, onClose, onSaved }: Props) {
  const [setups, setSetups] = useState<any[]>([]);
  const [accounts, setAccounts] = useState<any[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const toDateStr = (d: any) => d ? new Date(d).toISOString().split("T")[0] : "";
  const toTimeStr = (d: any) => d ? new Date(d).toTimeString().slice(0, 5) : "";

  const [form, setForm] = useState({
    accountId: trade?.accountId ?? "",
    symbol: trade?.symbol ?? "",
    direction: trade?.direction ?? "long",
    entryDate: toDateStr(trade?.entryDate) || new Date().toISOString().split("T")[0],
    entryTime: toTimeStr(trade?.entryDate) || "09:00",
    entryPrice: String(trade?.entryPrice ?? ""),
    stopLoss: String(trade?.stopLoss ?? ""),
    takeProfit: String(trade?.takeProfit ?? ""),
    lotSize: String(trade?.lotSize ?? ""),
    exitDate: toDateStr(trade?.exitDate),
    exitTime: toTimeStr(trade?.exitDate),
    exitPrice: String(trade?.exitPrice ?? ""),
    pnl: String(trade?.pnl ?? ""),
    commission: String(trade?.commission ?? "0"),
    swap: String(trade?.swap ?? "0"),
    setupId: trade?.setupId ?? "",
    setupCategory: trade?.setupCategory ?? "",
    session: trade?.session ?? "",
    timeframe: trade?.timeframe ?? "H4",
    notes: trade?.notes ?? "",
    mood: trade?.mood ?? 3,
    tags: (trade?.tags ?? []).join(", "),
  });

  const [calc, setCalc] = useState({ riskPips: 0, rewardPips: 0, rr: 0, rMultiple: 0 });

  useEffect(() => {
    fetch("/api/setups").then((r) => r.json()).then(setSetups);
    fetch("/api/dashboard").then((r) => r.json()).then((d) => {
      setAccounts(d.accounts ?? []);
      if (!form.accountId && d.account) setForm((f) => ({ ...f, accountId: d.account.id }));
    });
  }, []);

  useEffect(() => {
    const entry = parseFloat(form.entryPrice);
    const sl = parseFloat(form.stopLoss);
    const tp = parseFloat(form.takeProfit);
    const exit = parseFloat(form.exitPrice);
    if (!entry || !sl) return;
    const riskPips = Math.abs(entry - sl);
    const rewardPips = tp ? Math.abs(tp - entry) : 0;
    const rr = rewardPips && riskPips ? rewardPips / riskPips : 0;
    let rMultiple = 0;
    if (exit && riskPips) {
      const diff = form.direction === "long" ? exit - entry : entry - exit;
      rMultiple = Math.round((diff / riskPips) * 10) / 10;
    }
    setCalc({
      riskPips: Math.round(riskPips * 100) / 100,
      rewardPips: Math.round(rewardPips * 100) / 100,
      rr: Math.round(rr * 100) / 100,
      rMultiple,
    });
  }, [form.entryPrice, form.stopLoss, form.takeProfit, form.exitPrice, form.direction]);

  const set = (key: string) => (e: any) => setForm((f) => ({ ...f, [key]: e.target?.value ?? e }));

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError("");
    const payload = { ...form, tags: form.tags.split(",").map((t: string) => t.trim()).filter(Boolean) };
    const isEdit = !!trade;
    const res = await fetch(isEdit ? `/api/trades/${trade.id}` : "/api/trades", {
      method: isEdit ? "PATCH" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (res.ok) { onSaved(); } else {
      try {
        const d = await res.json();
        setError(d.error ?? "Failed to save trade");
      } catch { setError("Failed to save trade"); }
    }
    setSaving(false);
  }

  const inputCls = "w-full text-xs px-3 py-2 rounded-xl border bg-background focus:outline-none focus:ring-2 focus:ring-indigo-500/50 transition-all";
  const labelCls = "block text-[11px] text-muted-foreground mb-1";

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white dark:bg-zinc-900 border rounded-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b sticky top-0 bg-white dark:bg-zinc-900 z-10 rounded-t-xl">
          <div>
            <h2 className="text-sm font-semibold">{trade ? "Edit Trade" : "New Trade"}</h2>
            <p className="text-xs text-muted-foreground">Forex & Commodities</p>
          </div>
          <button onClick={onClose} className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-muted transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-4 space-y-4">
          {/* Account */}
          <div>
            <label className={labelCls}>Trading Account</label>
            <select className={inputCls} value={form.accountId} onChange={set("accountId")} required>
              <option value="">Select account...</option>
              {accounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
            </select>
          </div>

          {/* Basic Info */}
          <div className="border-t pt-3">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium mb-3">Basic Info</p>

            <div className="grid grid-cols-2 gap-3 mb-3">
              <div>
                <label className={labelCls}>Symbol</label>
                <input className={cn(inputCls, "uppercase")} value={form.symbol} onChange={set("symbol")}
                  placeholder="XAUUSD, EURUSD..." required />
              </div>
              <div>
                <label className={labelCls}>Side</label>
                <div className="flex gap-2">
                  {["long","short"].map((d) => (
                    <button key={d} type="button" onClick={() => setForm((f) => ({ ...f, direction: d }))}
                      className={cn("flex-1 py-1.5 text-xs font-medium rounded-lg border transition-colors",
                        form.direction === d && d === "long" ? "bg-[#dcfce7] text-[#15803d] border-[#86efac]"
                        : form.direction === d && d === "short" ? "bg-[#fee2e2] text-[#b91c1c] border-[#fca5a5]"
                        : "text-muted-foreground hover:bg-muted"
                      )}>
                      {d === "long" ? "Long ↑" : "Short ↓"}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="grid grid-cols-4 gap-2 mb-3">
              <div><label className={labelCls}>Entry Price</label><input className={inputCls} value={form.entryPrice} onChange={set("entryPrice")} placeholder="0.00" required /></div>
              <div><label className={labelCls}>Stop Loss</label><input className={inputCls} value={form.stopLoss} onChange={set("stopLoss")} placeholder="0.00" /></div>
              <div><label className={labelCls}>Take Profit</label><input className={inputCls} value={form.takeProfit} onChange={set("takeProfit")} placeholder="0.00" /></div>
              <div><label className={labelCls}>Lot Size</label><input className={inputCls} value={form.lotSize} onChange={set("lotSize")} placeholder="0.01" required /></div>
            </div>

            <div className="grid grid-cols-4 gap-2 mb-3">
              <div className="col-span-2"><label className={labelCls}>Entry Date</label><input type="date" className={inputCls} value={form.entryDate} onChange={set("entryDate")} required /></div>
              <div><label className={labelCls}>Entry Time</label><input type="time" className={inputCls} value={form.entryTime} onChange={set("entryTime")} /></div>
              <div><label className={labelCls}>Commission ($)</label><input className={inputCls} value={form.commission} onChange={set("commission")} placeholder="0.00" /></div>
            </div>

            <div className="grid grid-cols-4 gap-2">
              <div><label className={labelCls}>Exit Price</label><input className={inputCls} value={form.exitPrice} onChange={set("exitPrice")} placeholder="0.00" /></div>
              <div><label className={labelCls}>Exit Date</label><input type="date" className={inputCls} value={form.exitDate} onChange={set("exitDate")} /></div>
              <div><label className={labelCls}>Exit Time</label><input type="time" className={inputCls} value={form.exitTime} onChange={set("exitTime")} /></div>
              <div><label className={labelCls}>P&L ($)</label><input className={inputCls} value={form.pnl} onChange={set("pnl")} placeholder="0.00" /></div>
            </div>
          </div>

          {/* Auto calc */}
          {(form.entryPrice && form.stopLoss) && (
            <div className="bg-muted/60 border rounded-lg p-3 grid grid-cols-2 gap-y-1.5 gap-x-4">
              <div className="flex justify-between"><span className="text-[11px] text-muted-foreground">Risk (SL distance)</span><span className="text-[11px] font-medium">{calc.riskPips} pts</span></div>
              <div className="flex justify-between"><span className="text-[11px] text-muted-foreground">Reward (TP distance)</span><span className="text-[11px] font-medium">{calc.rewardPips} pts</span></div>
              <div className="flex justify-between"><span className="text-[11px] text-muted-foreground">R:R Ratio</span><span className="text-[11px] font-medium">1 : {calc.rr}</span></div>
              <div className="flex justify-between"><span className="text-[11px] text-muted-foreground">Actual R-Multiple</span>
                <span className={cn("text-[11px] font-medium", calc.rMultiple > 0 ? "text-[#16a34a]" : calc.rMultiple < 0 ? "text-[#dc2626]" : "")}>
                  {formatR(calc.rMultiple)}
                </span>
              </div>
            </div>
          )}

          {/* Context */}
          <div className="border-t pt-3">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium mb-3">Context & Analysis</p>

            <div className="grid grid-cols-4 gap-2 mb-3">
              <div>
                <label className={labelCls}>Setup / Strategy</label>
                <select className={inputCls} value={form.setupId} onChange={set("setupId")}>
                  <option value="">Select setup...</option>
                  {setups.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </div>
              <div>
                <label className={labelCls}>Setup Category</label>
                <div className="flex gap-1">
                  {SETUP_CATS.map((cat) => (
                    <button key={cat} type="button" onClick={() => setForm((f) => ({ ...f, setupCategory: f.setupCategory === cat ? "" : cat }))}
                      className={cn("flex-1 py-1.5 text-[11px] font-bold rounded-lg border transition-colors",
                        form.setupCategory === cat
                          ? "bg-indigo-600 text-white border-indigo-600"
                          : "text-muted-foreground hover:bg-muted"
                      )}>
                      {cat}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className={labelCls}>Trading Session</label>
                <select className={inputCls} value={form.session} onChange={set("session")}>
                  <option value="">Select session...</option>
                  {SESSIONS.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
                </select>
              </div>
              <div>
                <label className={labelCls}>Timeframe</label>
                <select className={inputCls} value={form.timeframe} onChange={set("timeframe")}>
                  {TIMEFRAMES.map((tf) => <option key={tf} value={tf}>{tf}</option>)}
                </select>
              </div>
            </div>

            <div className="mb-3">
              <label className={labelCls}>Mood at Entry</label>
              <div className="flex gap-2">
                {MOODS.map((emoji, i) => (
                  <button key={i} type="button" onClick={() => setForm((f) => ({ ...f, mood: i + 1 }))}
                    className={cn("flex-1 py-1.5 text-lg rounded-lg border transition-colors",
                      form.mood === i + 1 ? "bg-muted border-foreground" : "hover:bg-muted"
                    )} title={MOOD_LABELS[i]}>
                    {emoji}
                  </button>
                ))}
              </div>
            </div>

            <div className="mb-3">
              <label className={labelCls}>Tags (comma separated)</label>
              <input className={inputCls} value={form.tags} onChange={set("tags")} placeholder="snr, confluence, breakout..." />
            </div>

            <div>
              <label className={labelCls}>Notes & Analysis</label>
              <textarea className={cn(inputCls, "min-h-[72px] resize-y")} value={form.notes} onChange={set("notes")}
                placeholder="Setup, reasoning, what happened..." />
            </div>
          </div>

          {/* Screenshots */}
          <div className="border-t pt-3">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium mb-3">Chart Screenshots</p>
            <div className="grid grid-cols-2 gap-3">
              <ScreenshotUpload
                label="Before Entry"
                value={form.screenshotBefore}
                onChange={(url) => setForm(f => ({ ...f, screenshotBefore: url }))}
              />
              <ScreenshotUpload
                label="After Exit"
                value={form.screenshotAfter}
                onChange={(url) => setForm(f => ({ ...f, screenshotAfter: url }))}
              />
            </div>
          </div>

          {error && <p className="text-xs text-destructive bg-destructive/10 px-3 py-2 rounded-lg">{error}</p>}

          <div className="flex items-center justify-between pt-2 border-t">
            <button type="button" onClick={onClose}
              className="text-xs px-4 py-2 rounded-lg border text-muted-foreground hover:bg-muted transition-colors">
              Cancel
            </button>
            <button type="submit" disabled={saving}
              className="text-xs px-5 py-2 rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 transition-colors disabled:opacity-60 font-medium">
              {saving ? "Saving..." : trade ? "Save Changes" : "Save Trade"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
