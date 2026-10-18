"use client";
export default function AutoPlanBanner({ setup, plan, source, mode, fmt }) {
  const automatic = mode === "auto";
  const blocked = source === "demo" || source === "error";
  const direction = mode === "off" ? "PLAN OFF" : automatic && blocked ? "NO LIVE SETUP" : plan ? (plan.long ? "BUY SETUP" : "SELL SETUP") : "WAIT";
  const color = plan ? (plan.long ? "var(--up)" : "var(--down)") : "var(--muted)";
  return <div style={{ padding: "10px 14px", borderTop: "1px solid var(--line)", borderBottom: "1px solid var(--line)", background: "var(--surface-2)" }} aria-live="polite">
    <strong style={{ color }}>{direction}</strong>
    <span style={{ marginLeft: 10, color: "var(--muted)", fontSize: 12 }}>{automatic ? "Automatic · indicator rules" : "Manual override"}</span>
    {plan ? <>
      <div style={{ display: "flex", flexWrap: "wrap", gap: "6px 16px", marginTop: 6, fontFamily: "var(--mono)", fontSize: 12 }}>
        <span>Entry {fmt(plan.E)}</span><span>SL {fmt(plan.SL)}</span><span>TP1 {fmt(plan.TP1)}</span><span>TP2 {fmt(plan.TP2)}</span><span>TSL after TP1 {fmt(plan.tslNow)}</span>
      </div>
      <p style={{ margin: "6px 0 0", fontSize: 12, color: "var(--muted)" }}>Live setup preview: direction and levels recalculate as candles change. TSL is projected, not an active or tracked order. Uses ChartLens candles; scores are not win probabilities.</p>
    </> : <p style={{ margin: "6px 0 0", fontSize: 12, color: "var(--muted)" }}>{mode === "off" ? "Select Auto in Trade plan to enable automatic direction." : blocked ? "Automatic plans are disabled for demo or failed feeds. Connect market data first." : !setup ? "Waiting for enough candles to calculate direction." : "Indicators do not show a clear direction. No entry or stop levels are plotted."}</p>}
  </div>;
}
