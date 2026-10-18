"use client";
export default function ScreenshotPlan({ plan }) {
  if (!plan) return null;
  const price=(x)=>typeof x==="number"?x.toLocaleString("en-IN",{maximumFractionDigits:8}):"—";
  return <section className="sec" aria-label="Screenshot conditional setup">
    <h3 style={{margin:0}}>{plan.direction==="long"?"Conditional buy setup":plan.direction==="short"?"Conditional sell setup":"Wait · no clear setup"}</h3>
    <p style={{margin:0}}>{plan.reason}</p>
    {plan.direction!=="wait" && <dl className="kv">
      <dt>Entry area (approx.)</dt><dd>{price(plan.entryLow)} – {price(plan.entryHigh)}</dd>
      <dt>SL (approx.)</dt><dd>{price(plan.stop)}</dd>
      <dt>TP1 (approx.)</dt><dd>{price(plan.tp1)}</dd>
      <dt>TP2 (approx.)</dt><dd>{price(plan.tp2)}</dd>
    </dl>}
    {plan.confirmation && <p style={{margin:0}}><strong>Entry confirmation: </strong>{plan.confirmation}</p>}
    {plan.invalidation && <p style={{margin:0}}><strong>Invalidation: </strong>{plan.invalidation}</p>}
    <p style={{margin:0}}><strong>TSL rule: </strong>{plan.trailingRule}</p>
    {plan.limitations?.length>0 && <ul>{plan.limitations.map((text,i)=><li key={i}>{text}</li>)}</ul>}
    <p className="rule">Approximate analysis of an uploaded snapshot, not a live quote or guaranteed best entry. No orders or trailing stops are executed or tracked.</p>
  </section>;
}
