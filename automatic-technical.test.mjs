import test from "node:test";
import assert from "node:assert/strict";
import {aggregateMinutes,automaticTechnical,heldRetest} from "../lib/automatic-technical.mjs";
const minute=60000, now=Date.UTC(2026,9,23,16);
const bars=Array.from({length:1000},(_,i)=>{
  const c=4000+i*.04+Math.sin(i/8)*3;
  return {t:now-(1000-i)*minute,o:c-.02,h:c+.3,l:c-.3,c,v:100+(i%5)};
});
const evaluate=(rows=bars,options={})=>automaticTechnical(rows,{now,source:"twelvedata",...options});
test("demo and unknown sources cannot generate signals",()=>{
  for(const source of ["demo","", "proxy"])assert.equal(evaluate(bars,{source}).overall,"NO TRADE");
});
test("aggregation requires every minute and preserves missing volume",()=>{
  const first=Date.UTC(2026,9,23);
  const rows=Array.from({length:5},(_,i)=>({t:first+i*minute,o:10,h:12,l:9,c:11,v:i===2?null:1}));
  assert.equal(aggregateMinutes(rows,5).length,1);assert.equal(aggregateMinutes(rows,5)[0].v,null);
  assert.equal(aggregateMinutes(rows.slice(1),5).length,0);
  assert.equal(aggregateMinutes([...rows,rows[0]],5).length,0);
});
test("stale data, duplicates, malformed candles and gaps fail closed",()=>{
  for(const rows of [bars.slice(0,-4),[...bars,bars[0]],bars.map((b,i)=>i===999?{...b,h:b.l-1}:b),bars.filter((_,i)=>i!==990)]){
    const result=evaluate(rows);assert.equal(result.overall,"NO TRADE");assert.ok(result.results.every(r=>r.plan===null));
  }
});
test("open candles are excluded and do not change calculated readings",()=>{
  const before=evaluate(),after=evaluate([...bars,{...bars.at(-1),t:now,c:6000,h:6001}]);
  assert.equal(before.metrics.price,after.metrics.price);assert.equal(before.asOf,after.asOf);
});
test("feed metrics use the correct 9/21 EMAs and complete UTC VWAP",()=>{
  const result=evaluate();assert.equal(result.state,"connected");assert.equal(result.results.length,7);
  const session=bars.filter(b=>b.t>=Date.UTC(2026,9,23));
  const vwap=session.reduce((s,b)=>s+(b.h+b.l+b.c)/3*b.v,0)/session.reduce((s,b)=>s+b.v,0);
  assert.ok(Math.abs(result.metrics.vwap-vwap)<1e-8);
  assert.ok(Number.isFinite(result.metrics.ema9));assert.notEqual(result.metrics.ema9,result.metrics.ema21);
});
test("missing volume cannot be fabricated into VWAP or an approved trade",()=>{
  const result=evaluate(bars.map(b=>({...b,v:null})));
  assert.equal(result.metrics.vwap,null);assert.equal(result.metrics.volumeRatio,null);
  assert.equal(result.overall,"NO TRADE");assert.equal(result.results[6].plan,null);
});
test("incomplete session does not calculate a partial-session VWAP",()=>{
  const result=evaluate(bars.filter(b=>b.t!==Date.UTC(2026,9,23)));
  assert.equal(result.metrics.vwap,null);assert.equal(result.results[4].verdict,"NO TRADE");
});
test("breakout requires a later retest, not just a wick or breakout candle",()=>{
  const make=(o,c,l,h)=>({o,c,l,h,t:0});
  const initial=[make(99,99,98,100),make(99,102,99,103)];
  assert.equal(heldRetest(initial,100,1,.2),false);
  assert.equal(heldRetest([...initial,make(100.1,101,100,102)],100,1,.2),true);
  assert.equal(heldRetest([...initial,make(101,99,98,102)],100,1,.2),false);
});
test("automatic BUY and SELL need no manual direction and generate ordered 2R/3R plans",()=>{
  const bullish=bars.map((bar,i)=>{const c=4000+i*.04+Math.sin(i/20+1)*3+(i%2?.3:-.3);return {...bar,o:c-.02,h:c+.3,l:c-.3,c,v:i===999?3000:i>994?1000:100};});
  const bearish=bullish.map(b=>({...b,o:10000-b.o,h:10000-b.l,l:10000-b.h,c:10000-b.c}));
  for(const [rows,expected] of [[bullish,"BUY"],[bearish,"SELL"]]){
  const report=evaluate(rows);assert.equal(report.overall,expected);assert.equal(report.results[6].verdict,"APPROVE");
  assert.ok(report.results[6].plan);
  for(const result of report.results){if(!result.plan)continue;const p=result.plan;
    assert.ok([p.entry,p.stop,p.tp1,p.tp2].every(v=>Number.isFinite(v)&&v>0));
    assert.ok(Math.abs(p.tp1-p.entry)/Math.abs(p.entry-p.stop)>=1.999999999);
    assert.ok(p.direction==="BUY"?p.stop<p.entry&&p.entry<p.tp1&&p.tp1<p.tp2:p.tp2<p.tp1&&p.tp1<p.entry&&p.entry<p.stop);
  }
  assert.equal(evaluate(rows.map(b=>({...b,v:null}))).overall,"NO TRADE");
  }
});
