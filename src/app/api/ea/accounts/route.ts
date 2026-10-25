import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { EA_COLORS, requireUserId } from "@/lib/ea-server";

const clean = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim().slice(0, 80) : null);

export async function POST(req: NextRequest) {
  const uid = await requireUserId();
  if (typeof uid !== "string") return uid;
  const b = await req.json();
  const name = clean(b.name);
  if (!name) return NextResponse.json({ error: "Nama EA wajib diisi" }, { status: 400 });
  const unit = b.unit === "USC" ? "USC" : "USD";
  const count = await prisma.eaAccount.count({ where: { userId: uid } });
  const acc = await prisma.eaAccount.create({
    data: { userId: uid, name, symbol: clean(b.symbol), magic: clean(b.magic), login: clean(b.login), unit, color: EA_COLORS[count % EA_COLORS.length] },
  });
  return NextResponse.json(acc);
}
