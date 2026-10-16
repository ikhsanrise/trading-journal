import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { searchParams } = new URL(req.url);
  const accountId = searchParams.get("accountId");
  if (!accountId) return NextResponse.json({ error: "Missing accountId" }, { status: 400 });
  const transactions = await prisma.transaction.findMany({
    where: { accountId },
    orderBy: { date: "desc" },
  });
  return NextResponse.json(transactions);
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = await req.json();
  const { accountId, type, amount, note, date } = body;
  if (!accountId || !type || !amount) return NextResponse.json({ error: "Missing fields" }, { status: 400 });

  const account = await prisma.tradingAccount.findFirst({
    where: { id: accountId, userId: session.user.id },
  });
  if (!account) return NextResponse.json({ error: "Account not found" }, { status: 404 });

  const tx = await prisma.transaction.create({
    data: {
      accountId,
      type,
      amount: parseFloat(amount),
      note,
      date: date ? new Date(date) : new Date(),
    },
  });

  // Update totalDeposit / totalWithdraw
  if (type === "deposit") {
    await prisma.tradingAccount.update({
      where: { id: accountId },
      data: { totalDeposit: { increment: parseFloat(amount) } },
    });
  } else {
    await prisma.tradingAccount.update({
      where: { id: accountId },
      data: { totalWithdraw: { increment: parseFloat(amount) } },
    });
  }

  return NextResponse.json(tx);
}

export async function DELETE(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 });

  const tx = await prisma.transaction.findUnique({ where: { id } });
  if (!tx) return NextResponse.json({ error: "Not found" }, { status: 404 });

  await prisma.transaction.delete({ where: { id } });

  // Revert totalDeposit / totalWithdraw
  if (tx.type === "deposit") {
    await prisma.tradingAccount.update({
      where: { id: tx.accountId },
      data: { totalDeposit: { decrement: tx.amount } },
    });
  } else {
    await prisma.tradingAccount.update({
      where: { id: tx.accountId },
      data: { totalWithdraw: { decrement: tx.amount } },
    });
  }

  return NextResponse.json({ ok: true });
}
