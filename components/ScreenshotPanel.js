"use client";
import { useEffect, useRef, useState } from "react";
import { CHECK_FIELDS, NUMBER_FIELDS, SELECT_FIELDS, reviewScreenshot } from "@/lib/screenshot-review.mjs";

export default function ScreenshotPanel() {
  const [file,setFile]=useState(null), [preview,setPreview]=useState(null), [error,setError]=useState("");
  const [input,setInput]=useState({symbol:"XAUUSD",direction:"",volumeType:""}), [report,setReport]=useState(null);
  const fileInput=useRef(null);
  const update=(key,value)=>{setInput(old=>({...old,[key]:value}));setReport(null);};
  const take=file=>{
    if(!file)return;
    if(!["image/png","image/jpeg","image/webp"].includes(file.type)){setError("Choose a PNG, JPG or WebP screenshot.");return;}
    if(file.size>10*1024*1024){setError("Choose an image smaller than 10 MB.");return;}
    setFile(file);setPreview(URL.createObjectURL(file));setError("");setReport(null);
    // Observations belong to a specific screenshot and must never survive replacement.
    setInput(old=>({symbol:old.symbol || "XAUUSD",direction:"",volumeType:""}));
  };
  const takeRef=useRef(take);takeRef.current=take;
  useEffect(()=>()=>{if(preview)URL.revokeObjectURL(preview);},[preview]);
  useEffect(()=>{
    const paste=event=>{const item=[...(event.clipboardData?.items||[])].find(item=>item.type.startsWith("image/"));if(item){event.preventDefault();takeRef.current(item.getAsFile());}};
    document.addEventListener("paste",paste);return()=>document.removeEventListener("paste",paste);
  },[]);
  const remove=()=>{setFile(null);setPreview(null);setReport(null);setInput(old=>({symbol:old.symbol || "XAUUSD",direction:"",volumeType:""}));if(fileInput.current)fileInput.current.value="";};
  const textField=(key,label,placeholder="")=><div className="field" key={key}><label htmlFor={`review-${key}`}>{label}</label><input id={`review-${key}`} value={input[key]||""} maxLength={160} placeholder={placeholder} onChange={event=>update(key,event.target.value)}/></div>;
  const numericFields=(keys)=>NUMBER_FIELDS.filter(([key])=>keys.includes(key)).map(([key,label])=><div className="field" key={key}><label htmlFor={`review-${key}`}>{label}</label><input id={`review-${key}`} type="number" min="0" step="any" value={input[key]??""} onChange={event=>update(key,event.target.value)}/></div>);
  return <div className="grid screenshot-review">
    <div className="col"><section className="panel">
      <div className="panel-head"><div><div className="eyebrow">No AI · no market feed</div><div className="ptitle">Screenshot technical review</div></div>{file&&<button className="btn" onClick={remove}>Remove screenshot</button>}</div>
      <div className="review-intro"><p>Upload your chart as a reference, then enter its values and completed-candle observations. All seven techniques run together using fixed rules.</p><p className="rule">The app does not read pixels or detect indicators automatically. Blank or unconfirmed inputs produce NO TRADE. Your image stays in this browser; no AI request is sent.</p></div>
      <label className="drop" htmlFor="review-file" onDragOver={event=>event.preventDefault()} onDrop={event=>{event.preventDefault();take(event.dataTransfer.files[0]);}}>{preview?<img src={preview} alt="Your chart reference; values are entered manually below"/>:<div><strong>Upload or paste your screenshot</strong><p>PNG, JPG or WebP, up to 10 MB. Include 1m, 5m and 15m views where possible.</p></div>}</label>
      <input hidden ref={fileInput} id="review-file" type="file" accept="image/png,image/jpeg,image/webp" onChange={event=>{take(event.target.files[0]);event.target.value="";}}/>
      {error&&<p className="err review-intro" role="alert">{error}</p>}
      <form onSubmit={event=>{event.preventDefault();setReport(reviewScreenshot(input,!!file));}}>
        <div className="review-fields">
          {textField("symbol","Instrument","XAUUSD")}{textField("snapshot","Screenshot date and time","Date and time displayed on chart")}
          {textField("timezone","Chart timezone","Asia/Kolkata")}{textField("session","VWAP session and date","Exact session and date used by VWAP")}
          <div className="field"><label htmlFor="review-direction">Proposed trade direction</label><select id="review-direction" value={input.direction} onChange={event=>update("direction",event.target.value)}><option value="">Not selected</option><option value="long">BUY</option><option value="short">SELL</option></select></div>
          <div className="field"><label htmlFor="review-volumeType">Volume source</label><select id="review-volumeType" value={input.volumeType} onChange={event=>update("volumeType",event.target.value)}><option value="">Unknown / unavailable</option><option value="tick">Broker tick volume</option><option value="traded">Traded volume</option></select></div>
        </div>
        <details open className="review-group"><summary>1. Structure, zones and price action</summary><div className="review-fields">
          {numericFields(["price","supportLow","supportHigh","resistanceLow","resistanceHigh"])}
          {SELECT_FIELDS.map(([key,label])=><div className="field" key={key}><label htmlFor={`review-${key}`}>{label}</label><select id={`review-${key}`} value={input[key]||""} onChange={event=>update(key,event.target.value)}><option value="">Not observed / unknown</option><option value="long">Bullish / BUY</option><option value="short">Bearish / SELL</option><option value="mixed">Conflicting / mixed</option></select></div>)}
        </div></details>
        <details className="review-group"><summary>2. VWAP, EMA and volume (5m)</summary><div className="review-fields">{numericFields(["vwap","ema9","ema21","volume","averageVolume"])}</div></details>
        <details className="review-group"><summary>3. Momentum inputs (1m)</summary><div className="review-fields">{numericFields(["price1","vwap1","ema9_1","ema21_1","rsi","volume1","averageVolume1"])}</div></details>
        <details className="review-group"><summary>4. First 15-minute opening range</summary><div className="review-fields">{textField("openingInterval","Session date and exact first 15-minute interval","Specify start/end in chart timezone")}{numericFields(["openingHigh","openingLow"])}</div></details>
        <details open className="review-group"><summary>5. Your proposed levels and confirmation</summary><div className="review-fields">{numericFields(["entry","stop","tp1","tp2"])}</div><div className="review-checks">{CHECK_FIELDS.map(([key,label])=><label key={key}><input type="checkbox" checked={input[key]===true} onChange={event=>update(key,event.target.checked)}/><span>{label}</span></label>)}</div></details>
        <div className="review-intro"><details><summary>Fixed-rule thresholds</summary><p className="rule">Directional trend agreement; completed BOS/CHoCH; volume at least 1.5× the previous 20-bar average; BUY price &gt; EMA9 &gt; EMA21 and VWAP (reverse for SELL); 1m RSI 55–70 for BUY or 30–45 for SELL; TP1 R:R at least 2:1 before costs. Breakouts require a completed close beyond the entered outer boundary and a held retest. Reversals require an entered rejection and completed CHoCH, with 5m/15m trend agreement. Overall BUY/SELL requires all six scanners and the validator to pass.</p></details><button className="btn primary" type="submit" disabled={!file}>Review all seven techniques</button></div>
      </form>
    </section></div>
    <div className="col"><section className="panel"><div className="panel-head"><div><div className="eyebrow">Rules-based results</div><div className="ptitle">All seven techniques</div></div></div><div className="report" aria-live="polite">
      {!report?<div className="empty"><p>Upload a screenshot and enter your observations. No prices or confirmations will be inferred from the image.</p><p>Every edit clears the previous result. Replacing the screenshot clears its observations.</p></div>:<>
        <div className="sec"><h3>Overall: {report.overall}</h3><p>{input.symbol} · {input.snapshot || "Snapshot time missing"} · {input.timezone || "Timezone missing"}</p><p className="rule">Based only on your manual inputs. {input.volumeType==="tick"?"Volume uses broker tick activity, not centralized gold volume.":input.volumeType==="traded"?"Volume source marked as traded volume by you.":"Volume source is unverified."} No live monitoring or automatic image interpretation.</p></div>
        {report.zones&&<div className="sec"><h4>Your entered zones</h4><p>Support: {report.zones.support.join(" – ")}<br/>Resistance: {report.zones.resistance.join(" – ")}</p><p className="rule">Potential sell-side liquidity below support and buy-side liquidity above resistance are hypotheses, not visible resting orders.</p></div>}
        {report.results.map((result,index)=><section className="sec" key={result.id}><div className="sec-h"><h4>{index+1}. {result.name}</h4><span className="tag">{result.verdict}</span></div><p>{result.reason}</p>
          {result.confidence!==null&&<p>Checklist completeness: {result.confidence}/10. This is not a win probability or independently verified confidence.</p>}
          {result.plan&&<dl className="kv"><dt>Your entry</dt><dd>{result.plan.entry}</dd><dt>Your SL</dt><dd>{result.plan.stop}</dd><dt>Your TP1 / TP2</dt><dd>{result.plan.tp1} / {result.plan.tp2}</dd><dt>R:R to TP1 / TP2</dt><dd>1:{result.plan.rr1.toFixed(2)} / 1:{result.plan.rr2.toFixed(2)}</dd></dl>}
          <p>{result.invalidation}</p><details><summary>Confirmation checks</summary><ul>{result.checks.map(([label,ok])=><li key={label}>{ok?"Pass":"Missing / fails"}: {label}</li>)}</ul></details>
        </section>)}
      </>}
    </div></section></div>
  </div>;
}
