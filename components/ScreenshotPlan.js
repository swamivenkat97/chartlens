"use client";
export default function ScreenshotPlan({ plan }) {
  if (!plan) return null;
  const price=(x)=>typeof x==="number"?x.toLocaleString("en-IN",{maximumFractionDigits:8}):"—";
  return <section className="sec" aria-label="Screenshot conditional setup">
    <h3 style={{margin:0}}>{plan.verdict === "APPROVE" ? "APPROVE · proposed setup" : plan.verdict === "REJECT" ? "REJECT · proposed setup" : plan.direction==="long"?"BUY · confirmed snapshot setup":plan.direction==="short"?"SELL · confirmed snapshot setup":"WAIT · NO TRADE"}</h3>
    <p style={{margin:0}}>{plan.reason}</p>
    {plan.direction!=="wait" && <dl className="kv">
      <dt>Entry area (approx.)</dt><dd>{price(plan.entryLow)} – {price(plan.entryHigh)}</dd>
      <dt>SL (approx.)</dt><dd>{price(plan.stop)}</dd>
      <dt>TP1 (approx.)</dt><dd>{price(plan.tp1)}</dd>
      <dt>TP2 (approx.)</dt><dd>{price(plan.tp2)}</dd>
      <dt>R:R to TP1 / TP2</dt><dd>1:{plan.rr1?.toFixed(2)} / 1:{plan.rr2?.toFixed(2)} before costs</dd>
    </dl>}
    {plan.confidence != null && <p><strong>Evidence confidence: {plan.confidence}/10</strong> — not a win probability.</p>}
    {plan.evidence && <details className="shot-checks"><summary>Confirmation checklist</summary><ul>{Object.entries(plan.evidence).map(([key,value]) => <li key={key}>{({structure:"Trend / structure",vwap:"Session VWAP",ema:"9/21 EMA",volume:"Volume",momentum:"Momentum",closedCandle:"Closed candle",retest:"Retest",openingRange:"Opening range",timeframes:"Required timeframes"})[key]}: {value}</li>)}</ul></details>}
    {plan.confirmation && <p style={{margin:0}}><strong>Entry confirmation: </strong>{plan.confirmation}</p>}
    {plan.invalidation && <p style={{margin:0}}><strong>Invalidation: </strong>{plan.invalidation}</p>}
    <p style={{margin:0}}><strong>TSL rule: </strong>{plan.trailingRule}</p>
    {plan.limitations?.length>0 && <ul>{plan.limitations.map((text,i)=><li key={i}>{text}</li>)}</ul>}
    <p className="rule">Approximate analysis of an uploaded snapshot, not a live quote or guaranteed best entry. No orders or trailing stops are executed or tracked.</p>
  </section>;
}
