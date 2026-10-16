// src/types/index.ts
import { Trade, TradingAccount, Setup } from "@prisma/client";

export type TradeWithRelations = Trade & {
  account: TradingAccount;
  setup: Setup | null;
};

export type TradeFormData = {
  symbol: string;
  direction: "long" | "short";
  entryPrice: number;
  exitPrice?: number;
  stopLoss?: number;
  takeProfit?: number;
  lotSize: number;
  entryDate: string;
  entryTime: string;
  exitDate?: string;
  exitTime?: string;
  commission?: number;
  swap?: number;
  setupId?: string;
  session?: string;
  timeframe?: string;
  notes?: string;
  mood?: number;
  tags?: string[];
};

export type DashboardStats = {
  totalTrades: number;
  closedTrades: number;
  netPnL: number;
  winRate: number;
  avgR: number | null;
  profitFactor: number;
  currentBalance: number;
  initialBalance: number;
  bestTrade: TradeWithRelations | null;
  worstTrade: TradeWithRelations | null;
};

export type EquityPoint = {
  date: string;
  balance: number;
  pnl: number;
};

export type CalendarDay = {
  date: string;
  pnl: number;
  tradeCount: number;
};

export type TradeFilters = {
  search?: string;
  outcome?: "win" | "loss" | "breakeven" | "open" | "";
  direction?: "long" | "short" | "";
  symbol?: string;
  session?: string;
  setupId?: string;
  dateFrom?: string;
  dateTo?: string;
  page?: number;
  pageSize?: number;
};

export type Session = "london" | "newyork" | "asia" | "sydney";
export type Timeframe = "M1" | "M5" | "M15" | "M30" | "H1" | "H4" | "D1" | "W1";
export type AssetClass = "forex" | "commodity" | "stock" | "crypto";
