"use client";
import { useEffect,useState } from "react";
export default function AutomaticTechnical(){
  const [symbol,setSymbol]=useState("XAUUSD"),[report,setReport]=useState(null),[busy,setBusy]=useState(false),[error,setError]=useState(""),[refresh,setRefresh]=useState(0);
  const [clock,setClock]=useState(Date.now());
  useEffect(()=>{const timer=setInterval(()=>setClock(Date.now()),15000);return()=>clearInterval(timer);},[]);
  useEffect(()=>{
    let alive=true,controller=null,sequence=0;setReport(null);setError("");
    const load=async()=>{
      const request=++sequence;controller?.abort();controller=new AbortController();setBusy(true);
      try{
        const response=await fetch(`/api/technical?symbol=${encodeURIComponent(symbol)}`,{cache:"no-store",signal:controller.signal});
        const data=await response.json();if(!response.ok)throw new Error(data.error||"Market feed request failed.");
        if(alive&&request===sequence){setReport(data);setError("");setClock(Date.now());}
      }catch(err){if(alive&&request===sequence&&err.name!=="AbortError"){setError("Unable to refresh the feed. Previous signals are cleared; NO TRADE.");setReport(null);}}
      finally{if(alive&&request===sequence)setBusy(false);}
    };
    load();const timer=setInterval(load,60000);
    const visible=()=>{if(document.visibilityState==="visible"){setClock(Date.now());load();}};
    document.addEventListener("visibilitychange",visible);
    return()=>{alive=false;controller?.abort();clearInterval(timer);document.removeEventListener("visibilitychange",visible);};
  },[symbol,refresh]);
  const price=value=>typeof value==="number"&&Number.isFinite(value)?value.toLocaleString("en-US",{maximumFractionDigits:5}):"Unavailable";
  const stale=report?.asOf&&clock-Date.parse(report.asOf)>180000;
  const plan=!stale?report?.results?.[6]?.plan:null;
  return <div className="panel"><div className="panel-head"><div><div className="eyebrow">Automatic market data · no AI</div><div className="ptitle">Seven-technique trade scanner</div></div><div className="shot-ctl" style={{padding:0}}><select aria-label="Instrument" value={symbol} onChange={e=>{setReport(null);setSymbol(e.target.value);}}><option value="XAUUSD">XAUUSD · Gold / USD</option><option value="BTCUSDT">BTCUSDT · Binance spot</option><option value="ETHUSDT">ETHUSDT · Binance spot</option></select><button className="btn" disabled={busy} onClick={()=>setRefresh(n=>n+1)}>Refresh</button></div></div>
    <div className="report" aria-live="polite"><p>No screenshot or manual entry, SL or indicator values are required. The scanner derives 1m, 5m and 15m candles, calculates indicators, and validates generated setups.</p>
      <section className="sec"><h3>{busy?"Refreshing · WAIT":stale?"NO TRADE":report?.overall||"NO TRADE"}</h3><p>{stale?"Displayed data is stale. Refresh the feed; previous signals are invalid.":error||report?.reason||"Connecting to market data…"}</p>{report?.asOf&&<p>Last completed 1m candle: {report.asOf} · Source: {report.source}</p>}
      {plan&&!busy&&!error&&<dl className="kv"><dt>Direction</dt><dd>{plan.direction}</dd><dt>Reference entry</dt><dd>{price(plan.entry)}</dd><dt>SL</dt><dd>{price(plan.stop)}</dd><dt>TP1 / TP2</dt><dd>{price(plan.tp1)} / {price(plan.tp2)}</dd><dt>R:R before costs</dt><dd>1:2 / 1:3</dd><dt>Invalidation</dt><dd>{plan.invalidation}</dd></dl>}
      <p className="rule">Refreshes every 60 seconds. Setups use completed candles, not executable bid/ask quotes. No orders or stops are placed. A stale feed or missing confirmation means NO TRADE.</p></section>
      {report?.metrics&&<section className="sec"><h4>Calculated readings</h4><dl className="kv">{[["Latest completed close",report.metrics.price],["5m EMA9 / EMA21",`${price(report.metrics.ema9)} / ${price(report.metrics.ema21)}`],["Session VWAP",report.metrics.vwap],["1m RSI14",report.metrics.rsi],["5m relative volume",report.metrics.volumeRatio],["1m relative volume",report.metrics.volumeRatio1]].map(([label,value])=><div key={label}><dt>{label}</dt><dd>{typeof value==="string"?value:price(value)}</dd></div>)}</dl><p>{report.metrics.trend5} (5m)<br/>{report.metrics.trend15} (15m)</p><p className="rule">{report.metrics.session}. VWAP is unavailable unless the entire session anchor is loaded with actual volume. Missing volume is never estimated. Targets are fixed risk multiples, not price forecasts.</p></section>}
      {report?.levels?.length>0&&<section className="sec"><h4>Support, resistance and potential liquidity</h4><ul>{report.levels.map((level,i)=><li key={i}>{level.type}: {price(level.price)}</li>)}</ul><p className="rule">Potential liquidity beyond swing levels is inferred; resting orders are not observed.</p></section>}
      {!busy&&!stale&&report?.results?.map((result,i)=><section key={result.name} className="sec"><div className="sec-h"><h4>{i+1}. {result.name}</h4><span className="tag">{result.verdict}</span></div><p>{result.reason}</p>{result.confidence!=null&&<p>Rule agreement: {result.confidence}/10, not a win probability.</p>}{result.plan&&<p className="rule">Strategy checks passed; use the overall validator above for the final decision.</p>}<details><summary>Calculated checks</summary><ul>{result.checks.map(([label,passed])=><li key={label}>{passed?"Pass":"Missing / fails"}: {label}</li>)}</ul></details></section>)}
    </div></div>;
}
