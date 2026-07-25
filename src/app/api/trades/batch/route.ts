import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export const maxDuration = 30;

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { accountId, trades } = await req.json();
  if (!accountId || !trades?.length) return NextResponse.json({ imported: 0, skipped: 0 });

  const account = await prisma.tradingAccount.findFirst({
    where: { id: accountId, userId: session.user.id },
  });
  if (!account) return NextResponse.json({ error: "Account not found" }, { status: 404 });

  const existing = await prisma.trade.findMany({
    where: { accountId },
    select: { entryDate: true, symbol: true, lotSize: true },
  });
  const existingKeys = new Set(
    existing.map(t => `${t.symbol}|${t.lotSize}|${new Date(t.entryDate).getTime()}`)
  );

  const newTrades = trades.filter((t: any) => {
    const key = `${t.symbol}|${t.lotSize}|${new Date(t.entryDate).getTime()}`;
    return !existingKeys.has(key);
  });

  if (newTrades.length > 0) {
    await prisma.trade.createMany({ data: newTrades, skipDuplicates: true });
    const totalPnl = newTrades.reduce((s: number, t: any) => s + (t.pnl || 0), 0);
    if (totalPnl !== 0) {
      await prisma.tradingAccount.update({
        where: { id: accountId },
        data: { currentBalance: { increment: totalPnl } },
      });
    }
  }

  return NextResponse.json({ imported: newTrades.length, skipped: trades.length - newTrades.length });
}
