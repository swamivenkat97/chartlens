import { analyze } from "./analysis.js";
export const FRAME_MS={"4H":14400000,"1H":3600000,"15m":900000,"5m":300000};
const last=values=>values.at(-1);
const names=["Market structure","VWAP + EMA","Momentum","Breakout / retest","Opening range","Reversal","Final trade validator"];
const numericVolume=bars=>bars.length>0&&bars.every(b=>typeof b.v==="number"&&Number.isFinite(b.v)&&b.v>=0)&&bars.some(b=>b.v>0);
function ema(bars,n){let e=bars[0].c;for(const b of bars.slice(1))e+=2/(n+1)*(b.c-e);return e;}
const relativeVolume=bars=>numericVolume(bars.slice(-21))&&bars.length>=21&&bars.slice(-21,-1).reduce((s,b)=>s+b.v,0)>0?last(bars).v/(bars.slice(-21,-1).reduce((s,b)=>s+b.v,0)/20):null;
const check=(label,passed)=>[label,passed===true];
export function hierarchyWait(reason,state="unavailable"){
  return {state,overall:"NO TRADE",reason,source:null,asOf:null,plan:null,stages:Object.keys(FRAME_MS).map((timeframe,i)=>({timeframe,role:["Direction","Structure","Setup","Entry"][i],status:"WAIT",reason,closedAt:null})),results:names.map(name=>({name,verdict:"NO TRADE",reason,checks:[]})),levels:[]};
}
export function analyzeHierarchy(frames,{now=Date.now(),source="",symbol="XAUUSD"}={}){
  if(!["twelvedata","binance"].includes(source))return hierarchyWait("A real, correctly identified market feed is required.");
  const closed={},ind={};
  for(const [tf,ms] of Object.entries(FRAME_MS)){
    const rows=frames?.[tf];
    if(!Array.isArray(rows)||rows.some(b=>![b.t,b.o,b.h,b.l,b.c].every(Number.isFinite)||b.t%60000!==0||b.l<=0||b.l>Math.min(b.o,b.c)||b.h<Math.max(b.o,b.c)))return hierarchyWait(`Invalid ${tf} candles; analysis paused.`);
    const sorted=[...rows].sort((a,b)=>a.t-b.t);
    if(sorted.some((b,i)=>i&&b.t===sorted[i-1].t))return hierarchyWait(`Duplicate ${tf} candles.`);
    closed[tf]=sorted.filter(b=>b.t+ms<=now);
    const bars=closed[tf];
    if(bars.length<60)return hierarchyWait(`At least 60 complete ${tf} candles are required.`);
    if(now-(last(bars).t+ms)>ms+120000)return hierarchyWait(`${tf} feed is stale or the market is closed.`,"stale");
    if(bars.slice(-5).some((b,i,a)=>i&&b.t-a[i-1].t!==ms))return hierarchyWait(`Recent ${tf} candles contain gaps.`);
    ind[tf]=analyze(bars.map(b=>({...b,v:typeof b.v==="number"&&Number.isFinite(b.v)&&b.v>=0?b.v:0})),{src:source,tf,mkt:symbol==="XAUUSD"?"forex":"crypto"});
  }
  const bars5=closed["5m"],bars15=closed["15m"],m5=ind["5m"].m,m15=ind["15m"].m;
  const bias=ind["4H"].m.sBias,dir=bias==="up"?1:bias==="down"?-1:0,up=dir===1;
  const side=dir===1?"BUY":dir===-1?"SELL":"NO TRADE";
  const bar=last(bars5),prev=bars5.at(-2),atr=m5.atr;
  const aligns=(fast,slow,price)=>dir!==0&&(up?price>fast&&fast>slow:price<fast&&fast<slow);
  const directionOK=dir!==0&&aligns(ema(closed["4H"],9),ema(closed["4H"],21),last(closed["4H"]).c);
  const structureOK=dir!==0&&ind["1H"].m.sBias===bias;
  const event=last(ind["15m"].smc.events),eventOK=!!(event&&event.dir===dir&&bars15.length-1-event.i<=3);
  const setupTrend=dir!==0&&m15.sBias===bias&&aligns(ema(bars15,9),ema(bars15,21),last(bars15).c);
  const entryEMA=aligns(ema(bars5,9),ema(bars5,21),bar.c);
  const day=Math.floor(now/86400000)*86400000,session=bars5.filter(b=>b.t>=day);
  const fullSession=session.length>0&&session[0].t===day&&session.every((b,i)=>b.t===day+i*300000);
  const vwap=fullSession&&numericVolume(session)?session.reduce((sum,b)=>sum+(b.h+b.l+b.c)/3*b.v,0)/session.reduce((sum,b)=>sum+b.v,0):null;
  const vwapOK=vwap!==null&&dir!==0&&(up?bar.c>vwap:bar.c<vwap),ratio=relativeVolume(bars5),volumeOK=ratio!==null&&ratio>=1.5;
  const momentumOK=dir!==0&&(up?m5.rsi>=55&&m5.rsi<=70:m5.rsi>=30&&m5.rsi<=45);
  const trigger=dir!==0&&(up?bar.c>prev.h&&bar.c>bar.o:bar.c<prev.l&&bar.c<bar.o)&&Math.abs(bar.c-bar.o)>=.6*(bar.h-bar.l)&&bar.h>bar.l;
  const retest=!!(eventOK&&bar.t>=bars15[event.i].t+900000&&(up?bar.l<=event.p+atr*.1&&bar.l>=event.p-atr*.1&&bar.c>event.p:bar.h>=event.p-atr*.1&&bar.h<=event.p+atr*.1&&bar.c<event.p));
  const sweep=ind["15m"].sweeps.at(-1),choch=ind["15m"].smc.events.filter(e=>e.type==="CHoCH").at(-1);
  const reversal=!!(dir&&sweep&&choch&&sweep.side===(up?"low":"high")&&choch.dir===dir&&choch.i>=sweep.i&&bars15.length-1-choch.i<=3);
  const entry=bar.c,stop=up?Math.min(...bars5.slice(-3).map(b=>b.l))-atr*.1:Math.max(...bars5.slice(-3).map(b=>b.h))+atr*.1,risk=Math.abs(entry-stop);
  const levels=[...ind["1H"].m.support.map(l=>({type:"1H support",price:l.p})),...ind["1H"].m.resistance.map(l=>({type:"1H resistance",price:l.p}))];
  const obstacle=levels.filter(l=>up?l.price>entry:l.price<entry).sort((a,b)=>Math.abs(a.price-entry)-Math.abs(b.price-entry))[0];
  const tp1=entry+dir*2*risk,tp2=entry+dir*3*risk;
  const riskOK=dir!==0&&Number.isFinite(atr)&&atr>0&&stop>0&&tp2>0&&(up?stop<entry:stop>entry)&&(!obstacle||Math.abs(obstacle.price-entry)>=2*risk);
  const base=[check("4H trend and 9/21 EMA direction",directionOK),check("1H swing structure agrees with 4H",structureOK),check("15m trend and EMA setup agree",setupTrend),check("15m completed BOS/CHoCH, held retest or sweep/CHoCH setup",eventOK||retest||reversal),check("5m completed entry trigger",trigger),check("5m 9/21 EMA alignment",entryEMA),check("UTC-session VWAP agrees",vwapOK),check("5m volume ≥ 1.5× previous 20 bars",volumeOK),check("5m RSI14 directional band",momentumOK),check("Directional SL and no known opposing 1H level within 2R",riskOK)];
  const approved=base.every(([,ok])=>ok),opening=session.slice(0,3),openingComplete=fullSession&&opening.length===3;
  const openingLevel=openingComplete?(up?Math.max(...opening.map(b=>b.h)):Math.min(...opening.map(b=>b.l))):null;
  // Opening confirmation requires a prior close outside the first-15m range,
  // followed by a later completed 5m retest holding the boundary.
  const openRetest=openingComplete&&dir!==0&&bar.t>=day+1200000&&(up?prev.c>openingLevel&&bar.l<=openingLevel+atr*.1&&bar.l>=openingLevel-atr*.1&&bar.c>openingLevel:prev.c<openingLevel&&bar.h>=openingLevel-atr*.1&&bar.h<=openingLevel+atr*.1&&bar.c<openingLevel);
  const groups=[base.slice(0,4),[...base.slice(0,3),base[5],base[6],base[7]],[...base.slice(0,3),base[5],base[7],base[8]],[...base.slice(0,2),check("15m break followed by completed 5m held retest",retest),base[7]],[base[0],base[1],check("Complete UTC 00:00–00:15 opening range",openingComplete),check("Opening breakout and subsequent held retest",openRetest),base[6],base[7]],[base[0],base[1],check("15m sweep followed by directional CHoCH",reversal),base[7],base[8]],base];
  const results=names.map((name,i)=>{const checks=groups[i],passed=checks.every(([,ok])=>ok);return {name,verdict:i===6?(approved?"APPROVE":"WAIT"):passed?side:"NO TRADE",reason:passed?"Fixed-rule checks passed on completed candles.":checks.filter(([,ok])=>!ok).map(([label])=>label).join("; "),checks};});
  const stages=Object.keys(FRAME_MS).map((tf,i)=>({timeframe:tf,role:["Direction","Structure","Setup","Entry"][i],status:[directionOK,structureOK,setupTrend&&(eventOK||retest||reversal),approved][i]?(i===3?side:"CONFIRMED"):"WAIT",reason:[ind["4H"].m.structure,ind["1H"].m.structure,`${m15.structure}; latest event: ${event?.type||"none"}`,approved?"Completed 5m trigger and all risk checks pass.":"Entry withheld until all confirmation checks pass."][i],closedAt:new Date(last(closed[tf]).t+FRAME_MS[tf]).toISOString()}));
  return {state:"connected",symbol,source,overall:approved?side:"NO TRADE",reason:approved?"All four timeframes and final confirmation checks agree.":"Wait: required timeframe, indicator, volume or risk confirmation is missing.",asOf:new Date(bar.t+300000).toISOString(),stages,results,levels,metrics:{rsi:m5.rsi,vwap,ema9:ema(bars5,9),ema21:ema(bars5,21),relativeVolume:ratio},plan:approved?{direction:side,entry,stop,tp1,tp2,rr1:2,rr2:3,invalidation:`${up?"Below":"Above"} SL ${stop.toFixed(5)}, or loss of timeframe agreement.`,tsl:`After TP1 is reached, consider moving SL to entry only if costs allow. Then trail behind each newly confirmed 5m ${up?"swing low":"swing high"}, using a 0.1 × current 5m ATR buffer. Never widen the stop. This is a conditional rule, not an active stop.`}:null};
}
