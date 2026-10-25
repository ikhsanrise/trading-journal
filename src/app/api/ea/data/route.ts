import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { EA_COLORS, requireUserId, unitDivisor } from "@/lib/ea-server";

export const dynamic = "force-dynamic";

type Row = { d: string; p: number; n: number; w: number; gw: number; gl: number };

export async function GET() {
  const uid = await requireUserId();
  if (typeof uid !== "string") return uid;

  const accounts = await prisma.eaAccount.findMany({ where: { userId: uid }, orderBy: { createdAt: "asc" } });
  const ids = accounts.map((a) => a.id);
  const divOf = new Map(accounts.map((a) => [a.id, unitDivisor(a.unit)]));

  const [deals, flows, uploads, setting] = await Promise.all([
    ids.length ? prisma.eaDeal.findMany({ where: { eaAccountId: { in: ids } }, select: { eaAccountId: true, kind: true, time: true, profit: true } }) : Promise.resolve([]),
    ids.length ? prisma.eaFlow.findMany({ where: { eaAccountId: { in: ids } }, orderBy: { time: "asc" } }) : Promise.resolve([]),
    ids.length ? prisma.eaUpload.findMany({ where: { eaAccountId: { in: ids } }, orderBy: { createdAt: "desc" }, take: 60 }) : Promise.resolve([]),
    prisma.eaSetting.findUnique({ where: { userId: uid } }),
  ]);

  const byAcc = new Map<string, Map<string, Row>>();
  for (const dl of deals) {
    const div = divOf.get(dl.eaAccountId) ?? 1;
    const d = dl.time.toISOString().slice(0, 10);
    let m = byAcc.get(dl.eaAccountId);
    if (!m) { m = new Map(); byAcc.set(dl.eaAccountId, m); }
    let r = m.get(d);
    if (!r) { r = { d, p: 0, n: 0, w: 0, gw: 0, gl: 0 }; m.set(d, r); }
    const usd = dl.profit / div;
    r.p += usd;
    if (dl.kind === "out") {
      r.n += 1;
      if (usd > 0) { r.w += 1; r.gw += usd; } else if (usd < 0) r.gl += -usd;
    }
  }
  const daily: Record<string, Row[]> = {};
  for (const a of accounts) {
    const m = byAcc.get(a.id);
    daily[a.id] = m ? Array.from(m.values()).sort((x, y) => (x.d < y.d ? -1 : 1)) : [];
  }

  const lastUp = new Map<string, Date>();
  for (const u of uploads) if (!lastUp.has(u.eaAccountId)) lastUp.set(u.eaAccountId, u.createdAt);

  return NextResponse.json({
    rate: setting?.usdIdr ?? 16250,
    accounts: accounts.map((a, i) => ({
      id: a.id, name: a.name, symbol: a.symbol, magic: a.magic, login: a.login, unit: a.unit,
      color: a.color ?? EA_COLORS[i % EA_COLORS.length],
      lastUploadAt: lastUp.get(a.id)?.toISOString() ?? null,
    })),
    daily,
    flows: flows.map((f) => ({
      id: f.id, accountId: f.eaAccountId, d: f.time.toISOString().slice(0, 10),
      type: f.type, amount: f.amount / (divOf.get(f.eaAccountId) ?? 1), comment: f.comment,
    })),
    uploads: uploads.map((u) => ({
      id: u.id, accountId: u.eaAccountId, filename: u.filename, newDeals: u.newDeals, dupDeals: u.dupDeals, newFlows: u.newFlows,
      periodFrom: u.periodFrom?.toISOString().slice(0, 10) ?? null, periodTo: u.periodTo?.toISOString().slice(0, 10) ?? null,
      createdAt: u.createdAt.toISOString(),
    })),
  });
}
