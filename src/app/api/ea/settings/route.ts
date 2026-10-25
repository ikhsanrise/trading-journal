import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUserId } from "@/lib/ea-server";

export async function PUT(req: NextRequest) {
  const uid = await requireUserId();
  if (typeof uid !== "string") return uid;
  const b = await req.json();
  const rate = Number(b.usdIdr);
  if (!Number.isFinite(rate) || rate < 1000 || rate > 100000) return NextResponse.json({ error: "Kurs tidak valid" }, { status: 400 });
  const s = await prisma.eaSetting.upsert({ where: { userId: uid }, update: { usdIdr: rate }, create: { userId: uid, usdIdr: rate } });
  return NextResponse.json(s);
}
