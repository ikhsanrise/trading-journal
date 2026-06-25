"use client";
import { useEffect, useState, useCallback, Fragment } from "react";
import { Plus, Upload, Search, Pencil, Trash2, ChevronDown, ChevronRight } from "lucide-react";
import { cn, formatCurrency, formatR, formatDate, getDurationString } from "@/lib/utils";
import TradeFormModal from "@/components/trades/TradeFormModal";
import ImportModal from "@/components/trades/ImportModal";
import AccountSwitcher from "@/components/layout/AccountSwitcher";

const OUTCOME_FILTERS = [
  { label: "All", value: "" },
  { label: "Win", value: "win" },
  { label: "Loss", value: "loss" },
  { label: "B/E", value: "breakeven" },
];
const DIR_FILTERS = [{ label: "Long", value: "long" }, { label: "Short", value: "short" }];
const SETUP_CATS = ["A", "A+", "A++", "B"];
const MOODS = ["😖","😕","😐","🙂","😎"];

function PnLPill({ value }: { value: number | null }) {
  if (value === null) return <span className="text-[10px] px-2 py-0.5 rounded bg-muted text-muted-foreground font-medium">Open</span>;
  if (value > 0) return <span className="text-[11px] font-semibold px-2 py-0.5 rounded bg-[#16a34a]/20 text-[#4ade80]">{formatCurrency(value)}</span>;
  if (value < 0) return <span className="text-[11px] font-semibold px-2 py-0.5 rounded bg-[#dc2626]/20 text-[#f87171]">{formatCurrency(value)}</span>;
  return <span className="text-[11px] font-semibold px-2 py-0.5 rounded bg-muted text-muted-foreground">Rp 0</span>;
}

function OutcomeBadge({ outcome }: { outcome: string | null }) {
  if (!outcome) return <span className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground font-medium">Open</span>;
  const map: Record<string, string> = {
    win: "bg-[#dcfce7] text-[#16a34a] dark:bg-[#16a34a]/20",
    loss: "bg-[#fee2e2] text-[#dc2626] dark:bg-[#dc2626]/20",
    breakeven: "bg-[#fef9c3] text-[#ca8a04] dark:bg-[#ca8a04]/20",
  };
  const labels: Record<string, string> = { win: "Win", loss: "Loss", breakeven: "B/E" };
  return (
    <span className={cn("text-[10px] font-medium px-1.5 py-0.5 rounded", map[outcome] ?? "")}>
      {labels[outcome] ?? outcome}
    </span>
  );
}

function SetupCatBadge({ cat }: { cat: string | null }) {
  if (!cat) return <span className="text-muted-foreground">—</span>;
  const colors: Record<string, string> = {
    "A++": "bg-indigo-100 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 border-indigo-300 dark:border-indigo-700",
    "A+":  "bg-violet-100 dark:bg-violet-950 text-violet-700 dark:text-violet-300 border-violet-300 dark:border-violet-700",
    "A":   "bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-300 border-blue-300 dark:border-blue-700",
    "B":   "bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 border-zinc-300 dark:border-zinc-600",
  };
  return (
    <span className={cn("text-[10px] font-bold px-1.5 py-0.5 rounded border", colors[cat] ?? "")}>
      {cat}
    </span>
  );
}

