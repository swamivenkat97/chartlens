"use client";

const FACTORS = ["Market structure", "SMC break", "Trend (EMAs)", "Momentum", "Order flow", "Liquidity sweep", "Premium / discount", "Volume & VWAP", "AMD session"];

export default function LiveScore({ setup, source }) {
  if (!setup) return null;
  const bull = Math.max(0, Math.min(100, setup.bull));
  const bear = 100 - bull;
  const bias = setup.net >= 20 ? "Bullish bias" : setup.net <= -20 ? "Bearish bias" : "Mixed evidence";
  const tone = setup.net >= 20 ? "up" : setup.net <= -20 ? "down" : "flat";
  const number = (value) => `${value > 0 ? "+" : ""}${value.toFixed(1)}`;
  return (
    <section className="panel" aria-label="Live chart scoring">
      <div className="panel-head">
        <h3 style={{ margin: 0 }}>Chart score</h3>
        <span className={`pill ${tone}`}>{bias}</span>
      </div>
      <div className="report">
        {source === "demo" && <p className="hint" style={{ margin: 0 }}>Demo candles: these scores use synthetic data.</p>}
        <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
          <strong style={{ color: "var(--up)" }}>Bullish {bull}/100</strong>
          <strong style={{ color: "var(--down)" }}>Bearish {bear}/100</strong>
        </div>
        <div role="meter" aria-label="Bullish indicator agreement" aria-valuemin={0} aria-valuemax={100} aria-valuenow={bull}
          style={{ height: 12, borderRadius: 6, overflow: "hidden", background: "var(--down)" }}>
          <div style={{ height: "100%", width: `${bull}%`, background: "var(--up)" }} />
        </div>
        <p className="note" style={{ margin: 0 }}>Net evidence: {number(setup.net)} / 100. Scores measure weighted indicator agreement, not win probability. Bullish and bearish scores sum to 100; 50/50 means balanced evidence.</p>
        <details>
          <summary style={{ cursor: "pointer" }}>View scoring breakdown ({setup.total} available factors)</summary>
          <div style={{ overflowX: "auto" }}>
            <table className="lv" style={{ marginTop: 12 }}>
              <thead><tr><th scope="col" style={{ textAlign: "left" }}>Factor</th><th scope="col">Weight</th><th scope="col">Net points</th></tr></thead>
              <tbody>{FACTORS.map((name) => {
                const factor = setup.factors.find((item) => item.name === name);
                return <tr key={name}>
                  <td><strong>{name}</strong><div style={{ fontSize: 12, color: "var(--muted)" }}>{factor?.reading ?? "Unavailable; excluded from scoring"}</div></td>
                  <td className="p">{factor ? factor.weight : "—"}</td>
                  <td className="p" style={{ color: factor?.points > 0 ? "var(--up)" : factor?.points < 0 ? "var(--down)" : "var(--muted)" }}>{factor ? number(factor.points) : "—"}</td>
                </tr>;
              })}</tbody>
            </table>
          </div>
          <p style={{ fontSize: 12, color: "var(--muted)" }}>Positive points favour bullish evidence; negative points favour bearish evidence. Available weights are rescaled to 100. Structure and SMC have weight 15 each; other factors have weight 10 each. A net of +20 or −20 sets the bias label. Volume and order flow use candle-based estimates.</p>
        </details>
        {setup.cautions.length > 0 && <div className="sec"><strong>Conditions to watch</strong><ul>{setup.cautions.map((text) => <li key={text}>{text}</li>)}</ul></div>}
      </div>
    </section>
  );
}
