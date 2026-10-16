import { ReactNode } from "react";

export function PageHeader({ title, subtitle, actions }: { title: string; subtitle?: string; actions?: ReactNode }) {
  return (
    <div className="relative flex flex-wrap items-end justify-between gap-3 px-4 md:px-6 pt-5 pb-4">
      <div className="pointer-events-none absolute inset-x-0 -top-10 h-40 hidden dark:block bg-[radial-gradient(600px_160px_at_20%_0%,rgba(79,107,255,0.18),transparent)]" />
      <div className="relative">
        <h1 className="text-xl font-semibold tracking-tight">{title}</h1>
        {subtitle && <p className="text-xs text-muted-foreground mt-0.5">{subtitle}</p>}
      </div>
      {actions && <div className="relative flex items-center gap-2">{actions}</div>}
    </div>
  );
}
