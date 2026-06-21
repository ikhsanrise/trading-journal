"use client";
import { signOut } from "next-auth/react";
import { LogOut, ChevronDown, User } from "lucide-react";
import { useState } from "react";
import { ThemeToggle } from "@/components/ThemeToggle";

interface TopbarProps {
  user?: { name?: string | null; email?: string | null };
}

export default function Topbar({ user }: TopbarProps) {
  const [open, setOpen] = useState(false);

  return (
    <header className="h-11 bg-card border-b flex items-center justify-between px-4 shrink-0 relative z-10">
      <div id="topbar-title" className="flex items-center gap-2" />
      <div className="flex items-center gap-3">
        <ThemeToggle />
        <div className="relative">
          <button
            onClick={() => setOpen(!open)}
            className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            <div className="w-6 h-6 rounded-full bg-blue-100 dark:bg-blue-900 flex items-center justify-center">
              <User className="w-3.5 h-3.5 text-blue-700 dark:text-blue-300" />
            </div>
            <span className="text-xs">{user?.name ?? user?.email}</span>
            <ChevronDown className="w-3 h-3" />
          </button>
          {open && (
            <>
              <div className="fixed inset-0" onClick={() => setOpen(false)} />
              <div className="absolute right-0 top-8 w-44 bg-card border rounded-lg shadow-md py-1 z-50">
                <div className="px-3 py-2 border-b">
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
