import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/auth";
import { prisma } from "@/lib/prisma";
import { calculateRMultiple, getOutcomeFromR } from "@/lib/utils";

async function verifyOwner(tradeId: string, userEmail: string) {
  const user = await prisma.user.findUnique({ where: { email: userEmail } });
  if (!user) return null;
  const trade = await prisma.trade.findFirst({ where: { id: tradeId }, include: { account: true } });
  if (!trade || trade.account.userId !== user.id) return null;
  return trade;
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const existing = await verifyOwner(params.id, session.user.email);
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const body = await req.json();
  const oldPnl = existing.pnl ?? 0;

  const entryPrice = body.entryPrice ? parseFloat(body.entryPrice) : existing.entryPrice;
  const exitPrice = body.exitPrice ? parseFloat(body.exitPrice) : existing.exitPrice;
  const stopLoss = body.stopLoss ? parseFloat(body.stopLoss) : existing.stopLoss;
  const direction = body.direction ?? existing.direction;

  let rMultiple = existing.rMultiple;
  let outcome = existing.outcome;
  let status = existing.status;

  if (exitPrice && stopLoss) {
    rMultiple = calculateRMultiple(direction, entryPrice, exitPrice, stopLoss);
    outcome = getOutcomeFromR(rMultiple);
    status = "closed";
  }

  let entryDate = existing.entryDate;
  if (body.entryDate) {
    const t = body.entryTime ?? "00:00";
    entryDate = new Date(`${body.entryDate}T${t}:00`);
  }

  let exitDate = existing.exitDate;
  if (body.exitDate && body.exitDate.trim() !== "") {
    const t = body.exitTime ?? "00:00";
    const d = new Date(`${body.exitDate}T${t}:00`);
    exitDate = isNaN(d.getTime()) ? existing.exitDate : d;
  }

  const updated = await prisma.trade.update({
    where: { id: params.id },
    data: {
      symbol: body.symbol?.toUpperCase() ?? existing.symbol,
      direction,
      entryPrice,
      exitPrice: exitPrice ?? null,
      stopLoss: stopLoss ?? null,
      takeProfit: body.takeProfit ? parseFloat(body.takeProfit) : existing.takeProfit,
      lotSize: body.lotSize ? parseFloat(body.lotSize) : existing.lotSize,
      entryDate,
      exitDate,
      commission: body.commission !== undefined ? parseFloat(body.commission) : existing.commission,
      swap: body.swap !== undefined ? parseFloat(body.swap) : existing.swap,
      pnl: body.pnl ? parseFloat(body.pnl) : existing.pnl,
      rMultiple, status, outcome,
      setupId: body.setupId !== undefined ? (body.setupId || null) : existing.setupId,
      session: body.session !== undefined ? (body.session || null) : existing.session,
      timeframe: body.timeframe ?? existing.timeframe,
      notes: body.notes !== undefined ? (body.notes || null) : existing.notes,
      mood: body.mood ? parseInt(body.mood) : existing.mood,
      tags: body.tags ?? existing.tags,
      setupCategory: body.setupCategory !== undefined ? (body.setupCategory || null) : existing.setupCategory,
      screenshotBefore: body.screenshotBefore !== undefined ? (body.screenshotBefore || null) : existing.screenshotBefore,
      screenshotAfter: body.screenshotAfter !== undefined ? (body.screenshotAfter || null) : existing.screenshotAfter,
    },
    include: { setup: true, account: true },
  });

  const delta = (updated.pnl ?? 0) - oldPnl;
  if (delta !== 0) {
    await prisma.tradingAccount.update({
      where: { id: existing.accountId },
      data: { currentBalance: { increment: delta } },
    });
  }

  return NextResponse.json(updated);
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const trade = await verifyOwner(params.id, session.user.email);
  if (!trade) return NextResponse.json({ error: "Not found" }, { status: 404 });

  await prisma.trade.delete({ where: { id: params.id } });

  if (trade.pnl && trade.status === "closed") {
    await prisma.tradingAccount.update({
      where: { id: trade.accountId },
      data: { currentBalance: { decrement: trade.pnl } },
    });
  }

  return NextResponse.json({ success: true });
}
