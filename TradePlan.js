"use client";

export default function TradePlan({ opts, setOpts, plan: P, fmt, dec }) {
  const set = (k) => (e) => setOpts((o) => ({ ...o, [k]: e.target.value }));
  const dist = (p) => { const x = ((p - P.E) / P.E) * 100; return (x > 0 ? "+" : "") + x.toFixed(2) + "%"; };
  const qty = P ? (P.qty >= 100 ? Math.floor(P.qty).toLocaleString("en-IN") : P.qty.toFixed(P.qty >= 1 ? 2 : 4)) : "";
  const Row = ({ n, col, p, rr, note }) => (
    <tr>
      <td><span className="sw" style={{ background: `var(${col})` }} />{n}<small>{note}</small></td>
      <td>{fmt(p)}</td><td>{dist(p)}</td><td>{rr}</td>
    </tr>
  );
  return (
    <div className="panel">
      <div className="panel-head">
        <div><div className="eyebrow">Trade plan</div><div className="ptitle">Entry, targets &amp; stops</div></div>
        <div className="seg" role="group" aria-label="Plan direction">
          {["off", "long", "short"].map((k) => (
            <button key={k} aria-pressed={opts.side === k} onClick={() => setOpts((o) => ({ ...o, side: k }))}>{k[0].toUpperCase() + k.slice(1)}</button>
          ))}
        </div>
      </div>
      <div className="plan">
        {!P ? (
          <p className="rule">Choose Long or Short to plot an entry, TP1, TP2, stop-loss and trailing stop on the chart. Levels come from fixed rules applied to this chart&apos;s structure, liquidity and ATR.</p>
        ) : (
          <>
            <div className="plan-form">
              <div className="field"><label htmlFor="pEntry">Entry</label>
                <input id="pEntry" type="number" step="any" inputMode="decimal" placeholder={P.E.toFixed(dec)} value={opts.entry ?? ""}
                  onChange={(e) => setOpts((o) => ({ ...o, entry: e.target.value === "" ? null : e.target.value }))} /></div>
              <div className="field"><label htmlFor="pTP">Targets from</label>
                <select id="pTP" value={opts.targets} onChange={set("targets")}><option value="levels">Key levels</option><option value="r">R multiples</option></select></div>
              <div className="field"><label htmlFor="pK">Trail (× ATR)</label><input id="pK" type="number" step="0.5" min="0.5" value={opts.k} onChange={set("k")} /></div>
              <div className="field"><label htmlFor="pR1">TP1 (R)</label><input id="pR1" type="number" step="0.5" min="0.5" value={opts.r1} onChange={set("r1")} /></div>
              <div className="field"><label htmlFor="pR2">TP2 (R)</label><input id="pR2" type="number" step="0.5" min="1" value={opts.r2} onChange={set("r2")} /></div>
              <div className="field"><label htmlFor="pRisk">Risk per trade %</label><input id="pRisk" type="number" step="0.25" min="0.1" value={opts.riskPct} onChange={set("riskPct")} /></div>
              <div className="field" style={{ gridColumn: "span 2" }}><label htmlFor="pCap">Capital (in quote currency)</label><input id="pCap" type="number" step="any" min="0" value={opts.capital} onChange={set("capital")} /></div>
              <div className="field" style={{ justifyContent: "flex-end" }}><button className="btn" onClick={() => setOpts((o) => ({ ...o, entry: null }))}>Entry = last price</button></div>
            </div>
            <table className="pt">
              <thead><tr><th>Level</th><th>Price</th><th>From entry</th><th>R:R</th></tr></thead>
              <tbody>
                <Row n="TP2" col="--up" p={P.TP2} rr={`1 : ${P.rr2.toFixed(2)}`} note={P.tp2Src} />
                <Row n="TP1" col="--up" p={P.TP1} rr={`1 : ${P.rr1.toFixed(2)}`} note={P.tp1Src} />
                <Row n="Entry" col="--fg" p={P.E} rr="—" note={`${P.entryNote} · ${P.long ? "long" : "short"}`} />
                <Row n="SL" col="--down" p={P.SL} rr="1R" note={P.slSrc} />
                <Row n="TSL" col="--warn" p={P.tslNow} rr="after TP1"
                  note={`Stop level once TP1 is hit: ${Math.abs(P.tslNow - P.E) < 1e-12 ? "breakeven (entry)" : `TP1 ${P.long ? "−" : "+"} ${P.k}×ATR`}, then trails`} />
              </tbody>
            </table>
            <div className="meta">
              <div><span className="eyebrow">Risk (1R)</span><b>{fmt(P.R)}</b></div>
              <div><span className="eyebrow">Amount at risk</span><b>{P.riskAmt.toLocaleString("en-IN", { maximumFractionDigits: 0 })}</b></div>
              <div><span className="eyebrow">Position size</span><b>{qty}</b></div>
            </div>
            <p className="rule">Trailing rule: the stop stays at SL until TP1 is reached, then moves to the TSL level. From there it follows price at {P.k} × ATR {P.long ? "below the highest high" : "above the lowest low"} since entry, only ever {P.long ? "rising" : "falling"}. Position size = {P.riskPct}% of capital ÷ 1R.</p>
          </>
        )}
      </div>
    </div>
  );
}
