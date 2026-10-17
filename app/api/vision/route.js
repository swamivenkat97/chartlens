import { getClient, MODEL, textOf, parseJSON, guard, errorResponse } from "@/lib/server/claude";
import { RULES, SCHEMA, SCREENSHOT_TASK } from "@/lib/server/prompts";

export const maxDuration = 60;
const TYPES = ["image/png", "image/jpeg", "image/webp", "image/gif"];

// Body: { image: base64 (no data: prefix), mediaType, context? }. The browser downsizes images first (Vercel caps bodies at 4.5 MB).
export async function POST(req) {
  const blocked = guard(req); if (blocked) return blocked;
  let body;
  try { body = await req.json(); } catch { return Response.json({ error: "Bad request." }, { status: 400 }); }
  const { image, mediaType, context } = body || {};
  if (!image || !TYPES.includes(mediaType)) return Response.json({ error: "Upload a PNG, JPG or WebP image." }, { status: 400 });
  if (image.length > 4_000_000) return Response.json({ error: "That image is too large. Try a smaller screenshot." }, { status: 413 });
  const note = typeof context === "string" && context.trim() ? `The user says: ${JSON.stringify(context.trim().slice(0, 300))}.` : "";

  try {
    const msg = await getClient().messages.create({
      model: MODEL(),
      max_tokens: 4000,
      system: RULES,
      messages: [{
        role: "user",
        content: [
          { type: "image", source: { type: "base64", media_type: mediaType, data: image } },
          { type: "text", text: `${SCREENSHOT_TASK}\n${note}\n\nReply with only one JSON object in this shape:\n${SCHEMA}` },
        ],
      }],
    });
    const report = parseJSON(textOf(msg));
    if (!report) return Response.json({ error: "The report came back malformed. Try again." }, { status: 502 });
    return Response.json({ report });
  } catch (e) { return errorResponse(e); }
}
