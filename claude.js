import "server-only";
import Anthropic from "@anthropic-ai/sdk";

let client = null;
export function getClient() {
  if (!process.env.ANTHROPIC_API_KEY) return null;
  if (!client) client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  return client;
}

export const MODEL = () => process.env.ANTHROPIC_MODEL || "claude-sonnet-5-5";
export const FAST_MODEL = () => process.env.ANTHROPIC_FAST_MODEL || "claude-haiku-5-5";

export const textOf = (msg) => msg.content.filter((b) => b.type === "text").map((b) => b.text).join("");

// Tolerant JSON read: whole reply, a fenced block, or the outermost {...}.
export function parseJSON(text) {
  const tries = [text, text.match(/```(?:json)?\s*([\s\S]*?)```/)?.[1], text.slice(text.indexOf("{"), text.lastIndexOf("}") + 1)];
  for (const t of tries) {
    if (!t) continue;
    try { return JSON.parse(t); } catch {}
  }
  return null;
}

// Best-effort per-IP limit. Serverless instances don't share memory, so put an
// edge rate limiter or login in front of these routes before a public launch.
const hits = new Map();
export function rateLimited(req) {
  const max = +(process.env.AI_RATE_LIMIT_PER_HOUR || 30);
  const ip = (req.headers.get("x-forwarded-for") || "local").split(",")[0].trim();
  const now = Date.now(), list = (hits.get(ip) || []).filter((t) => now - t < 3600e3);
  list.push(now); hits.set(ip, list);
  return list.length > max;
}

// Only accept calls from this site's own pages.
export function sameOrigin(req) {
  const origin = req.headers.get("origin");
  if (!origin) return true;
  try { return new URL(origin).host === req.headers.get("host"); } catch { return false; }
}

export function errorResponse(e) {
  const status = e?.status;
  const msg = status === 429 ? "The AI is busy right now. Try again in a minute."
    : status === 401 ? "The server's Anthropic API key is invalid."
    : status === 400 ? "The AI couldn't process that request."
    : "Something went wrong reaching the AI. Try again.";
  console.error("[claude]", status, e?.message);
  return Response.json({ error: msg }, { status: status === 429 ? 429 : 502 });
}

export function guard(req) {
  if (!sameOrigin(req)) return Response.json({ error: "Requests must come from ChartLens." }, { status: 403 });
  if (!getClient()) return Response.json({ error: "AI isn't set up yet: add ANTHROPIC_API_KEY in your Vercel project settings." }, { status: 503 });
  if (rateLimited(req)) return Response.json({ error: "You've reached the hourly limit for AI requests. Try again later." }, { status: 429 });
  return null;
}
