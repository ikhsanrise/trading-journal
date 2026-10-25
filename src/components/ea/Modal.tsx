"use client";
import { ReactNode, useEffect } from "react";
import { X } from "lucide-react";

export function Modal({ title, subtitle, onClose, children, wide }: { title: string; subtitle?: string; onClose: () => void; children: ReactNode; wide?: boolean }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { window.removeEventListener("keydown", onKey); document.body.style.overflow = prev; };
  }, [onClose]);
  return (
    <div className="fixed inset-0 z-[100] flex items-start md:items-center justify-center overflow-y-auto bg-black/60 p-3 md:p-8" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div role="dialog" aria-modal="true" aria-label={title}
        className={`w-full ${wide ? "max-w-[860px]" : "max-w-[520px]"} my-auto rounded-[22px] border bg-card p-5 md:p-7 shadow-[0_40px_80px_-30px_rgba(0,0,0,0.8)] dark:border-[#27358a]/70 dark:bg-gradient-to-br dark:from-[#14204d] dark:via-[#0c1330] dark:to-[#0a1024] anim-pop`}>
        <div className="flex items-start justify-between gap-4 mb-5">
          <div>
            <h2 className="text-[22px] font-extrabold tracking-[-0.01em]">{title}</h2>
            {subtitle && <p className="mt-1.5 text-[13.5px] leading-relaxed text-muted-foreground dark:text-[#8a94c4]">{subtitle}</p>}
          </div>
          <button type="button" onClick={onClose} aria-label="Tutup" className="shrink-0 w-10 h-10 rounded-xl border border-border dark:border-[#7a8cff]/25 bg-secondary/50 dark:bg-white/5 text-muted-foreground hover:text-foreground flex items-center justify-center transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

export const FIELD = "h-12 w-full rounded-xl border border-border dark:border-[#7a8cff]/30 bg-secondary/40 dark:bg-white/5 px-3.5 text-sm font-semibold outline-none focus:border-[#4f6bff] focus:ring-2 focus:ring-[#4f6bff]/30";
export const FIELD_LABEL = "text-[12px] font-bold uppercase tracking-[0.08em] text-muted-foreground dark:text-[#8a94c4]";
