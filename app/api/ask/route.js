import { getClient, FAST_MODEL, textOf, guard, errorResponse } from "@/lib/server/claude";
import { RULES, ASK_TASK } from "@/lib/server/prompts";

export const maxDuration = 30;

// Body: { context, report, turns: [{role, content}, ...] } — the page keeps the conversation.
export async function POST(req) {
  const blocked = guard(req); if (blocked) return blocked;
  let body;
  try { body = await req.json(); } catch { return Response.json({ error: "Bad request." }, { status: 400 }); }
  const turns = (Array.isArray(body?.turns) ? body.turns : [])
    .filter((t) => (t.role === "user" || t.role === "assistant") && typeof t.content === "string" && t.content.trim())
    .slice(-6).map((t) => ({ role: t.role, content: t.content.slice(0, 1200) }));
  while (turns.length && turns[0].role !== "user") turns.shift();
  if (!turns.length || turns.at(-1).role !== "user") return Response.json({ error: "Ask a question first." }, { status: 400 });

  const system = `${RULES}\n\n${ASK_TASK}\n\nChart data: ${JSON.stringify(body.context ?? {}).slice(0, 50_000)}\n\nYour earlier report: ${JSON.stringify(body.report ?? {}).slice(0, 12_000)}`;
  try {
    const msg = await getClient().messages.create({ model: FAST_MODEL(), max_tokens: 600, system, messages: turns });
    return Response.json({ answer: textOf(msg) });
  } catch (e) { return errorResponse(e); }
}
