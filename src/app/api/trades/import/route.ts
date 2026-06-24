// src/app/api/trades/import/route.ts
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import Papa from "papaparse";
import { calculateRMultiple, getOutcomeFromR } from "@/lib/utils";

function parseDate(str: string): Date | null {
  if (!str || str.trim() === "") return null;
  // Format: 2026.06.22 06:14:59
  const dotFmt = str.match(/^(\d{4})\.(\d{2})\.(\d{2})\s+(\d{2}:\d{2}:\d{2})$/);
  if (dotFmt) return new Date(`${dotFmt[1]}-${dotFmt[2]}-${dotFmt[3]}T${dotFmt[4]}`);
  return new Date(str);
}

// Format HFM/MT5: Time,Position,Symbol,Type,Volume,Price,S/L,T/P,Time,Price,Commission,Swap,Profit
function parseHFMRow(row: any) {
  const keys = Object.keys(row);
  // Kolom Time ada 2x, papaparse akan buat Time dan Time_1
  const entryTime = row["Time"] ?? row["Open Time"] ?? "";
  const exitTime = row["Time_1"] ?? row["Close Time"] ?? "";
  const entryPrice = parseNum(row["Price"]);
  const exitPrice = parseNum(row["Price_1"] ?? row["Close Price"]) || null;
  const type = (row["Type"] ?? row["type"] ?? "").toLowerCase();
  const sl = parseNum(row["S / L"] ?? row["SL"]) || null;
  const tp = parseNum(row["T / P"] ?? row["TP"]) || null;
  const pnl = parseNum(row["Profit"]);
  const commission = parseNum(row["Commission"]);
  const swap = parseNum(row["Swap"]);
  const lotSize = parseNum(row["Volume"] ?? row["Size"]);
  const symbol = (row["Symbol"] ?? "").replace(/r$/, ""); // hapus suffix 'r' pada XAUUSDr

  return {
    symbol,
    direction: type.includes("buy") ? "long" : "short",
    entryPrice,
    exitPrice,
    stopLoss: sl,
    takeProfit: tp,
    lotSize,
    entryDate: entryTime,
    exitDate: exitTime,
    pnl,
    commission,
    swap,
    rMultiple: null as number | null,
    outcome: null as string | null,
  };
}

// Format Trading Journal export: Date,Symbol,Direction,Entry Price,Exit Price,...
function parseJournalRow(row: any) {
  return {
    symbol: row["Symbol"] ?? "",
    direction: (row["Direction"] ?? "long").toLowerCase(),
    entryPrice: parseFloat(row["Entry Price"] ?? 0),
    exitPrice: parseFloat(row["Exit Price"] ?? "") || null,
    stopLoss: parseFloat(row["Stop Loss"] ?? "") || null,
    takeProfit: parseFloat(row["Take Profit"] ?? "") || null,
    lotSize: parseFloat(row["Lot Size"] ?? 0),
    entryDate: row["Entry Date"] ?? row["Date"] ?? "",
    exitDate: row["Exit Date"] ?? "",
    pnl: parseFloat(row["P&L"] ?? 0),
    commission: parseFloat(row["Commission"] ?? 0),
    swap: parseFloat(row["Swap"] ?? 0),
    rMultiple: parseFloat(row["R-Multiple"] ?? "") || null,
    outcome: row["Outcome"] ?? null,
    setup: row["Setup"] ?? null,
    setupCategory: row["Setup Category"] ?? null,
    session: row["Session"] ?? null,
    timeframe: row["Timeframe"] ?? null,
    mood: row["Mood"] ?? null,
    notes: row["Notes"] ?? null,
    tags: row["Tags"] ?? null,
  };
}

function parseNum(val: any): number {
  if (val == null) return 0;
  const str = String(val).trim();
  if (str === "" || str === "-") return 0;
  // Handle format HFM: "4 178.90" -> 4178.90, "-134 572.25" -> -134572.25
  // Spasi adalah thousand separator, titik adalah decimal separator
  const cleaned = str.replace(/\s/g, "");
  return parseFloat(cleaned) || 0;
}

