// Deterministic review of user-entered chart observations. No image recognition.
export const REVIEW_MODES = [
  ["structure", "Market structure"], ["vwap", "VWAP + 9/21 EMA"],
  ["momentum", "Momentum scalper"], ["breakout", "Breakout scanner"],
  ["opening", "Opening range"], ["reversal", "Reversal scanner"],
  ["validator", "Final trade validator"],
];
export const NUMBER_FIELDS = [
  ["price", "Latest completed 5m close"], ["price1", "Latest completed 1m close"],
  ["supportLow", "Support zone low"], ["supportHigh", "Support zone high"],
  ["resistanceLow", "Resistance zone low"], ["resistanceHigh", "Resistance zone high"],
  ["vwap", "Session VWAP (5m chart)"], ["ema9", "9 EMA (5m)"], ["ema21", "21 EMA (5m)"],
  ["vwap1", "Session VWAP (1m chart)"], ["ema9_1", "9 EMA (1m)"], ["ema21_1", "21 EMA (1m)"],
  ["rsi", "RSI 14 (1m)"], ["volume", "Completed 5m volume"], ["averageVolume", "Previous 20 × 5m average volume"],
  ["volume1", "Completed 1m volume"], ["averageVolume1", "Previous 20 × 1m average volume"],
  ["openingHigh", "First 15-minute range high"], ["openingLow", "First 15-minute range low"],
  ["entry", "Your proposed entry"], ["stop", "Your proposed SL"], ["tp1", "Your proposed TP1"], ["tp2", "Your proposed TP2"],
];
export const SELECT_FIELDS = [
  ["trend1", "1m trend"], ["trend5", "5m trend"], ["trend15", "15m trend"],
  ["breakDirection", "Completed BOS / CHoCH direction"], ["retest", "Completed breakout retest held for"],
  ["openingRetest", "Completed opening-range retest held for"],
  ["rejection", "Support/resistance rejection direction"], ["choch", "Completed reversal CHoCH direction"],
];
export const CHECK_FIELDS = [
  ["frames", "5m and 15m charts show the same instrument and matching snapshot time"],
  ["frames1", "1m and 5m charts show the same instrument and matching snapshot time"],
  ["closed", "5m observations use completed candles"], ["closed1", "1m observations use completed candles"],
  ["openingComplete", "The specified opening 15-minute interval is complete"],
  ["atZone", "Rejection occurred at the entered support/resistance zone"],
];
const number = value => value !== "" && value != null && Number.isFinite(Number(value)) ? Number(value) : null;
const positive = value => { const n=number(value); return n !== null && n > 0 ? n : null; };
const hasText = value => typeof value === "string" && value.trim().length > 0;

