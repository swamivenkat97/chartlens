import { analyze } from "./analysis.js";

export const TECHNIQUES = ["Market structure", "VWAP + 9/21 EMA", "Momentum scalper", "Breakout scanner", "Opening range", "Reversal scanner", "Automatic trade validator"];
const MINUTE=60000;
const last=a=>a.at(-1);
export function aggregateMinutes(rows,minutes){
  const groups=new Map();
  for(const row of rows){const key=Math.floor(row.t/(minutes*MINUTE))*minutes*MINUTE;if(!groups.has(key))groups.set(key,[]);groups.get(key).push(row);}
  return [...groups.entries()].filter(([start,bars])=>bars.length===minutes&&bars.every((bar,i)=>bar.t===start+i*MINUTE)).map(([t,bars])=>({t,o:bars[0].o,h:Math.max(...bars.map(b=>b.h)),l:Math.min(...bars.map(b=>b.l)),c:last(bars).c,v:bars.every(b=>typeof b.v==="number"&&Number.isFinite(b.v)&&b.v>=0)?bars.reduce((sum,b)=>sum+b.v,0):null}));
}
function ema(rows,period){let value=rows[0].c;for(const row of rows.slice(1))value+=2/(period+1)*(row.c-value);return rows.length>=period?value:null;}
function rsi(rows){let gain=0,loss=0;for(let i=1;i<rows.length;i++){const delta=rows[i].c-rows[i-1].c;if(i<=14){gain+=Math.max(delta,0);loss+=Math.max(-delta,0);if(i===14){gain/=14;loss/=14;}}else{gain=(gain*13+Math.max(delta,0))/14;loss=(loss*13+Math.max(-delta,0))/14;}}return rows.length<15?null:gain===0&&loss===0?50:loss===0?100:100-100/(1+gain/loss);}
const validVolume=rows=>rows.length>0&&rows.every(row=>typeof row.v==="number"&&Number.isFinite(row.v)&&row.v>=0)&&rows.some(row=>row.v>0);
const volumeRatio=rows=>validVolume(rows.slice(-21))&&rows.length>=21&&rows.slice(-21,-1).reduce((s,b)=>s+b.v,0)>0?last(rows).v/(rows.slice(-21,-1).reduce((s,b)=>s+b.v,0)/20):null;
export function heldRetest(rows,level,dir,tolerance,after=-Infinity){
  if(!Number.isFinite(level)||rows.length<3)return false;
  const end=rows.length-1, bar=last(rows);
  for(let i=Math.max(1,end-3);i<end;i++){
    const crossed=dir===1?rows[i-1].c<=level&&rows[i].c>level:rows[i-1].c>=level&&rows[i].c<level;
    if(rows[i].t<after||!crossed)continue;
    const holds=rows.slice(i+1).every(b=>dir===1?b.c>level:b.c<level);
    const touched=dir===1?bar.l<=level+tolerance&&bar.l>=level-tolerance:bar.h>=level-tolerance&&bar.h<=level+tolerance;
    if(holds&&touched&&(dir===1?bar.c>bar.o:bar.c<bar.o))return true;
  }
  return false;
}
export function unavailable(reason,state="unavailable"){
  return {state,overall:"NO TRADE",reason,asOf:null,source:null,metrics:null,levels:[],results:TECHNIQUES.map((name,index)=>({name,verdict:index===6?"WAIT":"NO TRADE",reason,checks:[],plan:null,confidence:null}))};
}
export function automaticTechnical(rows,{now=Date.now(),source="",symbol="XAUUSD"}={}){
  if(!["twelvedata","binance"].includes(source))return unavailable("A real market feed is required. Demo or unknown data cannot generate signals.");
  if(!Array.isArray(rows)||!rows.length)return unavailable("No candles received.");
  if(rows.some(b=>![b.t,b.o,b.h,b.l,b.c].every(Number.isFinite)||b.t%MINUTE!==0||b.l<=0||b.l>Math.min(b.o,b.c)||b.h<Math.max(b.o,b.c)||b.h<b.l))return unavailable("The feed returned invalid candle data.");
  const sorted=[...rows].sort((a,b)=>a.t-b.t);
  if(sorted.some((b,i)=>i&&b.t===sorted[i-1].t))return unavailable("Duplicate candle timestamps; analysis paused.");
  const one=sorted.filter(b=>b.t+MINUTE<=now);
  if(!one.length||now-(last(one).t+MINUTE)>120000)return unavailable("Feed is stale, delayed beyond two minutes, or the market is closed. No trade.","stale");
  if(one.slice(-60).some((b,i,a)=>i&&b.t-a[i-1].t!==MINUTE))return unavailable("Recent one-minute candles have gaps; no trade.");
  const five=aggregateMinutes(one,5),fifteen=aggregateMinutes(one,15);
  if(five.length<60||fifteen.length<60)return unavailable("Insufficient complete history: at least 60 closed 15m candles are required.");
  if(now-(last(five).t+5*MINUTE)>7*MINUTE||now-(last(fifteen).t+15*MINUTE)>17*MINUTE)return unavailable("Higher-timeframe candles are stale or incomplete.","stale");
  // The established indicator engine expects numeric volume; missing volume stays
  // unavailable for signal checks, and is zero only inside price-only structure analysis.
  const structure=bars=>analyze(bars.map(b=>({...b,v:typeof b.v==="number"&&Number.isFinite(b.v)&&b.v>=0?b.v:0})),{src:source,tf:"5m",mkt:symbol==="XAUUSD"?"forex":"crypto"});
  const a5=structure(five),a15=structure(fifteen),day=Math.floor(now/86400000)*86400000;
  const session=one.filter(b=>b.t>=day),completeSession=session.length>0&&session[0].t===day&&session.every((b,i)=>b.t===day+i*MINUTE);
  const totalVolume=validVolume(session)?session.reduce((s,b)=>s+b.v,0):0;
  const vwap=completeSession&&totalVolume>0?session.reduce((s,b)=>s+(b.h+b.l+b.c)/3*b.v,0)/totalVolume:null;
  const open=session.filter(b=>b.t<day+15*MINUTE),openingComplete=completeSession&&open.length===15&&now>=day+15*MINUTE;
  const openingHigh=openingComplete?Math.max(...open.map(b=>b.h)):null,openingLow=openingComplete?Math.min(...open.map(b=>b.l)):null;
  const m={price:last(one).c,close5:last(five).c,ema9:ema(five,9),ema21:ema(five,21),ema9_1:ema(one,9),ema21_1:ema(one,21),rsi:rsi(one),vwap,volumeRatio:volumeRatio(five),volumeRatio1:volumeRatio(one),atr:a5.m.atr,trend5:a5.m.structure,trend15:a15.m.structure,openingHigh,openingLow,session:"00:00 UTC daily anchor (opening range 00:00–00:15 UTC)"};
  const event=last(a5.smc.events),choch=a5.smc.events.filter(e=>e.type==="CHoCH").at(-1),sweep=a5.sweeps.at(-1);
  const check=(label,pass)=>[label,pass===true];
  const levels=[...a5.m.support.map(l=>({type:"Support",price:l.p})),...a5.m.resistance.map(l=>({type:"Resistance",price:l.p}))];
  const candidates=[1,-1].map(dir=>{
    const up=dir===1,bias=up?"up":"down",side=up?"BUY":"SELL";
    const trend=[check("5m and 15m swing trends agree",a5.m.sBias===bias&&a15.m.sBias===bias)];
    const recentEvent=event&&event.dir===dir&&five.length-1-event.i<=3;
    const em=check("5m price / EMA9 / EMA21 alignment",up?m.close5>m.ema9&&m.ema9>m.ema21:m.close5<m.ema9&&m.ema9<m.ema21);
    const vw=check("Complete UTC-session VWAP agrees",vwap!==null&&(up?m.price>vwap:m.price<vwap));
    const vol=check("Closed 5m volume at least 1.5× prior 20 bars",m.volumeRatio!==null&&m.volumeRatio>=1.5);
    const momentum=[check("1m price / EMA9 / EMA21 alignment",up?m.price>m.ema9_1&&m.ema9_1>m.ema21_1:m.price<m.ema9_1&&m.ema9_1<m.ema21_1),check("1m RSI directional band",up?m.rsi>=55&&m.rsi<=70:m.rsi>=30&&m.rsi<=45),check("1m volume at least 1.5× prior 20 bars",m.volumeRatio1!==null&&m.volumeRatio1>=1.5)];
    const entry=m.price,stop=up?Math.min(...five.slice(-3).map(b=>b.l))-m.atr*.1:Math.max(...five.slice(-3).map(b=>b.h))+m.atr*.1,risk=Math.abs(entry-stop);
    const obstacle=levels.filter(l=>up?l.price>entry:l.price<entry).sort((a,b)=>Math.abs(a.price-entry)-Math.abs(b.price-entry))[0];
    const riskChecks=[check("Positive ATR and directional stop",Number.isFinite(m.atr)&&m.atr>0&&stop>0&&(up?stop<entry:stop>entry)),check("Nearest known opposing level leaves at least 2R",!obstacle||Math.abs(obstacle.price-entry)>=2*risk),check("Latest 1m price remains within 0.25 ATR of the 5m close",Math.abs(entry-m.close5)<=m.atr*.25)];
    const plan={direction:side,entry,stop,tp1:entry+dir*2*risk,tp2:entry+dir*3*risk,rr1:2,rr2:3,invalidation:`${up?"Below":"Above"} ${stop.toFixed(5)}; any missing confirmation or stale feed cancels the setup.`};
    riskChecks.push(check("Positive ordered targets",up?stop<entry&&entry<plan.tp1&&plan.tp1<plan.tp2:0<plan.tp2&&plan.tp2<plan.tp1&&plan.tp1<entry&&entry<stop));
    const reversal=check("Recent sweep followed by directional CHoCH",!!(sweep&&choch&&sweep.side===(up?"low":"high")&&choch.dir===dir&&choch.i>=sweep.i&&five.length-1-choch.i<=3));
    const groups=[
      [...trend,check("Recent completed BOS/CHoCH",!!recentEvent)],
      [...trend,em,vw,vol],
      [...trend,em,vw,vol,...momentum],
      [...trend,vol,check("Breakout and later held retest",!!(recentEvent&&heldRetest(five,event.p,dir,m.atr*.1)))],
      [...trend,vw,vol,check("Complete first 15 minutes of UTC session",openingComplete),check("Opening breakout and later held retest",openingComplete&&heldRetest(five,up?openingHigh:openingLow,dir,m.atr*.1,day+15*MINUTE))],
      [...trend,vol,...momentum,reversal],
    ];
    return groups.map((checks,i)=>{
      const all=[...checks,...riskChecks],passed=all.every(([,pass])=>pass);
      return {name:TECHNIQUES[i],verdict:passed?side:"NO TRADE",checks:all,reason:passed?"All fixed-rule confirmations passed on completed candles.":all.filter(([,pass])=>!pass).map(([label])=>label).join("; "),plan:passed?plan:null,confidence:i===2?Math.max(1,Math.round(10*all.filter(([,ok])=>ok).length/all.length)):null};
    });
  });
  const results=TECHNIQUES.slice(0,6).map((_,i)=>candidates.map(c=>c[i]).sort((a,b)=>Number(!!b.plan)-Number(!!a.plan)||b.checks.filter(([,p])=>p).length-a.checks.filter(([,p])=>p).length)[0]);
  const active=results.filter(r=>r.plan),directions=new Set(active.map(r=>r.verdict));
  const strongest=active.sort((a,b)=>b.checks.length-a.checks.length)[0];
  const validator=strongest?candidates[strongest.verdict==="BUY"?0:1][2]:null;
  const overall=directions.size===1&&strongest&&validator?.plan?strongest.verdict:"NO TRADE";
  results.push({name:TECHNIQUES[6],verdict:overall==="NO TRADE"?"WAIT":"APPROVE",reason:overall==="NO TRADE"?"No setup passes strategy, trend, VWAP, EMA, volume, momentum and risk checks together.":`Validated automatically generated ${strongest.name.toLowerCase()} setup; not an order execution.`,checks:validator?.checks||[],plan:overall==="NO TRADE"?null:strongest.plan,confidence:null});
  return {state:"connected",overall,reason:overall==="NO TRADE"?"Wait for complete confirmation.":"A rules-based setup is confirmed on the latest completed candles.",source,symbol,asOf:new Date(last(one).t+MINUTE).toISOString(),metrics:m,levels,results};
}
