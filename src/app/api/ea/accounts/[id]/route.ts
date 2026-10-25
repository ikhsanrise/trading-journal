import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUserId } from "@/lib/ea-server";

const clean = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim().slice(0, 80) : null);

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const uid = await requireUserId();
  if (typeof uid !== "string") return uid;
  const own = await prisma.eaAccount.findFirst({ where: { id, userId: uid } });
  if (!own) return NextResponse.json({ error: "Akun tidak ditemukan" }, { status: 404 });
  const b = await req.json();
  const name = clean(b.name);
  if (!name) return NextResponse.json({ error: "Nama EA wajib diisi" }, { status: 400 });
  const acc = await prisma.eaAccount.update({
    where: { id },
    data: { name, symbol: clean(b.symbol), magic: clean(b.magic), login: clean(b.login), unit: b.unit === "USC" ? "USC" : "USD" },
  });
  return NextResponse.json(acc);
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const uid = await requireUserId();
  if (typeof uid !== "string") return uid;
  const own = await prisma.eaAccount.findFirst({ where: { id, userId: uid } });
  if (!own) return NextResponse.json({ error: "Akun tidak ditemukan" }, { status: 404 });
  await prisma.eaAccount.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
