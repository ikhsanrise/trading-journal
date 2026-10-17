"use client";
import { ReactNode } from "react";
import { cn } from "@/lib/utils";

export type TipRow = { label: string; value: string; tone?: "win" | "loss" | "muted" };

/**
 * CSS-only hover/focus detail popover. Wrap any element:
 *   <HoverTip title="Asia" rows={[{label:"Win rate", value:"12%"}]}>...</HoverTip>
 * Position defaults to above; pass side="bottom" near the top of the viewport.
 */
export function HoverTip({
  title, rows, note, children, side = "top", align = "center", className, block = false,
}: {
  title?: string; rows?: TipRow[]; note?: string; children: ReactNode;
  side?: "top" | "bottom"; align?: "center" | "left" | "right"; className?: string; block?: boolean;
}) {
  const tone = (t?: TipRow["tone"]) =>
    t === "win" ? "text-[#4ade80]" : t === "loss" ? "text-[#f87171]" : t === "muted" ? "text-[#8a94c4]" : "text-[#e8ecff]";
  return (
    <div className={cn("group/tip relative", block ? "block" : "inline-block", "hover:z-40 focus-within:z-40", className)} tabIndex={0}>
      {children}
      <div
        role="tooltip"
        className={cn(
          "pointer-events-none absolute z-50 w-max min-w-[160px] max-w-[260px] rounded-xl border border-[#7a8cff]/25 bg-[#0c1330] px-3.5 py-3 text-left shadow-[0_18px_40px_-12px_rgba(0,0,0,0.7)]",
          "invisible opacity-0 scale-95 transition-[opacity,transform,visibility] duration-200 ease-out group-hover/tip:visible group-hover/tip:opacity-100 group-hover/tip:scale-100 group-focus-within/tip:visible group-focus-within/tip:opacity-100 group-focus-within/tip:scale-100",
          side === "top" ? "bottom-full mb-2 origin-bottom" : "top-full mt-2 origin-top",
          align === "center" ? "left-1/2 -translate-x-1/2" : align === "left" ? "left-0" : "right-0",
        )}
      >
        {title && <p className="text-xs font-bold text-white mb-1.5">{title}</p>}
        {rows && (
          <div className="flex flex-col gap-1">
            {rows.map((r) => (
              <div key={r.label} className="flex items-center justify-between gap-4 text-[11.5px]">
                <span className="text-[#8a94c4]">{r.label}</span>
                <b className={cn("font-mono tabular-nums font-semibold", tone(r.tone))}>{r.value}</b>
              </div>
            ))}
          </div>
        )}
        {note && <p className="mt-1.5 text-[11px] leading-snug text-[#8a94c4]">{note}</p>}
      </div>
    </div>
  );
}
