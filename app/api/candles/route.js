import { findSymbol, TIMEFRAMES } from "@/lib/instruments";
import { demoSeries } from "@/lib/demo";

export const dynamic = "force-dynamic";

const LIMIT = 500;
// Binance's public market-data host first; the main API as a fallback.
const BINANCE_HOSTS = ["https://data-api.binance.vision", "https://api.binance.com"];

async function fromBinance(symbol, interval) {
  let lastErr;
  for (const host of BINANCE_HOSTS) {
    try {
      const r = await fetch(`${host}/api/v3/klines?symbol=${symbol}&interval=${interval}&limit=${LIMIT}`, { cache: "no-store" });
      if (!r.ok) throw new Error(`Binance ${r.status}`);
      const rows = await r.json();
      return rows.map((k) => ({ t: k[0], o: +k[1], h: +k[2], l: +k[3], c: +k[4], v: +k[5] }));
    } catch (e) { lastErr = e; }
  }
  throw lastErr;
}

async function fromTwelveData(sym, interval) {
  const q = new URLSearchParams({ symbol: sym.td, interval, outputsize: String(LIMIT), timezone: "UTC", apikey: process.env.TWELVE_DATA_API_KEY });
  if (sym.exchange) q.set("exchange", sym.exchange);
  const r = await fetch(`https://api.twelvedata.com/time_series?${q}`, { cache: "no-store" });
  const j = await r.json();
  if (j.status !== "ok" || !Array.isArray(j.values)) throw new Error(j.message || "Twelve Data returned no values");
  return j.values
    .map((v) => ({ t: Date.parse(v.datetime.replace(" ", "T") + (v.datetime.length > 10 ? "Z" : "T00:00:00Z")), o: +v.open, h: +v.high, l: +v.low, c: +v.close, v: +(v.volume || 0) }))
    .filter((b) => isFinite(b.t) && isFinite(b.c))
    .reverse();
}

export async function GET(req) {
  const p = new URL(req.url).searchParams;
  const market = p.get("market"), tf = p.get("tf");
  const sym = findSymbol(market, p.get("symbol")), tfc = TIMEFRAMES[tf];
  if (!sym || !tfc) return Response.json({ error: "Unknown instrument or timeframe." }, { status: 400 });

  const hasTD = !!process.env.TWELVE_DATA_API_KEY;
  let note = null;

  if (sym.td && hasTD) {
    try {
      const candles = await fromTwelveData(sym, tfc.td);
      if (candles.length >= 60)
        return Response.json({ source: "twelvedata", live: true, poll: 60, candles }, { headers: { "Cache-Control": "public, s-maxage=30, stale-while-revalidate=30" } });
      note = "Twelve Data returned too few candles; showing demo data.";
    } catch (e) { note = `Twelve Data: ${e.message}. Showing demo data.`; }
  }

  if (sym.binance) {
    try {
      const candles = await fromBinance(sym.binance, tfc.binance);
      return Response.json(
        { source: "binance", live: true, stream: `${sym.binance.toLowerCase()}@kline_${tfc.binance}`,
          note: sym.binance !== sym.s ? `Showing Binance ${sym.binance} as a proxy for ${sym.s}.` : null, candles },
        { headers: { "Cache-Control": "public, s-maxage=5, stale-while-revalidate=10" } });
    } catch (e) { note = `Binance unavailable (${e.message}). Showing demo data.`; }
  }

  if (!note && sym.td && !hasTD) note = "Demo data. Add TWELVE_DATA_API_KEY to load real candles for this market.";
  return Response.json({ source: "demo", live: false, note, candles: demoSeries(sym, tf) }, { headers: { "Cache-Control": "no-store" } });
}
