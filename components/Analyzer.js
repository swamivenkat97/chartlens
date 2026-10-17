"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { MARKETS, TIMEFRAMES } from "@/lib/instruments";
import { setupScore, analyze, anchorIndex, anchoredVWAP, computePlan, parseCSV, RANGE } from "@/lib/analysis";
import { buildCards } from "@/lib/cards";
import { buildContext } from "@/lib/context";
import { makeFmt, makeFmtTime, pct } from "@/lib/format";
import Chart from "./Chart";
import TradingViewChart from "./TradingViewChart";
import LiveScore from "./LiveScore";
import Report, { Pill, Spinner } from "./Report";
import TradePlan from "./TradePlan";
import ScreenshotPanel from "./ScreenshotPanel";
import Logo from "./Logo";

const OVERLAYS = [
  ["smc", "SMC", "--ob"], ["fvg", "FVG", "--up"], ["sweeps", "Sweeps", "--down"], ["fib", "Fibonacci", "--fib"], ["amd", "AMD", "--warn"],
  ["vp", "Volume profile", "--vp-va"], ["avwap", "Anchored VWAP", "--vwap"], ["ema", "EMAs", "--ema50"], ["levels", "S/R levels", "--muted"],
];
const ANCHORS = { rangeLow: "Range low", rangeHigh: "Range high", swingLow: "Last swing low", swingHigh: "Last swing high", maxVol: "Highest-volume bar", pick: "Chosen candle" };
const WS_URL = "wss://stream.binance.com:9443/ws/";

/* Loads candles for the chosen instrument and keeps them current:
   Binance pairs stream over a browser WebSocket; Twelve Data markets poll; demo data is static. */
function useCandles(market, symbol, tf, csv) {
  const [state, setState] = useState({ candles: [], source: "loading", note: null, live: false, error: null });
  const buf = useRef([]);
  useEffect(() => {
    if (csv) { setState({ candles: csv.rows, source: "csv", note: null, live: false, error: null }); return; }
    let alive = true, ws = null, poll = null, flush = null, retry = null, dirty = false;
    setState((s) => ({ ...s, source: "loading", error: null }));
    const load = async () => {
      try {
        const r = await fetch(`/api/candles?${new URLSearchParams({ market, symbol, tf })}`);
        const j = await r.json(); if (!r.ok) throw new Error(j.error);
        if (!alive) return;
        buf.current = j.candles;
        setState({ candles: j.candles, source: j.source, note: j.note, live: j.live, error: null });
        return j;
      } catch (e) { if (alive) setState((s) => ({ ...s, source: s.candles.length ? s.source : "error", error: "Couldn't load candles. Check your connection." })); }
    };
    const connect = (stream) => {
      ws = new WebSocket(WS_URL + stream);
      ws.onmessage = (ev) => {
        const k = JSON.parse(ev.data)?.k; if (!k) return;
        const bar = { t: k.t, o: +k.o, h: +k.h, l: +k.l, c: +k.c, v: +k.v }, b = buf.current;
        if (!b.length) return;
        if (b.at(-1).t === bar.t) b[b.length - 1] = bar; else if (bar.t > b.at(-1).t) { b.push(bar); if (b.length > 600) b.shift(); } else return;
        dirty = true;
      };
      ws.onclose = () => { if (alive) retry = setTimeout(() => connect(stream), 3000); };
      // Re-render at most once a second so analysis stays cheap.
      clearInterval(flush);
      flush = setInterval(() => { if (alive && dirty) { dirty = false; setState((s) => ({ ...s, candles: [...buf.current] })); } }, 1000);
    };
    load().then((j) => {
      if (!alive || !j) return;
      if (j.stream) connect(j.stream);
      else if (j.poll) poll = setInterval(load, j.poll * 1000);
    });
    return () => { alive = false; clearInterval(poll); clearInterval(flush); clearTimeout(retry); if (ws) { ws.onclose = null; ws.close(); } };
  }, [market, symbol, tf, csv]);
  return state;
}

