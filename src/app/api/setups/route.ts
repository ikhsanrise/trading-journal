import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) return NextResponse.json([], { status: 200 });
  const user = await prisma.user.findUnique({ where: { email: session.user.email } });
  if (!user) return NextResponse.json([]);
  const setups = await prisma.setup.findMany({
    where: { userId: user.id },
    orderBy: { name: "asc" },
  });
  return NextResponse.json(setups);
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const user = await prisma.user.findUnique({ where: { email: session.user.email } });
  if (!user) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const body = await req.json();
  const setup = await prisma.setup.create({
    data: {
      userId: user.id,
      name: body.name,
      description: body.description ?? null,
      rules: body.rules ?? null,
      timeframe: body.timeframe ?? null,
      expectedRR: body.expectedRR ? parseFloat(body.expectedRR) : null,
      tags: body.tags ?? [],
    },
  });
  return NextResponse.json(setup, { status: 201 });
}
