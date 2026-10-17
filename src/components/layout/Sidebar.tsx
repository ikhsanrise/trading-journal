"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Building2 } from "lucide-react";
import {
  TrendingUp, LayoutDashboard, ListOrdered, BarChart3,
  CalendarDays, BookOpen, Settings, FileText,
} from "lucide-react";
import { cn } from "@/lib/utils";

const navItems = [
  { href: "/dashboard", icon: LayoutDashboard, label: "Dashboard" },
  { href: "/trades", icon: ListOrdered, label: "Trade Log" },
  { href: "/analytics", icon: BarChart3, label: "Analytics" },
  { href: "/calendar", icon: CalendarDays, label: "Calendar" },
  { href: "/propfirm", icon: Building2, label: "Prop Firm" },
  { href: "/reports", icon: FileText, label: "Laporan" },
  { href: "/playbook", icon: BookOpen, label: "Playbook" },
];

export default function Sidebar() {
  const pathname = usePathname();

  return (
    <>
      {/* Desktop Sidebar */}
      <aside className="hidden md:flex w-[68px] flex-col items-center py-4 gap-1.5 bg-card dark:bg-[#080d22] border-r dark:border-[#7a8cff]/12 shrink-0">
        <Link href="/dashboard" className="w-9 h-9 bg-gradient-to-b from-[#4f6bff] to-[#2f4bd8] shadow-[0_8px_24px_-8px_rgba(79,107,255,0.8)] rounded-xl flex items-center justify-center mb-3 hover:brightness-110 transition">
          <TrendingUp className="w-[18px] h-[18px] text-white" />
        </Link>
        <nav className="flex flex-col gap-1 flex-1">
          {navItems.map(({ href, icon: Icon, label }) => {
            const active = pathname.startsWith(href);
            return (
              <Link key={href} href={href}>
                <div className={cn("w-11 h-11 rounded-xl flex items-center justify-center transition-colors cursor-pointer text-muted-foreground hover:bg-secondary hover:text-foreground", active && "bg-[#4f6bff]/15 text-[#3b57e8] dark:text-[#9db0ff] shadow-[inset_0_0_0_1px_rgba(79,107,255,0.4),0_0_20px_-6px_rgba(79,107,255,0.7)]")} title={label}>
                  <Icon className="w-[18px] h-[18px]" />
                </div>
              </Link>
            );
          })}
        </nav>
        <Link href="/settings">
          <div className={cn("w-11 h-11 rounded-xl flex items-center justify-center transition-colors cursor-pointer text-muted-foreground hover:bg-secondary hover:text-foreground", pathname.startsWith("/settings") && "bg-[#4f6bff]/15 text-[#3b57e8] dark:text-[#9db0ff] shadow-[inset_0_0_0_1px_rgba(79,107,255,0.4)]")} title="Settings">
            <Settings className="w-[18px] h-[18px]" />
          </div>
        </Link>
      </aside>

      {/* Mobile Bottom Navigation - solid background with inline style */}
      <nav
        className="md:hidden fixed bottom-0 left-0 right-0 z-50 flex items-center justify-around px-1"
        style={{
          backgroundColor: 'hsl(var(--card))',
          borderTop: '1px solid hsl(var(--border))',
          paddingTop: '8px',
          paddingBottom: 'max(8px, env(safe-area-inset-bottom))',
        }}
      >
        {navItems.map(({ href, icon: Icon, label }) => {
          const active = pathname.startsWith(href);
          return (
            <Link key={href} href={href} className={cn("flex flex-col items-center gap-0.5 px-2 py-1 rounded-lg transition-colors min-w-0 flex-1", active ? "text-indigo-500" : "text-muted-foreground")}>
              <Icon className="w-5 h-5 shrink-0" />
              <span className="text-[9px] font-medium truncate">{label}</span>
            </Link>
          );
        })}
        <Link href="/settings" className={cn("flex flex-col items-center gap-0.5 px-2 py-1 rounded-lg transition-colors min-w-0 flex-1", pathname.startsWith("/settings") ? "text-indigo-500" : "text-muted-foreground")}>
          <Settings className="w-5 h-5 shrink-0" />
          <span className="text-[9px] font-medium">Settings</span>
        </Link>
      </nav>
    </>
  );
}
