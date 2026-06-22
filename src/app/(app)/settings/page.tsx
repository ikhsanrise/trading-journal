"use client";
import { useEffect, useState } from "react";
import { Download, FileText, FileJson, TrendingUp, RefreshCw, Plus, Trash2, Check } from "lucide-react";
import { cn, formatCurrency } from "@/lib/utils";

function ExportCard({ icon: Icon, title, desc, ext, onClick, loading }: any) {
  return (
    <button onClick={onClick} disabled={loading} className="flex items-start gap-3 p-4 bg-card border rounded-xl hover:border-indigo-400 transition-colors text-left w-full disabled:opacity-60">
      <div className="w-9 h-9 rounded-lg bg-indigo-100 dark:bg-indigo-950 flex items-center justify-center shrink-0">
        <Icon className="w-4 h-4 text-indigo-600" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium">{title}</p>
        <p className="text-xs text-muted-foreground mt-0.5">{desc}</p>
      </div>
      <div className="flex items-center gap-1.5 shrink-0">
        {loading ? <RefreshCw className="w-3.5 h-3.5 animate-spin text-muted-foreground" /> : <Download className="w-3.5 h-3.5 text-muted-foreground" />}
        <span className="text-xs text-muted-foreground">{ext}</span>
      </div>
    </button>
  );
}

const EMPTY_FORM = { name: "", broker: "", currency: "USD", assetClass: "forex", initialBalance: "" };

