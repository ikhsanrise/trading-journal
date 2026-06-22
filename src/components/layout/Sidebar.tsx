"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  TrendingUp,
  LayoutDashboard,
  ListOrdered,
  BarChart3,
  CalendarDays,
  BookOpen,
  Settings,
} from "lucide-react";
import { cn } from "@/lib/utils";

const navItems = [
  { href: "/dashboard", icon: LayoutDashboard, label: "Dashboard" },
  { href: "/trades", icon: ListOrdered, label: "Trade Log" },
  { href: "/analytics", icon: BarChart3, label: "Analytics" },
  { href: "/calendar", icon: CalendarDays, label: "Calendar" },
  { href: "/playbook", icon: BookOpen, label: "Playbook" },
];

export default function Sidebar() {
  const pathname = usePathname();

  return (
    <>
      {/* Desktop Sidebar */}
      <aside className="hidden md:flex w-12 flex-col items-center py-3 gap-1.5 bg-card border-r shrink-0">
        <Link
          href="/dashboard"
          className="w-7 h-7 bg-indigo-600 rounded-lg flex items-center justify-center mb-2 hover:bg-indigo-700 transition-colors"
        >
          <TrendingUp className="w-4 h-4 text-white" />
        </Link>

        <nav className="flex flex-col gap-1 flex-1">
          {navItems.map(({ href, icon: Icon, label }) => {
            const active = pathname.startsWith(href);
            return (
              <Link key={href} href={href}>
                <div
                  className={cn(
                    "w-9 h-9 rounded-lg flex items-center justify-center transition-colors cursor-pointer",
                    "text-muted-foreground hover:bg-secondary hover:text-foreground",
                    active && "bg-indigo-50 dark:bg-indigo-950 text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-950"
                  )}
                  title={label}
                >
                  <Icon className="w-[18px] h-[18px]" />
                </div>
              </Link>
            );
          })}
        </nav>

        <Link href="/settings">
          <div
            className={cn(
              "w-9 h-9 rounded-lg flex items-center justify-center transition-colors cursor-pointer",
              "text-muted-foreground hover:bg-secondary hover:text-foreground",
              pathname.startsWith("/settings") && "bg-indigo-50 dark:bg-indigo-950 text-indigo-600"
            )}
            title="Settings"
          >
            <Settings className="w-[18px] h-[18px]" />
          </div>
        </Link>
      </aside>

      {/* Mobile Bottom Navigation */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-card border-t flex items-center justify-around px-2 py-1 safe-area-pb">
        {navItems.map(({ href, icon: Icon, label }) => {
          const active = pathname.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                "flex flex-col items-center gap-0.5 px-3 py-1.5 rounded-lg transition-colors min-w-0",
                active ? "text-indigo-600" : "text-muted-foreground"
              )}
            >
              <Icon className="w-5 h-5 shrink-0" />
              <span className="text-[10px] font-medium truncate">{label}</span>
            </Link>
          );
        })}
        <Link
          href="/settings"
          className={cn(
            "flex flex-col items-center gap-0.5 px-3 py-1.5 rounded-lg transition-colors min-w-0",
            pathname.startsWith("/settings") ? "text-indigo-600" : "text-muted-foreground"
          )}
        >
          <Settings className="w-5 h-5 shrink-0" />
          <span className="text-[10px] font-medium">Settings</span>
        </Link>
      </nav>
    </>
  );
}
