export function buildAutomaticReport(c) {
  if (!c || !c.metrics || !Number.isFinite(c.metrics.close) || !Number.isFinite(c.metrics.rsi14)) throw new Error("Valid chart metrics are required.");
  const m=c.metrics, s=c.smartMoney||{}, p=c.tradePlan, f=m.orderFlowEstimated, v=m.volumeProfileLast120, w=m.anchoredVWAP, a=c.amd, g=c.fairValueGaps;
  const n=x=>Number.isFinite(x)?String(x):"unavailable";
  const sections={};
  const add=(key,stance,points)=>{sections[key]={stance,points:points.filter(Boolean)}};
  const votes=[s.trendFromBreaks==="bullish"?1:s.trendFromBreaks==="bearish"?-1:0,m.rsi14>55?1:m.rsi14<45?-1:0,Number.isFinite(m.ema50)?Math.sign(m.close-m.ema50):0];
  const net=votes.reduce((x,y)=>x+y,0), bias=net>=2?"bullish":net<=-2?"bearish":"mixed";
  add('structure',m.structure||'Available metrics',[`Latest supplied close: ${n(m.close)}. ${m.structure||'Structure unavailable'}.`,m.breakOfStructure,Number.isFinite(m.ema50)?`Price is ${m.close>m.ema50?'above':m.close<m.ema50?'below':'at'} EMA 50 (${n(m.ema50)}).`:null]);
  add('momentum',m.rsi14>70?'Stretched upward':m.rsi14<30?'Stretched downward':'Within middle RSI band',[`RSI 14 is ${n(m.rsi14)}; MACD histogram is ${n(m.macdHist)}.`,typeof m.macdHistRising==='boolean'?`MACD histogram is ${m.macdHistRising?'rising':'falling'} over the measured interval.`:null]);
  add('smc',s.trendFromBreaks||'Unavailable',[s.lastBreak?`${s.lastBreak.type} ${s.lastBreak.dir} at ${n(s.lastBreak.level)}, ${s.lastBreak.barsAgo} bars ago.`:null,s.bullishOBBelow?`Bullish order block below: ${n(s.bullishOBBelow.lo)}–${n(s.bullishOBBelow.hi)}.`:null,s.bearishOBAbove?`Bearish order block above: ${n(s.bearishOBAbove.lo)}–${n(s.bearishOBAbove.hi)}.`:null,g?`${g.openCount} open fair value gaps; price ${g.priceInsideFVG?'is':'is not'} inside a detected gap.`:null,c.fibonacci?`Fibonacci leg: ${c.fibonacci.leg}; OTE ${c.fibonacci.inOTE?'contains current price':'does not contain current price'}.`:null]);
  add('amd',a?.currentPhase||'Unavailable',a?[`Current session phase: ${a.currentPhase}.`,`Accumulation range: ${n(a.accumulationRange?.[0])}–${n(a.accumulationRange?.[1])}.`]:[]);
  add('liquidity','Detected levels',(m.liquiditySweeps||[]).slice(-3).map(x=>`Swing ${x.side} swept at ${n(x.sweptLevel)}, ${x.barsAgo} bars ago.`));
  add('orderflow',f?'Estimated from candles':'Unavailable',f?[`Estimated buy share: ${Math.round(f.buyShareLast20*100)}%; cumulative delta change: ${n(f.cumDeltaChange20)}.`,f.divergence,'These figures estimate volume allocation from candles, not exchange bid/ask trades.']:[]);
  add('volume',v?.priceVsValueArea||'Unavailable',[v?`POC ${n(v.poc)}; value area ${n(v.valueAreaLow)}–${n(v.valueAreaHigh)}.`:null,w?`Anchored VWAP ${n(w.value)}; price zone: ${w.priceZone}.`:null]);
  add('risk',p?'Calculated setup preview':'No active setup',[`ATR 14: ${n(m.atr14)}; ATR versus median: ${n(m.atrVsMedian)}×.`,p?`${p.side} preview: entry ${n(p.entry)}, SL ${n(p.stopLoss)}, TP1 ${n(p.tp1)}, TP2 ${n(p.tp2)}.`:'No trade-plan levels were supplied.',p?`Projected TSL after TP1: ${n(p.trailingStopNow)}. No open position or active stop is tracked.`:null,...(c.setupScore?.cautions||[])]);
  const levels=[];
  for(const [label,items] of [['Support',m.support],['Resistance',m.resistance]]) for(const x of items||[]) if(Number.isFinite(x.price)) levels.push({label,price:String(x.price),why:`Swing cluster with ${x.touches} touch(es).`});
  const res=m.resistance?.[0]?.price,sup=m.support?.[0]?.price;
  const scenarios=[];
  if(Number.isFinite(res)&&Number.isFinite(sup)) {
    scenarios.push({name:'Upside confirmation',confirms:`A close above ${res} followed by a holding retest.`,invalidates:`Price rejects resistance or falls through ${sup}.`});
    scenarios.push({name:'Downside confirmation',confirms:`A close below ${sup} followed by a failed recovery.`,invalidates:`Price reclaims support or breaks above ${res}.`});
  }
  const available=Object.values(sections).filter(x=>x.points.length).length;
  return {mode:'rules',bias,clarity:Math.round(available/8*100),summary:`${c.instrument||'Instrument'} · ${c.timeframe||'timeframe unavailable'}: ${bias} alignment across structure, momentum and EMA position. Source: ${c.dataSource||'unspecified'}. This is a template-based review of supplied metrics, not AI analysis or a probability estimate.`,sections,levels,scenarios,lessons:['Indicator agreement is not a guarantee of direction.','A screenshot requires separate image analysis; this report only reads supplied numerical metrics.','Entry and stop levels are recalculating previews, not executed orders.']};
}
