"use client";
import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import { Info } from "lucide-react";
import { cn } from "@/lib/utils";

const GREEN = "#4ade80";
const RED = "#f87171";
const BLUE = "#60a5fa";

/* Batas skala Trade Score (skor 100 / 0 tercapai di nilai ini) — ubah sesuai selera */
const SCORE_CFG = {
  winRateFull: 60,      // win rate (%) yang dianggap skor 100
  profitFactorFull: 3,  // profit factor yang dianggap skor 100
  avgWinLossFull: 3,    // rasio avg win / avg loss yang dianggap skor 100
  recoveryFull: 3,      // net profit / max drawdown yang dianggap skor 100
  drawdownZeroAt: 50,   // max drawdown (% dari total deposit) yang dianggap skor 0
  consistencyFull: 60,  // % hari profit yang dianggap skor 100
};

function useCountUp(target: number, ms = 900) {
  const [v, setV] = useState(0);
  useEffect(() => {
    let raf = 0;
    const t0 = performance.now();
    const tick = (t: number) => {
      const p = Math.min(1, (t - t0) / ms);
      setV(target * (1 - Math.pow(1 - p, 3)));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, ms]);
  return v;
}

function compact(v: number, cur: string) {
  const sym = cur === "IDR" ? "Rp" : "$";
  const a = Math.abs(v);
  const s = v < 0 ? "-" : "";
  if (a >= 1e9) return `${s}${sym}${(a / 1e9).toFixed(1)}B`;
  if (a >= 1e6) return `${s}${sym}${(a / 1e6).toFixed(1)}M`;
  if (a >= 1e3) return `${s}${sym}${(a / 1e3).toFixed(0)}K`;
  return `${s}${sym}${a.toFixed(0)}`;
}

function plural(n: number, unit: string) {
  return `${n} ${unit}${n === 1 ? "" : "s"}`;
}

function Card({ title, info, children, className }: { title: string; info: string; children: ReactNode; className?: string }) {
  return (
    <div className={cn("rounded-2xl border bg-card p-4 card-hover flex flex-col justify-between min-h-[128px]", className)}>
      <div className="flex items-center gap-1.5">
        <p className="text-xs text-muted-foreground">{title}</p>
        <span title={info} className="cursor-help text-muted-foreground/60 hover:text-foreground transition-colors">
          <Info className="w-3 h-3" />
        </span>
      </div>
      {children}
    </div>
  );
}

function Pill({ color, children }: { color: string; children: ReactNode }) {
  return (
    <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold" style={{ background: `${color}26`, color }}>
      {children}
    </span>
  );
}

/* busur setengah lingkaran: f = 0 (kiri) → 1 (kanan) */
function arc(cx: number, cy: number, r: number, f0: number, f1: number) {
  const p = (f: number) => {
    const a = Math.PI * (1 - f);
    return [cx + r * Math.cos(a), cy - r * Math.sin(a)];
  };
  const [x0, y0] = p(f0);
  const [x1, y1] = p(f1);
  return `M ${x0.toFixed(2)} ${y0.toFixed(2)} A ${r} ${r} 0 0 1 ${x1.toFixed(2)} ${y1.toFixed(2)}`;
}

/* ── 1. Trade win % ── */
function WinCard({ stats }: { stats: any }) {
  const closed = stats?.closedTrades ?? 0;
  const winRate = stats?.winRate ?? 0;
  const win = stats?.winCount ?? Math.round((winRate / 100) * closed);
  const be = stats?.beCount ?? 0;
  const loss = stats?.lossCount ?? Math.max(0, closed - win - be);
  const total = win + be + loss;
  const shown = useCountUp(winRate);

  const segs = [
    { n: win, color: GREEN },
    { n: be, color: BLUE },
    { n: loss, color: RED },
  ].filter((s) => s.n > 0);
  const gap = segs.length > 1 ? 0.025 : 0;
  let acc = 0;
  const paths = segs.map((s) => {
    const f0 = acc;
    const f1 = acc + s.n / total;
    acc = f1;
    return { d: arc(60, 60, 46, f0 + gap / 2, f1 - gap / 2), color: s.color };
  });

  return (
    <Card title="Trade win %" info="Persentase trade yang berakhir profit. Busur: hijau = win, biru = breakeven, merah = loss.">
      <div className="flex items-end justify-between gap-3 mt-2">
        <p className="text-3xl font-bold tracking-tight">{stats ? `${shown.toFixed(2)}%` : "—"}</p>
        <div className="flex flex-col items-center">
          <svg viewBox="0 0 120 66" className="w-32 h-[70px]">
            <path d={arc(60, 60, 46, 0, 1)} fill="none" stroke="rgba(255,255,255,0.07)" strokeWidth={9} />
            {paths.map((p, i) => (
              <path key={i} d={p.d} fill="none" stroke={p.color} strokeWidth={9} pathLength={1} className="gauge-seg" style={{ animationDelay: `${0.15 + i * 0.12}s` }} />
            ))}
          </svg>
          <div className="flex gap-1.5 -mt-1">
            <Pill color={GREEN}>{win}</Pill>
            <Pill color={BLUE}>{be}</Pill>
            <Pill color={RED}>{loss}</Pill>
          </div>
        </div>
      </div>
    </Card>
  );
}

/* ── 2. Avg win/loss ── */
function AvgCard({ stats, cur }: { stats: any; cur: string }) {
  const avgWin = stats?.avgWin ?? 0;
  const avgLoss = stats?.avgLoss ?? 0; // negatif
  const ratio = avgLoss !== 0 ? avgWin / Math.abs(avgLoss) : 0;
  const sum = avgWin + Math.abs(avgLoss);
  const greenPct = sum > 0 ? (avgWin / sum) * 100 : 50;
  const shown = useCountUp(ratio);
  const has = stats?.avgWin != null && stats?.avgLoss != null;

  return (
    <Card title="Avg win/loss trade" info="Rata-rata profit trade menang dibanding rata-rata kerugian trade kalah. Di atas 1 berarti win rata-rata lebih besar dari loss rata-rata.">
      <div className="flex items-end justify-between gap-4 mt-2">
        <p className="text-3xl font-bold tracking-tight">{has ? shown.toFixed(2) : "—"}</p>
        <div className="flex-1 min-w-[96px] max-w-[190px] pb-1">
          <div className="h-2 rounded-full overflow-hidden flex bar-grow">
            <div style={{ width: `${greenPct}%`, background: GREEN }} />
            <div style={{ width: `${100 - greenPct}%`, background: RED }} />
          </div>
          <div className="flex justify-between mt-1.5 text-[10px] font-semibold">
            <span style={{ color: GREEN }}>{compact(avgWin, cur)}</span>
            <span style={{ color: RED }}>{compact(avgLoss, cur)}</span>
          </div>
        </div>
      </div>
    </Card>
  );
}

/* ── 3. Profit factor ── */
function PFCard({ stats }: { stats: any }) {
  const pf = stats?.profitFactor ?? 0;
  const has = (stats?.closedTrades ?? 0) > 0;
  const inf = pf >= 999;
  const gf = !has ? 0 : inf ? 1 : pf / (1 + pf);
  const rf = has ? 1 - gf : 0;
  const gap = gf > 0 && rf > 0 ? 0.02 : 0;
  const shown = useCountUp(inf ? 0 : pf);

  return (
    <Card title="Profit factor" info="Total profit kotor dibagi total loss kotor. Di atas 1 berarti profit lebih besar dari loss. Cincin hijau = porsi profit, merah = porsi loss.">
      <div className="flex items-end justify-between gap-3 mt-2">
        <p className="text-3xl font-bold tracking-tight">{!has ? "—" : inf ? "∞" : shown.toFixed(2)}</p>
        <svg viewBox="0 0 72 72" className="w-[72px] h-[72px] ring-in">
          <circle cx={36} cy={36} r={28} fill="none" stroke="rgba(255,255,255,0.07)" strokeWidth={8} />
          {gf > 0 && (
            <circle cx={36} cy={36} r={28} fill="none" stroke={GREEN} strokeWidth={8} pathLength={1}
              strokeDasharray={`${gf - gap} ${1 - (gf - gap)}`} transform="rotate(-90 36 36)" />
          )}
          {rf > 0 && (
            <circle cx={36} cy={36} r={28} fill="none" stroke={RED} strokeWidth={8} pathLength={1}
              strokeDasharray={`${rf - gap} ${1 - (rf - gap)}`} strokeDashoffset={-gf} transform="rotate(-90 36 36)" />
          )}
        </svg>
      </div>
    </Card>
  );
}

/* ── 4. Current streak ── */
function dayStreak(calendar: any[]) {
  const days = [...(calendar ?? [])].filter((d) => d.pnl !== 0).sort((a, b) => a.date.localeCompare(b.date));
  let w = 0, l = 0, maxWin = 0, maxLoss = 0;
  for (const d of days) {
    if (d.pnl > 0) { w++; l = 0; maxWin = Math.max(maxWin, w); }
    else { l++; w = 0; maxLoss = Math.max(maxLoss, l); }
  }
  const last = days[days.length - 1];
  const type = !last ? "none" : last.pnl > 0 ? "win" : "loss";
  return { cur: type === "win" ? w : type === "loss" ? l : 0, type, maxWin, maxLoss };
}

function StreakCol({ heading, cur, type, maxWin, maxLoss, unit }: { heading: string; cur: number; type: string; maxWin: number; maxLoss: number; unit: string }) {
  const color = type === "win" ? GREEN : type === "loss" ? RED : "rgba(255,255,255,0.25)";
  return (
    <div>
      <p className="text-[10px] font-bold tracking-wider mb-1.5">{heading}</p>
      <div className="flex items-center gap-2.5">
        <div className="w-12 h-12 rounded-full border-[3px] flex items-center justify-center text-lg font-bold shrink-0" style={{ borderColor: color, color }}>
          {cur}
        </div>
        <div className="flex flex-col gap-1">
          <Pill color={RED}>{plural(maxLoss, unit)}</Pill>
          <Pill color={GREEN}>{plural(maxWin, unit)}</Pill>
        </div>
      </div>
    </div>
  );
}

function StreakCard({ stats, calendar }: { stats: any; calendar: any[] }) {
  const d = dayStreak(calendar);
  const t = stats?.streak;
  return (
    <Card title="Current streak" info="Lingkaran = streak saat ini (hijau = menang, merah = kalah). Badge merah = streak kalah terpanjang, hijau = streak menang terpanjang.">
      <div className="grid grid-cols-2 gap-3 mt-2">
        <StreakCol heading="DAYS" cur={d.cur} type={d.type} maxWin={d.maxWin} maxLoss={d.maxLoss} unit="day" />
        <StreakCol heading="TRADES" cur={t?.current ?? 0} type={t?.type ?? "none"} maxWin={t?.maxWin ?? 0} maxLoss={t?.maxLoss ?? 0} unit="trade" />
      </div>
    </Card>
  );
}

export function KpiRow({ stats, calendar, currency }: { stats: any; calendar: any[]; currency: string }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3 stagger">
      <WinCard stats={stats} />
      <AvgCard stats={stats} cur={currency} />
      <PFCard stats={stats} />
      <StreakCard stats={stats} calendar={calendar} />
    </div>
  );
}