export default function TradesPage() {
  const [trades, setTrades] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [outcome, setOutcome] = useState("");
  const [direction, setDirection] = useState("");
  const [setupCat, setSetupCat] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [editTrade, setEditTrade] = useState<any>(null);
  const [expandedRow, setExpandedRow] = useState<string | null>(null);
  const [stats, setStats] = useState({ netPnL: 0, wins: 0, losses: 0, total: 0 });
  const [accountId, setAccountId] = useState("");

  const fetchTrades = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (search) params.set("search", search);
    if (outcome) params.set("outcome", outcome);
    if (direction) params.set("direction", direction);
    if (setupCat) params.set("setupCategory", setupCat);
    if (accountId) params.set("accountId", accountId);
    params.set("page", String(page));
    params.set("pageSize", "15");
    const res = await fetch(`/api/trades?${params}`);
    const data = await res.json();
    setTrades(data.trades ?? []);
    setTotal(data.total ?? 0);
    setTotalPages(data.totalPages ?? 1);
    const pnl = (data.trades ?? []).reduce((s: number, t: any) => s + (t.pnl ?? 0), 0);
    const wins = (data.trades ?? []).filter((t: any) => t.outcome === "win").length;
    const losses = (data.trades ?? []).filter((t: any) => t.outcome === "loss").length;
    setStats({ netPnL: pnl, wins, losses, total: data.total ?? 0 });
    setLoading(false);
  }, [search, outcome, direction, setupCat, page, accountId]);

  useEffect(() => { fetchTrades(); }, [fetchTrades]);

  async function deleteTrade(e: React.MouseEvent, id: string) {
    e.stopPropagation();
    if (!confirm("Delete this trade?")) return;
    await fetch(`/api/trades/${id}`, { method: "DELETE" });
    fetchTrades();
  }

  function handleEditClick(e: React.MouseEvent, trade: any) {
    e.stopPropagation();
    setEditTrade(trade);
    setShowForm(true);
  }

  return (
    <div className="p-3">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2"><span className="text-sm font-semibold">Trade Log</span><AccountSwitcher value={accountId} onChange={(id) => { setAccountId(id); }} /></div>
        <div className="flex items-center gap-2">
          <button onClick={() => setShowImport(true)}
            className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border text-muted-foreground hover:text-foreground transition-colors">
            <Upload className="w-3.5 h-3.5" /> Import CSV
          </button>
          <button onClick={() => { setEditTrade(null); setShowForm(true); }}
            className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 transition-colors">
            <Plus className="w-3.5 h-3.5" /> Add Trade
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-card border rounded-xl mb-3">
        <div className="flex items-center gap-2 px-3 py-2 flex-wrap">
          <div className="relative flex-shrink-0">
            <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input value={search} onChange={(e) => { setSearch(e.target.value.toUpperCase()); setPage(1); }}
              placeholder="Search symbol..."
              className="text-xs pl-7 pr-3 py-1.5 rounded-lg border bg-background focus:outline-none focus:ring-1 focus:ring-indigo-500 w-36" />
          </div>
          <div className="w-px h-4 bg-border" />
          {OUTCOME_FILTERS.map((f) => (
            <button key={f.value} onClick={() => { setOutcome(f.value); setPage(1); }}
              className={cn("text-xs px-2.5 py-1 rounded-full border transition-colors",
                outcome === f.value ? "bg-indigo-600 text-white border-indigo-600" : "text-muted-foreground hover:text-foreground"
              )}>{f.label}</button>
          ))}
          <div className="w-px h-4 bg-border" />
          {DIR_FILTERS.map((f) => (
            <button key={f.value} onClick={() => { setDirection(direction === f.value ? "" : f.value); setPage(1); }}
              className={cn("text-xs px-2.5 py-1 rounded-full border transition-colors",
                direction === f.value ? "bg-indigo-600 text-white border-indigo-600" : "text-muted-foreground hover:text-foreground"
              )}>{f.label}</button>
          ))}
          <div className="w-px h-4 bg-border" />
          <span className="text-xs text-muted-foreground">Setup:</span>
          {SETUP_CATS.map((cat) => (
            <button key={cat} onClick={() => { setSetupCat(setupCat === cat ? "" : cat); setPage(1); }}
              className={cn("text-xs px-2.5 py-1 rounded-full border transition-colors font-medium",
                setupCat === cat ? "bg-indigo-600 text-white border-indigo-600" : "text-muted-foreground hover:text-foreground"
              )}>{cat}</button>
          ))}
        </div>
        <div className="border-t px-3 py-1.5 flex gap-4">
          <span className="text-[11px] text-muted-foreground">
            <span className="font-medium text-foreground">{stats.total}</span> trades
          </span>
          <span className="text-[11px] text-muted-foreground">
            Net P&L: <span className={cn("font-medium", stats.netPnL >= 0 ? "text-[#16a34a]" : "text-[#dc2626]")}>
              {formatCurrency(stats.netPnL)}
            </span>
          </span>
          <span className="text-[11px] text-muted-foreground">{stats.wins}W · {stats.losses}L</span>
        </div>
      </div>

      {/* Table */}
      <div className="bg-card border rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b bg-muted/50">
                <th className="w-6 px-3 py-2"></th>
                <th className="text-left px-3 py-2 font-medium text-muted-foreground whitespace-nowrap">Date</th>
                <th className="text-left px-3 py-2 font-medium text-muted-foreground">Symbol</th>
                <th className="text-left px-3 py-2 font-medium text-muted-foreground">Side</th>
                <th className="text-right px-3 py-2 font-medium text-muted-foreground">Entry</th>
                <th className="text-right px-3 py-2 font-medium text-muted-foreground">Exit</th>
                <th className="text-right px-3 py-2 font-medium text-muted-foreground">Lot</th>
                <th className="text-left px-3 py-2 font-medium text-muted-foreground">Hold</th>
                <th className="text-right px-3 py-2 font-medium text-muted-foreground">R</th>
                <th className="text-right px-3 py-2 font-medium text-muted-foreground">P&L</th>
                <th className="text-left px-3 py-2 font-medium text-muted-foreground">Setup</th>
                <th className="text-left px-3 py-2 font-medium text-muted-foreground">Cat.</th>
                <th className="text-left px-3 py-2 font-medium text-muted-foreground">Status</th>
                <th className="px-3 py-2"></th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={14} className="text-center py-10 text-muted-foreground">Loading...</td></tr>
              ) : trades.length === 0 ? (
                <tr><td colSpan={14} className="text-center py-10 text-muted-foreground">No trades yet. Add your first trade!</td></tr>
              ) : trades.map((t) => {
                const duration = t.exitDate ? getDurationString(new Date(t.entryDate), new Date(t.exitDate)) : "—";
                const isExpanded = expandedRow === t.id;
                return (
                  <Fragment key={t.id}>
                    <tr
                      className="border-b hover:bg-muted/40 group cursor-pointer"
                      onClick={() => setExpandedRow(isExpanded ? null : t.id)}
                    >
                      <td className="px-3 py-2 text-muted-foreground">
                        {isExpanded
                          ? <ChevronDown className="w-3 h-3" />
                          : <ChevronRight className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity" />}
                      </td>
                      <td className="px-3 py-2 text-muted-foreground whitespace-nowrap">{formatDate(t.entryDate)}</td>
                      <td className="px-3 py-2 font-medium">{t.symbol}</td>
                      <td className="px-3 py-2">
                        <span className={cn("text-[10px] font-medium px-1.5 py-0.5 rounded",
                          t.direction === "long" ? "bg-[#16a34a]/20 text-[#4ade80]" : "bg-[#dc2626]/20 text-[#f87171]")}>
                          {t.direction === "long" ? "Long" : "Short"}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-right">{t.entryPrice}</td>
                      <td className="px-3 py-2 text-right">{t.exitPrice ?? "—"}</td>
                      <td className="px-3 py-2 text-right">{t.lotSize}</td>
                      <td className="px-3 py-2 text-muted-foreground">{duration}</td>
                      <td className="px-3 py-2 text-right">
                        <span className={cn("font-medium",
                          (t.rMultiple ?? 0) > 0 ? "text-[#16a34a]" : (t.rMultiple ?? 0) < 0 ? "text-[#dc2626]" : "text-muted-foreground")}>
                          {formatR(t.rMultiple)}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-right"><PnLPill value={t.pnl} /></td>
                      <td className="px-3 py-2">
                        {t.setup
                          ? <span className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground border">{t.setup.name}</span>
                          : <span className="text-muted-foreground">—</span>}
                      </td>
                      <td className="px-3 py-2"><SetupCatBadge cat={t.setupCategory} /></td>
                      <td className="px-3 py-2"><OutcomeBadge outcome={t.outcome} /></td>
                      <td className="px-3 py-2">
                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button onClick={(e) => handleEditClick(e, t)}
                            className="w-6 h-6 flex items-center justify-center rounded border hover:bg-muted transition-colors text-muted-foreground">
                            <Pencil className="w-3 h-3" />
                          </button>
                          <button onClick={(e) => deleteTrade(e, t.id)}
                            className="w-6 h-6 flex items-center justify-center rounded border hover:bg-[#fee2e2] hover:text-[#dc2626] hover:border-[#fca5a5] transition-colors text-muted-foreground">
                            <Trash2 className="w-3 h-3" />
                          </button>
                        </div>
                      </td>
                    </tr>
                    {isExpanded && (
                      <tr className="border-b bg-muted/20">
                        <td colSpan={14} className="px-4 py-3">
                          <div className="flex gap-6 text-xs">
                            <div className="flex-1">
                              <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider mb-1">Notes & Analysis</p>
                              {t.notes
                                ? <p className="text-foreground leading-relaxed">{t.notes}</p>
                                : <p className="text-muted-foreground italic">No notes for this trade.</p>}
                            </div>
                            {t.tags && t.tags.length > 0 && (
                              <div className="shrink-0">
                                <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider mb-1">Tags</p>
                                <div className="flex gap-1 flex-wrap">
                                  {t.tags.map((tag: string) => (
                                    <span key={tag} className="text-[10px] px-2 py-0.5 rounded-full bg-indigo-100 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800">{tag}</span>
                                  ))}
                                </div>
                              </div>
                            )}
                            {t.mood && (
                              <div className="shrink-0">
                                <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider mb-1">Mood</p>
                                <span className="text-lg">{MOODS[t.mood - 1]}</span>
                              </div>
                            )}
                            {(t.screenshotBefore || t.screenshotAfter) && (
                              <div className="shrink-0">
                                <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider mb-1">Screenshots</p>
                                <div className="flex gap-2">
                                  {t.screenshotBefore && (
                                    <div className="text-center">
                                      <img src={t.screenshotBefore} alt="Before" className="w-24 h-16 object-cover rounded-lg border cursor-pointer hover:opacity-80 transition-opacity" onClick={() => window.open(t.screenshotBefore, '_blank')} />
                                      <p className="text-[10px] text-muted-foreground mt-0.5">Before</p>
                                    </div>
                                  )}
                                  {t.screenshotAfter && (
                                    <div className="text-center">
                                      <img src={t.screenshotAfter} alt="After" className="w-24 h-16 object-cover rounded-lg border cursor-pointer hover:opacity-80 transition-opacity" onClick={() => window.open(t.screenshotAfter, '_blank')} />
                                      <p className="text-[10px] text-muted-foreground mt-0.5">After</p>
                                    </div>
                                  )}
                                </div>
                              </div>
                            )}
                          </div>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        </div>

        {totalPages > 1 && (
          <div className="border-t px-3 py-2 flex items-center justify-between">
            <span className="text-xs text-muted-foreground">Showing {trades.length} of {total} trades</span>
            <div className="flex gap-1">
              <button disabled={page === 1} onClick={() => setPage(page - 1)}
                className="text-xs px-2 py-1 rounded border disabled:opacity-40 hover:bg-muted transition-colors">Prev</button>
              {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => i + 1).map((p) => (
                <button key={p} onClick={() => setPage(p)}
                  className={cn("text-xs px-2 py-1 rounded border transition-colors",
                    page === p ? "bg-indigo-600 text-white border-indigo-600" : "hover:bg-muted")}>
                  {p}
                </button>
              ))}
              <button disabled={page === totalPages} onClick={() => setPage(page + 1)}
                className="text-xs px-2 py-1 rounded border disabled:opacity-40 hover:bg-muted transition-colors">Next</button>
            </div>
          </div>
        )}
      </div>

      {showForm && (
        <TradeFormModal trade={editTrade} onClose={() => setShowForm(false)} onSaved={() => { setShowForm(false); fetchTrades(); }} />
      )}
      {showImport && (
        <ImportModal onClose={() => setShowImport(false)} onImported={() => { setShowImport(false); fetchTrades(); }} />
      )}
    </div>
  );
}
