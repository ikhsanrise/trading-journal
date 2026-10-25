export const maxDuration = 60;

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUserId, unitDivisor } from "@/lib/ea-server";
import { parseMt5Csv } from "@/lib/ea-parse";

const CHUNK = 500;

// POST multipart: file, accountId, mode = "preview" | "commit"
export async function POST(req: NextRequest) {
  const uid = await requireUserId();
  if (typeof uid !== "string") return uid;

  const form = await req.formData();
  const file = form.get("file");
  const accountId = String(form.get("accountId") ?? "");
  const mode = String(form.get("mode") ?? "preview");
  if (!(file instanceof File)) return NextResponse.json({ error: "File tidak ditemukan" }, { status: 400 });
  if (file.size > 25 * 1024 * 1024) return NextResponse.json({ error: "File terlalu besar (maksimal 25 MB)" }, { status: 400 });

  const account = await prisma.eaAccount.findFirst({ where: { id: accountId, userId: uid } });
  if (!account) return NextResponse.json({ error: "Pilih akun EA terlebih dulu" }, { status: 400 });

  const text = await file.text();
  const parsed = parseMt5Csv(text);
  if (parsed.format === "unknown" || (parsed.deals.length === 0 && parsed.flows.length === 0)) {
    return NextResponse.json({ error: parsed.warnings[0] ?? "Tidak ada trade yang terbaca di file ini", warnings: parsed.warnings }, { status: 422 });
  }

  const [existDeals, existFlows] = await Promise.all([
    prisma.eaDeal.findMany({ where: { eaAccountId: account.id }, select: { ticket: true } }),
    prisma.eaFlow.findMany({ where: { eaAccountId: account.id }, select: { ticket: true } }),
  ]);
  const dealSet = new Set(existDeals.map((d) => d.ticket));
  const flowSet = new Set(existFlows.map((f) => f.ticket));
  const seen = new Set<string>();
  const newDeals = parsed.deals.filter((d) => { if (dealSet.has(d.ticket) || seen.has(d.ticket)) return false; seen.add(d.ticket); return true; });
  const seenF = new Set<string>();
  const newFlows = parsed.flows.filter((f) => { if (flowSet.has(f.ticket) || seenF.has(f.ticket)) return false; seenF.add(f.ticket); return true; });
  const dupDeals = parsed.deals.length - newDeals.length;
  const div = unitDivisor(account.unit);

  const allTimes = [...parsed.deals.map((d) => d.time.getTime()), ...parsed.flows.map((f) => f.time.getTime())];
  const periodFrom = allTimes.length ? new Date(Math.min(...allTimes)) : null;
  const periodTo = allTimes.length ? new Date(Math.max(...allTimes)) : null;
  const newTrades = newDeals.filter((d) => d.kind === "out").length;
  const netNative = newDeals.reduce((s, d) => s + d.profit, 0);

  if (mode !== "commit") {
    const sample = [
      ...newDeals.filter((d) => d.kind === "out").slice(0, 4).map((d) => ({ kind: "trade", ticket: d.ticket, time: d.time.toISOString(), symbol: d.symbol, side: d.side, amountUsd: d.profit / div })),
      ...newFlows.slice(0, 2).map((f) => ({ kind: f.type, ticket: f.ticket, time: f.time.toISOString(), symbol: null, side: null, amountUsd: (f.type === "deposit" ? f.amount : -f.amount) / div })),
    ];
    return NextResponse.json({
      format: parsed.format, unit: account.unit, accountName: account.name,
      newTrades, newDeals: newDeals.length, dupDeals, newFlows: newFlows.length,
      dupFlows: parsed.flows.length - newFlows.length,
      netUsd: netNative / div,
      withdrawUsd: newFlows.filter((f) => f.type === "withdraw").reduce((s, f) => s + f.amount, 0) / div,
      depositUsd: newFlows.filter((f) => f.type === "deposit").reduce((s, f) => s + f.amount, 0) / div,
      periodFrom: periodFrom?.toISOString().slice(0, 10) ?? null,
      periodTo: periodTo?.toISOString().slice(0, 10) ?? null,
      totalRows: parsed.deals.length + parsed.flows.length,
      sample, warnings: parsed.warnings,
    });
  }

  const upload = await prisma.eaUpload.create({
    data: { eaAccountId: account.id, filename: file.name.slice(0, 120), newDeals: newTrades, dupDeals, newFlows: newFlows.length, periodFrom, periodTo },
  });
  for (let i = 0; i < newDeals.length; i += CHUNK) {
    await prisma.eaDeal.createMany({
      data: newDeals.slice(i, i + CHUNK).map((d) => ({ eaAccountId: account.id, ticket: d.ticket, kind: d.kind, time: d.time, symbol: d.symbol, side: d.side, volume: d.volume, profit: d.profit, uploadId: upload.id })),
    });
  }
  for (let i = 0; i < newFlows.length; i += CHUNK) {
    await prisma.eaFlow.createMany({
      data: newFlows.slice(i, i + CHUNK).map((f) => ({ eaAccountId: account.id, ticket: f.ticket, time: f.time, type: f.type, amount: f.amount, comment: f.comment || null, uploadId: upload.id })),
    });
  }
  return NextResponse.json({ ok: true, uploadId: upload.id, newTrades, newFlows: newFlows.length, dupDeals });
}

// DELETE ?id=<uploadId> : batalkan satu unggahan (hapus trade dan arus dana yang masuk lewat unggahan itu)
export async function DELETE(req: NextRequest) {
  const uid = await requireUserId();
  if (typeof uid !== "string") return uid;
  const id = new URL(req.url).searchParams.get("id");
  if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 });
  const up = await prisma.eaUpload.findFirst({ where: { id, account: { userId: uid } } });
  if (!up) return NextResponse.json({ error: "Unggahan tidak ditemukan" }, { status: 404 });
  await prisma.eaDeal.deleteMany({ where: { uploadId: id } });
  await prisma.eaFlow.deleteMany({ where: { uploadId: id } });
  await prisma.eaUpload.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
