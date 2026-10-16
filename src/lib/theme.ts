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
