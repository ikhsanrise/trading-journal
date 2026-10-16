"use client";

declare global {
  interface Window {
    __fetchCacheInstalled?: boolean;
  }
}

type Entry = { ts: number; promise: Promise<Response> };

const TTL = 45_000; // 45 detik

function install() {
  if (window.__fetchCacheInstalled) return;
  window.__fetchCacheInstalled = true;

  const original = window.fetch.bind(window);
  const cache = new Map<string, Entry>();

  const keyOf = (raw: string): string | null => {
    const url = new URL(raw, window.location.origin);
    if (url.origin !== window.location.origin) return null;
    if (!url.pathname.startsWith("/api/")) return null;
    if (/^\/api\/(auth|export)/.test(url.pathname)) return null;
    // route dashboard mengabaikan period=all → samakan key supaya antar halaman saling pakai cache
    if (url.pathname === "/api/dashboard" && url.searchParams.get("period") === "all") {
      url.searchParams.delete("period");
    }
    url.searchParams.sort();
    return url.pathname + url.search;
  };

  window.fetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const method = (init?.method ?? (input instanceof Request ? input.method : "GET")).toUpperCase();
    const raw = typeof input === "string" ? input : input instanceof URL ? input.toString() : null;

    // Mutasi (add/edit/delete/import) → buang semua cache sebelum & sesudah request
    if (method !== "GET") {
      cache.clear();
      try {
        return await original(input, init);
      } finally {
        cache.clear();
      }
    }

    if (!raw) return original(input, init);
    let key: string | null = null;
    try { key = keyOf(raw); } catch { key = null; }
    if (!key) return original(input, init);

    const hit = cache.get(key);
    if (hit && Date.now() - hit.ts < TTL) return (await hit.promise).clone();

    const promise = original(raw, { ...init, cache: "no-store" });
    const entry: Entry = { ts: Date.now(), promise };
    cache.set(key, entry);
    try {
      const res = await promise;
      if (!res.ok && cache.get(key!) === entry) cache.delete(key!);
      return res.clone();
    } catch (e) {
      if (cache.get(key!) === entry) cache.delete(key!);
      throw e;
    }
  };
}

if (typeof window !== "undefined") install();

export default function FetchCache() {
  return null;
}
