export type Cur = "usd" | "idr";

export function makeFmt(cur: Cur, rate: number) {
  const usd = cur === "usd";
  const grp = (n: number, dec: number) => {
    const [i, f] = Math.abs(n).toFixed(dec).split(".");
    const ip = i.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
    return f ? `${ip},${f}` : ip;
  };
  const money = (n: number) => (n < 0 && Math.round(Math.abs(n) * (usd ? 100 : rate)) > 0 ? "-" : "") + (usd ? "$" + grp(n, 2) : "Rp " + grp(n * rate, 0));
  const moneyS = (n: number) => (n > 0 && Math.round(n * (usd ? 100 : rate)) > 0 ? "+" : "") + money(n);
  const compact = (n: number) => {
    const sign = n < 0 ? "-" : n > 0 ? "+" : "";
    if (usd) {
      const a = Math.abs(n);
      if (a >= 1000) return sign + (a / 1000).toFixed(1).replace(".", ",") + "k";
      if (a >= 10) return sign + Math.round(a);
      return sign + a.toFixed(1).replace(".", ",");
    }
    const a = Math.abs(n * rate);
    if (a >= 1e6) return sign + (a / 1e6).toFixed(1).replace(".", ",") + "jt";
    if (a >= 1e3) return sign + Math.round(a / 1e3) + "rb";
    return sign + Math.round(a);
  };
  const pct = (x: number, dec = 1) => (x === 0 ? "0%" : (x * 100).toFixed(dec).replace(".", ",") + "%");
  const pctS = (x: number, dec = 1) => (x > 0 ? "+" : "") + pct(x, dec);
  return { money, moneyS, compact, pct, pctS, grp };
}
