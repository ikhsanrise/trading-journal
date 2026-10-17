"use client";
import { useTheme } from "next-themes";
import { useEffect, useState } from "react";
import { Sun, Moon, Monitor } from "lucide-react";

export function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  if (!mounted) return null;

  return (
    <div className="flex items-center gap-0.5 bg-muted dark:bg-white/5 rounded-[10px] p-[3px]">
      {[
        { value: "light", icon: Sun },
        { value: "system", icon: Monitor },
        { value: "dark", icon: Moon },
      ].map(({ value, icon: Icon }) => (
        <button
          key={value}
          onClick={() => setTheme(value)}
          className={`w-[30px] h-7 flex items-center justify-center rounded-lg transition-colors ${
            theme === value
              ? "bg-card dark:bg-[#4f6bff]/25 text-foreground dark:text-[#c7d0ff] shadow-sm"
              : "text-muted-foreground hover:text-foreground"
          }`}
          title={value}
        >
          <Icon className="w-4 h-4" />
        </button>
      ))}
    </div>
  );
}
