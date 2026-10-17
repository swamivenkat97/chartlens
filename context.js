// Builds the compact JSON the AI reads: computed metrics plus the last 30 candles.
import { MARKETS } from "./instruments";

export function buildContext({ data: d, ind, sym, market, tf, src, plan: P }) {
  const m = ind.m;
  const r=v=>v==null?null:+(+v).toFixed(sym.d);
  return {instrument:sym.s,name:sym.n,market:src==="csv"?"user data":MARKETS[market].label,session:src==="csv"?null:MARKETS[market].session,timeframe:src==="csv"?"as supplied":tf,
    dataSource:src==="demo"?"synthetic demo series (not real prices)":src==="csv"?"user-uploaded CSV":`live candles from ${src}`,
    metrics:{close:r(m.close),changePct:+m.change.toFixed(2),structure:m.structure,breakOfStructure:m.bos,lastSwingHigh:r(m.lastSwingHigh),lastSwingLow:r(m.lastSwingLow),
      ema20:r(m.ema20),ema50:r(m.ema50),ema200:r(m.ema200),ema50SlopePct5bars:m.ema50SlopePct5?.toFixed(3),
      rsi14:+m.rsi.toFixed(1),macdHist:r(m.macdHist),macdHistRising:m.histRising,roc10Pct:+m.roc10.toFixed(2),
      resistance:m.resistance.map(l=>({price:r(l.p),touches:l.touches})),support:m.support.map(l=>({price:r(l.p),touches:l.touches})),
      equalHighs:r(m.eqHigh),equalLows:r(m.eqLow),
      liquiditySweeps:m.recentSweeps.map(s=>({side:s.side,sweptLevel:r(s.p),wickExtreme:r(s.ext),barsAgo:s.bars})),
      orderFlowEstimated:m.flow?{note:"delta estimated from close location in bar range, not tick data",buyShareLast20:+m.flow.buyShare20.toFixed(2),cumDeltaChange20:Math.round(m.flow.cvdChange20),cumDeltaRising5:m.flow.cvdRising,divergence:m.flow.divergence?.text||null,absorptionBarsAgo:m.flow.absorption.map(a=>a.bars)}:null,
      volumeProfileLast120:m.vp?{poc:r(m.vp.poc),valueAreaHigh:r(m.vp.vah),valueAreaLow:r(m.vp.val),priceVsValueArea:m.vp.where}:null,
      anchoredVWAP:m.avwap?{anchor:m.avwap.anchor,barsSinceAnchor:m.avwap.barsSince,value:r(m.avwap.value),sigma:r(m.avwap.sd),priceZone:m.avwap.zone,distanceATR:+m.avwap.distATR.toFixed(2)}:null,
      volume5vs20:m.volRatio?+m.volRatio.toFixed(2):null,atr14:r(m.atr),atrPct:+m.atrPct.toFixed(2),atrVsMedian:+m.regime.toFixed(2)},
    smartMoney:{trendFromBreaks:m.smc.trend>0?"bullish":m.smc.trend<0?"bearish":"none",lastBreak:m.smc.lastEvent?{type:m.smc.lastEvent.type,dir:m.smc.lastEvent.dir>0?"up":"down",level:r(m.smc.lastEvent.level),barsAgo:m.smc.lastEvent.bars}:null,
      lastCHoCH:m.smc.lastChoch?{dir:m.smc.lastChoch.dir>0?"up":"down",level:r(m.smc.lastChoch.level),barsAgo:m.smc.lastChoch.bars}:null,
      bullishOBBelow:m.smc.obBelow?{lo:r(m.smc.obBelow.lo),hi:r(m.smc.obBelow.hi),state:m.smc.obBelow.state}:null,bearishOBAbove:m.smc.obAbove?{lo:r(m.smc.obAbove.lo),hi:r(m.smc.obAbove.hi),state:m.smc.obAbove.state}:null,
      premiumDiscount:m.fib.zone},
    fairValueGaps:{openCount:m.fvg.open,nearestBullishBelow:m.fvg.below?{bot:r(m.fvg.below.bot),top:r(m.fvg.below.top)}:null,nearestBearishAbove:m.fvg.above?{bot:r(m.fvg.above.bot),top:r(m.fvg.above.top)}:null,priceInsideFVG:!!m.fvg.inside},
    fibonacci:{leg:m.fib.up?"up":"down",from:r(m.fib.up?m.fib.lo:m.fib.hi),to:r(m.fib.up?m.fib.hi:m.fib.lo),retracedPct:+(m.fib.retr*100).toFixed(1),inOTE:m.fib.inOTE,levels:m.fib.levels.map(l=>[l.r,r(l.p)])},
    amd:m.amd?{session:m.amd.unit,currentPhase:m.amd.phase,accumulationRange:[r(m.amd.accLo),r(m.amd.accHi)],manipulation:m.amd.manip?{side:m.amd.manip.side,extreme:r(m.amd.manip.ext)}:null,previousSession:m.amd.prev,earlierSessions:m.amd.recent}:null,
    tradePlan:P?{note:"calculated mechanically by the tool from rules the user chose",side:P.side,entry:r(P.E),stopLoss:r(P.SL),stopRule:P.slSrc,tp1:r(P.TP1),tp1Rule:P.tp1Src,tp2:r(P.TP2),tp2Rule:P.tp2Src,
      rewardRisk1:+P.rr1.toFixed(2),rewardRisk2:+P.rr2.toFixed(2),trailingStopNow:r(P.tslNow),trailRule:`SL until TP1; then stop moves to trailingStopNow and trails ${P.k}xATR behind the best price since entry`}:null,
    last30bars:d.slice(-30).map(b=>[r(b.o),r(b.h),r(b.l),r(b.c)])};
}
