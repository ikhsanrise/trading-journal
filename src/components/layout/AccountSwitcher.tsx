"use client";
import { useEffect, useState } from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

interface Props {
  value: string;
  onChange: (id: string) => void;
}

export default function AccountSwitcher({ value, onChange }: Props) {
  const [accounts, setAccounts] = useState<any[]>([]);
  const [open, setOpen] = useState(false);
  const [current, setCurrent] = useState<any>(null);

  useEffect(() => {
    fetch("/api/accounts")
      .then((r) => r.json())
      .then((data) => {
        if (!Array.isArray(data)) return;
        setAccounts(data);
        const def = data.find((a: any) => a.isDefault) ?? data[0];
        if (def && !value) {
          onChange(def.id);
          setCurrent(def);
        } else if (value) {
          setCurrent(data.find((a: any) => a.id === value) ?? def);
        }
      });
  }, []);

  useEffect(() => {
    if (accounts.length && value) {
      setCurrent(accounts.find((a) => a.id === value));
    }
  }, [value, accounts]);

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-lg bg-indigo-50 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800 hover:border-indigo-400 transition-colors max-w-[160px]"
      >
        <span className="truncate">{current?.name ?? "Select Account"}</span>
        <ChevronDown className="w-3 h-3 shrink-0" />
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div
            className="absolute left-0 top-8 z-50 min-w-[180px] border rounded-xl shadow-xl py-1 overflow-hidden"
            style={{ backgroundColor: 'hsl(var(--card))' }}
          >
            {accounts.map((acc) => (
              <button
                key={acc.id}
                onClick={() => { onChange(acc.id); setCurrent(acc); setOpen(false); }}
                className={cn(
                  "w-full text-left px-3 py-2 text-xs hover:bg-muted transition-colors flex items-center justify-between gap-2",
                  value === acc.id && "text-indigo-500 font-medium"
                )}
              >
                <span className="truncate">{acc.name}</span>
                {value === acc.id && (
                  <svg className="w-3 h-3 shrink-0 text-indigo-500" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                )}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
