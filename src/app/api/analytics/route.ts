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

  const selected = accounts.filter((a) => accountIds.includes(a.id));
  const currency: string = (selected[0] as any)?.currency ?? "USD";
  const initial = selected.reduce((s, a) => s + (Number((a as any).initialBalance) || 0), 0);
  const r2 = (n: number) => Math.round(n * 100) / 100;
  const dayOf = (t: any) => (t.exitDate ?? t.entryDate).toISOString().slice(0, 10);

  // ── Drawdown curve ────────────────────────────────────────────────────────
  // balance = cumulative P&L; drawdownAmt = balance - peak (currency, <= 0);
  // drawdown (%) is relative to peak equity (initial balance + peak P&L) when known.
  let peak = 0, balance = 0;
  const drawdownCurve = trades.map((t) => {
    balance += t.pnl ?? 0;
    peak = Math.max(peak, balance);
    const base = initial > 0 ? initial + peak : peak;
    const amt = balance - peak;
    const dd = base > 0 ? (amt / base) * 100 : 0;
    return {
      date: dayOf(t),
      balance: r2(balance),
      drawdown: r2(dd),
      drawdownAmt: r2(amt),
    };
  });
  const maxDrawdown = drawdownCurve.length
    ? Math.min(...drawdownCurve.map((d) => d.drawdown))
    : 0;
  const maxDrawdownAmt = drawdownCurve.length
    ? Math.min(...drawdownCurve.map((d) => d.drawdownAmt))
    : 0;

  // ── Summary ───────────────────────────────────────────────────────────────
  const pnls = trades.map((t) => t.pnl ?? 0);
  const wins = pnls.filter((p) => p > 0);
  const losses = pnls.filter((p) => p < 0);
  const grossProfit = wins.reduce((s, p) => s + p, 0);
  const grossLoss = losses.reduce((s, p) => s + p, 0);
  const netPnLAll = pnls.reduce((s, p) => s + p, 0);
  const avgWin = wins.length ? grossProfit / wins.length : 0;
  const avgLoss = losses.length ? grossLoss / losses.length : 0;
  const dayPnl = new Map<string, number>();
  for (const t of trades) dayPnl.set(dayOf(t), (dayPnl.get(dayOf(t)) ?? 0) + (t.pnl ?? 0));
  let bestDay: { date: string; pnl: number } | null = null;
  let worstDay: { date: string; pnl: number } | null = null;
  for (const [date, pnl] of dayPnl) {
    if (!bestDay || pnl > bestDay.pnl) bestDay = { date, pnl: r2(pnl) };
    if (!worstDay || pnl < worstDay.pnl) worstDay = { date, pnl: r2(pnl) };
  }
  const summary = {
    expectancy: trades.length ? r2(netPnLAll / trades.length) : 0,
    avgWin: r2(avgWin),
    avgLoss: r2(avgLoss),
    winCount: wins.length,
    lossCount: losses.length,
    payoffRatio: avgLoss !== 0 ? r2(avgWin / Math.abs(avgLoss)) : 0,
    profitFactor: grossLoss !== 0 ? r2(grossProfit / Math.abs(grossLoss)) : 0,
    netPnL: r2(netPnLAll),
    bestDay,
    worstDay,
  };

  // ── Long vs Short ─────────────────────────────────────────────────────────
  const dirStats = (dir: string) => {
    const ts = trades.filter((t) => String((t as any).direction ?? "").toLowerCase() === dir);
    return {
      trades: ts.length,
      winRate: ts.length ? Math.round((ts.filter((t) => (t.pnl ?? 0) > 0).length / ts.length) * 1000) / 10 : 0,
      pnl: r2(ts.reduce((s, t) => s + (t.pnl ?? 0), 0)),
    };
  };
  const longShort = { long: dirStats("long"), short: dirStats("short") };

  // ── P&L distribution (buckets in thousands for IDR, scaled for others) ───
  const isIdr = currency === "IDR";
  const edges = isIdr ? [-500, -100, -25, 0, 25, 100, 500] : [-50, -20, -5, 0, 5, 20, 50];
  const unit = isIdr ? 1000 : 1;
  const labels = isIdr
    ? ["<-500rb", "-500...-100", "-100...-25", "-25...0", "0...25", "25...100", "100...500", ">500rb"]
    : ["<-50", "-50...-20", "-20...-5", "-5...0", "0...5", "5...20", "20...50", ">50"];
  const counts = new Array(8).fill(0) as number[];
  for (const p of pnls) {
    const v = p / unit;
    let i = edges.findIndex((e) => v < e);
    if (i === -1) i = 7;
    // a zero P&L trade falls in the first non-negative bucket
    counts[i] += 1;
  }
  const pnlDistribution = labels.map((label, i) => ({ label, count: counts[i], positive: i >= 4 }));

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
    // P&L dihitung pada hari trade ditutup (sama dengan Dashboard & Calendar)
    const dow = DAYS[getDay(t.exitDate ?? t.entryDate)];
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
    drawdownCurve, maxDrawdown, maxDrawdownAmt,
    currency, summary, longShort, pnlDistribution,
    heatmapData,
    bySetup, byCategory, bySession, byDow,
    totalTrades: trades.length,
  });
}
