// Shared navy theme constants (extracted from the Trade Log page).
export const PANEL =
  "rounded-2xl border bg-card dark:border-[#27358a]/40 dark:bg-gradient-to-br dark:from-[#14204d]/55 dark:via-[#0c1330]/55 dark:to-[#0a1024]/70";
export const BTN_PRIMARY =
  "bg-gradient-to-b from-[#4f6bff] to-[#2f4bd8] text-white shadow-[0_8px_24px_-8px_rgba(79,107,255,0.8)] hover:brightness-110";
export const PILL_ON =
  "bg-[#4f6bff]/15 text-[#3b57e8] border-[#4f6bff]/40 dark:text-[#9db0ff]";
export const PILL_OFF =
  "text-muted-foreground border-transparent hover:bg-secondary hover:text-foreground";
export const PILL = "px-3 py-1 rounded-full text-xs font-medium border transition-colors";
export const LABEL = "text-[11px] font-medium uppercase tracking-wider text-muted-foreground";
export const WIN = "text-emerald-600 dark:text-[#4ade80]";
export const LOSS = "text-red-600 dark:text-[#f87171]";
export const pnlColor = (v: number) => (v > 0 ? WIN : v < 0 ? LOSS : "text-muted-foreground");

// Mockup-scale layout helpers
export const PAGE = "px-4 md:px-8 pt-6 md:pt-7 pb-10 flex flex-col gap-4";
export const H1 = "text-[30px] leading-tight font-extrabold tracking-[-0.02em]";
export const SUB = "mt-1.5 text-[13px] text-muted-foreground dark:text-[#8a94c4]";
export const H2 = "text-base font-bold tracking-[-0.01em]";
export const CAP = "text-xs text-muted-foreground dark:text-[#8a94c4]";
export const KPI = "text-[34px] font-extrabold tracking-[-0.025em] tabular-nums leading-[1.05]";
export const CHIP = "inline-flex items-center justify-center min-w-[34px] h-[22px] px-[9px] rounded-full text-[11px] font-bold border";
export const CHIP_G = "bg-emerald-400/15 text-emerald-300 border-emerald-400/30";
export const CHIP_R = "bg-red-400/15 text-red-300 border-red-400/30";
export const CHIP_B = "bg-[#4f6bff]/20 text-[#a5b4ff] border-[#7a8cff]/40";
export const TABS = "flex gap-0.5 p-[3px] rounded-[10px] bg-secondary dark:bg-white/5";
export const TAB = "h-7 px-3 rounded-lg text-xs font-semibold text-muted-foreground dark:text-[#8a94c4] transition-colors";
export const TAB_ON = "bg-card text-foreground dark:bg-[#4f6bff]/25 dark:text-[#d6dcff]";
export const BTN = "inline-flex items-center gap-2 h-10 px-4 rounded-xl text-[13px] font-semibold";
