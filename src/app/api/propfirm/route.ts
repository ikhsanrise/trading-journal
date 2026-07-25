import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const firms = await prisma.propFirm.findMany({
    where: { userId: session.user.id },
    include: { entries: { orderBy: { date: "asc" } } },
    orderBy: { createdAt: "asc" },
  });
  return NextResponse.json(firms);
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { name } = await req.json();
  if (!name) return NextResponse.json({ error: "Missing name" }, { status: 400 });
  const firm = await prisma.propFirm.create({
    data: { userId: session.user.id, name },
    include: { entries: true },
  });
  return NextResponse.json(firm);
}

export async function DELETE(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 });
  await prisma.propFirm.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
