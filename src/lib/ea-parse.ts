// Parser CSV MetaTrader 5 untuk EA Tracker.
// Mendukung dua tata letak umum:
//  1. "Deals"     : Time, Deal, Symbol, Type, Direction, Volume, Price, Order, Commission, Fee, Swap, Profit, Balance, Comment
//                   (baris Type = balance = deposit/withdraw)
//  2. "Positions" : Time, Position, Symbol, Type, Volume, Price, S/L, T/P, Time, Price, Commission, Swap, Profit
//                   (tidak punya baris deposit/withdraw)
import Papa from "papaparse";

export type ParsedDeal = {
  ticket: string;
  kind: "in" | "out";
  time: Date;
  symbol: string | null;
  side: "buy" | "sell" | null;
  volume: number | null;
  profit: number;
};
export type ParsedFlow = {
  ticket: string;
  time: Date;
  type: "deposit" | "withdraw";
  amount: number;
  comment: string;
};
export type ParseResult = {
  format: "deals" | "positions" | "unknown";
  deals: ParsedDeal[];
  flows: ParsedFlow[];
  warnings: string[];
};

export function parseNum(v: unknown): number {
  if (v == null) return 0;
  let s = String(v).replace(/[\s ]/g, "");
  if (!s || s === "-") return 0;
  const hasComma = s.includes(",");
  const hasDot = s.includes(".");
  if (hasComma && hasDot) {
    if (s.lastIndexOf(",") > s.lastIndexOf(".")) s = s.replace(/\./g, "").replace(",", ".");
    else s = s.replace(/,/g, "");
  } else if (hasComma) {
    s = /,\d{1,2}$/.test(s) ? s.replace(",", ".") : s.replace(/,/g, "");
  }
  const n = parseFloat(s);
  return Number.isFinite(n) ? n : 0;
}

// Waktu MT5 dibaca apa adanya (waktu server broker) sebagai UTC, supaya pengelompokan harian tidak bergeser.
export function parseTime(v: unknown): Date | null {
  if (v == null) return null;
  const m = String(v).trim().match(/^(\d{4})[.\-/](\d{2})[.\-/](\d{2})[ T](\d{2}):(\d{2})(?::(\d{2}))?/);
  if (!m) return null;
  return new Date(Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5], m[6] ? +m[6] : 0));
}

const norm = (c: string) => c.toLowerCase().replace(/[\s_\-/]/g, "");

export function parseMt5Csv(textIn: string): ParseResult {
  const text = textIn.replace(/^﻿/, "");
  const warnings: string[] = [];
  const sample = text.split(/\r?\n/).filter((l) => l.trim()).slice(0, 25).join("\n");
  const counts: Record<string, number> = { ",": 0, ";": 0, "\t": 0 };
  for (const ch of sample) if (ch in counts) counts[ch]++;
  const delimiter = Object.entries(counts).sort((a, b) => b[1] - a[1])[0][0];

  const parsed = Papa.parse<string[]>(text, { delimiter, skipEmptyLines: true });
  const rows = parsed.data as string[][];

  let headerIdx = -1;
  for (let i = 0; i < Math.min(rows.length, 80); i++) {
    const cells = rows[i].map(norm);
    if (cells.includes("time") && cells.includes("profit") && (cells.includes("deal") || cells.includes("position") || cells.includes("ticket"))) {
      headerIdx = i;
      break;
    }
  }
  if (headerIdx < 0) return { format: "unknown", deals: [], flows: [], warnings: ["Baris header tidak ditemukan. Pastikan file berisi kolom Time, Deal/Position, dan Profit."] };

  const header = rows[headerIdx].map(norm);
  const all = (name: string) => header.reduce<number[]>((a, h, i) => (h === name ? [...a, i] : a), []);
  const one = (...names: string[]) => {
    for (const n of names) {
      const idx = header.indexOf(n);
      if (idx >= 0) return idx;
    }
    return -1;
  };

  const iDeal = one("deal", "ticket");
  const iPos = one("position");
  const format: "deals" | "positions" = iDeal >= 0 ? "deals" : "positions";
  const iSymbol = one("symbol");
  const iType = one("type");
  const iDir = one("direction");
  const iVol = one("volume", "size");
  const iComm = one("commission");
  const iFee = one("fee");
  const iSwap = one("swap");
  const iProfit = one("profit");
  const iComment = one("comment");
  const times = all("time");

  const deals: ParsedDeal[] = [];
  const flows: ParsedFlow[] = [];
  let skipped = 0;
  const ignoredTypes = new Set<string>();

  for (let r = headerIdx + 1; r < rows.length; r++) {
    const row = rows[r];
    const type = iType >= 0 ? String(row[iType] ?? "").trim().toLowerCase() : "";

    if (format === "deals") {
      const time = parseTime(row[times[0]]);
      const ticket = String(row[iDeal] ?? "").trim();
      if (!time || !ticket) { skipped++; continue; }
      const profit = parseNum(row[iProfit]);
      if (type === "balance") {
        if (profit === 0) continue;
        flows.push({ ticket, time, type: profit > 0 ? "deposit" : "withdraw", amount: Math.abs(profit), comment: iComment >= 0 ? String(row[iComment] ?? "") : "" });
        continue;
      }
      if (type !== "buy" && type !== "sell") { if (type) ignoredTypes.add(type); continue; }
      const dir = iDir >= 0 ? String(row[iDir] ?? "").trim().toLowerCase() : "out";
      const net = profit + (iComm >= 0 ? parseNum(row[iComm]) : 0) + (iFee >= 0 ? parseNum(row[iFee]) : 0) + (iSwap >= 0 ? parseNum(row[iSwap]) : 0);
      deals.push({
        ticket,
        kind: dir === "in" ? "in" : "out",
        time,
        symbol: iSymbol >= 0 ? String(row[iSymbol] ?? "").trim() || null : null,
        side: type as "buy" | "sell",
        volume: iVol >= 0 ? parseNum(row[iVol]) : null,
        profit: net,
      });
    } else {
      const closeTime = parseTime(row[times[times.length - 1]]);
      const ticket = String(row[iPos] ?? "").trim();
      if (!closeTime || !ticket) { skipped++; continue; }
      if (type !== "buy" && type !== "sell") { if (type) ignoredTypes.add(type); continue; }
      const net = parseNum(row[iProfit]) + (iComm >= 0 ? parseNum(row[iComm]) : 0) + (iFee >= 0 ? parseNum(row[iFee]) : 0) + (iSwap >= 0 ? parseNum(row[iSwap]) : 0);
      deals.push({
        ticket,
        kind: "out",
        time: closeTime,
        symbol: iSymbol >= 0 ? String(row[iSymbol] ?? "").trim().replace(/r$/, "") || null : null,
        side: type as "buy" | "sell",
        volume: iVol >= 0 ? parseNum(row[iVol]) : null,
        profit: net,
      });
    }
  }

  if (skipped > 0) warnings.push(`${skipped} baris dilewati karena waktu atau nomor tiketnya tidak terbaca (biasanya baris total di bagian bawah).`);
  if (ignoredTypes.size > 0) warnings.push(`Tipe baris diabaikan: ${Array.from(ignoredTypes).join(", ")}.`);
  if (format === "positions") warnings.push("File berisi daftar posisi, tanpa baris deposit dan withdraw. Gunakan ekspor Deals kalau ingin deposit dan withdraw ikut terbaca.");
  return { format, deals, flows, warnings };
}
