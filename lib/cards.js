// Scorecards shown under the chart: {h: title, b: pill tone, t: pill text, kv: [[label, value]], note}.
import { RANGE } from "./analysis";
import { pct } from "./format";

export function buildCards(m, { fmt, fmtTime }) {
  const yes=b=>b==null?"—":b?"Above":"Below";
  const lvl=a=>a.length?a.map(x=>fmt(x.p)).join(" · "):"None nearby";
  const liqBias=m.sweep?(m.sweep.side==="high"?"down":"up"):"flat";
  const liqTxt=m.sweep?(m.sweep.side==="high"?"Highs swept":"Lows swept"):(m.eqHigh||m.eqLow)?"Pools resting":"Balanced";
  const sweepRows=m.recentSweeps.length?m.recentSweeps.slice().reverse().slice(0,3).map(s=>[`${s.side==="high"?"High":"Low"} swept · ${s.bars} bars ago`,fmt(s.p)]):[["Sweeps (last "+RANGE+" bars)","None"]];
  const f=m.flow, vp=m.vp, aw=m.avwap;
  const cards=[
    {h:"Structure",b:m.sBias,t:m.sBias==="up"?"Bullish":m.sBias==="down"?"Bearish":"Ranging",
      kv:[["Last swing high",fmt(m.lastSwingHigh)],["Last swing low",fmt(m.lastSwingLow)],["vs EMA 50",yes(m.aboveEMA50)],["vs EMA 200",yes(m.aboveEMA200)]],
      note:m.structure+(m.bos?". "+m.bos+".":".")},
    {h:"Momentum",b:m.mBias,t:m.mBias==="up"?"Positive":m.mBias==="down"?"Negative":"Neutral",
      kv:[["RSI 14",m.rsi.toFixed(1)],["MACD histogram",(m.macdHist>0?"+":"")+fmt(m.macdHist)],["Histogram",m.histRising?"Rising":"Falling"],["10-bar change",pct(m.roc10)]],
      note:m.rsi>70?"RSI is above 70: stretched, which often precedes pauses.":m.rsi<30?"RSI is below 30: stretched to the downside.":"RSI is in its middle band; no extreme reading."},
    {h:"Liquidity",b:liqBias==="flat"?"flat":liqBias,t:liqTxt,
      kv:[...sweepRows,["Equal highs (buy-stops)",m.eqHigh?fmt(m.eqHigh):"None"],["Equal lows (sell-stops)",m.eqLow?fmt(m.eqLow):"None"],["Resistance",lvl(m.resistance)],["Support",lvl(m.support)]],
      note:m.sweep?`Price ran the stops beyond the swing ${m.sweep.side} at ${fmt(m.sweep.p)} and closed back inside ${m.sweep.bars?m.sweep.bars+" bars ago":"on the last bar"}. Sweeps that fail to follow through often mark exhaustion.`:"A sweep is a wick through a prior swing that closes back inside: stops get triggered without acceptance beyond the level."},
    {h:"Risk",b:m.regime>1.3?"warn":"flat",t:m.regimeTxt+" volatility",
      kv:[["ATR 14",fmt(m.atr)],["ATR % of price",m.atrPct.toFixed(2)+"%"],["ATR vs 100-bar median",m.regime.toFixed(2)+"×"],["To support / resistance",(m.distSupATR!=null?m.distSupATR.toFixed(1):"—")+" / "+(m.distResATR!=null?m.distResATR.toFixed(1):"—")+" ATR"]],
      note:"Distances in ATR show how far one average bar's range is from each level."}
  ];
  if(f) cards.push({h:"Order flow",b:f.divergence?(f.divergence.type==="bullish"?"up":"down"):f.buyShare20>.58?"up":f.buyShare20<.42?"down":"flat",
      t:f.divergence?(f.divergence.type==="bullish"?"Bullish divergence":"Bearish divergence"):f.buyShare20>.58?"Buyers in control":f.buyShare20<.42?"Sellers in control":"Two-sided",
      kv:[["Buy share, last 20 bars",(f.buyShare20*100).toFixed(0)+"%"],["Last bar delta",(f.deltaLast>0?"+":"")+Math.round(f.deltaLast).toLocaleString("en-IN")],["Cum. delta, 20 bars",(f.cvdChange20>0?"+":"")+Math.round(f.cvdChange20).toLocaleString("en-IN")],["Absorption bars (30)",f.absorption.length?f.absorption.map(a=>a.bars+" ago").join(", "):"None"]],
      note:(f.divergence?f.divergence.text+". ":"")+"Delta is estimated from where each bar closed in its range; real footprint data needs exchange ticks."});
  if(vp&&aw) cards.push({h:"Volume & AVWAP",b:vp.where==="above"?"up":vp.where==="below"?"down":"flat",t:vp.where==="inside"?"Inside value":vp.where==="above"?"Above value":"Below value",
      kv:[["Point of control",fmt(vp.poc)],["Value area high / low",fmt(vp.vah)+" / "+fmt(vp.val)],["AVWAP ("+aw.anchor.toLowerCase()+")",fmt(aw.value)],["Price vs AVWAP",aw.zone+" · "+(aw.distATR>0?"+":"")+aw.distATR.toFixed(1)+" ATR"]],
      note:`Value area holds 70% of the last ${RANGE} bars' volume. AVWAP is the average price paid since ${fmtTime(aw.anchorTime)||aw.barsSince+" bars ago"}; buyers from there are ${m.close>aw.value?"in profit":"under water"} on average.`});
  const S=m.smc, F=m.fvg, FB=m.fib, AM=m.amd, zone=o=>o?fmt(o.lo)+" – "+fmt(o.hi):"None", gz=g=>g?fmt(g.bot)+" – "+fmt(g.top):"None";
  const dirW=x=>x>0?"bullish":"bearish";
  cards.splice(1,0,{h:"Smart money concepts",b:S.trend>0?"up":S.trend<0?"down":"flat",t:S.trend>0?"Bullish order flow":S.trend<0?"Bearish order flow":"No break yet",
    kv:[["Last break",S.lastEvent?`${S.lastEvent.type} ${S.lastEvent.dir>0?"↑":"↓"} · ${S.lastEvent.bars} bars ago`:"—"],["Broken level",S.lastEvent?fmt(S.lastEvent.level):"—"],
        ["Last CHoCH",S.lastChoch?`${S.lastChoch.dir>0?"↑":"↓"} ${fmt(S.lastChoch.level)} · ${S.lastChoch.bars} ago`:"None"],["Bullish OB below",zone(S.obBelow)],["Bearish OB above",zone(S.obAbove)],
        ["Premium / discount",`${FB.zone} (${(FB.retr*100).toFixed(0)}% retraced)`]],
    note:`BOS = break in the trend's direction; CHoCH = first break against it. In the last ${RANGE} bars: ${S.bos} BOS, ${S.choch} CHoCH. Order blocks are the last opposite candle before the break.`});
  cards.splice(2,0,{h:"FVG & Fibonacci",b:FB.inOTE?"warn":F.inside?"warn":"flat",t:FB.inOTE?"Price in OTE zone":F.inside?`Inside ${dirW(F.inside.dir)} FVG`:`${F.open} open FVGs`,
    kv:[["Open bullish FVG below",gz(F.below)],["Open bearish FVG above",gz(F.above)],["Fib leg",`${FB.up?"Up":"Down"}: ${fmt(FB.up?FB.lo:FB.hi)} → ${fmt(FB.up?FB.hi:FB.lo)}`],
        ["0.5 / 0.618",fmt(FB.levels.find(l=>l.r===.5).p)+" / "+fmt(FB.levels.find(l=>l.r===.618).p)],["OTE (0.618–0.786)",fmt(Math.min(...FB.ote))+" – "+fmt(Math.max(...FB.ote))],["Ext 1.272 / 1.618",fmt(FB.levels.find(l=>l.r===1.272).p)+" / "+fmt(FB.levels.find(l=>l.r===1.618).p)]],
    note:"An FVG is a three-candle gap left by a fast move; price often returns to fill it. Fibonacci is drawn on the main leg of the last "+RANGE+" bars."});
  if(AM){const lbl={"1h":"1 hour","4h":"4 hours",day:"1 day",week:"1 week",month:"1 month",quarter:"1 quarter"}[AM.unit];
    cards.push({h:"AMD · Power of 3",b:AM.phase==="Distribution"?(AM.dist>0?"up":"down"):AM.phase==="Manipulation"?"warn":"flat",t:AM.phase+(AM.phase==="Distribution"?(AM.dist>0?" ↑":" ↓"):""),
      kv:[["Session length",lbl],["Accumulation range",fmt(AM.accLo)+" – "+fmt(AM.accHi)],["Manipulation",AM.manip?`Took the ${AM.manip.side} to ${fmt(AM.manip.ext)}`:"Not yet"],
          ["Previous session",AM.prev||"—"],["Earlier sessions",AM.recent.length?AM.recent.join(" · "):"—"]],
      note:"Accumulation = the session's opening range. Manipulation = a run outside one side to take stops. Distribution = a close through the opposite side, the session's real move."})}
  return cards;
}
