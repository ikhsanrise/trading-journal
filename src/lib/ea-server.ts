import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/auth";

export const EA_COLORS = ["#4f6bff", "#22d3ee", "#a78bfa", "#f472b6", "#fb923c", "#34d399", "#facc15", "#60a5fa"];
export const unitDivisor = (unit: string) => (unit === "USC" ? 100 : 1);

export async function requireUserId(): Promise<string | NextResponse> {
  const session = await getServerSession(authOptions);
  const id = (session?.user as any)?.id as string | undefined;
  if (!session?.user?.email || !id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  return id;
}
