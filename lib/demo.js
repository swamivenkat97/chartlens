// Seeded synthetic candles, used when no live feed is configured. Not real prices.
import { TIMEFRAMES } from "./instruments";

function hash(str) { let h = 2166136261; for (const c of str) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619); } return h >>> 0; }
function rng(seed) {
  return () => { seed |= 0; seed = (seed + 0x6d2b79f5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

export function demoSeries(sym, tf, n = 300, endTime = Date.now()) {
  const r = rng(hash(sym.s + tf));
  const gauss = () => { let u = 0, v = 0; while (!u) u = r(); while (!v) v = r(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); };
  const { f, ms } = TIMEFRAMES[tf], vol = sym.v * f, out = [];
  let price = sym.p * (0.86 + r() * 0.18), drift = 0;
  const t0 = Math.floor(endTime / ms) * ms - (n - 1) * ms;
  for (let i = 0; i < n; i++) {
    if (i % Math.floor(28 + r() * 30) === 0) drift = (r() - 0.5) * vol * 0.55;
    const o = price, c = o * Math.exp(drift + vol * gauss() * 0.75);
    const h = Math.max(o, c) * (1 + Math.abs(gauss()) * vol * 0.38), l = Math.min(o, c) * (1 - Math.abs(gauss()) * vol * 0.38);
    const v = Math.round((1e5 + r() * 6e4) * (1 + (Math.abs(c - o) / o / vol) * 1.4) * (r() < 0.06 ? 2.6 : 1));
    out.push({ t: t0 + i * ms, o, h, l, c, v });
    price = c;
  }
  return out;
}
