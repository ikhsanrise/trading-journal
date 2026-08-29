import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/auth";
import { prisma } from "@/lib/prisma";

export async function DELETE(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const accountId = searchParams.get("accountId");
  if (!accountId) return NextResponse.json({ error: "Missing accountId" }, { status: 400 });

  const account = await prisma.tradingAccount.findFirst({
    where: { id: accountId, userId: session.user.id },
  });
  if (!account) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const deleted = await prisma.trade.deleteMany({ where: { accountId } });
  await prisma.tradingAccount.update({
    where: { id: accountId },
    data: { currentBalance: account.initialBalance },
  });

  return NextResponse.json({ deleted: deleted.count });
}
