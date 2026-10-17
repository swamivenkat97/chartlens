// Stores waitlist emails in Upstash Redis (Vercel Marketplace → Upstash; it sets KV_REST_API_URL and KV_REST_API_TOKEN).
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export async function POST(req) {
  let body;
  try { body = await req.json(); } catch { return Response.json({ error: "Bad request." }, { status: 400 }); }
  const email = String(body?.email || "").trim().toLowerCase();
  if (!EMAIL.test(email) || email.length > 200) return Response.json({ error: "Enter a valid email address." }, { status: 400 });

  const url = process.env.KV_REST_API_URL, token = process.env.KV_REST_API_TOKEN;
  if (!url || !token) {
    console.log("[waitlist] storage not configured; received", email);
    return Response.json({ error: "The waitlist isn't open yet. Please check back soon." }, { status: 503 });
  }
  try {
    const r = await fetch(`${url}/pipeline`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify([["ZADD", "waitlist", "NX", Date.now(), email]]),
    });
    if (!r.ok) throw new Error(`Upstash ${r.status}`);
    return Response.json({ ok: true });
  } catch (e) {
    console.error("[waitlist]", e.message);
    return Response.json({ error: "Couldn't save your email. Try again." }, { status: 502 });
  }
}
