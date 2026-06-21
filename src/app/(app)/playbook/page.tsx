"use client";
import { useEffect, useState } from "react";
import { Plus, BookOpen, TrendingUp, Target, Pencil, Trash2, X, ChevronDown, ChevronUp } from "lucide-react";
import { cn, formatCurrency, formatR } from "@/lib/utils";

const TIMEFRAMES = ["M1","M5","M15","M30","H1","H4","D1","W1"];

function SetupCatBadge({ cat }: { cat: string | null }) {
  if (!cat) return null;
  const colors: Record<string, string> = {
    "A++": "bg-indigo-100 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 border-indigo-300",
    "A+":  "bg-violet-100 dark:bg-violet-950 text-violet-700 dark:text-violet-300 border-violet-300",
    "A":   "bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-300 border-blue-300",
    "B":   "bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 border-zinc-300",
  };
  return <span className={cn("text-[10px] font-bold px-1.5 py-0.5 rounded border", colors[cat] ?? "")}>{cat}</span>;
}

function SetupFormModal({ setup, onClose, onSaved }: { setup?: any; onClose: () => void; onSaved: () => void }) {
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    name: setup?.name ?? "",
    description: setup?.description ?? "",
    rules: setup?.rules ?? "",
    timeframe: setup?.timeframe ?? "H4",
    expectedRR: String(setup?.expectedRR ?? ""),
    tags: (setup?.tags ?? []).join(", "),
  });

  const set = (key: string) => (e: any) => setForm(f => ({ ...f, [key]: e.target.value }));

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    const payload = { ...form, tags: form.tags.split(",").map((t: string) => t.trim()).filter(Boolean), expectedRR: form.expectedRR ? parseFloat(form.expectedRR) : null };
    const res = await fetch(setup ? `/api/setups/${setup.id}` : "/api/setups", {
      method: setup ? "PATCH" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (res.ok) onSaved();
    setSaving(false);
  }

  const inputCls = "w-full text-xs px-3 py-2 rounded-xl border bg-background focus:outline-none focus:ring-2 focus:ring-indigo-500/50 transition-all";
  const labelCls = "block text-[11px] text-muted-foreground mb-1";

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white dark:bg-zinc-900 border rounded-xl w-full max-w-lg shadow-2xl">
        <div className="flex items-center justify-between p-4 border-b">
          <h2 className="text-sm font-semibold">{setup ? "Edit Setup" : "New Setup"}</h2>
          <button onClick={onClose} className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-muted"><X className="w-4 h-4" /></button>
        </div>
        <form onSubmit={handleSubmit} className="p-4 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <label className={labelCls}>Setup Name</label>
              <input className={inputCls} value={form.name} onChange={set("name")} placeholder="e.g. Break & Retest" required />
            </div>
            <div>
              <label className={labelCls}>Timeframe</label>
              <select className={inputCls} value={form.timeframe} onChange={set("timeframe")}>
                {TIMEFRAMES.map(tf => <option key={tf} value={tf}>{tf}</option>)}
              </select>
            </div>
            <div>
              <label className={labelCls}>Expected R:R</label>
              <input className={inputCls} value={form.expectedRR} onChange={set("expectedRR")} placeholder="2.5" />
            </div>
          </div>
          <div>
            <label className={labelCls}>Description</label>
            <textarea className={cn(inputCls, "min-h-[64px] resize-y")} value={form.description} onChange={set("description")} placeholder="Brief description of this setup..." />
          </div>
          <div>
            <label className={labelCls}>Rules & Checklist</label>
            <textarea className={cn(inputCls, "min-h-[96px] resize-y")} value={form.rules} onChange={set("rules")} placeholder={"1. Wait for structure break\n2. Look for retest\n3. Entry on confirmation candle\n4. SL below swing low"} />
          </div>
          <div>
            <label className={labelCls}>Tags (comma separated)</label>
            <input className={inputCls} value={form.tags} onChange={set("tags")} placeholder="snr, momentum, reversal..." />
          </div>
          <div className="flex justify-between pt-2 border-t">
            <button type="button" onClick={onClose} className="text-xs px-4 py-2 rounded-lg border text-muted-foreground hover:bg-muted transition-colors">Cancel</button>
            <button type="submit" disabled={saving} className="text-xs px-5 py-2 rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 transition-colors disabled:opacity-60 font-medium">
              {saving ? "Saving..." : setup ? "Save Changes" : "Create Setup"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function SetupCard({ setup, onEdit, onDelete, stats }: { setup: any; onEdit: () => void; onDelete: () => void; stats: any }) {
  const [expanded, setExpanded] = useState(false);
  const wr = stats?.winRate ?? null;
  const trades = stats?.totalTrades ?? 0;
  const pnl = stats?.netPnL ?? null;
  const avgR = stats?.avgR ?? null;

  return (
    <div className="bg-card border rounded-xl overflow-hidden">
      <div className="p-4">
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-indigo-100 dark:bg-indigo-950 flex items-center justify-center">
              <BookOpen className="w-4 h-4 text-indigo-600" />
            </div>
            <div>
              <h3 className="text-sm font-semibold">{setup.name}</h3>
              <div className="flex items-center gap-1.5 mt-0.5">
                {setup.timeframe && <span className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground border">{setup.timeframe}</span>}
                {setup.expectedRR && <span className="text-[10px] text-muted-foreground">RR: {setup.expectedRR}</span>}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-1">
            <button onClick={onEdit} className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-muted text-muted-foreground"><Pencil className="w-3.5 h-3.5" /></button>
            <button onClick={onDelete} className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-[#fee2e2] hover:text-[#dc2626] text-muted-foreground"><Trash2 className="w-3.5 h-3.5" /></button>
          </div>
        </div>

        {/* Stats row */}
        <div className="grid grid-cols-4 gap-2 mb-3">
          <div className="bg-muted/50 rounded-lg p-2 text-center">
            <p className="text-[10px] text-muted-foreground">Trades</p>
            <p className="text-sm font-semibold">{trades}</p>
          </div>
          <div className="bg-muted/50 rounded-lg p-2 text-center">
            <p className="text-[10px] text-muted-foreground">Win Rate</p>
            <p className={cn("text-sm font-semibold", wr !== null ? (wr >= 50 ? "text-[#16a34a]" : "text-[#dc2626]") : "")}>
              {wr !== null ? `${wr.toFixed(0)}%` : "—"}
            </p>
          </div>
          <div className="bg-muted/50 rounded-lg p-2 text-center">
            <p className="text-[10px] text-muted-foreground">Avg R</p>
            <p className={cn("text-sm font-semibold", avgR !== null ? (avgR > 0 ? "text-[#16a34a]" : "text-[#dc2626]") : "")}>
              {avgR !== null ? formatR(avgR) : "—"}
            </p>
          </div>
          <div className="bg-muted/50 rounded-lg p-2 text-center">
            <p className="text-[10px] text-muted-foreground">Net P&L</p>
            <p className={cn("text-sm font-semibold", pnl !== null ? (pnl > 0 ? "text-[#16a34a]" : "text-[#dc2626]") : "")}>
              {pnl !== null ? formatCurrency(pnl) : "—"}
            </p>
          </div>
        </div>

        {/* Description */}
        {setup.description && <p className="text-xs text-muted-foreground mb-2">{setup.description}</p>}

        {/* Tags */}
        {setup.tags?.length > 0 && (
          <div className="flex flex-wrap gap-1 mb-2">
            {setup.tags.map((tag: string) => (
              <span key={tag} className="text-[10px] px-2 py-0.5 rounded-full bg-indigo-100 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800">{tag}</span>
            ))}
          </div>
        )}

        {/* Rules toggle */}
        {setup.rules && (
          <button onClick={() => setExpanded(!expanded)} className="flex items-center gap-1 text-[11px] text-indigo-600 hover:underline">
            {expanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
            {expanded ? "Hide rules" : "Show rules & checklist"}
          </button>
        )}
      </div>

      {/* Expanded rules */}
      {expanded && setup.rules && (
        <div className="border-t px-4 py-3 bg-muted/30">
          <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider mb-2">Rules & Checklist</p>
          <pre className="text-xs text-foreground whitespace-pre-wrap font-sans leading-relaxed">{setup.rules}</pre>
        </div>
      )}
    </div>
  );
}

export default function PlaybookPage() {
  const [setups, setSetups] = useState<any[]>([]);
  const [setupStats, setSetupStats] = useState<Record<string, any>>({});
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editSetup, setEditSetup] = useState<any>(null);

  async function fetchSetups() {
    setLoading(true);
    const [setupsRes, statsRes] = await Promise.all([
      fetch("/api/setups"),
      fetch("/api/setups/stats"),
    ]);
    const setupsData = await setupsRes.json();
    const statsData = statsRes.ok ? await statsRes.json() : {};
    setSetups(Array.isArray(setupsData) ? setupsData : []);
    setSetupStats(statsData);
    setLoading(false);
  }

  useEffect(() => { fetchSetups(); }, []);

  async function deleteSetup(id: string) {
    if (!confirm("Delete this setup? Trades using it will not be deleted.")) return;
    await fetch(`/api/setups/${id}`, { method: "DELETE" });
    fetchSetups();
  }

  const totalTrades = Object.values(setupStats).reduce((s: number, v: any) => s + (v.totalTrades ?? 0), 0);
  const totalPnL = Object.values(setupStats).reduce((s: number, v: any) => s + (v.netPnL ?? 0), 0);

  return (
    <div className="p-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-sm font-semibold">Playbook</h1>
          <p className="text-xs text-muted-foreground mt-0.5">Manage your trading setups & strategies</p>
        </div>
        <button onClick={() => { setEditSetup(null); setShowForm(true); }}
          className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 transition-colors">
          <Plus className="w-3.5 h-3.5" /> New Setup
        </button>
      </div>

      {/* Summary */}
      {setups.length > 0 && (
        <div className="grid grid-cols-3 gap-3 mb-4">
          <div className="bg-card border rounded-xl p-3">
            <p className="text-[11px] text-muted-foreground mb-1">Total Setups</p>
            <p className="text-xl font-semibold">{setups.length}</p>
          </div>
          <div className="bg-card border rounded-xl p-3">
            <p className="text-[11px] text-muted-foreground mb-1">Total Trades</p>
            <p className="text-xl font-semibold">{totalTrades}</p>
          </div>
          <div className="bg-card border rounded-xl p-3">
            <p className="text-[11px] text-muted-foreground mb-1">Combined P&L</p>
            <p className={cn("text-xl font-semibold", totalPnL > 0 ? "text-[#16a34a]" : totalPnL < 0 ? "text-[#dc2626]" : "")}>
              {formatCurrency(totalPnL)}
            </p>
          </div>
        </div>
      )}

      {/* Setup cards */}
      {loading ? (
        <div className="flex items-center justify-center h-48 text-muted-foreground text-sm">Loading...</div>
      ) : setups.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-64 text-center">
          <div className="w-12 h-12 rounded-xl bg-indigo-100 dark:bg-indigo-950 flex items-center justify-center mb-3">
            <BookOpen className="w-6 h-6 text-indigo-600" />
          </div>
          <p className="text-sm font-medium mb-1">No setups yet</p>
          <p className="text-xs text-muted-foreground mb-4">Create your first trading setup to track performance per strategy</p>
          <button onClick={() => setShowForm(true)}
            className="text-xs px-4 py-2 rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 transition-colors">
            Create First Setup
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3">
          {setups.map((setup) => (
            <SetupCard
              key={setup.id}
              setup={setup}
              stats={setupStats[setup.id]}
              onEdit={() => { setEditSetup(setup); setShowForm(true); }}
              onDelete={() => deleteSetup(setup.id)}
            />
          ))}
        </div>
      )}

      {showForm && (
        <SetupFormModal
          setup={editSetup}
          onClose={() => setShowForm(false)}
          onSaved={() => { setShowForm(false); fetchSetups(); }}
        />
      )}
    </div>
  );
}
