import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/auth";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  const userId = (session?.user as any)?.id as string | undefined;
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const sp = new URL(req.url).searchParams;
  const accountId = sp.get("accountId");
  const outcome = sp.get("outcome");
  const direction = sp.get("direction");
  const search = sp.get("search");
  const setupCategory = sp.get("setupCategory");
  const dateFrom = sp.get("from");
  const dateTo = sp.get("to");

  const accounts = await prisma.tradingAccount.findMany({
    where: { userId },
    select: { id: true, currency: true },
  });
  const ids = accounts.map((a) => a.id);
  const scoped = accountId && ids.includes(accountId) ? [accountId] : ids;

  const where: any = { accountId: { in: scoped } };
  if (outcome) where.outcome = outcome;
  if (direction) where.direction = direction;
  if (search) where.symbol = { contains: search.toUpperCase() };
  if (setupCategory) where.setupCategory = setupCategory;
  if (dateFrom || dateTo) {
    where.entryDate = {};
    if (dateFrom) where.entryDate.gte = new Date(dateFrom + "T00:00:00.000Z");
    if (dateTo) where.entryDate.lte = new Date(dateTo + "T23:59:59.999Z");
  }

  const [rows, accountTotal] = await Promise.all([
    prisma.trade.findMany({ where, select: { pnl: true, outcome: true } }),
    prisma.trade.count({ where: { accountId: { in: scoped } } }),
  ]);

  let netPnL = 0, wins = 0, losses = 0, be = 0, decided = 0, grossProfit = 0, grossLoss = 0;
  for (const r of rows) {
    const p = r.pnl ?? 0;
    netPnL += p;
    if (r.outcome) {
      decided++;
      if (r.outcome === "win") wins++;
      else if (r.outcome === "loss") losses++;
      else be++;
      if (p > 0) grossProfit += p;
      else if (p < 0) grossLoss += -p;
    }
  }
  const winRate = decided > 0 ? (wins / decided) * 100 : 0;
  const profitFactor = grossLoss === 0 ? (grossProfit > 0 ? 999 : 0) : grossProfit / grossLoss;
  const currency = accounts.find((a) => a.id === scoped[0])?.currency ?? "USD";

  return NextResponse.json({
    total: rows.length,
    accountTotal,
    netPnL: Math.round(netPnL * 100) / 100,
    wins,
    losses,
    be,
    winRate,
    profitFactor,
    currency,
  });
}
