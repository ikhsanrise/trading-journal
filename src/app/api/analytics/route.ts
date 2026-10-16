import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/auth";
import { prisma } from "@/lib/prisma";
import { calcWinRate, calcAvgR } from "@/lib/utils";
import { getDay, getHours } from "date-fns";

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const userId = session.user.id;
  if (!userId) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const accounts = await prisma.tradingAccount.findMany({ where: { userId } });
  const { searchParams } = new URL(req.url);
  const accountIdParam = searchParams.get("accountId");
  const accountIds = accountIdParam
    ? [accountIdParam]
    : accounts.map((a) => a.id);

  const trades = await prisma.trade.findMany({
    where: { accountId: { in: accountIds }, status: "closed" },
    include: { setup: true },
    orderBy: { entryDate: "asc" },
  });

  // ── Drawdown curve ────────────────────────────────────────────────────────
  let peak = 0, balance = 0;
  const drawdownCurve = trades.map((t) => {
    balance += t.pnl ?? 0;
    peak = Math.max(peak, balance);
    const dd = peak > 0 ? ((balance - peak) / peak) * 100 : 0;
    return {
      date: (t.exitDate ?? t.entryDate).toISOString().slice(0, 10),
      balance: Math.round(balance * 100) / 100,
      drawdown: Math.round(dd * 100) / 100,
    };
  });
  const maxDrawdown = drawdownCurve.length
    ? Math.min(...drawdownCurve.map((d) => d.drawdown))
    : 0;

  // ── Heatmap: day of week × hour ────────────────────────────────────────────
  const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const heatmap: Record<string, { trades: number; pnl: number; wins: number }> = {};
  for (const t of trades) {
    const dow = DAYS[getDay(t.entryDate)];
    const hour = getHours(t.entryDate);
    const key = `${dow}|${hour}`;
    if (!heatmap[key]) heatmap[key] = { trades: 0, pnl: 0, wins: 0 };
    heatmap[key].trades += 1;
    heatmap[key].pnl += t.pnl ?? 0;
    if (t.outcome === "win") heatmap[key].wins += 1;
  }
  const heatmapData = Object.entries(heatmap).map(([key, v]) => {
    const [day, hour] = key.split("|");
    return {
      day, hour: parseInt(hour),
      trades: v.trades,
      pnl: Math.round(v.pnl * 100) / 100,
      winRate: Math.round((v.wins / v.trades) * 100),
    };
  });

  // ── Performance by setup ──────────────────────────────────────────────────
  const setupMap = new Map<string, { name: string; trades: any[] }>();
  setupMap.set("none", { name: "No Setup", trades: [] });
  for (const t of trades) {
    const key = t.setupId ?? "none";
    const name = t.setup?.name ?? "No Setup";
    if (!setupMap.has(key)) setupMap.set(key, { name, trades: [] });
    setupMap.get(key)!.trades.push(t);
  }
  const bySetup = Array.from(setupMap.entries())
    .filter(([, v]) => v.trades.length > 0)
    .map(([id, v]) => {
      const netPnL = v.trades.reduce((s, t) => s + (t.pnl ?? 0), 0);
      return {
        id, name: v.name,
        totalTrades: v.trades.length,
        winRate: Math.round(calcWinRate(v.trades) * 10) / 10,
        avgR: calcAvgR(v.trades),
        netPnL: Math.round(netPnL * 100) / 100,
      };
    })
    .sort((a, b) => b.netPnL - a.netPnL);

  // ── Performance by setup category ─────────────────────────────────────────
  const catMap = new Map<string, any[]>();
  for (const t of trades) {
    const cat = (t as any).setupCategory ?? "Uncategorized";
    if (!catMap.has(cat)) catMap.set(cat, []);
    catMap.get(cat)!.push(t);
  }
  const byCategory = Array.from(catMap.entries()).map(([cat, ts]) => ({
    category: cat,
    totalTrades: ts.length,
    winRate: Math.round(calcWinRate(ts) * 10) / 10,
    avgR: calcAvgR(ts),
    netPnL: Math.round(ts.reduce((s: number, t: any) => s + (t.pnl ?? 0), 0) * 100) / 100,
  })).sort((a, b) => {
    const order = ["A++", "A+", "A", "B", "Uncategorized"];
    return order.indexOf(a.category) - order.indexOf(b.category);
  });

  // ── Performance by session ────────────────────────────────────────────────
  const sessMap = new Map<string, any[]>();
  for (const t of trades) {
    const sess = t.session ?? "unknown";
    if (!sessMap.has(sess)) sessMap.set(sess, []);
    sessMap.get(sess)!.push(t);
  }
  const bySession = Array.from(sessMap.entries()).map(([session, ts]) => ({
    session,
    totalTrades: ts.length,
    winRate: Math.round(calcWinRate(ts) * 10) / 10,
    avgR: calcAvgR(ts),
    netPnL: Math.round(ts.reduce((s: number, t: any) => s + (t.pnl ?? 0), 0) * 100) / 100,
  }));

  // ── Performance by day of week ─────────────────────────────────────────────
  const dowMap = new Map<string, any[]>();
  for (const t of trades) {
    const dow = DAYS[getDay(t.entryDate)];
    if (!dowMap.has(dow)) dowMap.set(dow, []);
    dowMap.get(dow)!.push(t);
  }
  const byDow = DAYS.map((day) => {
    const ts = dowMap.get(day) ?? [];
    return {
      day,
      totalTrades: ts.length,
      winRate: ts.length ? Math.round(calcWinRate(ts) * 10) / 10 : 0,
      netPnL: Math.round(ts.reduce((s: number, t: any) => s + (t.pnl ?? 0), 0) * 100) / 100,
    };
  });

  return NextResponse.json({
    drawdownCurve, maxDrawdown,
    heatmapData,
    bySetup, byCategory, bySession, byDow,
    totalTrades: trades.length,
  });
}
