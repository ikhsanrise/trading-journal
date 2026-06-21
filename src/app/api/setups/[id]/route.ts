import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/auth";
import { prisma } from "@/lib/prisma";

export async function PATCH(
  req: NextRequest,
  context: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const user = await prisma.user.findUnique({ where: { email: session.user.email } });
  if (!user) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const setup = await prisma.setup.findFirst({ where: { id: context.params.id, userId: user.id } });
  if (!setup) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const body = await req.json();
  const updated = await prisma.setup.update({
    where: { id: context.params.id },
    data: {
      name: body.name ?? setup.name,
      description: body.description ?? setup.description,
      rules: body.rules ?? setup.rules,
      timeframe: body.timeframe ?? setup.timeframe,
      expectedRR: body.expectedRR != null ? parseFloat(body.expectedRR) : setup.expectedRR,
      tags: body.tags ?? setup.tags,
    },
  });
  return NextResponse.json(updated);
}

export async function DELETE(
  req: NextRequest,
  context: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const user = await prisma.user.findUnique({ where: { email: session.user.email } });
  if (!user) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const setup = await prisma.setup.findFirst({ where: { id: context.params.id, userId: user.id } });
  if (!setup) return NextResponse.json({ error: "Not found" }, { status: 404 });

  await prisma.trade.updateMany({ where: { setupId: context.params.id }, data: { setupId: null } });
  await prisma.setup.delete({ where: { id: context.params.id } });
  return NextResponse.json({ success: true });
}
