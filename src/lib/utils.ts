// src/lib/utils.ts
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import { format, parseISO } from "date-fns";
import { id } from "date-fns/locale";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatCurrency(
  value: number,
  currency = "USD",
  showSign = true
): string {
  const abs = Math.abs(value);
  const noDecimals = ["IDR", "JPY"];
  const formatted = new Intl.NumberFormat(currency === "IDR" ? "id-ID" : "en-US", {
    style: "currency",
    currency,
    minimumFractionDigits: noDecimals.includes(currency) ? 0 : 2,
    maximumFractionDigits: noDecimals.includes(currency) ? 0 : 2,
  }).format(abs);

  if (showSign && value > 0) return `+${formatted}`;
  if (value < 0) return `-${formatted}`;
  return formatted;
}

export function formatR(value: number | null): string {
  if (value === null || value === undefined) return "—";
  if (value === 0) return "0R";
  const sign = value > 0 ? "+" : "";
  return `${sign}${value.toFixed(1)}R`;
}

export function formatPercent(value: number, decimals = 1): string {
  const sign = value > 0 ? "+" : "";
  return `${sign}${value.toFixed(decimals)}%`;
}

export function formatDate(date: Date | string, fmt = "dd MMM yy"): string {
  const d = typeof date === "string" ? parseISO(date) : date;
  return format(d, fmt, { locale: id });
}

export function formatDateTime(date: Date | string): string {
  const d = typeof date === "string" ? parseISO(date) : date;
  return format(d, "dd MMM yyyy HH:mm", { locale: id });
}

export function calculatePnL(
  direction: string,
  entryPrice: number,
  exitPrice: number,
  lotSize: number,
  symbol: string,
  commission = 0,
  swap = 0
): number {
  // Simplified PnL calc — for forex standard lot = 100,000 units
  // For commodities (XAUUSD, USOIL) adjust accordingly
  let pipValue = 1;

  if (symbol.includes("JPY")) {
    pipValue = lotSize * 1000; // JPY pairs
  } else if (symbol.includes("XAU")) {
    pipValue = lotSize * 100; // Gold: 1 lot = 100 oz
  } else if (symbol.includes("XAG")) {
    pipValue = lotSize * 5000; // Silver
  } else if (symbol.includes("OIL") || symbol.includes("WTI")) {
    pipValue = lotSize * 1000; // Oil
  } else {
    pipValue = lotSize * 100000; // Standard forex
  }

  const priceDiff =
    direction === "long" ? exitPrice - entryPrice : entryPrice - exitPrice;
  const grossPnl = priceDiff * pipValue;
  return grossPnl - commission - Math.abs(swap);
}

export function calculateRMultiple(
  direction: string,
  entryPrice: number,
  exitPrice: number,
  stopLoss: number
): number {
  if (!stopLoss) return 0;
  const risk = Math.abs(entryPrice - stopLoss);
  if (risk === 0) return 0;

  const result =
    direction === "long"
      ? (exitPrice - entryPrice) / risk
      : (entryPrice - exitPrice) / risk;

  return Math.round(result * 10) / 10;
}

export function getPnLColor(value: number): string {
  if (value > 0) return "text-profit-600";
  if (value < 0) return "text-loss-600";
  return "text-neutral-600";
}

export function getOutcomeFromR(rMultiple: number): "win" | "loss" | "breakeven" {
  if (rMultiple > 0.1) return "win";
  if (rMultiple < -0.1) return "loss";
  return "breakeven";
}

export function getDurationString(entryDate: Date, exitDate: Date): string {
  const diffMs = exitDate.getTime() - entryDate.getTime();
  const hours = Math.floor(diffMs / (1000 * 60 * 60));
  const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
  if (hours === 0) return `${minutes}m`;
  if (minutes === 0) return `${hours}h`;
  return `${hours}h ${minutes}m`;
}

// Stats calculations
export function calcWinRate(trades: { outcome: string | null }[]): number {
  const closed = trades.filter((t) => t.outcome !== null);
  if (closed.length === 0) return 0;
  const wins = closed.filter((t) => t.outcome === "win").length;
  return (wins / closed.length) * 100;
}

export function calcProfitFactor(
  trades: { pnl: number | null; outcome: string | null }[]
): number {
  const closed = trades.filter((t) => t.pnl !== null && t.outcome !== null);
  const grossWin = closed
    .filter((t) => (t.pnl ?? 0) > 0)
    .reduce((s, t) => s + (t.pnl ?? 0), 0);
  const grossLoss = Math.abs(
    closed
      .filter((t) => (t.pnl ?? 0) < 0)
      .reduce((s, t) => s + (t.pnl ?? 0), 0)
  );
  if (grossLoss === 0) return grossWin > 0 ? 999 : 0;
  return Math.round((grossWin / grossLoss) * 100) / 100;
}

export function calcAvgR(
  trades: { rMultiple: number | null }[]
): number | null {
  const withR = trades.filter((t) => t.rMultiple !== null);
  if (withR.length === 0) return null;
  const sum = withR.reduce((s, t) => s + (t.rMultiple ?? 0), 0);
  return Math.round((sum / withR.length) * 100) / 100;
}