function detectFormat(headers: string[]): "hfm" | "journal" | "mt4" {
  if (headers.includes("Direction") || headers.includes("Entry Price")) return "journal";
  if (headers.includes("Volume") || headers.includes("Position")) return "hfm";
  return "mt4";
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const formData = await req.formData();
  const file = formData.get("file") as File;
  const accountId = formData.get("accountId") as string;

  if (!file || !accountId)
    return NextResponse.json({ error: "Missing file or accountId" }, { status: 400 });

  const account = await prisma.tradingAccount.findFirst({
    where: { id: accountId, userId: session.user.id },
  });
  if (!account)
    return NextResponse.json({ error: "Account not found" }, { status: 404 });

  let text = await file.text();

  // Skip metadata rows untuk format HFM (baris sebelum "Positions," atau "Time,Position,")
  const lines = text.split("\n");
  let dataStart = 0;
  for (let i = 0; i < lines.length; i++) {
    const l = lines[i].trim();
    if (l.startsWith("Time,Position") || l.startsWith("Date,Symbol") || l.startsWith("Symbol,")) {
      dataStart = i;
      break;
    }
    // Skip baris "Positions,,,,,"
    if (l.startsWith("Positions,")) {
      dataStart = i + 1;
      break;
    }
  }
  text = lines.slice(dataStart).join("\n");

  const { data, errors } = Papa.parse(text, {
    header: true,
    skipEmptyLines: true,
    transformHeader: (h) => h.trim(),
  });

  if (errors.length > 0 && data.length === 0)
    return NextResponse.json({ error: "CSV parse error", errors }, { status: 400 });

  const headers = data.length > 0 ? Object.keys(data[0] as object) : [];
  const format = detectFormat(headers);

  const created = [];
  const failed = [];
  let totalPnl = 0;

  for (const row of data as any[]) {
    try {
      const parsed = format === "journal" ? parseJournalRow(row) : parseHFMRow(row);

      if (!parsed.symbol || !parsed.lotSize) continue;
      // Skip baris summary/total di HFM
      if (parsed.symbol === "" || isNaN(parsed.entryPrice) || parsed.entryPrice === 0) continue;

      const status = parsed.exitDate && parsed.exitDate.trim() !== "" ? "closed" : "open";

      let rMultiple = parsed.rMultiple;
      let outcome = parsed.outcome;

      if (!rMultiple && parsed.exitPrice && parsed.stopLoss) {
        rMultiple = calculateRMultiple(
          parsed.direction,
          parsed.entryPrice,
          parsed.exitPrice,
          parsed.stopLoss
        );
      }
      if (!outcome) {
        // Prioritas: pakai PnL untuk outcome (lebih reliable dari rMultiple saat SL tidak ada)
        if (parsed.pnl > 0) outcome = "win";
        else if (parsed.pnl < 0) outcome = "loss";
        else if (rMultiple !== null && rMultiple !== 0) outcome = getOutcomeFromR(rMultiple);
        else if (status === "closed") outcome = "breakeven";
      }

      const entryDate = parseDate(parsed.entryDate) ?? new Date();
      const exitDate = parsed.exitDate ? parseDate(parsed.exitDate) : null;

      const tradeData: any = {
        accountId,
        symbol: parsed.symbol.toUpperCase(),
        direction: parsed.direction,
        entryPrice: parsed.entryPrice,
        exitPrice: parsed.exitPrice,
        stopLoss: parsed.stopLoss,
        takeProfit: parsed.takeProfit,
        lotSize: parsed.lotSize,
        entryDate,
        exitDate,
        commission: parsed.commission || 0,
        swap: parsed.swap || 0,
        pnl: parsed.pnl || 0,
        rMultiple,
        status,
        outcome,
      };

      // Extra fields untuk format journal
      if (format === "journal") {
        if ((parsed as any).session) tradeData.session = (parsed as any).session;
        if ((parsed as any).timeframe) tradeData.timeframe = (parsed as any).timeframe;
        if ((parsed as any).mood) tradeData.mood = (parsed as any).mood;
        if ((parsed as any).notes) tradeData.notes = (parsed as any).notes;
        if ((parsed as any).setupCategory) tradeData.setupCategory = (parsed as any).setupCategory;
      }

      await prisma.trade.create({ data: tradeData });
      created.push(parsed.symbol);
      totalPnl += parsed.pnl || 0;
    } catch (e) {
      failed.push({ error: String(e) });
    }
  }

  if (created.length > 0 && totalPnl !== 0) {
    await prisma.tradingAccount.update({
      where: { id: accountId },
      data: { currentBalance: { increment: totalPnl } },
    });
  }

  return NextResponse.json({
    imported: created.length,
    failed: failed.length,
    errors: failed.slice(0, 5),
    format,
  });
}
