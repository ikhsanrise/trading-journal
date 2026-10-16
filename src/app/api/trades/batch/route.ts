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
    select: { positionId: true, symbol: true, lotSize: true, entryDate: true },
  });
  const knownPositions = new Set(
    existing.map((t) => t.positionId).filter(Boolean) as string[]
  );
  const knownKeys = new Set(
    existing.map((t) => `${t.symbol}|${t.lotSize}|${new Date(t.entryDate).getTime()}`)
  );

  // Jika ada positionId, itu satu-satunya patokan duplikat.
  // Trade hedge dengan detik & lot sama tapi positionId beda adalah trade yang valid.
  const seen = new Set<string>();
  const newTrades = trades.filter((t: any) => {
    if (t.positionId) {
      if (knownPositions.has(t.positionId) || seen.has(t.positionId)) return false;
      seen.add(t.positionId);
      return true;
    }
    return !knownKeys.has(`${t.symbol}|${t.lotSize}|${new Date(t.entryDate).getTime()}`);
  });

  if (newTrades.length > 0) {
    await prisma.trade.createMany({ data: newTrades });
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
