// Perhitungan murni untuk EA Tracker (dipakai di browser). Semua nilai dalam USD.
export type DayRow = { d: string; p: number; n: number; w: number; gw: number; gl: number };
export type FlowRow = { d: string; type: "deposit" | "withdraw"; amount: number; accountId: string };
export type Pt = { d: string; p: number; cum: number; dd: number; pct: number };
export type Series = {
  out: Pt[];
  byDate: Record<string, Pt>;
  net: number;
  minDD: number;
  minPct: number;
  minDate: string;
  avg: number;
  best: Pt | null;
  worst: Pt | null;
  trades: number;
  wins: number;
  gw: number;
  gl: number;
  noBase: boolean;
};

export function mergeDays(lists: DayRow[][]): DayRow[] {
  const m = new Map<string, DayRow>();
  for (const list of lists) {
    for (const r of list) {
      const e = m.get(r.d);
      if (e) { e.p += r.p; e.n += r.n; e.w += r.w; e.gw += r.gw; e.gl += r.gl; }
      else m.set(r.d, { ...r });
    }
  }
  return Array.from(m.values()).sort((a, b) => (a.d < b.d ? -1 : 1));
}

/**
 * Kurva P&L kumulatif dari hari trading. Drawdown dihitung dari puncak kumulatif, dalam % terhadap
 * modal bersih saat itu (deposit - withdraw sampai tanggal itu) ditambah puncak profit.
 * Deposit dan withdraw tidak masuk kurva, hanya dasar persentase.
 */
export function buildSeries(days: DayRow[], flows: FlowRow[]): Series {
  const sortedDays = [...days].sort((a, b) => (a.d < b.d ? -1 : 1));
  const sortedFlows = [...flows].sort((a, b) => (a.d < b.d ? -1 : 1));
  let fi = 0;
  let base = 0;
  let cum = 0, peak = 0, minDD = 0, minPct = 0, minDate = "", sumPct = 0;
  let trades = 0, wins = 0, gw = 0, gl = 0;
  let sawBase = false;
  const out: Pt[] = [];
  const byDate: Record<string, Pt> = {};
  for (const x of sortedDays) {
    while (fi < sortedFlows.length && sortedFlows[fi].d <= x.d) {
      base += sortedFlows[fi].type === "deposit" ? sortedFlows[fi].amount : -sortedFlows[fi].amount;
      fi++;
    }
    if (base > 0) sawBase = true;
    cum += x.p;
    if (cum > peak) peak = cum;
    const dd = cum - peak;
    const denom = base + peak;
    const pct = base > 0 && denom > 0 ? dd / denom : 0;
    if (dd < minDD) minDD = dd;
    if (pct < minPct) { minPct = pct; minDate = x.d; }
    sumPct += pct;
    trades += x.n; wins += x.w; gw += x.gw; gl += x.gl;
    const pt: Pt = { d: x.d, p: x.p, cum, dd, pct };
    out.push(pt);
    byDate[x.d] = pt;
  }
  let best: Pt | null = out[0] ?? null;
  let worst: Pt | null = out[0] ?? null;
  for (const o of out) {
    if (best && o.p > best.p) best = o;
    if (worst && o.p < worst.p) worst = o;
  }
  return {
    out, byDate, net: cum, minDD, minPct, minDate,
    avg: out.length ? sumPct / out.length : 0,
    best, worst, trades, wins, gw, gl,
    noBase: !sawBase,
  };
}

export const sumRange = (s: Series, from: string, to: string) =>
  s.out.filter((o) => o.d >= from && o.d <= to).reduce((a, o) => a + o.p, 0);

// ── tanggal (semua dalam UTC, format yyyy-MM-dd) ─────────────────────────────
export const toDate = (d: string) => new Date(d + "T00:00:00Z");
export const fmtDate = (t: Date) => t.toISOString().slice(0, 10);
export const addDays = (d: string, n: number) => fmtDate(new Date(toDate(d).getTime() + n * 86400000));
export const mondayOf = (d: string) => { const w = toDate(d).getUTCDay(); return addDays(d, -((w + 6) % 7)); };
export const daysInMonth = (y: number, m0: number) => new Date(Date.UTC(y, m0 + 1, 0)).getUTCDate();

export const HARI = ["Min", "Sen", "Sel", "Rab", "Kam", "Jum", "Sab"];
export const HARI_PANJANG = ["Minggu", "Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"];
export const BULAN = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"];
export const BULAN_PANJANG = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"];
export const dayLabel = (d: string) => { const t = toDate(d); return `${HARI[t.getUTCDay()]}, ${t.getUTCDate()} ${BULAN[t.getUTCMonth()]}`; };
export const dayLabelLong = (d: string) => { const t = toDate(d); return `${HARI_PANJANG[t.getUTCDay()]}, ${t.getUTCDate()} ${BULAN[t.getUTCMonth()]} ${t.getUTCFullYear()}`; };
export const dayShort = (d: string) => { const t = toDate(d); return `${t.getUTCDate()} ${BULAN[t.getUTCMonth()]}`; };