export default function SettingsPage() {
  const [account, setAccount] = useState<any>(null);
  const [accounts, setAccounts] = useState<any[]>([]);
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState<string | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  useEffect(() => { loadData(); }, []);

  async function loadData() {
    const d = await fetch("/api/dashboard").then(r => r.json());
    setAccount(d.account);
    setAccounts(d.accounts ?? []);
    setStats(d.stats);
  }

  async function handleExport(type: string) {
    setLoading(type);
    const params = new URLSearchParams({ type });
    if (account?.id) params.set("accountId", account.id);
    const res = await fetch(`/api/export?${params}`);
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `trades-${new Date().toISOString().slice(0, 10)}.${type}`;
    a.click();
    URL.revokeObjectURL(url);
    setLoading(null);
  }

  async function handleAddAccount() {
    if (!form.name || !form.broker || !form.initialBalance) return;
    setSaving(true);
    await fetch("/api/accounts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    setForm(EMPTY_FORM);
    setShowAddForm(false);
    setSaving(false);
    loadData();
  }

  async function handleSetDefault(id: string) {
    await fetch(`/api/accounts/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isDefault: true }),
    });
    loadData();
  }

  async function handleDelete(id: string) {
    await fetch(`/api/accounts/${id}`, { method: "DELETE" });
    setDeleteConfirm(null);
    loadData();
  }

  return (
    <div className="p-4 max-w-2xl space-y-6">
      <div>
        <h1 className="text-sm font-semibold">Settings</h1>
        <p className="text-xs text-muted-foreground mt-0.5">Manage your accounts and export data</p>
      </div>

      {/* Trading Accounts */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Trading Accounts</p>
          <button
            onClick={() => setShowAddForm(!showAddForm)}
            className="flex items-center gap-1 text-xs text-indigo-500 hover:text-indigo-400 transition-colors"
          >
            <Plus className="w-3 h-3" /> Add Account
          </button>
        </div>

        {/* Add Account Form */}
        {showAddForm && (
          <div className="bg-card border rounded-xl p-4 space-y-3">
            <p className="text-xs font-medium">New Trading Account</p>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-xs text-muted-foreground">Account Name *</label>
                <input
                  value={form.name}
                  onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                  placeholder="IC Markets - Forex"
                  className="w-full mt-0.5 px-2 py-1.5 text-xs bg-background border rounded-lg focus:outline-none focus:border-indigo-400"
                />
              </div>
              <div>
                <label className="text-xs text-muted-foreground">Broker *</label>
                <input
                  value={form.broker}
                  onChange={e => setForm(f => ({ ...f, broker: e.target.value }))}
                  placeholder="IC Markets"
                  className="w-full mt-0.5 px-2 py-1.5 text-xs bg-background border rounded-lg focus:outline-none focus:border-indigo-400"
                />
              </div>
              <div>
                <label className="text-xs text-muted-foreground">Currency</label>
                <select
                  value={form.currency}
                  onChange={e => setForm(f => ({ ...f, currency: e.target.value }))}
                  className="w-full mt-0.5 px-2 py-1.5 text-xs bg-background border rounded-lg focus:outline-none focus:border-indigo-400"
                >
                  <option>USD</option>
                  <option>EUR</option>
                  <option>GBP</option>
                  <option>IDR</option>
                </select>
              </div>
              <div>
                <label className="text-xs text-muted-foreground">Asset Class</label>
                <select
                  value={form.assetClass}
                  onChange={e => setForm(f => ({ ...f, assetClass: e.target.value }))}
                  className="w-full mt-0.5 px-2 py-1.5 text-xs bg-background border rounded-lg focus:outline-none focus:border-indigo-400"
                >
                  <option value="forex">Forex</option>
                  <option value="crypto">Crypto</option>
                  <option value="stocks">Stocks</option>
                  <option value="commodities">Commodities</option>
                  <option value="indices">Indices</option>
                </select>
              </div>
              <div className="col-span-2">
                <label className="text-xs text-muted-foreground">Initial Balance *</label>
                <input
                  type="number"
                  value={form.initialBalance}
                  onChange={e => setForm(f => ({ ...f, initialBalance: e.target.value }))}
                  placeholder="10000"
                  className="w-full mt-0.5 px-2 py-1.5 text-xs bg-background border rounded-lg focus:outline-none focus:border-indigo-400"
                />
              </div>
            </div>
            <div className="flex gap-2 justify-end">
              <button
                onClick={() => { setShowAddForm(false); setForm(EMPTY_FORM); }}
                className="px-3 py-1.5 text-xs border rounded-lg hover:bg-muted transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleAddAccount}
                disabled={saving || !form.name || !form.broker || !form.initialBalance}
                className="px-3 py-1.5 text-xs bg-indigo-600 text-white rounded-lg hover:bg-indigo-500 disabled:opacity-50 transition-colors"
              >
                {saving ? "Saving..." : "Create Account"}
              </button>
            </div>
          </div>
        )}

        {/* Account Cards */}
        {accounts.map(acc => (
          <div key={acc.id} className={cn("bg-card border rounded-xl p-4", acc.isDefault && "border-indigo-400")}>
            <div className="flex items-start justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <p className="text-sm font-medium">{acc.name}</p>
                  {acc.isDefault && (
                    <span className="text-[10px] bg-indigo-500/20 text-indigo-400 px-1.5 py-0.5 rounded-full">Default</span>
                  )}
                </div>
                <p className="text-xs text-muted-foreground mt-0.5">{acc.broker} · {acc.currency} · {acc.assetClass}</p>
                <p className="text-xs text-muted-foreground mt-1">
                  Balance: <span className="text-foreground font-medium">{formatCurrency(acc.currentBalance, acc.currency, false)}</span>
                </p>
              </div>
              <div className="flex items-center gap-1">
                {!acc.isDefault && (
                  <button
                    onClick={() => handleSetDefault(acc.id)}
                    className="p-1.5 text-muted-foreground hover:text-indigo-400 transition-colors"
                    title="Set as default account"
                  >
                    <Check className="w-3.5 h-3.5" />
                  </button>
                )}
                {!acc.isDefault && (
                  deleteConfirm === acc.id ? (
                    <div className="flex items-center gap-1 ml-1">
                      <span className="text-xs text-red-400">Delete?</span>
                      <button onClick={() => handleDelete(acc.id)} className="text-xs text-red-400 hover:text-red-300 px-1">Yes</button>
                      <button onClick={() => setDeleteConfirm(null)} className="text-xs text-muted-foreground hover:text-foreground px-1">No</button>
                    </div>
                  ) : (
                    <button
                      onClick={() => setDeleteConfirm(acc.id)}
                      className="p-1.5 text-muted-foreground hover:text-red-400 transition-colors"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Active Account Stats */}
      {account && stats && (
        <div className="bg-card border rounded-xl p-4 space-y-3">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Active Account Stats</p>
          <div className="grid grid-cols-3 gap-3 text-xs">
            <div>
              <p className="text-muted-foreground">Total Trades</p>
              <p className="font-semibold mt-0.5">{stats.totalTrades}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Win Rate</p>
              <p className="font-semibold mt-0.5">{stats.winRate}%</p>
            </div>
            <div>
              <p className="text-muted-foreground">Net P&L</p>
              <p className={cn("font-semibold mt-0.5", stats.netPnL >= 0 ? "text-[#16a34a]" : "text-[#dc2626]")}>
                {formatCurrency(stats.netPnL, account.currency)}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Export */}
      <div className="space-y-2">
        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Export Data</p>
        <ExportCard icon={FileText} title="Export to CSV" desc="All trades with full details — compatible with Excel, Google Sheets" ext=".csv" onClick={() => handleExport("csv")} loading={loading === "csv"} />
        <ExportCard icon={FileJson} title="Export to JSON" desc="Raw trade data in JSON format — useful for backup or migration" ext=".json" onClick={() => handleExport("json")} loading={loading === "json"} />
      </div>

      {/* Import */}
      <div className="space-y-2">
        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Import Data</p>
        <div className="bg-card border rounded-xl p-4">
          <p className="text-xs font-medium mb-1">Import from MT4/MT5 CSV</p>
          <p className="text-xs text-muted-foreground mb-3">
            Go to <span className="font-medium">Trade Log → Import CSV</span> to import your broker history. Supported formats: MT4, MT5 detailed report.
          </p>
          <div className="text-[11px] text-muted-foreground bg-muted/50 rounded-lg p-3 font-mono">
            MT4/MT5 → Account History → Right click → Save as Detailed Report → CSV
          </div>
        </div>
      </div>

      {/* About */}
      <div className="space-y-2">
        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">About</p>
        <div className="bg-card border rounded-xl p-4 flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-indigo-100 dark:bg-indigo-950 flex items-center justify-center">
            <TrendingUp className="w-4 h-4 text-indigo-600" />
          </div>
          <div>
            <p className="text-sm font-medium">Trading Journal</p>
            <p className="text-xs text-muted-foreground">Personal trading journal — Forex & Commodities · v2.0</p>
          </div>
        </div>
      </div>
    </div>
  );
}
