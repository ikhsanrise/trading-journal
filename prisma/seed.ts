// prisma/seed.ts
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("Seeding database...");

  const user = await prisma.user.upsert({
    where: { email: "trader@example.com" },
    update: {},
    create: {
      email: "trader@example.com",
      name: "Trader",
      password: "$2b$10$placeholder", // ganti dengan bcrypt hash
    },
  });

  const account = await prisma.tradingAccount.upsert({
    where: { id: "acc_default" },
    update: {},
    create: {
      id: "acc_default",
      userId: user.id,
      name: "IC Markets - Forex",
      broker: "IC Markets",
      currency: "USD",
      initialBalance: 10000,
      currentBalance: 11248,
      assetClass: "forex",
      isDefault: true,
    },
  });

  const setupBR = await prisma.setup.create({
    data: {
      userId: user.id,
      name: "Break & Retest",
      description: "Entry setelah breakout dan retest level S/R",
      timeframe: "H4",
      expectedRR: 2.5,
      tags: ["snr", "momentum"],
    },
  });

  const setupLO = await prisma.setup.create({
    data: {
      userId: user.id,
      name: "London Open",
      description: "Trade di awal sesi London, manfaatkan volatilitas tinggi",
      timeframe: "H1",
      expectedRR: 2.0,
      tags: ["session", "volatility"],
    },
  });

  const trades = [
    {
      accountId: account.id,
      symbol: "XAUUSD",
      direction: "long",
      entryPrice: 2318.5,
      exitPrice: 2334.8,
      stopLoss: 2306.0,
      takeProfit: 2350.0,
      lotSize: 0.5,
      entryDate: new Date("2025-06-25T07:30:00Z"),
      exitDate: new Date("2025-06-25T10:50:00Z"),
      commission: 3.2,
      pnl: 308.8,
      rMultiple: 2.1,
      status: "closed",
      outcome: "win",
      setupId: setupBR.id,
      session: "london",
      timeframe: "H4",
      notes: "Setup terlihat bersih di H4. Candle sebelumnya engulfing di area demand.",
      mood: 3,
      tags: ["confluence", "snr"],
    },
    {
      accountId: account.id,
      symbol: "EURUSD",
      direction: "short",
      entryPrice: 1.0784,
      exitPrice: 1.07743,
      stopLoss: 1.0795,
      takeProfit: 1.076,
      lotSize: 1.0,
      entryDate: new Date("2025-06-24T08:00:00Z"),
      exitDate: new Date("2025-06-24T09:45:00Z"),
      commission: 2.0,
      pnl: 143.0,
      rMultiple: 1.5,
      status: "closed",
      outcome: "win",
      setupId: setupLO.id,
      session: "london",
      timeframe: "H1",
      mood: 4,
      tags: ["london-open"],
    },
    {
      accountId: account.id,
      symbol: "USOIL",
      direction: "long",
      entryPrice: 81.45,
      exitPrice: 80.95,
      stopLoss: 80.95,
      takeProfit: 83.5,
      lotSize: 1.0,
      entryDate: new Date("2025-06-23T09:00:00Z"),
      exitDate: new Date("2025-06-23T15:10:00Z"),
      commission: 2.5,
      pnl: -102.5,
      rMultiple: -1.0,
      status: "closed",
      outcome: "loss",
      session: "london",
      timeframe: "H4",
      mood: 2,
      tags: ["support-flip"],
    },
    {
      accountId: account.id,
      symbol: "GBPUSD",
      direction: "long",
      entryPrice: 1.2645,
      exitPrice: 1.2724,
      stopLoss: 1.262,
      takeProfit: 1.274,
      lotSize: 2.0,
      entryDate: new Date("2025-06-21T08:30:00Z"),
      exitDate: new Date("2025-06-21T14:00:00Z"),
      commission: 4.0,
      pnl: 476.0,
      rMultiple: 3.2,
      status: "closed",
      outcome: "win",
      setupId: setupBR.id,
      session: "london",
      timeframe: "H4",
      mood: 5,
      tags: ["confluence", "strong-trend"],
    },
    {
      accountId: account.id,
      symbol: "XAUUSD",
      direction: "short",
      entryPrice: 2342.1,
      exitPrice: 2352.1,
      stopLoss: 2352.0,
      takeProfit: 2322.0,
      lotSize: 0.5,
      entryDate: new Date("2025-06-20T14:00:00Z"),
      exitDate: new Date("2025-06-20T16:05:00Z"),
      commission: 3.2,
      pnl: -103.2,
      rMultiple: -1.0,
      status: "closed",
      outcome: "loss",
      session: "newyork",
      timeframe: "H1",
      mood: 2,
      tags: ["reversal"],
    },
    {
      accountId: account.id,
      symbol: "USDJPY",
      direction: "short",
      entryPrice: 157.82,
      exitPrice: 157.33,
      stopLoss: 158.2,
      takeProfit: 157.1,
      lotSize: 1.0,
      entryDate: new Date("2025-06-19T08:00:00Z"),
      exitDate: new Date("2025-06-19T12:00:00Z"),
      commission: 2.0,
      pnl: 154.0,
      rMultiple: 1.8,
      status: "closed",
      outcome: "win",
      session: "london",
      timeframe: "H1",
      mood: 4,
      tags: ["trendline"],
    },
    {
      accountId: account.id,
      symbol: "XAGUSD",
      direction: "long",
      entryPrice: 29.34,
      exitPrice: 29.34,
      stopLoss: 29.1,
      takeProfit: 29.7,
      lotSize: 1.0,
      entryDate: new Date("2025-06-18T09:00:00Z"),
      exitDate: new Date("2025-06-18T09:45:00Z"),
      commission: 2.0,
      pnl: -2.0,
      rMultiple: 0,
      status: "closed",
      outcome: "breakeven",
      setupId: setupBR.id,
      session: "london",
      timeframe: "H4",
      mood: 3,
      tags: ["snr"],
    },
  ];

  for (const trade of trades) {
    await prisma.trade.create({ data: trade });
  }

  console.log("Seed selesai!");
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
