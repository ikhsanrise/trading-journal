import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/auth";
import { prisma } from "@/lib/prisma";
import { calculateRMultiple, getOutcomeFromR } from "@/lib/utils";

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ trades: [], total: 0, page: 1, pageSize: 15, totalPages: 0 });
  const userId = session.user.id;

  const { searchParams } = new URL(req.url);
  const accountId = searchParams.get("accountId");
  const outcome = searchParams.get("outcome");
  const direction = searchParams.get("direction");
  const search = searchParams.get("search");
  const setupCategory = searchParams.get("setupCategory");
  const page = parseInt(searchParams.get("page") ?? "1");
  const pageSize = parseInt(searchParams.get("pageSize") ?? "15");

  const accounts = await prisma.tradingAccount.findMany({ where: { userId }, select: { id: true } });
  const accountIds = accounts.map((a) => a.id);

  const where: any = { accountId: accountId && accountIds.includes(accountId) ? accountId : { in: accountIds } };
  if (outcome) where.outcome = outcome;
  if (direction) where.direction = direction;
  if (search) where.symbol = { contains: search.toUpperCase() };
  if (setupCategory) where.setupCategory = setupCategory;

  const [total, trades] = await Promise.all([
    prisma.trade.count({ where }),
    prisma.trade.findMany({ where, include: { setup: true, account: true }, orderBy: { entryDate: "desc" }, skip: (page - 1) * pageSize, take: pageSize }),
  ]);

  return NextResponse.json({ trades, total, page, pageSize, totalPages: Math.ceil(total / pageSize) });
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const user = await prisma.user.findUnique({ where: { email: session.user.email } });
  if (!user) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const body = await req.json();
  const account = await prisma.tradingAccount.findFirst({ where: { id: body.accountId, userId: user.id } });
  if (!account) return NextResponse.json({ error: "Account not found" }, { status: 404 });

  let rMultiple = null, outcome = null, status = "open";
  if (body.exitPrice && body.stopLoss) {
    rMultiple = calculateRMultiple(body.direction, parseFloat(body.entryPrice), parseFloat(body.exitPrice), parseFloat(body.stopLoss));
    outcome = getOutcomeFromR(rMultiple);
    status = "closed";
  }

  const entryDate = new Date(`${body.entryDate}T${body.entryTime ?? "00:00"}:00`);
  const exitDate = body.exitDate && body.exitDate.trim() !== "" ? new Date(`${body.exitDate}T${body.exitTime ?? "00:00"}:00`) : null;

  const trade = await prisma.trade.create({
    data: {
      accountId: body.accountId,
      symbol: body.symbol.toUpperCase(),
      direction: body.direction,
      entryPrice: parseFloat(body.entryPrice),
      exitPrice: body.exitPrice ? parseFloat(body.exitPrice) : null,
      stopLoss: body.stopLoss ? parseFloat(body.stopLoss) : null,
      takeProfit: body.takeProfit ? parseFloat(body.takeProfit) : null,
      lotSize: parseFloat(body.lotSize),
      entryDate, exitDate,
      commission: parseFloat(body.commission ?? 0),
      swap: parseFloat(body.swap ?? 0),
      pnl: body.pnl ? parseFloat(body.pnl) : null,
      rMultiple, status, outcome,
      setupId: body.setupId || null,
      session: body.session || null,
      timeframe: body.timeframe || null,
      notes: body.notes || null,
      mood: body.mood ? parseInt(body.mood) : null,
      tags: body.tags ?? [],
      setupCategory: body.setupCategory || null,
      screenshotBefore: body.screenshotBefore || null,
      screenshotAfter: body.screenshotAfter || null,
    },
    include: { setup: true, account: true },
  });

  if (trade.pnl && status === "closed") {
    await prisma.tradingAccount.update({ where: { id: account.id }, data: { currentBalance: { increment: trade.pnl } } });
  }

  return NextResponse.json(trade, { status: 201 });
}