export default function Analyzer() {
  const [mode, setMode] = useState("ticker");
  const [market, setMarket] = useState("crypto");
  const [symbol, setSymbol] = useState(MARKETS.crypto.symbols[0].s);
  const [tf, setTf] = useState("4H");
  const [csv, setCsv] = useState(null);
  const [ov, setOv] = useState({ smc: true, fvg: true, sweeps: true, fib: false, amd: false, vp: true, avwap: false, ema: false, levels: false });
  const [pane, setPane] = useState("rsi");
  const [anchor, setAnchor] = useState({ mode: "rangeLow", t: null });
  const [picking, setPicking] = useState(false);
  const [planOpts, setPlanOpts] = useState({ side: "off", entry: null, targets: "levels", r1: 1.5, r2: 3, k: 3, capital: 100000, riskPct: 1 });
  const [ai, setAi] = useState({ busy: false, report: null, error: null, key: null });
  const [csvOpen, setCsvOpen] = useState(false);

  const sym = csv ? { s: csv.name, n: "Your data", d: csv.d } : MARKETS[market].symbols.find((x) => x.s === symbol);
  const feed = useCandles(market, symbol, tf, csv);
  const data = feed.candles;
  const src = feed.source;

  const fmt = useMemo(() => makeFmt(sym.d), [sym.d]);
  const fmtTime = useMemo(() => makeFmtTime(data, tf, src), [data, tf, src]);
  const base = useMemo(() => (data.length >= 30 ? analyze(data, { src, tf, mkt: market }) : null), [data, src, tf, market]);

  // Anchored VWAP is kept by candle time so a live feed adding bars doesn't move the anchor.
  const { ind, vw } = useMemo(() => {
    if (!base) return { ind: null, vw: null };
    if (!base.hasVol) return { ind: { ...base, m: { ...base.m, avwap: null } }, vw: null };
    const pickIdx = anchor.mode === "pick" && anchor.t ? data.findIndex((b) => b.t === anchor.t) : null;
    const a = anchorIndex(data, base.sw, anchor.mode === "pick" && pickIdx < 0 ? "rangeLow" : anchor.mode, pickIdx >= 0 ? pickIdx : null);
    const v = anchoredVWAP(data, a), L = data.length - 1, m = base.m, val = v.v[L], sd = v.sd[L], c = m.close;
    const avwap = { anchor: ANCHORS[anchor.mode], anchorTime: data[a].t, barsSince: L - a, value: val, sd, distATR: (c - val) / m.atr,
      zone: c > val + 2 * sd ? "above +2σ" : c > val + sd ? "between +1σ and +2σ" : c >= val - sd ? "within ±1σ" : c >= val - 2 * sd ? "between −1σ and −2σ" : "below −2σ" };
    return { ind: { ...base, m: { ...m, avwap } }, vw: v };
  }, [base, anchor, data]);

  const plan = useMemo(() => {
    if (!ind) return null;
    const entry = planOpts.entry == null || planOpts.entry === "" ? null : parseFloat(planOpts.entry);
    return computePlan(data, ind, { ...planOpts, entry: isFinite(entry) && entry > 0 ? entry : null }, fmt);
  }, [ind, planOpts, data, fmt]);

  const setup = useMemo(() => (ind ? setupScore(ind, fmt) : null), [ind, fmt]);
  const cards = useMemo(() => (ind ? buildCards(ind.m, { fmt, fmtTime }) : []), [ind, fmt, fmtTime]);
  const context = useMemo(() => (ind ? buildContext({ data, ind, sym, market, tf, src, plan }) : null), [ind, data, sym, market, tf, src, plan]);

  // A new instrument or timeframe resets the report and a hand-typed entry.
  const key = `${csv ? csv.name : symbol}|${tf}`;
  useEffect(() => { setAi({ busy: false, report: null, error: null, key }); setPlanOpts((o) => ({ ...o, entry: null })); setPicking(false); setAnchor((a) => (a.mode === "pick" ? { mode: "rangeLow", t: null } : a)); }, [key]);

  const runAI = async () => {
    if (!context || ai.busy) return;
    setAi((s) => ({ ...s, busy: true, error: null }));
    try {
      const r = await fetch("/api/analyze", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ context }) });
      const j = await r.json(); if (!r.ok) throw new Error(j.error);
      setAi({ busy: false, report: j.report, error: null, key, context });
    } catch (e) { setAi((s) => ({ ...s, busy: false, error: e.message || "Couldn't reach the AI. Try again." })); }
  };

  const chooseMarket = (k) => { setCsv(null); setMarket(k); setSymbol(MARKETS[k].symbols[0].s); };
  const onPick = useCallback((i) => { setAnchor({ mode: "pick", t: data[i]?.t ?? null }); setPicking(false); setOv((o) => ({ ...o, avwap: true })); }, [data]);

  const m = ind?.m;
  const last = data.at(-1);
  const srcTag = src === "binance" ? "Live · Binance" : src === "twelvedata" ? "Live · Twelve Data (1 min refresh)" : src === "csv" ? `Your data · ${data.length} bars` : src === "demo" ? "Demo data" : src === "loading" ? "Loading…" : "Offline";

  return (
    <div className="app-shell">
      <div className="wrap">
        <header className="top">
          <Link href="/" className="brand" style={{ textDecoration: "none" }}>
            <Logo />
            <div><h1>ChartLens</h1><small>Crypto · Forex · Gold · NSE</small></div>
          </Link>
          <div className="modes" role="group" aria-label="Analysis mode">
            <button aria-pressed={mode === "ticker"} onClick={() => setMode("ticker")}>Ticker analysis</button>
            <button aria-pressed={mode === "shot"} onClick={() => setMode("shot")}>Screenshot analysis</button>
          </div>
        </header>

        {mode === "shot" ? <ScreenshotPanel /> : (
          <>
            <div className="rail">
              <div className="field"><label>Market</label>
                <div className="seg">{Object.entries(MARKETS).map(([k, v]) => <button key={k} aria-pressed={!csv && k === market} onClick={() => chooseMarket(k)}>{v.label}</button>)}</div>
              </div>
              <div className="field"><label htmlFor="sym">Instrument</label>
                <select id="sym" value={csv ? "" : symbol} onChange={(e) => { setCsv(null); setSymbol(e.target.value); }}>
                  {csv && <option value="">{csv.name}</option>}
                  {MARKETS[market].symbols.map((s) => <option key={s.s} value={s.s}>{s.s} · {s.n}</option>)}
                </select>
              </div>
              <div className="field"><label>Timeframe</label>
                <div className="seg">{Object.keys(TIMEFRAMES).map((k) => <button key={k} aria-pressed={k === tf} disabled={!!csv} onClick={() => setTf(k)}>{k}</button>)}</div>
              </div>
              <div className="spacer" />
              <button className="btn" onClick={() => setCsvOpen(true)}>Load your OHLC data</button>
            </div>

            <div className="grid">
              <div className="col">
                <div className="panel">
                  <div className="panel-head">
                    <div className="quote">
                      <h2>{sym.s}</h2>
                      <span className="px">{last ? fmt(last.c) : "—"}</span>
                      {m && <span className={`chg num ${m.change >= 0 ? "up" : "down"}`}>{pct(m.change)}</span>}
                    </div>
                    <span className={`tag${src === "demo" ? " demo" : ""}`}>{srcTag}</span>
                  </div>
                  {(feed.note || feed.error) && <p className="rule" style={{ padding: "8px 14px 0", margin: 0 }}>{feed.error || feed.note}</p>}
                  {csv && <div className="tools">
                    <div className="grp" role="group" aria-label="Chart overlays">
                      <span className="eyebrow">Overlays</span>
                      {OVERLAYS.map(([k, label, col]) => (
                        <button key={k} className="chip" aria-pressed={ov[k]} onClick={() => setOv((o) => ({ ...o, [k]: !o[k] }))}><i style={{ background: `var(${col})` }} />{label}</button>
                      ))}
                    </div>
                    <div className="grp">
                      <label className="eyebrow" htmlFor="anchor">VWAP anchor</label>
                      <select id="anchor" value={picking ? "pick" : anchor.mode} onChange={(e) => {
                        const v = e.target.value; setOv((o) => ({ ...o, avwap: true }));
                        if (v === "pick") setPicking(true); else { setPicking(false); setAnchor({ mode: v, t: null }); }
                      }}>
                        {Object.entries(ANCHORS).map(([k, l]) => <option key={k} value={k}>{k === "pick" ? "Pick a candle…" : l}</option>)}
                      </select>
                      {picking && <span className="hint">Click a candle to anchor</span>}
                    </div>
                    <div className="grp" role="group" aria-label="Lower pane">
                      <span className="eyebrow">Lower pane</span>
                      <div className="seg">{[["rsi", "RSI"], ["flow", "Order flow"]].map(([k, l]) => <button key={k} aria-pressed={pane === k} onClick={() => setPane(k)}>{l}</button>)}</div>
                    </div>
                  </div>}
                  {csv ? (ind ? (
                    <Chart data={data} ind={ind} vw={vw} ov={ov} pane={pane} plan={plan} fmt={fmt} fmtTime={fmtTime} picking={picking} onPick={onPick} />
                  ) : (
                    <div className="chart-box" style={{ display: "grid", placeItems: "center" }}>{src === "error" ? <p className="err">{feed.error}</p> : <Spinner>Loading candles…</Spinner>}</div>
                  )) : <TradingViewChart market={market} symbol={symbol} timeframe={tf} />}
                  {csv && ind && <Legend ov={ov} ind={ind} pane={pane} hasVW={!!vw} />}
                </div>
                <LiveScore setup={setup} source={src} />
                <div className="cards">
                  {cards.map((c, ix) => (
                    <div key={c.h} className={`panel card${cards.length % 2 && ix === cards.length - 1 ? " wide" : ""}`}>
                      <div className="card-top"><h3>{c.h}</h3><Pill tone={c.b}>{c.t}</Pill></div>
                      <dl className="kv">{c.kv.map(([k, v], i) => <FragmentKV key={i} k={k} v={v} />)}</dl>
                      <p className="note">{c.note}</p>
                    </div>
                  ))}
                </div>
              </div>

              <div className="col">
                <TradePlan opts={planOpts} setOpts={setPlanOpts} plan={plan} fmt={fmt} dec={sym.d} />
                <div className="panel">
                  <div className="panel-head">
                    <div><div className="eyebrow">AI review</div><div className="ptitle">Structured report</div></div>
                    <button className="btn primary" onClick={runAI} disabled={!context || ai.busy}>{ai.report ? "Regenerate report" : "Generate AI report"}</button>
                  </div>
                  <div className="report">
                    {ai.busy ? <Spinner>Reading the chart and writing the report…</Spinner>
                      : ai.report ? <Report report={ai.report} context={ai.context} />
                      : (
                        <div className="empty">
                          <span>The cards are computed from the candles. The AI report explains them in plain language:</span>
                          <ul><li>A summary and how clear the picture is</li><li>SMC, AMD, structure, momentum, liquidity, order flow, volume and risk</li><li>Key levels and what would confirm or cancel the reading</li><li>A review of your trade plan, if one is on</li></ul>
                        </div>
                      )}
                    {ai.error && <p className="err">{ai.error}</p>}
                  </div>
                </div>
              </div>
            </div>
          </>
        )}

        <footer className="disc">
          <strong>Educational use only.</strong> ChartLens describes market structure, smart money concepts, order flow, liquidity and risk to help you learn to read charts.
          It does not give investment advice or recommendations and is not registered with SEBI or any regulator. Trade plans are calculated mechanically from rules you choose; they are not signals to trade.
          Order flow is estimated from candle data. Demo series are synthetic. Markets carry risk; decisions are yours.
        </footer>
      </div>
      {csvOpen && <CsvDialog onClose={() => setCsvOpen(false)} onLoad={(c) => { setCsv(c); setCsvOpen(false); }} />}
    </div>
  );
}

