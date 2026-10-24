import test from "node:test";
import assert from "node:assert/strict";
import {analyzeHierarchy,FRAME_MS} from "../lib/hierarchy-analysis.mjs";
const now=Date.UTC(2026,9,23,16);
const fixture=()=>Object.fromEntries(Object.entries(FRAME_MS).map(([tf,ms])=>[tf,Array.from({length:300},(_,i)=>{
  const c=4000+i*.02+Math.sin(i/8+1.2)*3+(tf==="5m"?(i%2?.3:-.3):0);
  return {t:Math.floor(now/ms)*ms-(300-i)*ms,o:c-(i===299?.6:.02),h:c+.1,l:c-(i===299?.7:.3),c,v:i===299?3000:100};
})]));
const evaluate=frames=>analyzeHierarchy(frames,{now,source:"twelvedata"});
const mirror=bars=>bars.map(b=>({...b,o:10000-b.o,h:10000-b.l,l:10000-b.h,c:10000-b.c}));
test("aligned hierarchy produces automatic BUY and SELL with SL/TP/conditional TSL",()=>{
  const bullish=fixture(),bearish=Object.fromEntries(Object.entries(bullish).map(([tf,bars])=>[tf,mirror(bars)]));
  for(const [frames,side] of [[bullish,"BUY"],[bearish,"SELL"]]){
    const result=evaluate(frames);assert.equal(result.overall,side);assert.equal(result.results[6].verdict,"APPROVE");assert.ok(result.plan);
    const p=result.plan;assert.ok(Math.abs(Math.abs(p.tp1-p.entry)/Math.abs(p.entry-p.stop)-2)<1e-8);
    assert.match(p.tsl,/After TP1/);assert.match(p.tsl,/Never widen/);assert.match(p.tsl,/not an active stop/);
    assert.deepEqual(result.stages.map(s=>s.timeframe),["4H","1H","15m","5m"]);
  }
});
test("conflicting 4H direction or 1H structure blocks the 5m entry",()=>{
  for(const tf of ["4H","1H"]){const frames=fixture();frames[tf]=mirror(frames[tf]);const result=evaluate(frames);assert.equal(result.overall,"NO TRADE");assert.equal(result.plan,null);}
});
test("a screenshot cannot substitute for any missing timeframe",()=>{
  for(const tf of Object.keys(FRAME_MS)){const frames=fixture();delete frames[tf];const result=evaluate(frames);assert.equal(result.overall,"NO TRADE");assert.equal(result.plan,null);}
});
test("missing volume is not estimated for VWAP or confirmation",()=>{
  const frames=fixture();frames["5m"]=frames["5m"].map(b=>({...b,v:null}));const result=evaluate(frames);
  assert.equal(result.overall,"NO TRADE");assert.equal(result.metrics.vwap,null);assert.equal(result.plan,null);
});
test("incomplete candles are excluded from every timeframe",()=>{
  const frames=fixture(),before=evaluate(frames);
  for(const [tf,ms] of Object.entries(FRAME_MS)){frames[tf].push({...frames[tf].at(-1),t:Math.floor(now/ms)*ms,c:8000,h:8001});}
  const after=evaluate(frames);assert.equal(after.overall,before.overall);assert.deepEqual(after.plan,before.plan);
  assert.ok(after.stages.every(stage=>Date.parse(stage.closedAt)<=now));
});
test("stale data, duplicates, malformed OHLC and recent gaps fail closed",()=>{
  for(const kind of ["stale","duplicate","invalid","gap"]){const frames=fixture();
    if(kind==="stale")frames["5m"]=frames["5m"].slice(0,-3);
    if(kind==="duplicate")frames["1H"].push(frames["1H"][0]);
    if(kind==="invalid")frames["15m"][0].c=NaN;
    if(kind==="gap")frames["4H"].splice(-2,1);
    const result=evaluate(frames);assert.equal(result.overall,"NO TRADE");assert.equal(result.plan,null);
  }
});
test("demo data cannot create an actionable hierarchy",()=>{
  const result=analyzeHierarchy(fixture(),{now,source:"demo"});assert.equal(result.overall,"NO TRADE");assert.equal(result.plan,null);
});
test("partial-session history cannot invent a session VWAP",()=>{
  const frames=fixture();frames["5m"]=frames["5m"].filter(b=>b.t!==Date.UTC(2026,9,23));
  const result=evaluate(frames);assert.equal(result.metrics.vwap,null);assert.equal(result.overall,"NO TRADE");
});
