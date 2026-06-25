import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const userId = session?.user?.id;
  if (!userId) return NextResponse.json({ error: "User not found" }, { status: 404 });
  const accounts = await prisma.tradingAccount.findMany({
    where: { userId },
    orderBy: { createdAt: "asc" },
  });
  return NextResponse.json(accounts);
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const user = await prisma.user.findUnique({ where: { email: session.user.email } });
  if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });
  const body = await req.json();
  const { name, broker, currency, assetClass, initialBalance } = body;
  const existingAccounts = await prisma.tradingAccount.findMany({ where: { userId: user.id } });
  const account = await prisma.tradingAccount.create({
    data: {
      userId: user.id,
      name,
      broker,
      currency,
      assetClass,
      initialBalance: parseFloat(initialBalance),
      currentBalance: parseFloat(initialBalance),
      isDefault: existingAccounts.length === 0,
    },
  });
  return NextResponse.json(account);
}