function FragmentKV({ k, v }) { return <><dt>{k}</dt><dd>{v}</dd></>; }

function Legend({ ov, ind, pane, hasVW }) {
  const it = [];
  if (ov.smc) it.push(<span key="smc"><i style={{ background: "var(--up)" }} />BOS (solid) · CHoCH (dashed)</span>, <span key="ob"><i style={{ background: "var(--ob)", height: 8, opacity: 0.6 }} />Order blocks</span>);
  if (ov.fvg) it.push(<span key="fvg"><i style={{ background: "var(--up)", height: 8, opacity: 0.4 }} />Open FVG (faint = filled)</span>);
  if (ov.fib) it.push(<span key="fib"><i style={{ background: "var(--fib)" }} />Fibonacci · shaded OTE 0.618–0.786</span>);
  if (ov.amd && ind.amd.length) it.push(<span key="amd"><i style={{ background: "var(--warn)" }} />AMD: A accumulation · M manipulation · D distribution</span>);
  if (ov.ema) it.push(<span key="ema"><i style={{ background: "var(--ema20)" }} />EMA 20 · 50 · 200</span>);
  if (ov.levels) it.push(<span key="lv"><i style={{ height: 0, borderTop: "1.5px dashed var(--muted)" }} />S / R levels (×touches)</span>);
  if (ov.sweeps) it.push(<span key="sw"><i style={{ background: "var(--down)", width: 8, height: 8, borderRadius: 2 }} />Sweep marker</span>);
  if (ov.avwap && hasVW) it.push(<span key="vw"><i style={{ background: "var(--vwap)" }} />AVWAP ±1σ ±2σ</span>);
  if (ov.vp && ind.vp) it.push(<span key="vp"><i style={{ background: "var(--vp-va)", height: 8 }} />Value area · POC in accent</span>);
  it.push(<span key="pane">Lower pane: {pane === "rsi" ? "RSI 14" : "estimated delta + cumulative delta"}</span>);
  if (!ind.hasVol) it.push(<span key="nv" className="err">No volume in this feed: AVWAP, profile and order flow are off</span>);
  return <div className="legend">{it}</div>;
}