export function reviewScreenshot(input = {}, hasScreenshot = false) {
  const n=Object.fromEntries(NUMBER_FIELDS.map(([key])=>[key,positive(input[key])]));
  const up=input.direction === "long", down=input.direction === "short", direction=up?"BUY":down?"SELL":null;
  const aligned = value => (up || down) && value === input.direction;
  const beyond = (price, high, low) => price !== null && (up ? high !== null && price > high : down && low !== null && price < low);
  const zones=n.supportLow!==null && n.supportHigh!==null && n.resistanceLow!==null && n.resistanceHigh!==null && n.supportLow<=n.supportHigh && n.supportHigh<n.resistanceLow && n.resistanceLow<=n.resistanceHigh;
  const volume=(current,average)=>["tick","traded"].includes(input.volumeType) && current!==null && average!==null && current>=1.5*average;
  const ema=(price,fast,slow)=>price!==null && fast!==null && slow!==null && (up?price>fast && fast>slow:down && price<fast && fast<slow);
  const vwap=(price,anchor)=>price!==null && anchor!==null && hasText(input.session) && hasText(input.timezone) && (up?price>anchor:down && price<anchor);
  const base=[
    ["Screenshot reference",hasScreenshot], ["Instrument and snapshot date/time",hasText(input.symbol)&&hasText(input.snapshot)],
    ["Proposed BUY/SELL direction",!!direction], ["5m/15m chart alignment",input.frames===true],
    ["Completed 5m candle",input.closed===true && n.price!==null],
  ];
  const structure=[["Valid support/resistance zones",zones],["5m trend agrees",aligned(input.trend5)],["15m trend agrees",aligned(input.trend15)],["Completed BOS/CHoCH agrees",aligned(input.breakDirection)]];
  const vw=[["Price relative to session VWAP",vwap(n.price,n.vwap)],["Price and 9/21 EMA aligned",ema(n.price,n.ema9,n.ema21)]];
  const vol=[["5m volume ≥ 1.5 × prior 20-bar average",volume(n.volume,n.averageVolume)]];
  const breakout=[["5m close outside outer zone boundary",zones && beyond(n.price,n.resistanceHigh,n.supportLow)],["Completed retest held",aligned(input.retest)]];
  const momentum=[
    ["1m/5m chart alignment",input.frames1===true], ["Completed 1m candle",input.closed1===true && n.price1!==null],
    ["1m trend agrees",aligned(input.trend1)], ["1m session VWAP agrees",vwap(n.price1,n.vwap1)],
    ["1m price and 9/21 EMA aligned",ema(n.price1,n.ema9_1,n.ema21_1)],
    ["1m volume ≥ 1.5 × prior 20-bar average",volume(n.volume1,n.averageVolume1)],
    ["1m RSI: BUY 55–70 / SELL 30–45",n.rsi!==null && (up?n.rsi>=55&&n.rsi<=70:down&&n.rsi>=30&&n.rsi<=45)],
  ];
  const opening=[
    ["Session, date, timezone and exact interval specified",hasText(input.session)&&hasText(input.timezone)&&hasText(input.openingInterval)],
    ["Opening 15-minute range completed",input.openingComplete===true],
    ["Valid opening range",n.openingHigh!==null&&n.openingLow!==null&&n.openingLow<n.openingHigh],
    ["5m close outside opening range",n.openingLow<n.openingHigh && beyond(n.price,n.openingHigh,n.openingLow)],
    ["Completed opening-range retest held",aligned(input.openingRetest)],
  ];
  const reversal=[
    ["Rejection at entered zone",zones && input.atZone===true && aligned(input.rejection)],
    ["Completed reversal CHoCH agrees",aligned(input.choch)],
    ["5m close reclaimed rejection zone",zones && n.price!==null && (up?n.price>n.supportHigh:down&&n.price<n.resistanceLow)],
  ];
  const prices=[n.entry,n.stop,n.tp1,n.tp2].every(v=>v!==null);
  const ordering=prices && (up?n.stop<n.entry&&n.entry<n.tp1&&n.tp1<n.tp2:down&&n.tp2<n.tp1&&n.tp1<n.entry&&n.entry<n.stop);
  const rr1=ordering?Math.abs(n.tp1-n.entry)/Math.abs(n.entry-n.stop):null;
  const rr2=ordering?Math.abs(n.tp2-n.entry)/Math.abs(n.entry-n.stop):null;
  const risk=[["Entry, SL and both targets supplied",prices],["SL/entry/targets ordered correctly",!!ordering],["TP1 R:R ≥ 2:1 before costs",rr1!==null&&rr1>=2]];
  const groups={structure:[...structure],vwap:[...structure,...vw,...vol],momentum:[...structure,...vw,...vol,...momentum],breakout:[...structure,...vol,...breakout],opening:[...structure,...vw.slice(0,1),...vol,...opening],reversal:[...structure.slice(0,3),...vol,...momentum,...reversal],validator:[...structure,...vw,...vol,...momentum]};
  const results=REVIEW_MODES.map(([id,name])=>{
    const checks=[...base,...groups[id],...risk];
    const failed=checks.filter(([,ok])=>!ok).map(([label])=>label);
    const passed=failed.length===0;
    const invalidRisk=prices && (!ordering || rr1<2);
    const conflicts=(up||down) && [input.trend5,input.trend15].some(value=>["long","short","mixed"].includes(value)&&value!==input.direction);
    const verdict=id==="validator"?(passed?"APPROVE":invalidRisk||conflicts?"REJECT":"WAIT"):passed?direction:"NO TRADE";
    return {id,name,verdict,checks,reason:passed?"All selected fixed-rule checks pass on your entered observations.":`${verdict}: ${failed.join("; ")}.`,
      confidence:id==="momentum"?Math.max(1,Math.round(10*checks.filter(([,ok])=>ok).length/checks.length)):null,
      plan:passed?{entry:n.entry,stop:n.stop,tp1:n.tp1,tp2:n.tp2,rr1,rr2}:null,
      invalidation:n.stop!==null?`Your proposed invalidation / SL: ${n.stop}.` : "Invalidation level unavailable; enter your proposed SL.",
    };
  });
  const six=results.slice(0,6), validator=results[6];
  // Conservative combined result: one passing strategy never overrides missing/conflicting techniques.
  const overall=six.every(result=>result.verdict===direction)&&validator.verdict==="APPROVE"?direction:"NO TRADE";
  return {overall,results,zones:zones?{support:[n.supportLow,n.supportHigh],resistance:[n.resistanceLow,n.resistanceHigh]}:null};
}
