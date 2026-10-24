export const SCREENSHOT_MODES = [
  { id: "structure", name: "Market structure", frames: ["5m", "15m"], focus: "Identify trend, confirmed BOS/CHoCH, key support/resistance and potential liquidity zones on 5m and 15m." },
  { id: "vwap", name: "VWAP + EMA", frames: ["5m", "15m"], focus: "Find the strongest setup using session VWAP, 9/21 EMA, volume and price action. Conflicting signals mean no trade." },
  { id: "momentum", name: "Momentum scalper", frames: ["1m", "5m"], focus: "Assess 1m and 5m price action, volume, RSI, VWAP and 9/21 EMA. Rank evidence confidence 1–10, never a win probability." },
  { id: "breakout", name: "Breakout scanner", frames: ["5m", "15m"], focus: "Distinguish a genuine breakout from a false break using a completed candle outside the range, volume and a completed retest that holds. A wick or a pending retest is not confirmation." },
  { id: "opening", name: "Opening range", frames: ["5m", "15m"], focus: "Use the first 15 minutes of the explicitly specified session, session VWAP, volume and structure. Require a completed opening range and confirmed breakout/retest. Never assume a session or timezone." },
  { id: "reversal", name: "Reversal scanner", frames: ["5m", "15m"], focus: "Identify strong support/resistance, rejection or liquidity sweep, volume and momentum shift. Require a completed rejection and structure confirmation before a reversal setup." },
  { id: "validator", name: "Final trade validator", frames: ["5m", "15m"], focus: "Objectively challenge the proposed direction, entry, stop and targets using trend structure, VWAP, 9/21 EMA, volume, momentum and reward-to-risk. Return APPROVE, WAIT or REJECT with key reason and invalidation. Do not replace the user's proposed prices." },
];

export const findMode = (id) => SCREENSHOT_MODES.find((mode) => mode.id === id);

const text = (value) => typeof value === "string" ? value : "";
export function cleanPlan(plan, mode = "breakout", proposal = null) {
  const limitations = Array.isArray(plan?.limitations) ? plan.limitations.filter((v) => typeof v === "string") : [];
  const evidence = Object.fromEntries(["structure", "vwap", "ema", "volume", "momentum", "closedCandle", "retest", "openingRange", "timeframes"].map(key => [key, ["confirmed", "missing", "conflicting"].includes(plan?.evidence?.[key]) ? plan.evidence[key] : "missing"]));
  const wait = (reason, verdict = "WAIT") => ({ direction: "wait", verdict, entryLow: null, entryHigh: null, stop: null, tp1: null, tp2: null, rr1: null, rr2: null, confidence: null, evidence, confirmation: text(plan?.confirmation), invalidation: text(plan?.invalidation), reason, trailingRule: "No active trailing stop.", limitations });
  if (mode === "validator" && plan?.verdict === "REJECT") return wait(text(plan.reason) || "The proposed setup fails confirmation or risk checks.", "REJECT");
  if (!plan || !["long", "short"].includes(plan.direction)) return wait(text(plan?.reason) || "No confirmed setup is visible.");
  if (mode !== "validator" && plan.verdict !== (plan.direction === "long" ? "BUY" : "SELL")) return wait(text(plan.reason) || "The analysis did not confirm a trade direction.");
  const { entryLow: l, entryHigh: h, stop: s, tp1: a, tp2: b } = plan;
  if (![l, h, s, a, b].every((v) => typeof v === "number" && Number.isFinite(v) && v > 0) || l > h) return wait("Readable, consistent prices are missing.");
  if (!(plan.direction === "long" ? s < l && h < a && a < b : b < a && a < l && h < s)) return wait("The proposed price levels are inconsistent.");
  const required = mode === "momentum" ? ["structure", "vwap", "ema", "volume", "momentum", "closedCandle", "timeframes"]
    : mode === "structure" ? ["structure", "closedCandle", "timeframes"]
    : mode === "reversal" ? ["structure", "volume", "momentum", "closedCandle", "timeframes"]
    : mode === "validator" ? ["structure", "vwap", "ema", "volume", "momentum", "closedCandle", "timeframes"]
    : mode === "vwap" ? ["structure", "vwap", "ema", "volume", "closedCandle", "timeframes"]
    : mode === "opening" ? ["structure", "vwap", "volume", "closedCandle", "retest", "openingRange", "timeframes"]
    : ["structure", "volume", "closedCandle", "retest", "timeframes"];
  const missing = required.filter((key) => evidence[key] !== "confirmed");
  if (missing.length) return wait(`Required confirmation is missing or conflicting: ${missing.join(", ")}.`);
  if (!text(plan.confirmation).trim() || !text(plan.invalidation).trim()) return wait("Confirmation and invalidation must both be explicit.");
  if (mode === "validator" && (plan.verdict !== "APPROVE" || !proposal || plan.direction !== proposal.direction || l !== proposal.entry || h !== proposal.entry || s !== proposal.stop || a !== proposal.tp1 || b !== proposal.tp2)) return wait("The proposed trade could not be validated without changing its levels.");
  const entry = plan.direction === "long" ? h : l;
  const risk = Math.abs(entry - s);
  const rr1 = Math.abs(a - entry) / risk, rr2 = Math.abs(b - entry) / risk;
  if (rr1 < 2) return wait("Reward-to-risk to TP1 is below the required 2:1 before trading costs.", mode === "validator" ? "REJECT" : "WAIT");
  return { direction: plan.direction, verdict: mode === "validator" ? "APPROVE" : plan.direction === "long" ? "BUY" : "SELL", entryLow: l, entryHigh: h, stop: s, tp1: a, tp2: b, rr1, rr2, evidence, confidence: mode === "momentum" && Number.isInteger(plan.confidence) && plan.confidence >= 1 && plan.confidence <= 10 ? plan.confidence : null, reason: text(plan.reason), confirmation: text(plan.confirmation), invalidation: text(plan.invalidation), trailingRule: text(plan.trailingRule) || "Reassess after TP1; no active stop is tracked.", limitations };
}
