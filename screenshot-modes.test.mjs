import test from "node:test";
import assert from "node:assert/strict";
import { SCREENSHOT_MODES, cleanPlan } from "../lib/screenshot-modes.mjs";

const evidence = Object.fromEntries(["structure", "vwap", "ema", "volume", "momentum", "closedCandle", "retest", "openingRange", "timeframes"].map(key => [key, "confirmed"]));
const long = { direction:"long",verdict:"BUY",entryLow:100,entryHigh:101,stop:99,tp1:105,tp2:107,confirmation:"Completed close and held retest.",invalidation:"Close below 99.",evidence,confidence:8 };
test("all seven modes refuse missing timeframe evidence", () => {
  assert.equal(SCREENSHOT_MODES.length, 7);
  for (const mode of SCREENSHOT_MODES) assert.equal(cleanPlan({...long,evidence:{...evidence,timeframes:"missing"}},mode.id).direction,"wait");
});
test("breakout requires closed candle, volume and retest", () => {
  for (const key of ["closedCandle","volume","retest"]) {
    for (const state of ["missing","conflicting"]) {
      const plan=cleanPlan({...long,evidence:{...evidence,[key]:state}});
      assert.equal(plan.direction,"wait"); assert.equal(plan.entryLow,null);
    }
  }
});
test("confirmed long and short compute worst-entry reward/risk", () => {
  assert.equal(cleanPlan(long).rr1,2);
  const short=cleanPlan({...long,direction:"short",verdict:"SELL",entryLow:100,entryHigh:101,stop:102,tp1:96,tp2:94});
  assert.equal(short.verdict,"SELL"); assert.equal(short.rr1,2); assert.equal(short.rr2,3);
  assert.equal(cleanPlan({...long,tp1:104}).direction,"wait");
});
test("invalid prices and absent invalidation cannot produce a signal", () => {
  for (const change of [{stop:102},{tp2:104},{entryLow:NaN},{tp1:"105"},{invalidation:""}]) assert.equal(cleanPlan({...long,...change}).direction,"wait");
});
test("a WAIT or contradictory verdict cannot become a trade", () => {
  for (const verdict of ["WAIT", "SELL", "REJECT", undefined]) assert.equal(cleanPlan({...long,verdict}).direction,"wait");
});
test("opening range, VWAP and momentum checks are mode specific", () => {
  assert.equal(cleanPlan({...long,evidence:{...evidence,openingRange:"missing"}},"opening").direction,"wait");
  assert.equal(cleanPlan({...long,evidence:{...evidence,ema:"conflicting"}},"vwap").direction,"wait");
  assert.equal(cleanPlan({...long,evidence:{...evidence,momentum:"missing"}},"momentum").direction,"wait");
  assert.equal(cleanPlan(long,"momentum").confidence,8);
  assert.equal(cleanPlan(long,"breakout").confidence,null);
});
test("validator preserves proposed prices and supports approve, wait and reject", () => {
  const proposal={direction:"long",entry:101,stop:99,tp1:105,tp2:107};
  const plan={...long,entryLow:101,verdict:"APPROVE"};
  assert.equal(cleanPlan(plan,"validator",proposal).verdict,"APPROVE");
  assert.equal(cleanPlan({...plan,stop:98},"validator",proposal).verdict,"WAIT");
  assert.equal(cleanPlan({...plan,verdict:"WAIT"},"validator",proposal).verdict,"WAIT");
  assert.equal(cleanPlan({...plan,verdict:"REJECT"},"validator",proposal).verdict,"REJECT");
  assert.equal(cleanPlan({...plan,tp1:104},"validator",{...proposal,tp1:104}).verdict,"REJECT");
});
