import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/auth";
import { prisma } from "@/lib/prisma";
import { calcWinRate, calcProfitFactor, calcAvgR } from "@/lib/utils";
import { startOfMonth, subMonths, format } from "date-fns";

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const user = await prisma.user.findUnique({ where: { email: session.user.email } });
  if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

  const { searchParams } = new URL(req.url);
  const period = searchParams.get("period") ?? "all";
  const accountId = searchParams.get("accountId");

  const now = new Date();
  let dateFrom: Date;
  if (period === "7d") dateFrom = new Date(now.getTime() - 7 * 86400000);
  else if (period === "3m") dateFrom = subMonths(now, 3);
  else if (period === "ytd") dateFrom = new Date(now.getFullYear(), 0, 1);
  else if (period === "1m") dateFrom = startOfMonth(now);
  else dateFrom = new Date("2000-01-01");

  const accounts = await prisma.tradingAccount.findMany({ where: { userId: user.id } });
  const targetAccount = accountId
    ? accounts.find((a) => a.id === accountId)
    : accounts.find((a) => a.isDefault) ?? accounts[0];

  if (!targetAccount) return NextResponse.json({ accounts, stats: null, equityCurve: [], bySymbol: [], bySession: [], calendar: [], recentTrades: [] });

  const trades = await prisma.trade.findMany({
    where: {
      accountId: targetAccount.id,
      OR: [
        { entryDate: { gte: dateFrom, lte: now } },
        { exitDate: { gte: dateFrom, lte: now } },
      ],
    },
    include: { account: true, setup: true },
    orderBy: { entryDate: "asc" },
  });

  const allClosedTrades = await prisma.trade.findMany({
    where: { accountId: targetAccount.id, status: "closed" },
    orderBy: { entryDate: "asc" },
  });

  const closedTrades = trades.filter((t) => t.status === "closed");
  const netPnL = closedTrades.reduce((s, t) => s + (t.pnl ?? 0), 0);

  const equityMap = new Map<string, number>();
  let running = targetAccount.initialBalance;
  for (const t of closedTrades) {
    const day = format(t.exitDate ?? t.entryDate, "yyyy-MM-dd");
    running += t.pnl ?? 0;
    equityMap.set(day, running);
  }
  const equityCurve = Array.from(equityMap.entries()).map(([date, balance]) => ({ date, balance: Math.round(balance * 100) / 100 }));

  const symbolMap = new Map<string, { pnl: number; trades: number; wins: number }>();
  for (const t of closedTrades) {
    const e = symbolMap.get(t.symbol) ?? { pnl: 0, trades: 0, wins: 0 };
    e.pnl += t.pnl ?? 0; e.trades += 1;
    if (t.outcome === "win") e.wins += 1;
    symbolMap.set(t.symbol, e);
  }
  const bySymbol = Array.from(symbolMap.entries())
    .map(([symbol, d]) => ({ symbol, pnl: Math.round(d.pnl * 100) / 100, trades: d.trades, winRate: Math.round((d.wins / d.trades) * 100) }))
    .sort((a, b) => b.pnl - a.pnl);

  const sessionMap = new Map<string, { pnl: number; trades: number; wins: number }>();
  for (const t of closedTrades) {
    const sess = t.session ?? "unknown";
    const e = sessionMap.get(sess) ?? { pnl: 0, trades: 0, wins: 0 };
    e.pnl += t.pnl ?? 0; e.trades += 1;
    if (t.outcome === "win") e.wins += 1;
    sessionMap.set(sess, e);
  }
  const bySession = Array.from(sessionMap.entries())
    .map(([session, d]) => ({ session, pnl: Math.round(d.pnl * 100) / 100, trades: d.trades, winRate: Math.round((d.wins / d.trades) * 100) }));

  const calendarMap = new Map<string, { pnl: number; count: number }>();
  for (const t of allClosedTrades) {
    const day = format(t.exitDate ?? t.entryDate, "yyyy-MM-dd");
    const e = calendarMap.get(day) ?? { pnl: 0, count: 0 };
    e.pnl += t.pnl ?? 0; e.count += 1;
    calendarMap.set(day, e);
  }
  const calendar = Array.from(calendarMap.entries())
    .map(([date, d]) => ({ date, pnl: Math.round(d.pnl * 100) / 100, tradeCount: d.count }));

  const winTrades = closedTrades.filter(t => (t.pnl ?? 0) > 0);
  const lossTrades = closedTrades.filter(t => (t.pnl ?? 0) < 0);
  const avgWin = winTrades.length ? Math.round(winTrades.reduce((s, t) => s + (t.pnl ?? 0), 0) / winTrades.length * 100) / 100 : null;
  const avgLoss = lossTrades.length ? Math.round(lossTrades.reduce((s, t) => s + (t.pnl ?? 0), 0) / lossTrades.length * 100) / 100 : null;

  const sorted = [...closedTrades].sort((a, b) => new Date(a.exitDate ?? a.entryDate).getTime() - new Date(b.exitDate ?? b.entryDate).getTime());
  let maxWin = 0, maxLoss = 0, curW = 0, curL = 0;
  for (const t of sorted) {
    if (t.outcome === "win") { curW++; curL = 0; maxWin = Math.max(maxWin, curW); }
    else if (t.outcome === "loss") { curL++; curW = 0; maxLoss = Math.max(maxLoss, curL); }
  }
  const lastOutcome = sorted.length ? sorted[sorted.length - 1].outcome : null;
  let currentStreak = 0;
  for (let i = sorted.length - 1; i >= 0; i--) {
    if (sorted[i].outcome === lastOutcome) currentStreak++;
    else break;
  }
  const streak = { current: currentStreak, type: lastOutcome ?? "none", maxWin, maxLoss };

  const recentTrades = [...trades].sort((a, b) => b.entryDate.getTime() - a.entryDate.getTime()).slice(0, 5);

  return NextResponse.json({
    account: targetAccount, accounts,
    stats: {
      totalTrades: trades.length,
      closedTrades: closedTrades.length,
      netPnL: Math.round(netPnL * 100) / 100,
      winRate: Math.round(calcWinRate(closedTrades) * 10) / 10,
      avgR: calcAvgR(closedTrades),
      profitFactor: calcProfitFactor(closedTrades),
      currentBalance: targetAccount.currentBalance,
      initialBalance: targetAccount.initialBalance,
      avgWin, avgLoss, streak,
    },
    equityCurve, bySymbol, bySession, calendar, recentTrades,
  });
}
