import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/auth";
import { prisma } from "@/lib/prisma";
import { calcWinRate, calcProfitFactor, calcAvgR, formatCurrency, formatR } from "@/lib/utils";
import { format } from "date-fns";

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const user = await prisma.user.findUnique({ where: { email: session.user.email } });
  if (!user) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const { searchParams } = new URL(req.url);
  const type = searchParams.get("type") ?? "csv"; // csv | json
  const accountId = searchParams.get("accountId");

  const accounts = await prisma.tradingAccount.findMany({ where: { userId: user.id } });
  const targetAccount = accountId
    ? accounts.find((a) => a.id === accountId)
    : accounts.find((a) => a.isDefault) ?? accounts[0];

  if (!targetAccount) return NextResponse.json({ error: "No account" }, { status: 404 });

  const trades = await prisma.trade.findMany({
    where: { accountId: targetAccount.id },
    include: { setup: true },
    orderBy: { entryDate: "desc" },
  });

  if (type === "json") {
    return NextResponse.json(trades, {
      headers: { "Content-Disposition": `attachment; filename="trades-${format(new Date(), "yyyy-MM-dd")}.json"` },
    });
  }

  // CSV export
  const headers = [
    "Date", "Symbol", "Direction", "Entry Price", "Exit Price",
    "Stop Loss", "Take Profit", "Lot Size", "Entry Date", "Exit Date",
    "Hold (min)", "Commission", "Swap", "P&L", "R-Multiple",
    "Setup", "Setup Category", "Session", "Timeframe",
    "Outcome", "Mood", "Tags", "Notes",
  ];

  const rows = trades.map((t) => {
    const holdMin = t.exitDate && t.entryDate
      ? Math.round((new Date(t.exitDate).getTime() - new Date(t.entryDate).getTime()) / 60000)
      : "";
    return [
      format(t.entryDate, "yyyy-MM-dd"),
      t.symbol,
      t.direction,
      t.entryPrice,
      t.exitPrice ?? "",
      t.stopLoss ?? "",
      t.takeProfit ?? "",
      t.lotSize,
      format(t.entryDate, "yyyy-MM-dd HH:mm"),
      t.exitDate ? format(t.exitDate, "yyyy-MM-dd HH:mm") : "",
      holdMin,
      t.commission,
      t.swap,
      t.pnl ?? "",
      t.rMultiple ?? "",
      t.setup?.name ?? "",
      (t as any).setupCategory ?? "",
      t.session ?? "",
      t.timeframe ?? "",
      t.outcome ?? "",
      t.mood ?? "",
      (t.tags ?? []).join("; "),
      (t.notes ?? "").replace(/\n/g, " "),
    ];
  });

  const csv = [headers, ...rows]
    .map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(","))
    .join("\n");

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv",
      "Content-Disposition": `attachment; filename="trades-${format(new Date(), "yyyy-MM-dd")}.csv"`,
    },
  });
}
