// src/app/api/trades/import/route.ts
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import Papa from "papaparse";
import { calculateRMultiple, getOutcomeFromR } from "@/lib/utils";

// MT4/MT5 CSV header mapping
function parseMT4Row(row: any) {
  return {
    symbol: row["Symbol"] ?? row["symbol"] ?? "",
    direction: (row["Type"] ?? row["type"] ?? "").toLowerCase().includes("buy")
      ? "long"
      : "short",
    entryPrice: parseFloat(row["Open Price"] ?? row["Price"] ?? 0),
    exitPrice: parseFloat(row["Close Price"] ?? row["Close"] ?? 0) || null,
    stopLoss: parseFloat(row["S / L"] ?? row["SL"] ?? row["Stop Loss"] ?? 0) || null,
    takeProfit: parseFloat(row["T / P"] ?? row["TP"] ?? row["Take Profit"] ?? 0) || null,
    lotSize: parseFloat(row["Size"] ?? row["Lots"] ?? row["Volume"] ?? 0),
    entryDate: row["Open Time"] ?? row["Open Date"] ?? "",
    exitDate: row["Close Time"] ?? row["Close Date"] ?? "",
    pnl: parseFloat(row["Profit"] ?? row["P&L"] ?? 0),
    commission: parseFloat(row["Commission"] ?? 0),
    swap: parseFloat(row["Swap"] ?? 0),
  };
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

  // Verify account ownership
  const account = await prisma.tradingAccount.findFirst({
    where: { id: accountId, userId: session.user.id },
  });
  if (!account)
    return NextResponse.json({ error: "Account not found" }, { status: 404 });

  const text = await file.text();

  const { data, errors } = Papa.parse(text, {
    header: true,
    skipEmptyLines: true,
    transformHeader: (h) => h.trim(),
  });

  if (errors.length > 0)
    return NextResponse.json({ error: "CSV parse error", errors }, { status: 400 });

  const created = [];
  const failed = [];

  for (const row of data as any[]) {
    try {
      const parsed = parseMT4Row(row);
      if (!parsed.symbol || !parsed.lotSize) continue;

      let rMultiple = null;
      let outcome = null;
      const status = parsed.exitDate ? "closed" : "open";

      if (parsed.exitPrice && parsed.stopLoss) {
        rMultiple = calculateRMultiple(
          parsed.direction,
          parsed.entryPrice,
          parsed.exitPrice,
          parsed.stopLoss
        );
        outcome = getOutcomeFromR(rMultiple);
      } else if (parsed.pnl !== null && parsed.pnl !== 0) {
        outcome = parsed.pnl > 0 ? "win" : "loss";
      }

      const trade = await prisma.trade.create({
        data: {
          accountId,
          symbol: parsed.symbol.toUpperCase(),
          direction: parsed.direction,
          entryPrice: parsed.entryPrice,
          exitPrice: parsed.exitPrice,
          stopLoss: parsed.stopLoss,
          takeProfit: parsed.takeProfit,
          lotSize: parsed.lotSize,
          entryDate: parsed.entryDate
            ? new Date(parsed.entryDate)
            : new Date(),
          exitDate: parsed.exitDate ? new Date(parsed.exitDate) : null,
          commission: parsed.commission,
          swap: parsed.swap,
          pnl: parsed.pnl,
          rMultiple,
          status,
          outcome,
        },
      });
      created.push(trade.id);
    } catch (e) {
      failed.push({ row, error: String(e) });
    }
  }

  // Update account balance
  if (created.length > 0) {
    const totalPnl = (data as any[]).reduce(
      (s, r) => s + parseFloat(r["Profit"] ?? r["P&L"] ?? 0),
      0
    );
    await prisma.tradingAccount.update({
      where: { id: accountId },
      data: { currentBalance: { increment: totalPnl } },
    });
  }

  return NextResponse.json({
    imported: created.length,
    failed: failed.length,
    errors: failed,
  });
}
