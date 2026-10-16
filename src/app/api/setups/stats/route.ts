import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/auth";
import { prisma } from "@/lib/prisma";
import { calcWinRate, calcAvgR } from "@/lib/utils";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) return NextResponse.json({});
  const user = await prisma.user.findUnique({ where: { email: session.user.email } });
  if (!user) return NextResponse.json({});

  const setups = await prisma.setup.findMany({ where: { userId: user.id }, select: { id: true } });
  const result: Record<string, any> = {};

  for (const setup of setups) {
    const trades = await prisma.trade.findMany({
      where: { setupId: setup.id, status: "closed" },
      select: { pnl: true, outcome: true, rMultiple: true },
    });
    const netPnL = trades.reduce((s, t) => s + (t.pnl ?? 0), 0);
    result[setup.id] = {
      totalTrades: trades.length,
      winRate: calcWinRate(trades),
      avgR: calcAvgR(trades),
      netPnL: Math.round(netPnL * 100) / 100,
    };
  }
  return NextResponse.json(result);
}
