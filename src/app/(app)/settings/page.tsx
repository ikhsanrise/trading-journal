"use client";
import { useEffect, useState } from "react";
import { Download, FileText, FileJson, TrendingUp, RefreshCw } from "lucide-react";
import { cn, formatCurrency } from "@/lib/utils";

function ExportCard({ icon: Icon, title, desc, ext, onClick, loading }: any) {
  return (
    <button
      onClick={onClick}
      disabled={loading}
      className="flex items-start gap-3 p-4 bg-card border rounded-xl hover:border-indigo-400 transition-colors text-left w-full disabled:opacity-60"
    >
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

export default function SettingsPage() {
  const [account, setAccount] = useState<any>(null);
  const [accounts, setAccounts] = useState<any[]>([]);
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    fetch("/api/dashboard")
      .then((r) => r.json())
      .then((d) => {
        setAccount(d.account);
        setAccounts(d.accounts ?? []);
        setStats(d.stats);
      });
  }, []);

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

  return (
    <div className="p-4 max-w-2xl space-y-6">
      <div>
        <h1 className="text-sm font-semibold">Settings</h1>
        <p className="text-xs text-muted-foreground mt-0.5">Manage your account and export data</p>
      </div>

      {/* Account info */}
      {account && (
        <div className="bg-card border rounded-xl p-4 space-y-3">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Trading Account</p>
          <div className="grid grid-cols-2 gap-3 text-xs">
            <div>
              <p className="text-muted-foreground mb-0.5">Account Name</p>
              <p className="font-medium">{account.name}</p>
            </div>
            <div>
              <p className="text-muted-foreground mb-0.5">Broker</p>
              <p className="font-medium">{account.broker}</p>
            </div>
            <div>
              <p className="text-muted-foreground mb-0.5">Currency</p>
              <p className="font-medium">{account.currency}</p>
            </div>
            <div>
              <p className="text-muted-foreground mb-0.5">Asset Class</p>
              <p className="font-medium capitalize">{account.assetClass}</p>
            </div>
            <div>
              <p className="text-muted-foreground mb-0.5">Initial Balance</p>
              <p className="font-medium">{formatCurrency(account.initialBalance, account.currency, false)}</p>
            </div>
            <div>
              <p className="text-muted-foreground mb-0.5">Current Balance</p>
              <p className={cn("font-medium", account.currentBalance >= account.initialBalance ? "text-[#16a34a]" : "text-[#dc2626]")}>
                {formatCurrency(account.currentBalance, account.currency, false)}
              </p>
            </div>
          </div>
          {stats && (
            <div className="border-t pt-3 grid grid-cols-3 gap-3 text-xs">
              <div className="text-center">
                <p className="text-muted-foreground mb-0.5">Total Trades</p>
                <p className="font-semibold text-base">{stats.totalTrades}</p>
              </div>
              <div className="text-center">
                <p className="text-muted-foreground mb-0.5">Win Rate</p>
                <p className="font-semibold text-base">{stats.winRate?.toFixed(1)}%</p>
              </div>
              <div className="text-center">
                <p className="text-muted-foreground mb-0.5">Net P&L</p>
                <p className={cn("font-semibold text-base", (stats.netPnL ?? 0) >= 0 ? "text-[#16a34a]" : "text-[#dc2626]")}>
                  {formatCurrency(stats.netPnL ?? 0)}
                </p>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Export section */}
      <div className="space-y-2">
        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Export Data</p>
        <ExportCard
          icon={FileText}
          title="Export to CSV"
          desc="All trades with full details — compatible with Excel, Google Sheets"
          ext=".csv"
          onClick={() => handleExport("csv")}
          loading={loading === "csv"}
        />
        <ExportCard
          icon={FileJson}
          title="Export to JSON"
          desc="Raw trade data in JSON format — useful for backup or migration"
          ext=".json"
          onClick={() => handleExport("json")}
          loading={loading === "json"}
        />
      </div>

      {/* Import section */}
      <div className="space-y-2">
        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Import Data</p>
        <div className="bg-card border rounded-xl p-4">
          <p className="text-xs font-medium mb-1">Import from MT4/MT5 CSV</p>
          <p className="text-xs text-muted-foreground mb-3">
            Go to <span className="font-medium">Trade Log → Import CSV</span> to import your broker history.
            Supported formats: MT4, MT5 detailed report.
          </p>
          <div className="text-[11px] text-muted-foreground bg-muted/50 rounded-lg p-3 font-mono">
            MT4/MT5 → Account History → Right click → Save as Detailed Report → CSV
          </div>
        </div>
      </div>

      {/* Danger zone */}
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
