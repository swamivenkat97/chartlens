"use client";
import {useEffect,useRef,useState} from "react";
export default function ScreenshotLiveAnalysis(){
  const [preview,setPreview]=useState(null),[symbol,setSymbol]=useState("XAUUSD"),[report,setReport]=useState(null),[error,setError]=useState(""),[busy,setBusy]=useState(false),[refresh,setRefresh]=useState(0),[clock,setClock]=useState(Date.now());
  const input=useRef(null);
  const take=file=>{if(!file)return;if(!["image/png","image/jpeg","image/webp"].includes(file.type)||file.size>10*1024*1024){setError("Choose a PNG, JPG or WebP under 10 MB.");return;}setPreview(URL.createObjectURL(file));setReport(null);setError("");};
  const takeRef=useRef(take);takeRef.current=take;
  useEffect(()=>()=>{if(preview)URL.revokeObjectURL(preview);},[preview]);
  useEffect(()=>{const paste=event=>{const item=[...(event.clipboardData?.items||[])].find(item=>item.type.startsWith("image/"));if(item){event.preventDefault();takeRef.current(item.getAsFile());}};document.addEventListener("paste",paste);const timer=setInterval(()=>setClock(Date.now()),15000);return()=>{document.removeEventListener("paste",paste);clearInterval(timer);};},[]);
  useEffect(()=>{
    if(!preview){setBusy(false);return;}
    let alive=true,controller=null,sequence=0;
    const load=async()=>{const request=++sequence;controller?.abort();controller=new AbortController();setBusy(true);
      try{const response=await fetch(`/api/hierarchy?symbol=${encodeURIComponent(symbol)}`,{cache:"no-store",signal:controller.signal});const data=await response.json();if(!response.ok)throw new Error();if(alive&&sequence===request){setReport(data);setError("");setClock(Date.now());}}
      catch(e){if(alive&&sequence===request&&e.name!=="AbortError"){setReport(null);setError("Feed refresh failed. Previous signals cleared; NO TRADE.");}}
      finally{if(alive&&sequence===request)setBusy(false);}
    };load();const timer=setInterval(load,60000);const visible=()=>{if(document.visibilityState==="visible"){setClock(Date.now());load();}};document.addEventListener("visibilitychange",visible);
    return()=>{alive=false;controller?.abort();clearInterval(timer);document.removeEventListener("visibilitychange",visible);};
  },[preview,symbol,refresh]);
  const stale=report?.asOf&&clock-Date.parse(report.asOf)>420000,plan=!busy&&!stale&&!error?report?.plan:null;
  const price=value=>typeof value==="number"?value.toLocaleString("en-US",{maximumFractionDigits:5}):"Unavailable";
  return <div className="grid"><div className="col"><section className="panel"><div className="panel-head"><div><div className="eyebrow">Chart reference + live market analysis</div><div className="ptitle">Upload your chart</div></div>{preview&&<button className="btn" onClick={()=>{setPreview(null);setReport(null);setError("");}}>Remove image</button>}</div>
    <div className="review-intro"><p>Upload a 5m chart reference. The app automatically fetches 4H, 1H, 15m and 5m market candles for the selected instrument.</p><p className="rule"><strong>No AI image reading:</strong> the screenshot stays in your browser. Signals use current live-feed candles, not the prices, indicators or historical time shown in the image. Select the matching instrument below.</p><div className="field"><label htmlFor="hierarchy-symbol">Instrument shown in your screenshot</label><select id="hierarchy-symbol" value={symbol} onChange={e=>{setReport(null);setSymbol(e.target.value);}}><option value="XAUUSD">XAUUSD · Gold / USD</option><option value="BTCUSD">BTCUSD · Bitcoin / USD</option></select></div></div>
    <label className="drop" htmlFor="hierarchy-file" onDragOver={e=>e.preventDefault()} onDrop={e=>{e.preventDefault();take(e.dataTransfer.files[0]);}}>{preview?<img src={preview} alt="Uploaded chart reference, not automatically interpreted"/>:<div><strong>Drop, select or paste a chart screenshot</strong><p>PNG, JPG or WebP · up to 10 MB</p></div>}</label><input hidden id="hierarchy-file" ref={input} type="file" accept="image/png,image/jpeg,image/webp" onChange={e=>{take(e.target.files[0]);e.target.value="";}}/>
    <div className="review-intro"><button className="btn primary" disabled={!preview||busy} onClick={()=>setRefresh(n=>n+1)}>{busy?"Checking four timeframes…":"Refresh live analysis"}</button>{error&&<p className="err" role="alert">{error}</p>}<p className="rule">Reference entries before spread/slippage. No broker orders or stop updates are executed. Refreshes every 60 seconds while this view is open.</p></div>
  </section></div><div className="col"><section className="panel"><div className="panel-head"><div><div className="eyebrow">4H direction → 1H structure → 15m setup → 5m entry</div><div className="ptitle">{busy?"WAIT":stale?"NO TRADE":report?.overall||"Waiting for chart upload"}</div></div></div><div className="report" aria-live="polite">
    <p>{stale?"Data is stale; previous signals are invalid.":error||report?.reason||"Upload a reference chart to start the live-feed checks. No manual entry, SL or target values are required."}</p>
    {report?.asOf&&<p className="rule">Last completed 5m close: {report.asOf} · {report.source} · {symbol}</p>}
    {plan&&<section className="sec"><h3>{plan.direction} · all confirmation checks passed</h3><dl className="kv"><dt>Reference entry</dt><dd>{price(plan.entry)}</dd><dt>SL</dt><dd>{price(plan.stop)}</dd><dt>TP1 / TP2</dt><dd>{price(plan.tp1)} / {price(plan.tp2)}</dd><dt>R:R before costs</dt><dd>1:2 / 1:3</dd></dl><p><strong>Invalidation:</strong> {plan.invalidation}</p><p><strong>TSL rule:</strong> {plan.tsl}</p></section>}
    {!busy&&!stale&&report?.stages?.map(stage=><section className="sec" key={stage.timeframe}><div className="sec-h"><h4>{stage.timeframe} · {stage.role}</h4><span className="tag">{stage.status}</span></div><p>{stage.reason}</p>{stage.closedAt&&<p className="rule">Last completed candle: {stage.closedAt}</p>}</section>)}
    {!busy&&!stale&&report?.levels?.length>0&&<section className="sec"><h4>Structure levels</h4><ul>{report.levels.map((level,i)=><li key={i}>{level.type}: {price(level.price)}</li>)}</ul><p className="rule">Liquidity beyond swing levels is inferred, not observed orders.</p></section>}
    {!busy&&!stale&&report?.results?.map(result=><section className="sec" key={result.name}><div className="sec-h"><h4>{result.name}</h4><span className="tag">{result.verdict}</span></div><p>{result.reason}</p><details><summary>Rule checks</summary><ul>{result.checks.map(([label,passed])=><li key={label}>{passed?"Pass":"Missing / fails"}: {label}</li>)}</ul></details></section>)}
    <p className="rule">VWAP and the optional opening-range scanner use a stated UTC 00:00 daily anchor. Missing feed volume is never estimated. Targets are 2R/3R risk multiples, not forecasts. TSL is a conditional instruction, not an active or guaranteed stop.</p>
  </div></section></div></div>;
}
