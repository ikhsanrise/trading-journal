import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export const maxDuration = 30;

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { accountId, transactions } = await req.json();
  if (!accountId || !Array.isArray(transactions)) return NextResponse.json({ imported: 0, skipped: 0 });

  const account = await prisma.tradingAccount.findFirst({
    where: { id: accountId, userId: session.user.id },
  });
  if (!account) return NextResponse.json({ error: "Account not found" }, { status: 404 });

  const keyOf = (t: any) => `${t.type}|${Math.round(t.amount * 100)}|${new Date(t.date).getTime()}`;
  const existing = await prisma.transaction.findMany({
    where: { accountId },
    select: { type: true, amount: true, date: true },
  });
  const seen = new Set(existing.map(keyOf));

  const fresh: any[] = [];
  for (const t of transactions) {
    const k = keyOf(t);
    if (seen.has(k)) continue;
    seen.add(k);
    fresh.push({ accountId, type: t.type, amount: t.amount, note: t.note ?? null, date: new Date(t.date) });
  }
  if (fresh.length > 0) await prisma.transaction.createMany({ data: fresh });

  // Hitung ulang total dari semua transaksi (idempotent, tidak bisa dobel)
  const [dep, wdr] = await Promise.all([
    prisma.transaction.aggregate({ where: { accountId, type: "deposit" }, _sum: { amount: true } }),
    prisma.transaction.aggregate({ where: { accountId, type: "withdraw" }, _sum: { amount: true } }),
  ]);
  const totalDeposit = dep._sum.amount ?? 0;
  const totalWithdraw = wdr._sum.amount ?? 0;
  await prisma.tradingAccount.update({ where: { id: accountId }, data: { totalDeposit, totalWithdraw } });

  return NextResponse.json({
    imported: fresh.length,
    skipped: transactions.length - fresh.length,
    totalDeposit,
    totalWithdraw,
  });
}
