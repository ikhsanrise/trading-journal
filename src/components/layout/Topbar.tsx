"use client";
import { signOut } from "next-auth/react";
import { LogOut, ChevronDown } from "lucide-react";
import { useState } from "react";
import { usePathname } from "next/navigation";
import { ThemeToggle } from "@/components/ThemeToggle";

interface TopbarProps {
  user?: { name?: string | null; email?: string | null };
}

const TITLES: Record<string, string> = {
  "/dashboard": "Dashboard",
  "/trades": "Trade Log",
  "/analytics": "Analytics",
  "/calendar": "Calendar",
  "/propfirm": "Prop Firm",
  "/ea-tracker": "EA Tracker",
  "/reports": "Laporan",
  "/playbook": "Playbook",
  "/settings": "Settings",
};

export default function Topbar({ user }: TopbarProps) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const title = TITLES[Object.keys(TITLES).find((k) => pathname.startsWith(k)) ?? ""] ?? "";
  const name = user?.name ?? user?.email ?? "";
  const initials = name.split(/[\s@.]+/).filter(Boolean).slice(0, 2).map((w) => w[0]?.toUpperCase()).join("") || "U";

  return (
    <header className="h-[calc(60px+env(safe-area-inset-top))] pt-[env(safe-area-inset-top)] bg-card dark:bg-transparent border-b dark:border-[#7a8cff]/10 flex items-center justify-between px-4 md:px-8 shrink-0 relative z-10">
      <div id="topbar-title" className="text-xs font-medium text-muted-foreground dark:text-[#8a94c4]">
        Trading Journal <span className="opacity-50">/</span> <b className="font-semibold text-foreground dark:text-[#dfe4ff]">{title}</b>
      </div>
      <div className="flex items-center gap-4">
        <ThemeToggle />
        <div className="relative">
          <button
            onClick={() => setOpen(!open)}
            className="flex items-center gap-2.5 text-[13px] font-semibold text-foreground"
          >
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[#3b5bff] to-[#1b2a78] flex items-center justify-center text-xs font-bold text-white">
              {initials}
            </div>
            <span>{user?.name ?? user?.email}</span>
            <ChevronDown className="w-4 h-4 text-muted-foreground" />
          </button>
          {open && (
            <>
              <div className="fixed inset-0" onClick={() => setOpen(false)} />
              <div className="absolute right-0 top-10 w-48 border dark:border-[#27358a]/50 rounded-xl shadow-xl py-1 z-50 bg-card dark:bg-[#0c1330]">
                <div className="px-3 py-2 border-b dark:border-[#27358a]/40">
                  <p className="text-xs font-medium truncate">{user?.name}</p>
                  <p className="text-xs text-muted-foreground truncate">{user?.email}</p>
                </div>
                <button
                  onClick={() => signOut({ callbackUrl: "/login" })}
                  className="w-full flex items-center gap-2 px-3 py-2 text-xs text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  Sign Out
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
