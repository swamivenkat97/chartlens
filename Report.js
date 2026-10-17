"use client";
import { useState } from "react";

const NAMES = { structure: "Structure", smc: "Smart money concepts", amd: "AMD · Power of 3", momentum: "Momentum", liquidity: "Liquidity", orderflow: "Order flow", volume: "Volume profile & AVWAP", risk: "Risk" };
const TONE = { bullish: "up", bearish: "down", neutral: "flat", mixed: "warn" };

export function Pill({ tone, children }) { return <span className={`pill ${tone}`}>{children}</span>; }

export function Spinner({ children }) { return <div className="status"><span className="dot" />{children}</div>; }

export default function Report({ report, context }) {
  if (!report || typeof report !== "object") return <p className="err">The report was empty. Try again.</p>;
  const clarity = Math.max(0, Math.min(100, +report.clarity || 0));
  const secs = report.sections || {};
  const bias = String(report.bias || "neutral");
  return (
    <>
      <div className="bias">
        <Pill tone={TONE[bias] || "flat"}>{bias.charAt(0).toUpperCase() + bias.slice(1)} read</Pill>
        <span className="eyebrow">Clarity {clarity}</span>
        <div className="meter" aria-hidden="true"><span style={{ width: `${clarity}%` }} /></div>
      </div>
      <p className="summary">{report.summary}</p>
      {Object.entries(NAMES).map(([k, name]) => {
        const s = secs[k]; if (!s || !(s.points || []).length) return null;
        return (
          <div className="sec" key={k}>
            <div className="sec-h"><h4>{name}</h4><span className="tag">{s.stance}</span></div>
            <ul>{s.points.map((p, i) => <li key={i}>{p}</li>)}</ul>
          </div>
        );
      })}
      {Array.isArray(report.levels) && report.levels.length > 0 && (
        <div className="sec"><h4>Key levels</h4>
          <table className="lv"><tbody>{report.levels.map((l, i) => <tr key={i}><td className="l">{l.label}</td><td>{l.why}</td><td className="p">{l.price}</td></tr>)}</tbody></table>
        </div>
      )}
      {Array.isArray(report.scenarios) && report.scenarios.length > 0 && (
        <div className="sec"><h4>Scenarios to watch</h4>
          <div className="scen">{report.scenarios.map((s, i) => <div key={i}><b>{s.name}</b>{s.confirms}<div className="inv">Cancelled if: {s.invalidates}</div></div>)}</div>
        </div>
      )}
      {Array.isArray(report.lessons) && report.lessons.length > 0 && (
        <div className="sec"><h4>Learn from this chart</h4><ul>{report.lessons.map((p, i) => <li key={i}>{p}</li>)}</ul></div>
      )}
      {context && <Ask context={context} report={report} />}
    </>
  );
}

function Ask({ context, report }) {
  const [q, setQ] = useState(""), [turns, setTurns] = useState([]), [busy, setBusy] = useState(false), [err, setErr] = useState(null);
  const send = async () => {
    const question = q.trim(); if (!question || busy) return;
    const next = [...turns, { role: "user", content: question }];
    setTurns(next); setQ(""); setBusy(true); setErr(null);
    try {
      const r = await fetch("/api/ask", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ context, report, turns: next }) });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error);
      setTurns([...next, { role: "assistant", content: j.answer }]);
    } catch (e) { setErr(e.message || "Couldn't reach the AI. Try again."); setTurns(turns); setQ(question); }
    finally { setBusy(false); }
  };
  const pairs = [];
  for (let i = 0; i < turns.length; i += 2) pairs.push([turns[i], turns[i + 1]]);
  return (
    <div>
      <div className="ask">
        <input id="askQ" type="text" value={q} maxLength={300} placeholder="Ask about this chart, e.g. why does this order block matter?"
          onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => e.key === "Enter" && send()} />
        <button className="btn" onClick={send} disabled={busy}>Ask</button>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 8 }}>
        {busy && <Spinner>Thinking…</Spinner>}
        {err && <p className="err">{err}</p>}
        {pairs.reverse().map(([u, a], i) => <div className="answer" key={i}><b>{u.content}</b>{"\n"}{a?.content}</div>)}
      </div>
    </div>
  );
}
