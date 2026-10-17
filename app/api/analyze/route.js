import { getClient, MODEL, textOf, parseJSON, guard, errorResponse } from "@/lib/server/claude";
import { RULES, SCHEMA } from "@/lib/server/prompts";

export const maxDuration = 60;

export async function POST(req) {
  const blocked = guard(req); if (blocked) return blocked;
  let body;
  try { body = await req.json(); } catch { return Response.json({ error: "Bad request." }, { status: 400 }); }
  const context = JSON.stringify(body?.context ?? null);
  if (!body?.context || context.length > 60_000) return Response.json({ error: "Chart data missing or too large." }, { status: 400 });

  try {
    const msg = await getClient().messages.create({
      model: MODEL(),
      max_tokens: 4000,
      system: RULES,
      messages: [{
        role: "user",
        content: `Chart data (JSON; last30bars rows are [open,high,low,close], oldest first):\n${context}\n\nReply with only one JSON object in this shape:\n${SCHEMA}`,
      }],
    });
    const report = parseJSON(textOf(msg));
    if (!report) return Response.json({ error: "The report came back malformed. Try again." }, { status: 502 });
    return Response.json({ report });
  } catch (e) { return errorResponse(e); }
}