/* ── Trade Score (radar) ── */
const AXES = ["Win %", "Profit factor", "Avg win/loss", "Recovery factor", "Max drawdown", "Consistency"];

function polar(cx: number, cy: number, r: number, i: number) {
  const a = ((-90 + 60 * i) * Math.PI) / 180;
  return [cx + r * Math.cos(a), cy + r * Math.sin(a)];
}

const clamp = (v: number) => Math.max(0, Math.min(100, v));

export function TradeScoreCard({ stats, calendar, account }: { stats: any; calendar: any[]; account?: any }) {
  const days = [...(calendar ?? [])].sort((a, b) => a.date.localeCompare(b.date));
  let cum = 0, peak = 0, maxDD = 0;
  for (const d of days) {
    cum += d.pnl;
    peak = Math.max(peak, cum);
    maxDD = Math.max(maxDD, peak - cum);
  }
  const base = (account?.totalDeposit ?? 0) > 0 ? account.totalDeposit : (account?.initialBalance ?? 0) > 0 ? account.initialBalance : peak;
  const ddPct = base > 0 ? (maxDD / base) * 100 : 0;
  const netPnL = stats?.netPnL ?? 0;
  const recovery = maxDD > 0 ? netPnL / maxDD : netPnL > 0 ? SCORE_CFG.recoveryFull : 0;
  const traded = days.filter((d) => d.pnl !== 0);
  const profitDayPct = traded.length ? (traded.filter((d) => d.pnl > 0).length / traded.length) * 100 : 0;
  const avgWin = stats?.avgWin ?? 0;
  const avgLoss = Math.abs(stats?.avgLoss ?? 0);
  const ratio = avgLoss > 0 ? avgWin / avgLoss : avgWin > 0 ? SCORE_CFG.avgWinLossFull : 0;
  const pf = Math.min(stats?.profitFactor ?? 0, 99);

  const scores = [
    clamp(((stats?.winRate ?? 0) / SCORE_CFG.winRateFull) * 100),
    clamp((pf / SCORE_CFG.profitFactorFull) * 100),
    clamp((ratio / SCORE_CFG.avgWinLossFull) * 100),
    clamp((recovery / SCORE_CFG.recoveryFull) * 100),
    clamp(100 - (ddPct / SCORE_CFG.drawdownZeroAt) * 100),
    clamp((profitDayPct / SCORE_CFG.consistencyFull) * 100),
  ];
  const total = scores.reduce((s, v) => s + v, 0) / scores.length;
  const shown = useCountUp(total, 1100);

  const CX = 170, CY = 122, R = 80;
  const ring = (k: number) => AXES.map((_, i) => polar(CX, CY, R * k, i).map((n) => n.toFixed(1)).join(",")).join(" ");
  const dataPts = scores.map((s, i) => polar(CX, CY, R * (s / 100), i));
  const anchors = ["middle", "start", "start", "middle", "end", "end"] as const;

  return (
    <div className="rounded-2xl border bg-card p-4 card-hover flex flex-col">
      <div className="flex items-center gap-1.5 mb-1">
        <p className="text-xs font-semibold">Trade Score</p>
        <span
          title="Skor 0-100 dari rata-rata 6 metrik: win %, profit factor, avg win/loss, recovery factor, max drawdown (terhadap total deposit), dan konsistensi (% hari profit). Batas skala bisa diubah di SCORE_CFG."
          className="cursor-help text-muted-foreground/60 hover:text-foreground transition-colors"
        >
          <Info className="w-3 h-3" />
        </span>
      </div>

      <svg viewBox="0 0 340 250" className="w-full flex-1 min-h-[210px]">
        {[0.2, 0.4, 0.6, 0.8, 1].map((k) => (
          <polygon key={k} points={ring(k)} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth={1} />
        ))}
        {AXES.map((_, i) => {
          const [x, y] = polar(CX, CY, R, i);
          return <line key={i} x1={CX} y1={CY} x2={x} y2={y} stroke="rgba(255,255,255,0.06)" strokeWidth={1} />;
        })}
        <g className="radar-poly" style={{ transformOrigin: `${CX}px ${CY}px` }}>
          <polygon points={dataPts.map((p) => p.map((n) => n.toFixed(1)).join(",")).join(" ")} fill="rgba(99,102,241,0.35)" stroke="#818cf8" strokeWidth={1.5} strokeLinejoin="round" />
          {dataPts.map(([x, y], i) => (
            <circle key={i} cx={x} cy={y} r={3.5} fill="#1e1b4b" stroke="#a5b4fc" strokeWidth={1.5}>
              <title>{`${AXES[i]}: ${scores[i].toFixed(0)}/100`}</title>
            </circle>
          ))}
        </g>
        {AXES.map((label, i) => {
          const [x, y] = polar(CX, CY, R + 14, i);
          const dy = i === 0 ? -2 : i === 3 ? 9 : 3;
          return (
            <text key={label} x={x} y={y + dy} textAnchor={anchors[i]} fontSize={10.5} style={{ fill: "hsl(var(--muted-foreground))" }}>
              {label}
            </text>
          );
        })}
      </svg>

      <div className="border-t mt-2 pt-3 flex items-center gap-4">
        <div className="shrink-0">
          <p className="text-[10px] text-muted-foreground">Your Trade Score</p>
          <p className="text-2xl font-bold tracking-tight">{stats ? shown.toFixed(2) : "—"}</p>
        </div>
        <div className="flex-1">
          <div className="relative h-2 rounded-full" style={{ background: "linear-gradient(90deg,#f87171,#facc15,#4ade80)" }}>
            <div className="score-marker absolute top-1/2 w-3.5 h-3.5 rounded-full border-2 border-white/90 bg-card shadow" style={{ left: `${total}%`, transform: "translate(-50%,-50%)" }} />
          </div>
          <div className="flex justify-between mt-1.5 text-[9px] text-muted-foreground">
            {[0, 20, 40, 60, 80, 100].map((n) => <span key={n}>{n}</span>)}
          </div>
        </div>
      </div>
    </div>
  );
}
