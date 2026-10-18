import { buildAutomaticReport } from "@/lib/automatic-report";
export async function POST(req) {
  const origin=req.headers.get("origin");
  if(origin) { try { if(new URL(origin).host!==req.headers.get("host")) return Response.json({error:"Requests must come from ChartLens."},{status:403}); } catch { return Response.json({error:"Invalid origin."},{status:403}); } }
  let body; try { const text=await req.text(); if(text.length>65000) return Response.json({error:"Chart data is too large."},{status:413}); body=JSON.parse(text); } catch { return Response.json({error:"Invalid chart data."},{status:400}); }
  try { return Response.json({report:buildAutomaticReport(body?.context)}); }
  catch { return Response.json({error:"Chart metrics are incomplete. Load candles and try again."},{status:400}); }
}
