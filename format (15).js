export const makeFmt = (dec) => (p) =>
  p == null || isNaN(p) ? "—" : Number(p).toLocaleString("en-IN", { minimumFractionDigits: dec, maximumFractionDigits: dec });

export const pct = (x, dp = 2) => (x == null || isNaN(x) ? "—" : (x > 0 ? "+" : "") + x.toFixed(dp) + "%");

export const compact = (n) =>
  Math.abs(n) >= 1e6 ? (n / 1e6).toFixed(2) + "M" : Math.abs(n) >= 1e3 ? (n / 1e3).toFixed(1) + "K" : String(Math.round(n));

// Intraday charts show time; daily and weekly show dates. Times in IST.
export function makeFmtTime(data, tf, src) {
  const intraday = src === "csv"
    ? data.length > 1 && data[1].t && data[0].t && data[1].t - data[0].t < 864e5
    : !["1D", "1W"].includes(tf);
  return (t) => {
    if (!t) return "";
    const o = { day: "2-digit", month: "short", timeZone: "Asia/Kolkata" };
    if (intraday) Object.assign(o, { hour: "2-digit", minute: "2-digit", hour12: false });
    if (tf === "1W") o.year = "2-digit";
    return new Date(t).toLocaleString("en-IN", o);
  };
}
