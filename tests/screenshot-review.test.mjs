import test from "node:test";
import assert from "node:assert/strict";
import { reviewScreenshot } from "../lib/screenshot-review.mjs";
import { POST } from "../app/api/vision/route.js";
const confirmed={symbol:"XAUUSD",snapshot:"2026-10-17 09:00",session:"London 2026-10-17",timezone:"Asia/Kolkata",openingInterval:"12:30–12:45",direction:"long",volumeType:"tick",frames:true,frames1:true,closed:true,closed1:true,openingComplete:true,atZone:true,trend1:"long",trend5:"long",trend15:"long",breakDirection:"long",retest:"long",openingRetest:"long",rejection:"long",choch:"long",price:120,price1:120,supportLow:90,supportHigh:92,resistanceLow:110,resistanceHigh:112,vwap:115,ema9:118,ema21:116,vwap1:115,ema9_1:118,ema21_1:116,rsi:60,volume:150,averageVolume:100,volume1:150,averageVolume1:100,openingHigh:114,openingLow:108,entry:120,stop:110,tp1:140,tp2:150};
test("blank input never produces a trade or invented prices",()=>{
  const report=reviewScreenshot({},true);
  assert.equal(report.results.length,7);assert.equal(report.overall,"NO TRADE");
  assert.ok(report.results.every(result=>result.plan===null));
});
test("all confirmed observations pass all seven and calculate R:R",()=>{
  const report=reviewScreenshot(confirmed,true);
  assert.equal(report.overall,"BUY");assert.equal(report.results[6].verdict,"APPROVE");
  assert.ok(report.results.slice(0,6).every(result=>result.verdict==="BUY"));
  assert.equal(report.results[0].plan.rr1,2);assert.equal(report.results[0].plan.rr2,3);
});
test("confirmed sell mirrors direction and price ordering",()=>{
  const report=reviewScreenshot({...confirmed,direction:"short",trend1:"short",trend5:"short",trend15:"short",breakDirection:"short",retest:"short",openingRetest:"short",rejection:"short",choch:"short",price:80,price1:80,vwap:85,ema9:82,ema21:84,vwap1:85,ema9_1:82,ema21_1:84,rsi:40,entry:80,stop:90,tp1:60,tp2:50},true);
  assert.equal(report.overall,"SELL");assert.equal(report.results[6].verdict,"APPROVE");
});
test("no screenshot and incomplete candles block signals",()=>{
  assert.equal(reviewScreenshot(confirmed,false).overall,"NO TRADE");
  assert.ok(reviewScreenshot({...confirmed,closed:false},true).results.every(result=>result.plan===null));
});
test("missing volume source and insufficient volume block volume-based strategies",()=>{
  for(const changes of [{volumeType:""},{volume:149},{averageVolume:0}]){
    const report=reviewScreenshot({...confirmed,...changes},true);
    assert.equal(report.results[1].verdict,"NO TRADE");assert.equal(report.overall,"NO TRADE");
  }
});
test("a breakout wick, failed retest or incomplete opening range cannot pass",()=>{
  assert.equal(reviewScreenshot({...confirmed,price:111},true).results[3].verdict,"NO TRADE");
  assert.equal(reviewScreenshot({...confirmed,retest:"short"},true).results[3].verdict,"NO TRADE");
  for(const changes of [{openingComplete:false},{openingInterval:""},{openingHigh:108},{timezone:""}])assert.equal(reviewScreenshot({...confirmed,...changes},true).results[4].verdict,"NO TRADE");
});
test("RSI, EMA and reversal evidence cannot be replaced by a high score",()=>{
  for(const changes of [{rsi:85},{ema9_1:114},{closed1:false},{frames1:false}])assert.equal(reviewScreenshot({...confirmed,...changes},true).results[2].verdict,"NO TRADE");
  assert.equal(reviewScreenshot({...confirmed,atZone:false},true).results[5].verdict,"NO TRADE");
});
test("validator rejects conflicting trend and inadequate or invalid risk",()=>{
  for(const changes of [{trend15:"short"},{tp1:139},{stop:125},{entry:Infinity}]){
    const report=reviewScreenshot({...confirmed,...changes},true);
    assert.equal(report.overall,"NO TRADE");assert.equal(report.results[6].plan,null);
    if(changes.entry!==Infinity)assert.equal(report.results[6].verdict,"REJECT");
  }
});
test("invalid zones and numeric junk fail closed",()=>{
  for(const changes of [{supportLow:"junk"},{supportHigh:115},{resistanceLow:130},{supportLow:NaN}])assert.equal(reviewScreenshot({...confirmed,...changes},true).overall,"NO TRADE");
});
test("retired screenshot endpoint refuses AI analysis without provider setup",async()=>{
  const response=await POST();assert.equal(response.status,410);
  assert.match((await response.json()).error,/AI screenshot analysis has been removed/);
});
