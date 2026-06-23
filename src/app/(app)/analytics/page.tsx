"use client";
import { useEffect, useState } from "react";
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, Tooltip,
  ResponsiveContainer, CartesianGrid, ReferenceLine, Cell,
} from "recharts";
import { cn, formatCurrency, formatR } from "@/lib/utils";
import { TrendingDown } from "lucide-react";
import AccountSwitcher from "@/components/layout/AccountSwitcher";

const PROFIT = "#16a34a";
const LOSS = "#dc2626";
const DAYS = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];
const HOURS = Array.from({ length: 24 }, (_, i) => i);

const SESSION_LABELS: Record<string, string> = {
  london: "London", newyork: "New York", asia: "Asia", sydney: "Sydney", unknown: "Unknown",
};

function StatRow({ label, value, value2, color }: { label: string; value: string; value2?: string; color?: string }) {
  return (
    <div className="flex items-center justify-between py-2 border-b last:border-0">
      <span className="text-xs text-muted-foreground">{label}</span>
      <div className="flex items-center gap-4">
        {value2 && <span className="text-xs text-muted-foreground">{value2}</span>}
        <span className={cn("text-xs font-semibold", color)}>{value}</span>
      </div>
    </div>
  );
}

function PerfTable({ title, rows, keyLabel }: { title: string; rows: any[]; keyLabel: string }) {
  return (
    <div className="bg-card border rounded-xl overflow-hidden">
      <div className="px-4 py-3 border-b">
        <p className="text-xs font-semibold">{title}</p>
      </div>
      <table className="w-full text-xs">
        <thead>
          <tr className="border-b bg-muted/40">
            <th className="text-left px-4 py-2 font-medium text-muted-foreground">{keyLabel}</th>
            <th className="text-right px-4 py-2 font-medium text-muted-foreground">Trades</th>
            <th className="text-right px-4 py-2 font-medium text-muted-foreground">Win Rate</th>
            <th className="text-right px-4 py-2 font-medium text-muted-foreground">Avg R</th>
            <th className="text-right px-4 py-2 font-medium text-muted-foreground">Net P&L</th>
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr><td colSpan={5} className="text-center py-6 text-muted-foreground">No data</td></tr>
          ) : rows.map((row, i) => (
            <tr key={i} className="border-b last:border-0 hover:bg-muted/30">
              <td className="px-4 py-2 font-medium">{row.name ?? row.category ?? row.session ?? row.day}</td>
              <td className="px-4 py-2 text-right text-muted-foreground">{row.totalTrades}</td>
              <td className="px-4 py-2 text-right">
                <span className={cn("font-medium", row.winRate >= 50 ? "text-[#16a34a]" : "text-[#dc2626]")}>
                  {row.winRate.toFixed(1)}%
                </span>
              </td>
              <td className="px-4 py-2 text-right">
                <span className={cn("font-medium", (row.avgR ?? 0) > 0 ? "text-[#16a34a]" : "text-[#dc2626]")}>
                  {row.avgR != null ? formatR(row.avgR) : "—"}
                </span>
              </td>
              <td className="px-4 py-2 text-right">
                <span className={cn("font-medium", row.netPnL > 0 ? "text-[#16a34a]" : row.netPnL < 0 ? "text-[#dc2626]" : "")}>
                  {formatCurrency(row.netPnL)}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function HeatmapCell({ pnl, trades, winRate }: { pnl: number; trades: number; winRate: number }) {
  const intensity = Math.min(1, Math.abs(pnl) / 500);
  const bg = pnl > 0
    ? `rgba(22,163,74,${0.15 + intensity * 0.7})`
    : pnl < 0
    ? `rgba(220,38,38,${0.15 + intensity * 0.7})`
    : "transparent";
  return (
    <div
      className="rounded flex flex-col items-center justify-center h-10 cursor-default border border-transparent hover:border-indigo-400 transition-colors"
      style={{ background: bg }}
      title={`${trades} trades · ${winRate}% WR · ${formatCurrency(pnl)}`}
    >
      {trades > 0 && <span className="text-[9px] font-bold" style={{ color: intensity > 0.4 ? "#ffffff" : pnl > 0 ? "#15803d" : pnl < 0 ? "#b91c1c" : "hsl(var(--muted-foreground))" }}>
        {trades}
      </span>}
    </div>
  );
}

export default function AnalyticsPage() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [accountId, setAccountId] = useState("");

  useEffect(() => {
    fetch(`/api/analytics${accountId ? `?accountId=${accountId}` : ""}`)
      .then((r) => r.json())
      .then((d) => { setData(d); setLoading(false); })
      .catch(() => setLoading(false));
  }, [accountId]);

  if (loading) return (
    <div className="flex items-center justify-center h-64 text-sm text-muted-foreground">Loading analytics...</div>
  );

  if (!data || data.totalTrades === 0) return (
    <div className="p-4 flex flex-col items-center justify-center h-64 text-center">
      <p className="text-sm font-medium mb-1">No data yet</p>
      <p className="text-xs text-muted-foreground">Add and close some trades to see analytics</p>
    </div>
  );

  const { drawdownCurve, maxDrawdown, heatmapData, bySetup, byCategory, bySession, byDow } = data;

  // Build heatmap grid
  const heatGrid: Record<string, Record<number, any>> = {};
  for (const d of DAYS) { heatGrid[d] = {}; }
  for (const cell of heatmapData) { heatGrid[cell.day][cell.hour] = cell; }

  // Hours with activity
  const activeHours = ([...new Set(heatmapData.map((d: any) => d.hour))] as number[]).sort((a, b) => a - b);

  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-sm font-semibold">Analytics</h1>
        <span className="text-xs text-muted-foreground">{data.totalTrades} total trades</span>
      </div>

      {/* Drawdown chart */}
      <div className="bg-card border rounded-xl p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <TrendingDown className="w-4 h-4 text-[#dc2626]" />
            <p className="text-xs font-semibold">Drawdown Curve</p>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-[11px] text-muted-foreground">Max Drawdown:</span>
            <span className="text-[11px] font-semibold text-[#dc2626]">{maxDrawdown.toFixed(2)}%</span>
          </div>
        </div>
        <ResponsiveContainer width="100%" height={160}>
          <AreaChart data={drawdownCurve} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id="ddGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#dc2626" stopOpacity={0.3} />
                <stop offset="100%" stopColor="#dc2626" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
            <XAxis dataKey="date" tick={{ fontSize: 9, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fontSize: 9, fill: "hsl(var(--muted-foreground))" }} width={40} axisLine={false} tickLine={false}
              tickFormatter={(v) => `${v.toFixed(0)}%`} />
            <ReferenceLine y={0} stroke="var(--border)" />
            <Tooltip
              formatter={(v: number) => [`${v.toFixed(2)}%`, "Drawdown"]}
              contentStyle={{ fontSize: 11, borderRadius: 8, backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))", color: "hsl(var(--foreground))" }}
              labelStyle={{ color: "hsl(var(--muted-foreground))" }}
            />
            <Area type="monotone" dataKey="drawdown" stroke="#dc2626" strokeWidth={1.5} fill="url(#ddGrad)" dot={false} />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {/* Heatmap */}
      <div className="bg-card border rounded-xl p-4">
        <p className="text-xs font-semibold mb-3">Trade Activity Heatmap — Day × Hour (WIB)</p>
        {activeHours.length === 0 ? (
          <p className="text-xs text-muted-foreground">No data with entry times</p>
        ) : (
          <div className="overflow-x-auto">
            <div style={{ minWidth: activeHours.length * 36 + 52 }}>
              {/* Hour headers */}
              <div className="flex gap-1 mb-1 ml-12">
                {activeHours.map((h) => (
                  <div key={h} className="w-9 text-center text-[9px] text-muted-foreground">{String(h).padStart(2,"0")}</div>
                ))}
              </div>
              {/* Day rows */}
              {DAYS.map((day) => (
                <div key={day} className="flex items-center gap-1 mb-1">
                  <div className="w-10 text-[10px] text-muted-foreground text-right pr-1 shrink-0">{day}</div>
                  {activeHours.map((h) => {
                    const cell = heatGrid[day]?.[h];
                    return (
                      <div key={h} className="w-9">
                        <HeatmapCell
                          pnl={cell?.pnl ?? 0}
                          trades={cell?.trades ?? 0}
                          winRate={cell?.winRate ?? 0}
                        />
                      </div>
                    );
                  })}
                </div>
              ))}
              {/* Legend */}
              <div className="flex items-center gap-2 mt-2 ml-12">
                <span className="text-[10px] text-muted-foreground">Loss</span>
                {[0.8, 0.5, 0.2, 0, 0.2, 0.5, 0.8].map((v, i) => (
                  <div key={i} className="w-5 h-3 rounded-sm" style={{
                    background: i < 3 ? `rgba(220,38,38,${v})` : i === 3 ? "hsl(var(--muted))" : `rgba(22,163,74,${v})`
                  }} />
                ))}
                <span className="text-[10px] text-muted-foreground">Profit</span>
                <span className="text-[10px] text-muted-foreground ml-2">· Number = trade count</span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* P&L by Day of Week bar chart */}
      <div className="grid grid-cols-2 gap-4">
        <div className="bg-card border rounded-xl p-4">
          <p className="text-xs font-semibold mb-3">P&L by Day of Week</p>
          <ResponsiveContainer width="100%" height={140}>
            <BarChart data={byDow} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
              <XAxis dataKey="day" tick={{ fontSize: 9, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 9, fill: "hsl(var(--muted-foreground))" }} width={40} axisLine={false} tickLine={false}
                tickFormatter={(v) => v >= 1000 ? `$${(v/1000).toFixed(1)}K` : `$${v}`} />
              <ReferenceLine y={0} stroke="var(--border)" />
              <Tooltip
                formatter={(v: number) => [formatCurrency(v), "Net P&L"]}
                contentStyle={{ fontSize: 11, borderRadius: 8, backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))", color: "hsl(var(--foreground))" }}
                labelStyle={{ color: "hsl(var(--foreground))", fontWeight: 600 }}
                itemStyle={{ color: "hsl(var(--foreground))" }}
                cursor={{ fill: "hsl(var(--muted))", opacity: 0.4 }}
              />
              <Bar dataKey="netPnL" radius={[3, 3, 0, 0]}>
                {byDow.map((entry: any, i: number) => (
                  <Cell key={i} fill={entry.netPnL >= 0 ? PROFIT : LOSS} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="bg-card border rounded-xl p-4">
          <p className="text-xs font-semibold mb-2">Performance by Session</p>
          <div>
            {bySession.map((s: any) => (
              <StatRow
                key={s.session}
                label={SESSION_LABELS[s.session] ?? s.session}
                value={formatCurrency(s.netPnL)}
                value2={`${s.totalTrades} trades · ${s.winRate.toFixed(0)}% WR`}
                color={s.netPnL > 0 ? "text-[#16a34a]" : "text-[#dc2626]"}
              />
            ))}
          </div>
        </div>
      </div>

      {/* Setup category table */}
      <PerfTable
        title="Performance by Setup Category (A / A+ / A++ / B)"
        rows={byCategory.map((r: any) => ({ ...r, name: r.category }))}
        keyLabel="Category"
      />

      {/* By setup table */}
      <PerfTable
        title="Performance by Setup / Strategy"
        rows={bySetup}
        keyLabel="Setup"
      />
    </div>
  );
}
