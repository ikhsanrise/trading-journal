"use client";
import { useEffect, useState } from "react";
import { Plus, Pencil, Trash2, X, Check, AlertTriangle, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { PANEL, BTN_PRIMARY, PAGE, H1, SUB, H2, CAP, LABEL, WIN, LOSS } from "@/lib/theme";

const TIMEFRAMES = ["M1", "M5", "M15", "M30", "H1", "H4", "D1", "W1"];
const GRADES = ["A++", "A+", "A", "B"];
const RULES_KEY = "tj-discipline-rules";

type Status = "Terjaga" | "Dilanggar" | "Sebagian";
type Rule = { id: string; title: string; caption: string; status: Status };

const GRADE_CLS: Record<string, string> = {
  "A++": "bg-indigo-500/15 text-indigo-700 border-indigo-400/50 dark:bg-indigo-500/20 dark:text-[#c7d2fe] dark:border-indigo-400/50",
  "A+": "bg-violet-500/15 text-violet-700 border-violet-400/50 dark:bg-violet-500/20 dark:text-[#ddd6fe] dark:border-violet-400/50",
  "A": "bg-blue-500/15 text-blue-700 border-blue-400/50 dark:bg-blue-500/20 dark:text-[#bfdbfe] dark:border-blue-400/50",
  "B": "bg-zinc-400/15 text-zinc-600 border-zinc-400/40 dark:bg-zinc-400/15 dark:text-[#d4d4d8] dark:border-zinc-400/40",
};

const STATUS_CLS: Record<Status, string> = {
  Terjaga: "bg-emerald-500/15 text-emerald-700 border-emerald-500/30 dark:bg-emerald-400/15 dark:text-[#6ee7b7] dark:border-emerald-400/30",
  Dilanggar: "bg-red-500/15 text-red-700 border-red-500/30 dark:bg-red-400/15 dark:text-[#fca5a5] dark:border-red-400/30",
  Sebagian: "bg-amber-500/15 text-amber-700 border-amber-500/35 dark:bg-amber-400/15 dark:text-[#fcd34d] dark:border-amber-400/35",
};
const STATUS_ICON_CLS: Record<Status, string> = {
  Terjaga: "text-emerald-700 border-emerald-500/35 bg-emerald-500/10 dark:text-[#6ee7b7] dark:border-emerald-400/35 dark:bg-emerald-400/10",
  Dilanggar: "text-red-700 border-red-500/35 bg-red-500/10 dark:text-[#fca5a5] dark:border-red-400/35 dark:bg-red-400/10",
  Sebagian: "text-emerald-700 border-emerald-500/35 bg-emerald-500/10 dark:text-[#6ee7b7] dark:border-emerald-400/35 dark:bg-emerald-400/10",
};
const STATUS_ORDER: Status[] = ["Terjaga", "Dilanggar", "Sebagian"];

const SAMPLE_SETUPS = [
  { id: "sample-1", name: "London Breakout", description: "Break range Asia saat pembukaan London", grade: "A++", trades: 142, wr: 38.7, pf: 1.21,
    checklist: ["Range Asia jelas dan tidak lebih dari 12 USD", "Candle breakout menutup di luar range", "Stop di sisi lain range, target minimal 2R"] },
  { id: "sample-2", name: "Liquidity Sweep Reversal", description: "Reversal setelah sweep high atau low penting", grade: "A+", trades: 96, wr: 34.4, pf: 1.08,
    checklist: ["Wick menembus level lalu close kembali di dalam", "Ada penolakan di timeframe 5 menit", "Stop di atas wick sweep"] },
  { id: "sample-3", name: "Trend Pullback", description: "Entry searah tren saat koreksi ke zona minat", grade: "A", trades: 88, wr: 30.7, pf: 0.94,
    checklist: ["Struktur H1 searah dengan arah entry", "Pullback berhenti di zona 50–62% impuls", "Konfirmasi break struktur kecil"] },
  { id: "sample-4", name: "News Fade", description: "Melawan lonjakan awal setelah rilis berita", grade: "B", trades: 41, wr: 24.4, pf: 0.62,
    checklist: ["Tunggu 5 menit pertama setelah rilis", "Spread sudah kembali normal", "Lot dikurangi setengah dari biasanya"] },
];

const DEFAULT_RULES: Rule[] = [
  { id: "r1", title: "Risiko maksimal 1% per trade", caption: "Tidak ada pelanggaran bulan ini", status: "Terjaga" },
  { id: "r2", title: "Maksimal 3 trade per hari", caption: "Dilanggar 1× · 01 Okt 26 dengan 6 trade", status: "Dilanggar" },
  { id: "r3", title: "Berhenti setelah 2 loss beruntun", caption: "Perlu data jam entry untuk verifikasi penuh", status: "Sebagian" },
];

const uid = () => Math.random().toString(36).slice(2, 10);

function normalizeRules(v: any): Rule[] | null {
  if (!Array.isArray(v)) return null;
  const out: Rule[] = [];
  for (const it of v) {
    if (typeof it === "string") {
      if (it.trim()) out.push({ id: uid(), title: it.trim(), caption: "Belum dipantau otomatis", status: "Terjaga" });
    } else if (it && typeof it === "object" && typeof it.title === "string") {
      out.push({
        id: typeof it.id === "string" ? it.id : uid(),
        title: it.title,
        caption: typeof it.caption === "string" ? it.caption : "Belum dipantau otomatis",
        status: STATUS_ORDER.includes(it.status) ? it.status : "Terjaga",
      });
    }
  }
  return out;
}

function GradeBadge({ grade, className }: { grade: string | null; className?: string }) {
  if (!grade) return null;
  return (
    <span className={cn("inline-flex items-center px-[9px] py-[3px] rounded-[7px] text-[11px] font-extrabold border", GRADE_CLS[grade], className)}>
      {grade}
    </span>
  );
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

  const inputCls = "w-full text-xs px-3 py-2 rounded-xl border bg-background dark:bg-[#070b1d]/70 dark:border-[#27358a]/50 focus:outline-none focus:ring-2 focus:ring-[#4f6bff]/50 transition-all";
  const labelCls = cn(LABEL, "block mb-1 normal-case tracking-normal");

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
      <div className="bg-white dark:bg-[#0c1330] border dark:border-[#27358a]/50 rounded-2xl w-full max-w-lg shadow-2xl max-h-[92vh] overflow-y-auto">
        <div className="flex items-center justify-between p-4 border-b dark:border-[#27358a]/50">
          <h2 className="text-sm font-bold">{setup ? "Edit Setup" : "New Setup"}</h2>
          <button onClick={onClose} aria-label="Close" className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-muted"><X className="w-4 h-4" /></button>
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
            <label className={labelCls}>Tags (comma separated, add A++ / A+ / A / B for grade)</label>
            <input className={inputCls} value={form.tags} onChange={set("tags")} placeholder="A+, snr, momentum..." />
          </div>
          <div className="flex justify-between pt-3 border-t dark:border-[#27358a]/50">
            <button type="button" onClick={onClose} className="text-xs px-4 py-2 rounded-xl border dark:border-[#27358a]/50 text-muted-foreground hover:bg-muted transition-colors">Cancel</button>
            <button type="submit" disabled={saving} className={cn("text-xs px-5 py-2 rounded-xl transition-colors disabled:opacity-60 font-semibold", BTN_PRIMARY)}>
              {saving ? "Saving..." : setup ? "Save Changes" : "Create Setup"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

type CardData = {
  id: string; name: string; description: string; grade: string | null;
  trades: number | null; wr: number | null; pf: number | null; checklist: string[];
};

function SetupCard({ data, sample, onEdit, onDelete }: { data: CardData; sample: boolean; onEdit?: () => void; onDelete?: () => void }) {
  const { wr, pf, trades } = data;
  const good = pf !== null ? pf >= 1 : wr !== null ? wr >= 50 : false;
  const bar = wr !== null ? Math.max(0, Math.min(100, wr)) : 0;
  const tile = "rounded-xl bg-secondary/60 border border-border dark:bg-white/[0.04] dark:border-[#7a8cff]/[0.12] px-3 py-2.5 flex flex-col gap-[3px] min-w-0";
  const lbl = "text-xs font-medium text-muted-foreground dark:text-[#8a94c4]";
  return (
    <div className={cn(PANEL, "group p-5 md:px-6 md:py-[22px] flex flex-col gap-4 min-w-0 transition-all hover:dark:border-[#7a8cff]/40 hover:shadow-[0_20px_50px_-24px_rgba(79,107,255,0.6)]")}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="text-[16px] leading-tight font-bold tracking-[-0.01em]">{data.name}</h3>
            {sample && <span className="px-2 py-[1px] rounded-full text-[10px] font-semibold border border-[#4f6bff]/40 bg-[#4f6bff]/15 text-[#3b57e8] dark:text-[#9db0ff]">Contoh</span>}
          </div>
          {data.description && <div className={cn(CAP, "mt-1")}>{data.description}</div>}
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          {!sample && (
            <div className="flex items-center gap-0.5 md:opacity-0 md:group-hover:opacity-100 focus-within:opacity-100 transition-opacity">
              <button onClick={onEdit} aria-label="Edit setup" className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-muted text-muted-foreground"><Pencil className="w-3.5 h-3.5" /></button>
              <button onClick={onDelete} aria-label="Delete setup" className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-red-500/15 hover:text-red-500 text-muted-foreground"><Trash2 className="w-3.5 h-3.5" /></button>
            </div>
          )}
          <GradeBadge grade={data.grade} />
        </div>
      </div>

      <div className="grid grid-cols-3 gap-2">
        <div className={tile}><span className={lbl}>Trade</span><b className="text-base font-extrabold tabular-nums">{trades ?? "—"}</b></div>
        <div className={tile}><span className={lbl}>Win rate</span><b className={cn("text-base font-extrabold tabular-nums", good && WIN)}>{wr !== null ? `${wr.toFixed(1)}%` : "—"}</b></div>
        <div className={tile}><span className={lbl}>PF</span><b className={cn("text-base font-extrabold tabular-nums", pf !== null && (pf >= 1 ? WIN : LOSS))}>{pf !== null ? pf.toFixed(2) : "—"}</b></div>
      </div>

      <div className="h-1.5 rounded-full bg-secondary dark:bg-white/[0.07]">
        <div className="h-1.5 rounded-full bg-gradient-to-r from-[#4f6bff] to-[#8ea2ff]" style={{ width: `${bar}%` }} />
      </div>

      {data.checklist.length > 0 && (
        <div className="flex flex-col gap-2.5">
          {data.checklist.map((c, i) => (
            <div key={i} className="flex items-start gap-2.5 text-[13px] leading-[1.45] text-foreground/85 dark:text-[#cdd4f5]">
              <Check className="w-4 h-4 mt-px shrink-0 text-[#4f6bff] dark:text-[#6f86ff]" strokeWidth={1.7} />
              <span className="min-w-0">{c}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function RuleRow({ rule, last, onChange, onDelete }: { rule: Rule; last: boolean; onChange: (r: Rule) => void; onDelete: () => void }) {
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState(rule.title);
  const [caption, setCaption] = useState(rule.caption);
  function commit() {
    const t = title.trim();
    if (t) onChange({ ...rule, title: t, caption: caption.trim() });
    else { setTitle(rule.title); setCaption(rule.caption); }
    setEditing(false);
  }
  const nextStatus = () => onChange({ ...rule, status: STATUS_ORDER[(STATUS_ORDER.indexOf(rule.status) + 1) % STATUS_ORDER.length] });
  const inp = "w-full text-xs px-2.5 py-1.5 rounded-lg border bg-background dark:bg-[#070b1d]/70 dark:border-[#27358a]/50 focus:outline-none focus:ring-2 focus:ring-[#4f6bff]/50";
  return (
    <div className={cn("group flex items-center gap-3.5 py-3.5", !last && "border-b dark:border-[#7a8cff]/10")}>
      <span className={cn("w-9 h-9 rounded-[11px] border flex items-center justify-center shrink-0", STATUS_ICON_CLS[rule.status])}>
        {rule.status === "Dilanggar" ? <X className="w-4 h-4" strokeWidth={1.7} /> : <Check className="w-4 h-4" strokeWidth={1.7} />}
      </span>
      <div className="flex-1 min-w-0">
        {editing ? (
          <div className="flex flex-col gap-1.5" onKeyDown={e => { if (e.key === "Escape") { setTitle(rule.title); setCaption(rule.caption); setEditing(false); } }}>
            <input autoFocus className={inp} value={title} onChange={e => setTitle(e.target.value)} onKeyDown={e => { if (e.key === "Enter") commit(); }} />
            <input className={inp} value={caption} onChange={e => setCaption(e.target.value)} onKeyDown={e => { if (e.key === "Enter") commit(); }} onBlur={commit} placeholder="Keterangan" />
          </div>
        ) : (
          <button type="button" onClick={() => { setTitle(rule.title); setCaption(rule.caption); setEditing(true); }} className="block text-left w-full" title="Klik untuk edit">
            <b className="block text-[13.5px] font-bold">{rule.title}</b>
            <span className={cn(CAP, "block mt-0.5")}>{rule.caption}</span>
          </button>
        )}
      </div>
      <button type="button" onClick={nextStatus} title="Klik untuk ubah status"
        className={cn("inline-flex items-center px-[9px] py-[3px] rounded-[7px] text-[11px] font-extrabold border shrink-0", STATUS_CLS[rule.status])}>
        {rule.status}
      </button>
      <button type="button" onClick={onDelete} aria-label="Hapus aturan" className="w-6 h-6 flex items-center justify-center rounded-md text-muted-foreground hover:text-foreground hover:bg-muted shrink-0">
        <X className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}

export default function PlaybookPage() {
  const [setups, setSetups] = useState<any[]>([]);
  const [setupStats, setSetupStats] = useState<Record<string, any>>({});
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editSetup, setEditSetup] = useState<any>(null);

  async function fetchSetups() {
    setLoading(true);
    try {
      const [setupsRes, statsRes] = await Promise.all([fetch("/api/setups"), fetch("/api/setups/stats")]);
      if (!setupsRes.ok) throw new Error("setups");
      const setupsData = await setupsRes.json();
      let statsData: any = {};
      try { statsData = statsRes.ok ? await statsRes.json() : {}; } catch { statsData = {}; }
      setSetups(Array.isArray(setupsData) ? setupsData : []);
      setSetupStats(statsData && typeof statsData === "object" ? statsData : {});
      setFailed(false);
    } catch {
      setSetups([]);
      setSetupStats({});
      setFailed(true);
    }
    setLoading(false);
  }
  useEffect(() => { fetchSetups(); }, []);

  const sampleMode = !loading && (failed || setups.length === 0);

  // Trades without a setup (banner)
  const [tradeInfo, setTradeInfo] = useState<{ unset: number; total: number } | null>(null);
  useEffect(() => {
    fetch("/api/trades?pageSize=1000")
      .then(r => { if (!r.ok) throw new Error("trades"); return r.json(); })
      .then(d => {
        const list: any[] = Array.isArray(d?.trades) ? d.trades : [];
        const total = typeof d?.total === "number" ? d.total : list.length;
        setTradeInfo({ unset: list.filter((t: any) => !t.setupId).length, total });
      })
      .catch(() => setTradeInfo(null));
  }, []);

  let banner: { unset: number; total: number } | null = null;
  if (tradeInfo && tradeInfo.total > 0) banner = tradeInfo.unset > 0 ? tradeInfo : null;
  else if (sampleMode) banner = { unset: 112, total: 479 };

  // Discipline rules (stored per browser)
  const [rules, setRules] = useState<Rule[]>(DEFAULT_RULES);
  const [newRule, setNewRule] = useState("");
  useEffect(() => {
    try {
      const v = localStorage.getItem(RULES_KEY);
      if (v) { const n = normalizeRules(JSON.parse(v)); if (n) setRules(n); }
    } catch {}
  }, []);
  function saveRules(next: Rule[]) {
    setRules(next);
    try { localStorage.setItem(RULES_KEY, JSON.stringify(next)); } catch {}
  }

  async function deleteSetup(id: string) {
    if (!confirm("Delete this setup? Trades using it will not be deleted.")) return;
    await fetch(`/api/setups/${id}`, { method: "DELETE" });
    fetchSetups();
  }

  const cards: CardData[] = sampleMode
    ? SAMPLE_SETUPS.map(s => ({ id: s.id, name: s.name, description: s.description, grade: s.grade, trades: s.trades, wr: s.wr, pf: s.pf, checklist: s.checklist }))
    : setups.map(s => {
        const st = setupStats[s.id];
        const num = (v: any) => (typeof v === "number" && isFinite(v) ? v : null);
        return {
          id: s.id,
          name: s.name,
          description: s.description ?? "",
          grade: (s.tags ?? []).find((t: string) => GRADES.includes(t)) ?? null,
          trades: num(st?.totalTrades) ?? 0,
          wr: num(st?.winRate),
          pf: num(st?.profitFactor ?? st?.pf),
          checklist: String(s.rules ?? "").split("\n").map((l: string) => l.replace(/^\s*(?:\d+[.)]|[-*•])\s*/, "").trim()).filter(Boolean),
        };
      });

  const monthLabel = new Date().toLocaleDateString("id-ID", { month: "long", year: "numeric" });
  const catDesc: Record<string, string> = {
    "A++": "Semua kriteria terpenuhi dan konfirmasi kuat",
    "A+": "Hampir semua kriteria terpenuhi",
    "A": "Setup valid dengan satu kriteria lemah",
    "B": "Marginal, gunakan ukuran lot kecil",
  };

  return (
    <div className={PAGE}>
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className={H1}>Playbook</h1>
          <p className={SUB}>Pustaka setup trading, checklist eksekusi, dan aturan disiplin Anda</p>
          {sampleMode && (
            <span className="inline-flex items-center mt-3 px-3 py-1 rounded-full text-[11px] font-semibold border border-[#4f6bff]/40 bg-[#4f6bff]/15 text-[#3b57e8] dark:text-[#9db0ff]">
              Data contoh — buat setup pertama untuk menggantikannya
            </span>
          )}
        </div>
        <button onClick={() => { setEditSetup(null); setShowForm(true); }}
          className={cn("inline-flex items-center gap-2 h-10 px-4 rounded-xl text-[13px] font-semibold transition-all", BTN_PRIMARY)}>
          <Plus className="w-4 h-4" strokeWidth={1.7} /> Setup Baru
        </button>
      </div>

      {/* Unset trades banner */}
      {banner && (
        <div className="rounded-2xl border border-amber-500/30 bg-gradient-to-br from-amber-500/10 to-transparent dark:from-[#78500a]/[0.22] dark:to-[#0a1028]/80 px-[22px] py-[18px] flex flex-wrap items-center gap-4">
          <span className="w-9 h-9 rounded-[11px] border border-amber-500/35 bg-amber-500/10 dark:border-amber-400/35 dark:bg-amber-400/[0.12] text-amber-600 dark:text-[#fcd34d] flex items-center justify-center shrink-0">
            <AlertTriangle className="w-4 h-4" strokeWidth={1.7} />
          </span>
          <div className="flex-1 basis-[280px] min-w-0">
            <b className="text-sm font-bold">{banner.unset} trade belum diberi setup</b>
            <div className={cn(CAP, "mt-[3px]")}>Beri tag agar statistik per setup mencakup seluruh {banner.total} transaksi Anda.</div>
          </div>
          <a href="/trades" className="inline-flex items-center gap-2 h-10 px-4 rounded-xl text-[13px] font-semibold border border-amber-500/45 text-amber-700 dark:text-[#fde68a] hover:bg-amber-500/10 transition-colors">
            Tag sekarang <ChevronRight className="w-4 h-4" strokeWidth={1.7} />
          </a>
        </div>
      )}

      {/* Setup cards */}
      {loading ? (
        <div className="flex items-center justify-center h-48 text-muted-foreground text-sm">Loading...</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {cards.map(c => (
            <SetupCard
              key={c.id}
              data={c}
              sample={sampleMode}
              onEdit={sampleMode ? undefined : () => { setEditSetup(setups.find(s => s.id === c.id)); setShowForm(true); }}
              onDelete={sampleMode ? undefined : () => deleteSetup(c.id)}
            />
          ))}
        </div>
      )}

      {/* Discipline + categories */}
      <div className="flex flex-wrap gap-4 items-stretch">
        <div className={cn(PANEL, "flex-[2_1_560px] min-w-0 px-5 py-5 md:px-6 md:py-[22px]")}>
          <h2 className={H2}>Aturan Disiplin</h2>
          <div className={cn(CAP, "mt-1 mb-2")}>Dipantau otomatis dari data trade {monthLabel}</div>
          <div className="flex flex-col">
            {rules.length === 0 && <div className={cn(CAP, "py-3")}>Belum ada aturan. Tambahkan aturan disiplin trading Anda.</div>}
            {rules.map((r, i) => (
              <RuleRow
                key={r.id}
                rule={r}
                last={i === rules.length - 1}
                onChange={nr => saveRules(rules.map(x => (x.id === r.id ? nr : x)))}
                onDelete={() => saveRules(rules.filter(x => x.id !== r.id))}
              />
            ))}
          </div>
          <form
            onSubmit={e => {
              e.preventDefault();
              const v = newRule.trim();
              if (v) { saveRules([...rules, { id: uid(), title: v, caption: "Belum dipantau otomatis", status: "Terjaga" }]); setNewRule(""); }
            }}
            className="flex gap-2 mt-3 pt-4 border-t dark:border-[#7a8cff]/10"
          >
            <input value={newRule} onChange={e => setNewRule(e.target.value)} placeholder="Tambah aturan, mis. Wajib pasang Stop Loss"
              className="flex-1 min-w-0 text-xs border rounded-xl px-3 py-2 bg-background dark:bg-[#070b1d]/70 dark:border-[#27358a]/50 focus:outline-none focus:ring-2 focus:ring-[#4f6bff]/50" />
            <button type="submit" className={cn("text-xs font-semibold px-4 py-2 rounded-xl", BTN_PRIMARY)}>Tambah</button>
          </form>
        </div>

        <div className={cn(PANEL, "flex-[1_1_300px] min-w-0 px-5 py-5 md:px-6 md:py-[22px]")}>
          <h2 className={H2}>Kategori Setup</h2>
          <div className={cn(CAP, "mt-1 mb-4")}>Penilaian kualitas sebelum entry</div>
          <div className="flex flex-col gap-3.5">
            {GRADES.map(g => (
              <div key={g} className="flex items-center gap-3">
                <GradeBadge grade={g} className="w-11 justify-center" />
                <span className={cn(CAP, "text-[12.5px] leading-normal")}>{catDesc[g]}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

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