function CsvDialog({ onClose, onLoad }) {
  const ref = useRef(null);
  const [text, setText] = useState(""), [name, setName] = useState("My instrument"), [err, setErr] = useState("");
  useEffect(() => { ref.current?.showModal(); }, []);
  const load = () => {
    try {
      const rows = parseCSV(text), c = rows.at(-1).c;
      onLoad({ rows, name: name.trim() || "My instrument", d: c < 5 ? 5 : c < 200 ? 3 : 2 });
    } catch (e) { setErr(e.message); }
  };
  return (
    <dialog ref={ref} onClose={onClose}>
      <h3>Load your OHLC data</h3>
      <p>Paste or upload a CSV exported from TradingView, Kite, Binance or MT5. Columns: date, open, high, low, close, volume (volume optional). Needs at least 30 rows.</p>
      <textarea id="csvText" value={text} onChange={(e) => setText(e.target.value)} placeholder={"date,open,high,low,close,volume\n2026-10-01,25010,25120,24950,25080,182340\n..."} />
      <div className="field" style={{ marginTop: 8 }}>
        <label htmlFor="csvName">Instrument name</label>
        <input type="text" id="csvName" value={name} onChange={(e) => setName(e.target.value)} style={{ border: "1px solid var(--line)", background: "var(--surface-2)", borderRadius: 8, padding: "7px 10px" }} />
      </div>
      <div className="err">{err}</div>
      <div className="row">
        <label className="btn" htmlFor="csvFile" style={{ marginRight: "auto" }}>Choose CSV file</label>
        <input type="file" id="csvFile" accept=".csv,text/csv,text/plain" hidden onChange={async (e) => {
          const f = e.target.files[0]; if (!f) return; setText(await f.text()); if (name === "My instrument") setName(f.name.replace(/\.[^.]+$/, ""));
        }} />
        <button className="btn" onClick={() => ref.current?.close()}>Cancel</button>
        <button className="btn primary" onClick={load}>Load and analyze</button>
      </div>
    </dialog>
  );
}



