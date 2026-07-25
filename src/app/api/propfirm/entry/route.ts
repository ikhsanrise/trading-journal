import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { propFirmId, type, amount, note, date } = await req.json();
  if (!propFirmId || !type || !amount) return NextResponse.json({ error: "Missing fields" }, { status: 400 });
  const firm = await prisma.propFirm.findFirst({ where: { id: propFirmId, userId: session.user.id } });
  if (!firm) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const entry = await prisma.propEntry.create({
    data: { propFirmId, type, amount: parseFloat(amount), note, date: date ? new Date(date) : new Date() },
  });
  return NextResponse.json(entry);
}

export async function DELETE(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 });
  await prisma.propEntry.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
