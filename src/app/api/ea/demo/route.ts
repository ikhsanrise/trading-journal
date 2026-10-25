import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { EA_COLORS, requireUserId } from "@/lib/ea-server";

export const dynamic = "force-dynamic";
const PREFIX = "[Contoh] ";

// PRNG deterministik supaya data contoh selalu sama bentuknya
function rng(seed: number) {
  let s = seed >>> 0;
  return () => { s = (s + 0x6d2b79f5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

const SPECS = [
  { name: "Gold Scalper", symbol: "XAUUSD", login: "900001", magic: "7001", unit: "USD", mult: 1, perDay: [2, 5], p: 0.64, win: [5, 15], loss: [7, 17], dep: 1000, wd: 150, wdWeek: 5, seed: 11 },
  { name: "Trend Follower", symbol: "EURUSD", login: "900002", magic: "7002", unit: "USD", mult: 1, perDay: [0, 2], p: 0.5, win: [14, 42], loss: [9, 24], dep: 2000, wd: 0, wdWeek: 0, seed: 23 },
  { name: "Cent Grid", symbol: "XAUUSD", login: "900003", magic: "7003", unit: "USC", mult: 100, perDay: [3, 6], p: 0.6, win: [3, 9], loss: [5, 14], dep: 1000, wd: 200, wdWeek: 6, seed: 37 },
] as const;

export async function POST() {
  const uid = await requireUserId();
  if (typeof uid !== "string") return uid;
  const exists = await prisma.eaAccount.count({ where: { userId: uid, name: { startsWith: PREFIX } } });
  if (exists) return NextResponse.json({ ok: true, skipped: true });
  const base = await prisma.eaAccount.count({ where: { userId: uid } });

  // 8 minggu terakhir, berakhir di hari kerja terakhir
  const end = new Date(); end.setUTCHours(0, 0, 0, 0);
  while (end.getUTCDay() === 0 || end.getUTCDay() === 6) end.setUTCDate(end.getUTCDate() - 1);
  const start = new Date(end); start.setUTCDate(start.getUTCDate() - 7 * 8 + 1);
  while (start.getUTCDay() !== 1) start.setUTCDate(start.getUTCDate() + 1);

  let idx = 0;
  for (const sp of SPECS) {
    const r = rng(sp.seed);
    const acc = await prisma.eaAccount.create({
      data: { userId: uid, name: PREFIX + sp.name, symbol: sp.symbol, magic: sp.magic, login: sp.login, unit: sp.unit, color: EA_COLORS[(base + idx++) % EA_COLORS.length] },
    });
    const up = await prisma.eaUpload.create({ data: { eaAccountId: acc.id, filename: "contoh-data.csv", periodFrom: start, periodTo: end } });
    const deals: any[] = [];
    let n = 0, week = 0;
    for (let d = new Date(start); d <= end; d.setUTCDate(d.getUTCDate() + 1)) {
      if (d.getUTCDay() === 1) week++;
      if (d.getUTCDay() === 0 || d.getUTCDay() === 6) continue;
      const cnt = sp.perDay[0] + Math.floor(r() * (sp.perDay[1] - sp.perDay[0] + 1));
      const bad = week === 5; // satu minggu buruk supaya drawdown terlihat
      for (let i = 0; i < cnt; i++) {
        const win = r() < (bad ? sp.p - 0.28 : sp.p);
        const rg = win ? sp.win : sp.loss;
        const amt = (rg[0] + r() * (rg[1] - rg[0])) * sp.mult * (win ? 1 : -1);
        const t = new Date(d); t.setUTCHours(7 + Math.floor(r() * 14), Math.floor(r() * 60), Math.floor(r() * 60));
        deals.push({
          eaAccountId: acc.id, ticket: `demo-${acc.id.slice(-6)}-${++n}`, kind: "out", time: t, symbol: sp.symbol,
          side: r() < 0.5 ? "buy" : "sell", volume: sp.unit === "USC" ? 0.1 : 0.05, profit: Math.round(amt * 100) / 100, uploadId: up.id,
        });
      }
    }
    const flowDate = (offsetDays: number, h: number) => { const t = new Date(start); t.setUTCDate(t.getUTCDate() + offsetDays); t.setUTCHours(h, 0, 0); return t; };
    const flows: any[] = [{ eaAccountId: acc.id, ticket: `demo-dep-${acc.id.slice(-6)}`, time: flowDate(0, 0), type: "deposit", amount: sp.dep * sp.mult, comment: "Deposit awal (contoh)", uploadId: up.id }];
    if (sp.wd > 0) flows.push({ eaAccountId: acc.id, ticket: `demo-wd-${acc.id.slice(-6)}`, time: flowDate((sp.wdWeek - 1) * 7 + 4, 15), type: "withdraw", amount: sp.wd * sp.mult, comment: "Withdraw (contoh)", uploadId: up.id });
    await prisma.eaDeal.createMany({ data: deals });
    await prisma.eaFlow.createMany({ data: flows });
    await prisma.eaUpload.update({ where: { id: up.id }, data: { newDeals: deals.length, newFlows: flows.length } });
  }
  return NextResponse.json({ ok: true });
}

export async function DELETE() {
  const uid = await requireUserId();
  if (typeof uid !== "string") return uid;
  const r = await prisma.eaAccount.deleteMany({ where: { userId: uid, name: { startsWith: PREFIX } } });
  return NextResponse.json({ ok: true, removed: r.count });
}
