import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/auth";
import { prisma } from "@/lib/prisma";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const user = await prisma.user.findUnique({ where: { email: session.user.email } });
  if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });
  const body = await req.json();

  if (body.isDefault) {
    await prisma.tradingAccount.updateMany({
      where: { userId: user.id },
      data: { isDefault: false },
    });
    const account = await prisma.tradingAccount.update({
      where: { id: id },
      data: { isDefault: true },
    });
    return NextResponse.json(account);
  }

  const account = await prisma.tradingAccount.update({
    where: { id: id },
    data: body,
  });
  return NextResponse.json(account);
}

export async function DELETE(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  await prisma.tradingAccount.delete({ where: { id } });
  return NextResponse.json({ success: true });
}