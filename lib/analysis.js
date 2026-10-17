// ChartLens analysis engine — pure functions, no DOM. Used by the chart (client) and can run on the server.
// Candles are {t, o, h, l, c, v} with t in ms (UTC), oldest first.

export const RANGE = 120; // bars used for volume profile, range anchors, Fibonacci leg and the visible window on desktop

/* ---------- Indicators ---------- */
function ema(a,n){const k=2/(n+1),o=[];let e;a.forEach((x,i)=>{e=i===0?x:x*k+e*(1-k);o.push(i<n-1?null:e)});return o}
function emaRaw(a,n){const k=2/(n+1),o=[];let e;a.forEach((x,i)=>{e=i===0?x:x*k+e*(1-k);o.push(e)});return o}
function rsi(c,n=14){const o=Array(c.length).fill(null);let g=0,l=0;for(let i=1;i<c.length;i++){const d=c[i]-c[i-1],up=Math.max(d,0),dn=Math.max(-d,0);if(i<=n){g+=up;l+=dn;if(i===n){g/=n;l/=n;o[i]=100-100/(1+g/(l||1e-12))}}else{g=(g*(n-1)+up)/n;l=(l*(n-1)+dn)/n;o[i]=100-100/(1+g/(l||1e-12))}}return o}
function atr(d,n=14){const o=Array(d.length).fill(null);let a=0;for(let i=1;i<d.length;i++){const tr=Math.max(d[i].h-d[i].l,Math.abs(d[i].h-d[i-1].c),Math.abs(d[i].l-d[i-1].c));if(i<=n){a+=tr;if(i===n){a/=n;o[i]=a}}else{a=(a*(n-1)+tr)/n;o[i]=a}}return o}
function swings(d,k=3){const s=[];for(let i=k;i<d.length-k;i++){let hi=true,lo=true;for(let j=i-k;j<=i+k;j++){if(j===i)continue;if(d[j].h>=d[i].h)hi=false;if(d[j].l<=d[i].l)lo=false}if(hi)s.push({i,p:d[i].h,type:"H"});if(lo)s.push({i,p:d[i].l,type:"L"})}return s}
const median=a=>{const s=[...a].sort((x,y)=>x-y);return s[Math.floor(s.length/2)]};

/* Liquidity sweeps: a wick trades through a confirmed swing high/low, then the bar closes back inside.
   A swing that is closed through cleanly is treated as taken out (a break, not a sweep). */
function findSweeps(d,sw,k=3){
  const out=[], done=new Set();
  for(let i=0;i<d.length;i++){
    for(const s of sw){
      if(done.has(s)||s.i+k>=i||i-s.i>80) continue;
      if(s.type==="H"){
        if(d[i].c>s.p){done.add(s);continue}
        if(d[i].h>s.p){out.push({i,side:"high",p:s.p,from:s.i,ext:d[i].h});done.add(s)}
      } else {
        if(d[i].c<s.p){done.add(s);continue}
        if(d[i].l<s.p){out.push({i,side:"low",p:s.p,from:s.i,ext:d[i].l});done.add(s)}
      }
    }
  }
  return out;
}

/* Order flow (estimated): OHLCV has no bid/ask split, so each bar's volume is divided by where it closed
   in its range (close-location value). True footprint/delta needs tick data from the exchange or broker. */
function orderFlow(d){
  const delta=d.map(b=>{const r=b.h-b.l;return r>0?b.v*((b.c-b.l)-(b.h-b.c))/r:0});
  const cvd=[];let s=0;for(const x of delta){s+=x;cvd.push(s)}
  const L=d.length-1, seg=(a,f,t)=>a.slice(f,t);
  const hiNow=Math.max(...seg(d,L-9,L+1).map(b=>b.h)), hiPrev=Math.max(...seg(d,L-19,L-9).map(b=>b.h));
  const loNow=Math.min(...seg(d,L-9,L+1).map(b=>b.l)), loPrev=Math.min(...seg(d,L-19,L-9).map(b=>b.l));
  const cHiNow=Math.max(...seg(cvd,L-9,L+1)), cHiPrev=Math.max(...seg(cvd,L-19,L-9));
  const cLoNow=Math.min(...seg(cvd,L-9,L+1)), cLoPrev=Math.min(...seg(cvd,L-19,L-9));
  let divergence=null;
  if(hiNow>hiPrev&&cHiNow<cHiPrev) divergence={type:"bearish",text:"Price made a higher high but cumulative delta made a lower high"};
  else if(loNow<loPrev&&cLoNow>cLoPrev) divergence={type:"bullish",text:"Price made a lower low but cumulative delta made a higher low"};
  const absorption=[];
  for(let i=Math.max(20,L-29);i<=L;i++){
    const avg=d.slice(i-20,i).reduce((a,b)=>a+b.v,0)/20, r=d[i].h-d[i].l;
    if(d[i].v>avg*1.8&&r>0&&Math.abs(d[i].c-d[i].o)<r*.3) absorption.push({i,v:d[i].v/avg});
  }
  const last20=delta.slice(-20), pos=last20.filter(x=>x>0).reduce((a,b)=>a+b,0), tot=last20.reduce((a,b)=>a+Math.abs(b),0);
  return {delta,cvd,divergence,absorption,buyShare20:tot?pos/tot:.5,cvdChange20:cvd[L]-cvd[L-20],deltaLast:delta[L]};
}

/* Volume profile over the last RANGE bars: each bar's volume spread across the price rows its range covers. */
function volumeProfile(d,rows=28){
  const v=d.slice(-RANGE), lo=Math.min(...v.map(b=>b.l)), hi=Math.max(...v.map(b=>b.h)), step=(hi-lo)/rows;
  const bins=Array(rows).fill(0);
  for(const b of v){
    const r=b.h-b.l||step*.01;
    for(let k=Math.max(0,Math.floor((b.l-lo)/step));k<=Math.min(rows-1,Math.floor((b.h-lo)/step));k++){
      const a=lo+k*step, z=a+step, ov=Math.max(0,Math.min(z,b.h)-Math.max(a,b.l));
      bins[k]+=b.v*(r>0?ov/r:1);
    }
  }
  const total=bins.reduce((a,b)=>a+b,0); let poc=bins.indexOf(Math.max(...bins)), lo_i=poc, hi_i=poc, acc=bins[poc];
  while(acc<total*.7&&(lo_i>0||hi_i<rows-1)){
    const dn=lo_i>0?bins[lo_i-1]:-1, up=hi_i<rows-1?bins[hi_i+1]:-1;
    if(up>=dn){hi_i++;acc+=up}else{lo_i--;acc+=dn}
  }
  return {lo,hi,step,bins,pocIdx:poc,vaLo:lo_i,vaHi:hi_i,poc:lo+(poc+.5)*step,val:lo+lo_i*step,vah:lo+(hi_i+1)*step};
}

/* SMC: walk the bars; a close through the latest confirmed swing is a break.
   Same direction as the prior break = BOS (continuation); opposite = CHoCH (change of character).
   Order block = last opposite-colour candle at the origin of the leg that caused the break. */
function findOB(d,from,to,dir){
  let ext=from; for(let j=from;j<=to;j++) if(dir>0?d[j].l<d[ext].l:d[j].h>d[ext].h) ext=j;
  for(let j=ext;j>=Math.max(0,ext-6);j--) if(dir>0?d[j].c<d[j].o:d[j].c>d[j].o) return {i:j,hi:d[j].h,lo:d[j].l,dir};
  return {i:ext,hi:d[ext].h,lo:d[ext].l,dir};
}
function smcAnalysis(d,sw){
  const sws=sw.map(s=>({...s,conf:s.i+3})).sort((a,b)=>a.conf-b.conf), ev=[];
  let k=0,trend=0,lastH=null,lastL=null;
  for(let i=0;i<d.length;i++){
    while(k<sws.length&&sws[k].conf<=i){const s=sws[k++]; if(s.type==="H")lastH=s; else lastL=s}
    if(lastH&&!lastH.broken&&d[i].c>lastH.p){lastH.broken=true;ev.push({i,type:trend===-1?"CHoCH":"BOS",dir:1,p:lastH.p,from:lastH.i,ob:findOB(d,lastL&&lastL.i<i?lastL.i:Math.max(0,i-10),i,1)});trend=1}
    else if(lastL&&!lastL.broken&&d[i].c<lastL.p){lastL.broken=true;ev.push({i,type:trend===1?"CHoCH":"BOS",dir:-1,p:lastL.p,from:lastL.i,ob:findOB(d,lastH&&lastH.i<i?lastH.i:Math.max(0,i-10),i,-1)});trend=-1}
  }
  // order-block status: fresh until price trades back into it; broken once a close goes through the far side
  for(const e of ev){const ob=e.ob;ob.state="fresh";ob.end=null;
    for(let j=e.i+1;j<d.length;j++){
      if(ob.dir>0){ if(d[j].c<ob.lo){ob.state="broken";ob.end=j;break} if(d[j].l<=ob.hi&&ob.state==="fresh") ob.state="tested" }
      else { if(d[j].c>ob.hi){ob.state="broken";ob.end=j;break} if(d[j].h>=ob.lo&&ob.state==="fresh") ob.state="tested" }
    }}
  return {events:ev,trend};
}

/* Fair value gaps: candle 1's high below candle 3's low (bullish) or candle 1's low above candle 3's high (bearish).
   Tracked until fully filled; partial fills shrink the remaining gap. */
function findFVG(d,a){
  const out=[];
  for(let i=1;i<d.length-1;i++){
    const A=a[i]; if(A==null) continue; const p=d[i-1], n=d[i+1];
    let g=null;
    if(n.l>p.h&&n.l-p.h>=.15*A) g={i,dir:1,top:n.l,bot:p.h};
    else if(n.h<p.l&&p.l-n.h>=.15*A) g={i,dir:-1,top:p.l,bot:n.h};
    if(!g) continue; g.end=null; g.top0=g.top; g.bot0=g.bot;
    for(let j=i+2;j<d.length;j++){
      if(g.dir>0){ if(d[j].l<=g.bot){g.end=j;break} if(d[j].l<g.top) g.top=d[j].l }
      else { if(d[j].h>=g.top){g.end=j;break} if(d[j].h>g.bot) g.bot=d[j].h }
    }
    out.push(g);
  }
  return out;
}

/* Fibonacci on the dominant leg of the last RANGE bars (range low ↔ range high, ordered by which came last). */
const FIBS=[0,.236,.382,.5,.618,.786,1,1.272,1.618];
function fibLeg(d){
  const s=Math.max(0,d.length-RANGE); let hI=s,lI=s;
  for(let i=s;i<d.length;i++){if(d[i].h>d[hI].h)hI=i;if(d[i].l<d[lI].l)lI=i}
  const up=hI>lI, hi=d[hI].h, lo=d[lI].l, rg=hi-lo;
  // retracement r measured back from the leg's end; r>1 = extension beyond the leg's end
  const at=r=>up?hi-r*rg:lo+r*rg, ext=r=>up?hi+(r-1)*rg:lo-(r-1)*rg;
  const levels=FIBS.map(r=>({r,p:r<=1?at(r):ext(r)}));
  const close=d.at(-1).c, retr=up?(hi-close)/rg:(close-lo)/rg;
  return {up,hI,lI,hi,lo,levels,ote:[at(.618),at(.786)],eq:(hi+lo)/2,retr,
    zone:up?(close<(hi+lo)/2?"discount":"premium"):(close>(hi+lo)/2?"premium":"discount"),startI:up?lI:hI};
}

/* AMD / Power of 3 per session: first 30% of a session's bars = accumulation range;
   a move outside one side = manipulation; a close beyond the opposite side = distribution. */
const AMD_SESS={"1m":"1h","5m":"4h","15m":"day","30m":"day","1H":"day","4H":"week","1D":"month","1W":"quarter"};
function sessKey(t,unit,ist){
  const x=new Date(t+(ist?19800e3:0)), Y=x.getUTCFullYear(), M=x.getUTCMonth(), D=x.getUTCDate();
  if(unit==="1h") return Math.floor(t/36e5);
  if(unit==="4h") return Math.floor(t/144e5);
  if(unit==="day") return Y*1000+Math.floor((Date.UTC(Y,M,D)-Date.UTC(Y,0,1))/864e5);
  if(unit==="week") return Math.floor((t+(ist?19800e3:0)+3*864e5)/(7*864e5));
  if(unit==="month") return Y*12+M;
  return Y*4+Math.floor(M/3);
}
function amdSessions(d,unit,ist){
  if(!unit||!d[0].t) return [];
  const sess=[]; let cur=null;
  d.forEach((b,i)=>{const k=sessKey(b.t,unit,ist); if(!cur||cur.k!==k){cur={k,s:i,e:i};sess.push(cur)} else cur.e=i});
  for(const S of sess){
    const n=S.e-S.s+1; S.n=n; if(n<8){S.skip=true;continue}
    const accN=Math.max(3,Math.round(n*.3)), ae=S.s+accN-1; S.ae=ae;
    S.accHi=Math.max(...d.slice(S.s,ae+1).map(b=>b.h)); S.accLo=Math.min(...d.slice(S.s,ae+1).map(b=>b.l));
    for(let j=ae+1;j<=S.e;j++){
      if(!S.manip){ if(d[j].l<S.accLo) S.manip={side:"low",j,ext:d[j].l,ej:j}; else if(d[j].h>S.accHi) S.manip={side:"high",j,ext:d[j].h,ej:j} }
      else if(!S.dist){
        if(S.manip.side==="low"&&d[j].l<S.manip.ext){S.manip.ext=d[j].l;S.manip.ej=j}
        if(S.manip.side==="high"&&d[j].h>S.manip.ext){S.manip.ext=d[j].h;S.manip.ej=j}
        if(S.manip.side==="low"&&d[j].c>S.accHi) S.dist={dir:1,j};
        if(S.manip.side==="high"&&d[j].c<S.accLo) S.dist={dir:-1,j};
      }
      else if(!S.failed&&(S.dist.dir>0?d[j].c<S.accLo:d[j].c>S.accHi)) S.failed=j; // distribution reversed back through the range
    }
    S.phase=!S.manip?"Accumulation":!S.dist?"Manipulation":S.failed?"Reversed":"Distribution";
    S.pattern=S.failed?"Failed AMD (reversed)":S.dist?(S.dist.dir>0?"Bullish AMD":"Bearish AMD"):S.manip?`Expansion ${S.manip.side==="low"?"down":"up"}, no reversal`:"Stayed in range";
  }
  return sess.filter(S=>!S.skip);
}
function inferUnit(d,src,tf){
  if(src!=="csv") return AMD_SESS[tf];
  const diffs=[];for(let i=1;i<Math.min(d.length,60);i++) if(d[i].t&&d[i-1].t) diffs.push(d[i].t-d[i-1].t);
  if(!diffs.length) return null; const m=median(diffs);
  const tf2=m<=9e4?"1m":m<=4e5?"5m":m<=1e6?"15m":m<=2e6?"30m":m<=4e6?"1H":m<=1.5e7?"4H":m<=1e8?"1D":"1W";
  return AMD_SESS[tf2];
}

/* Anchored VWAP with ±1σ and ±2σ volume-weighted bands. */
export function anchorIndex(d,sw,mode,pick){
  const s=Math.max(0,d.length-RANGE), win=d.slice(s);
  if(mode==="pick"&&pick!=null) return pick;
  if(mode==="rangeHigh"){let m=s;for(let i=s;i<d.length;i++)if(d[i].h>d[m].h)m=i;return m}
  if(mode==="swingLow"){const x=sw.filter(z=>z.type==="L").at(-1);if(x)return x.i}
  if(mode==="swingHigh"){const x=sw.filter(z=>z.type==="H").at(-1);if(x)return x.i}
  if(mode==="maxVol"){let m=s;for(let i=s;i<d.length;i++)if(d[i].v>d[m].v)m=i;return m}
  let m=s;for(let i=s;i<d.length;i++)if(d[i].l<d[m].l)m=i;return m;
}
export function anchoredVWAP(d,a){
  const v=Array(d.length).fill(null), sd=Array(d.length).fill(null);let pv=0,vv=0,p2=0;
  for(let i=a;i<d.length;i++){const tp=(d[i].h+d[i].l+d[i].c)/3, w=d[i].v||1;pv+=tp*w;vv+=w;p2+=tp*tp*w;v[i]=pv/vv;sd[i]=Math.sqrt(Math.max(0,p2/vv-v[i]*v[i]))}
  return {v,sd,a};
}

export function analyze(d,ctx={}){
  const {src="demo",tf="4H",mkt="crypto"}=ctx;
  const c=d.map(x=>x.c), n=d.length, L=n-1, close=c[L];
  const e20=ema(c,20),e50=ema(c,50),e200=ema(c,200);
  const m12=emaRaw(c,12),m26=emaRaw(c,26),macd=c.map((_,i)=>m12[i]-m26[i]),sig=emaRaw(macd,9),hist=macd.map((x,i)=>x-sig[i]);
  const r=rsi(c), a=atr(d), A=a[L], sw=swings(d);
  const H=sw.filter(s=>s.type==="H"), Lo=sw.filter(s=>s.type==="L");
  const h1=H.at(-2),h2=H.at(-1),l1=Lo.at(-2),l2=Lo.at(-1);
  const hh=h1&&h2?h2.p>h1.p:null, hl=l1&&l2?l2.p>l1.p:null;
  let structure="Range / transition", sBias="flat";
  if(hh&&hl){structure="Uptrend: higher highs and higher lows";sBias="up"}
  else if(hh===false&&hl===false){structure="Downtrend: lower highs and lower lows";sBias="down"}
  else if(hh&&hl===false){structure="Expanding range: higher high, lower low"}
  else if(hh===false&&hl){structure="Contracting range: lower high, higher low"}
  let bos=null; if(h2&&close>h2.p) bos="Close above last swing high"; else if(l2&&close<l2.p) bos="Close below last swing low";

  // key levels: cluster swing prices from the last 160 bars
  const pts=sw.filter(s=>s.i>n-160).map(s=>s.p).sort((x,y)=>x-y), clusters=[];
  for(const p of pts){const last=clusters.at(-1);if(last&&p-last.max<=A*.6){last.ps.push(p);last.max=p}else clusters.push({ps:[p],max:p})}
  const lv=clusters.map(cl=>({p:cl.ps.reduce((s,x)=>s+x,0)/cl.ps.length,touches:cl.ps.length}));
  const res=lv.filter(x=>x.p>close+A*.15).sort((x,y)=>x.p-y.p).slice(0,2);
  const sup=lv.filter(x=>x.p<close-A*.15).sort((x,y)=>y.p-x.p).slice(0,2);

  // liquidity
  const recentH=H.filter(s=>s.i>n-90), recentL=Lo.filter(s=>s.i>n-90);
  const eq=(arr)=>{for(let i=arr.length-1;i>0;i--)for(let j=i-1;j>=0;j--)if(Math.abs(arr[i].p-arr[j].p)<=A*.25)return (arr[i].p+arr[j].p)/2;return null};
  const eqHigh=eq(recentH), eqLow=eq(recentL);
  const sweeps=findSweeps(d,sw);
  const recentSweeps=sweeps.filter(s=>s.i>L-RANGE).slice(-4).map(s=>({...s,bars:L-s.i}));
  const sweep=recentSweeps.filter(s=>s.bars<=10).at(-1)||null;
  const hasVol=d.some(x=>x.v>0);
  const flow=hasVol?orderFlow(d):null, vp=hasVol?volumeProfile(d):null;
  const smc=smcAnalysis(d,sw), fvgs=findFVG(d,a), fib=fibLeg(d);
  const amdUnit=inferUnit(d,src,tf), amd=amdSessions(d,amdUnit,mkt==="nse");
  const lastEv=smc.events.at(-1), lastChoch=[...smc.events].reverse().find(e=>e.type==="CHoCH");
  const liveOB=smc.events.map(e=>e.ob).filter(o=>o.state!=="broken"&&o.i>L-RANGE);
  const obBelow=liveOB.filter(o=>o.dir>0&&o.hi<close).sort((x,y)=>y.hi-x.hi)[0]||null;
  const obAbove=liveOB.filter(o=>o.dir<0&&o.lo>close).sort((x,y)=>x.lo-y.lo)[0]||null;
  const openF=fvgs.filter(g=>g.end==null&&g.i>L-RANGE);
  const fvgBelow=openF.filter(g=>g.top<close).sort((x,y)=>y.top-x.top)[0]||null;
  const fvgAbove=openF.filter(g=>g.bot>close).sort((x,y)=>x.bot-y.bot)[0]||null;
  const inFvg=openF.find(g=>close<=g.top&&close>=g.bot)||null;
  const curS=amd.at(-1), prevS=amd.at(-2);
  const vAvg=d.slice(-20).reduce((s,x)=>s+x.v,0)/20, v5=d.slice(-5).reduce((s,x)=>s+x.v,0)/5;
  const volRatio=hasVol&&vAvg?v5/vAvg:null;

  // momentum
  const R=r[L], hs=hist[L], hsPrev=hist[L-3], roc=(close/c[L-10]-1)*100;
  let mScore=0; if(R>55)mScore++; if(R<45)mScore--; if(hs>0)mScore++; if(hs<0)mScore--; if(hs>hsPrev)mScore+=.5; else mScore-=.5;
  const mBias=mScore>=1.5?"up":mScore<=-1.5?"down":"flat";

  // trend vs averages
  const above=[e20[L],e50[L],e200[L]].map(e=>e==null?null:close>e);
  const e50slope=e50[L]!=null&&e50[L-5]!=null?(e50[L]/e50[L-5]-1)*100:null;

  // risk
  const atrPct=A/close*100, atrMed=median(a.slice(-100).filter(x=>x!=null)), regime=A/atrMed;
  const rBias=regime>1.3?"warn":regime<.8?"flat":"flat";
  const regimeTxt=regime>1.3?"Expanding":regime<.8?"Compressed":"Normal";

  return {e20,e50,e200,macd,sig,hist,r,a,sw,sweeps,flow,vp,hasVol,smc,fvgs,fib,amd,amdUnit,
    m:{close,recentSweeps,hasVol,
       smc:{trend:smc.trend,lastEvent:lastEv?{type:lastEv.type,dir:lastEv.dir,level:lastEv.p,bars:L-lastEv.i}:null,
            lastChoch:lastChoch?{dir:lastChoch.dir,level:lastChoch.p,bars:L-lastChoch.i}:null,obBelow,obAbove,
            bos:smc.events.filter(e=>e.i>L-RANGE&&e.type==="BOS").length,choch:smc.events.filter(e=>e.i>L-RANGE&&e.type==="CHoCH").length},
       fvg:{open:openF.length,below:fvgBelow,above:fvgAbove,inside:inFvg},
       fib:{up:fib.up,hi:fib.hi,lo:fib.lo,retr:fib.retr,zone:fib.zone,ote:fib.ote,levels:fib.levels,inOTE:close>=Math.min(...fib.ote)&&close<=Math.max(...fib.ote)},
       amd:curS?{unit:amdUnit,phase:curS.phase,accHi:curS.accHi,accLo:curS.accLo,manip:curS.manip?{side:curS.manip.side,ext:curS.manip.ext}:null,dist:curS.dist?curS.dist.dir:null,
            prev:prevS?prevS.pattern:null,recent:amd.slice(-6,-1).map(S=>S.pattern)}:null,
       flow:flow&&{divergence:flow.divergence,absorption:flow.absorption.map(x=>({bars:L-x.i,mult:x.v})),buyShare20:flow.buyShare20,cvdChange20:flow.cvdChange20,deltaLast:flow.deltaLast,cvdRising:flow.cvd[L]>flow.cvd[L-5]},
       vp:vp&&{poc:vp.poc,vah:vp.vah,val:vp.val,where:close>vp.vah?"above":close<vp.val?"below":"inside"},change:(close/c[L-1]-1)*100,structure,sBias,bos,lastSwingHigh:h2?.p,lastSwingLow:l2?.p,
       resistance:res,support:sup,eqHigh,eqLow,sweep,volRatio,
       rsi:R,macdHist:hs,histRising:hs>hsPrev,roc10:roc,mBias,
       aboveEMA20:above[0],aboveEMA50:above[1],aboveEMA200:above[2],ema20:e20[L],ema50:e50[L],ema200:e200[L],ema50SlopePct5:e50slope,
       atr:A,atrPct,regime,regimeTxt,rBias,
       distSupATR:sup[0]?(close-sup[0].p)/A:null,distResATR:res[0]?(res[0].p-close)/A:null}};
}


/* ---------- Trade plan (rule-based) ----------
   SL: just beyond the nearest swing on the far side of entry (+0.25 ATR buffer), if within 3 ATR; else 1.5 ATR.
   TP1/TP2: first key levels at least 1R away (S/R, swings, POC, value area, FVGs, order blocks, Fibonacci, equal highs/lows), else R multiples.
   TSL: after TP1 the stop moves to max(entry, TP1 − k × ATR) and then trails k × ATR behind the best price. */
export function computePlan(d, ind, opts, fmt = (p) => String(p)) {
  const { side, entry = null, targets = "levels", r1: r1in = 1.5, r2: r2in = 3, k: kin = 3, capital = 0, riskPct = 1 } = opts;
  if (!side || side === "off") return null;
  const m = ind.m, I = ind, L = d.length - 1, A = m.atr, long = side === "long", dir = long ? 1 : -1;
  const E = entry ?? m.close, r1 = Math.max(0.5, +r1in || 1.5), r2 = Math.max(r1 + 0.5, +r2in || 3), k = Math.max(0.5, +kin || 3);
  const sws = I.sw.filter((s) => s.i > L - RANGE && (long ? s.type === "L" && s.p < E - 0.2 * A : s.type === "H" && s.p > E + 0.2 * A))
    .sort((a, b) => (b.p - a.p) * dir);
  let SL, slSrc; const near = sws[0];
  if (near && Math.abs(E - near.p) <= 3 * A) { SL = near.p - dir * 0.25 * A; slSrc = `Beyond swing ${long ? "low" : "high"} ${fmt(near.p)} + 0.25 ATR`; }
  else { SL = E - dir * 1.5 * A; slSrc = "1.5 × ATR from entry (no swing within 3 ATR)"; }
  const R = Math.abs(E - SL), pad = 0.1 * A;
  let lv = [...m.resistance.map((x) => ({ p: x.p, src: `Resistance ×${x.touches}` })), ...m.support.map((x) => ({ p: x.p, src: `Support ×${x.touches}` }))];
  for (const s of I.sw.filter((s) => s.i > L - RANGE)) lv.push({ p: s.p, src: `Swing ${s.type === "H" ? "high" : "low"}` });
  if (m.vp) lv.push({ p: m.vp.poc, src: "Volume POC" }, { p: m.vp.vah, src: "Value area high" }, { p: m.vp.val, src: "Value area low" });
  for (const l of m.fib.levels) if (l.r !== 0 && l.r !== 1) lv.push({ p: l.p, src: `Fib ${l.r}` });
  for (const g of I.fvgs.filter((g) => g.end == null && g.i > L - RANGE)) lv.push({ p: (g.dir > 0) === long ? g.top : g.bot, src: `${g.dir > 0 ? "Bullish" : "Bearish"} FVG` });
  for (const o of [m.smc.obAbove, m.smc.obBelow]) if (o) lv.push({ p: long ? o.lo : o.hi, src: `${o.dir > 0 ? "Bullish" : "Bearish"} order block` });
  if (m.eqHigh) lv.push({ p: m.eqHigh, src: "Equal highs (stop pool)" });
  if (m.eqLow) lv.push({ p: m.eqLow, src: "Equal lows (stop pool)" });
  lv = lv.filter((x) => (x.p - E) * dir >= R + pad).sort((a, b) => (a.p - b.p) * dir);
  const useLv = targets === "levels";
  let TP1, tp1Src, TP2, tp2Src;
  if (useLv && lv[0]) { TP1 = lv[0].p - dir * pad; tp1Src = `Just before ${lv[0].src} ${fmt(lv[0].p)}`; }
  else { TP1 = E + dir * r1 * R; tp1Src = `${r1}R from entry`; }
  const nx = useLv ? lv.find((x) => (x.p - pad - TP1) * dir >= 0.5 * R) : null;
  if (nx) { TP2 = nx.p - dir * pad; tp2Src = `Just before ${nx.src} ${fmt(nx.p)}`; }
  else { TP2 = E + dir * Math.max(r2 * R, Math.abs(TP1 - E) + R); tp2Src = `${(Math.abs(TP2 - E) / R).toFixed(1)}R from entry`; }
  const tslNow = long ? Math.max(E, TP1 - k * A) : Math.min(E, TP1 + k * A);
  const riskAmt = (+capital || 0) * (+riskPct || 0) / 100, qty = R > 0 ? riskAmt / R : 0;
  return { side, long, E, SL, TP1, TP2, R, k, tslNow, slSrc, tp1Src, tp2Src, rr1: Math.abs(TP1 - E) / R, rr2: Math.abs(TP2 - E) / R,
    riskAmt, qty, capital: +capital || 0, riskPct: +riskPct || 0, entryNote: entry == null ? "Last price" : "Your entry" };
}

/* ---------- CSV import ---------- */
export function parseCSV(text) {
  const lines = text.trim().split(/\r?\n/).filter((l) => l.trim());
  if (lines.length < 30) throw new Error("Need at least 30 rows of data to compute indicators.");
  const split = (l) => l.split(/[,;\t]/).map((x) => x.trim().replace(/^"|"$/g, ""));
  const head = split(lines[0]).map((x) => x.toLowerCase());
  let start = 1, idx = {};
  const find = (...ks) => head.findIndex((hd) => ks.some((k) => hd === k || hd.startsWith(k)));
  if (isNaN(parseFloat(head[1]))) {
    idx = { t: find("date", "time", "timestamp", "datetime"), o: find("open", "o"), h: find("high", "h"), l: find("low", "l"), c: find("close", "c", "last", "price"), v: find("vol", "volume", "v") };
    if ([idx.o, idx.h, idx.l, idx.c].some((i) => i < 0)) throw new Error("Couldn't find open, high, low and close columns in the header.");
  } else { start = 0; idx = { t: 0, o: 1, h: 2, l: 3, c: 4, v: 5 }; }
  const rows = [];
  for (const line of lines.slice(start)) {
    const f = split(line), num = (i) => (i >= 0 && f[i] !== undefined ? parseFloat(f[i].replace(/,/g, "")) : NaN);
    const o = num(idx.o), h = num(idx.h), l = num(idx.l), c = num(idx.c);
    if ([o, h, l, c].some(isNaN)) continue;
    let t = idx.t >= 0 ? Date.parse(f[idx.t]) : NaN;
    if (isNaN(t) && idx.t >= 0 && /^\d{10,13}$/.test(f[idx.t])) t = +f[idx.t] * (f[idx.t].length === 10 ? 1000 : 1);
    rows.push({ t: isNaN(t) ? null : t, o, h, l, c, v: isNaN(num(idx.v)) ? 0 : num(idx.v) });
  }
  if (rows.length < 30) throw new Error("Fewer than 30 rows had valid numbers.");
  if (rows[0].t && rows.at(-1).t && rows[0].t > rows.at(-1).t) rows.reverse();
  return rows;
}

/* ---------- Setup score (rule-based confluence) ----------
   Nine factors each read the chart as bullish (+) or bearish (−) between −1 and +1, times a weight.
   Factors with no data (e.g. no volume) are left out and the rest are rescaled to 100.
   net = Σ weight × reading / Σ weights × 100, from −100 (all bearish) to +100 (all bullish).
   Buy setup when net ≥ +20, sell setup when net ≤ −20, otherwise wait.
   Score = share of the weighted evidence on the winning side (50–100). Grade A ≥ 75, B ≥ 65, else C. */
const clamp1 = (x) => Math.max(-1, Math.min(1, x));
export const SETUP_THRESHOLD = 20;

export function setupScore(ind, fmt = (p) => String(p)) {
  const m = ind.m, f = [];
  const add = (name, weight, value, reading) => f.push({ name, weight, value: clamp1(value), reading });

  add("Market structure", 15, m.sBias === "up" ? 1 : m.sBias === "down" ? -1 : 0, m.structure);

  const ev = m.smc.lastEvent;
  if (ev) {
    const fresh = ev.bars <= 20 ? 1 : ev.bars <= 60 ? 0.6 : 0.3;
    add("SMC break", 15, ev.dir * (ev.type === "CHoCH" ? 1 : 0.85) * fresh, `${ev.type} ${ev.dir > 0 ? "up" : "down"} at ${fmt(ev.level)}, ${ev.bars} bars ago`);
  } else add("SMC break", 15, 0, "No break of structure yet");

  if (m.ema50 != null) {
    const v = (m.aboveEMA50 ? 0.4 : -0.4) + (m.aboveEMA200 == null ? 0 : m.aboveEMA200 ? 0.4 : -0.4) + ((m.ema50SlopePct5 ?? 0) > 0 ? 0.2 : -0.2);
    add("Trend (EMAs)", 10, v, `${m.aboveEMA50 ? "Above" : "Below"} EMA 50${m.aboveEMA200 == null ? "" : `, ${m.aboveEMA200 ? "above" : "below"} EMA 200`}; EMA 50 ${(m.ema50SlopePct5 ?? 0) > 0 ? "rising" : "falling"}`);
  }

  add("Momentum", 10, Math.max(-0.6, Math.min(0.6, (m.rsi - 50) / 20)) + (m.macdHist > 0 ? 0.25 : -0.25) + (m.histRising ? 0.15 : -0.15),
    `RSI ${m.rsi.toFixed(0)}, MACD histogram ${m.macdHist > 0 ? "positive" : "negative"} and ${m.histRising ? "rising" : "falling"}`);

  if (m.flow) {
    const dv = m.flow.divergence ? (m.flow.divergence.type === "bullish" ? 0.4 : -0.4) : 0;
    add("Order flow", 10, Math.max(-0.6, Math.min(0.6, (m.flow.buyShare20 - 0.5) * 2.5)) + (m.flow.cvdRising ? 0.2 : -0.2) + dv,
      `Buy share ${(m.flow.buyShare20 * 100).toFixed(0)}% over 20 bars, cumulative delta ${m.flow.cvdRising ? "rising" : "falling"}${m.flow.divergence ? `, ${m.flow.divergence.type} divergence` : ""}`);
  }

  const sw = m.sweep;
  add("Liquidity sweep", 10, sw ? (sw.side === "low" ? 1 : -1) * Math.max(0.3, 1 - sw.bars / 15) : 0,
    sw ? `Swept the swing ${sw.side} at ${fmt(sw.p)} ${sw.bars ? sw.bars + " bars ago" : "on the last bar"}` : "No sweep in the last 10 bars");

  const fb = m.fib, pos = (m.close - fb.lo) / ((fb.hi - fb.lo) || 1);
  add("Premium / discount", 10, (0.5 - pos) * 2, `Price at ${(pos * 100).toFixed(0)}% of the range: ${pos < 0.5 ? "discount (favours buying)" : "premium (favours selling)"}`);

  if (m.vp) {
    const v = (m.vp.where === "above" ? 0.5 : m.vp.where === "below" ? -0.5 : m.close > m.vp.poc ? 0.2 : -0.2) + (m.avwap ? (m.close > m.avwap.value ? 0.5 : -0.5) : 0);
    add("Volume & VWAP", 10, m.avwap ? v : v * 2,
      `${m.vp.where === "inside" ? `Inside value, ${m.close > m.vp.poc ? "above" : "below"} POC` : `${m.vp.where === "above" ? "Above" : "Below"} the value area`}${m.avwap ? `; ${m.close > m.avwap.value ? "above" : "below"} anchored VWAP` : ""}`);
  }

  if (m.amd) {
    const a = m.amd;
    const v = a.phase === "Distribution" ? a.dist : a.phase === "Manipulation" && a.manip ? (a.manip.side === "low" ? 0.5 : -0.5) : 0;
    add("AMD session", 10, v, a.phase === "Distribution" ? `Distribution ${a.dist > 0 ? "up" : "down"} this session`
      : a.phase === "Manipulation" && a.manip ? `Manipulation took the ${a.manip.side}; reversal ${a.manip.side === "low" ? "up" : "down"} not confirmed yet`
      : a.phase === "Reversed" ? "This session's move reversed back through its range" : "Still in the opening range");
  }

  const W = f.reduce((s, x) => s + x.weight, 0);
  for (const x of f) x.points = (x.weight * x.value) / W * 100;
  const net = f.reduce((s, x) => s + x.points, 0);
  const bull = Math.round((net + 100) / 2);
  const verdict = net >= SETUP_THRESHOLD ? "buy" : net <= -SETUP_THRESHOLD ? "sell" : "wait";
  const score = verdict === "sell" ? 100 - bull : verdict === "buy" ? bull : Math.max(bull, 100 - bull);
  const grade = verdict === "wait" ? null : score >= 75 ? "A" : score >= 65 ? "B" : "C";
  const dir = verdict === "buy" ? 1 : verdict === "sell" ? -1 : 0;
  const agree = dir ? f.filter((x) => Math.sign(x.value) === dir && Math.abs(x.value) >= 0.15).length : null;
  const against = dir ? f.filter((x) => Math.sign(x.value) === -dir && Math.abs(x.value) >= 0.15).length : null;

  const cautions = [];
  if (m.regime > 1.5) cautions.push(`Volatility is ${m.regime.toFixed(1)}× its recent normal; stops get hit more easily.`);
  if (verdict === "buy" && m.rsi > 75) cautions.push(`RSI is ${m.rsi.toFixed(0)}: stretched to the upside.`);
  if (verdict === "sell" && m.rsi < 25) cautions.push(`RSI is ${m.rsi.toFixed(0)}: stretched to the downside.`);
  if (verdict === "buy" && m.flow?.divergence?.type === "bearish") cautions.push("Order flow shows a bearish divergence against the buy setup.");
  if (verdict === "sell" && m.flow?.divergence?.type === "bullish") cautions.push("Order flow shows a bullish divergence against the sell setup.");
  if (verdict === "buy" && m.smc.obAbove && m.smc.obAbove.lo - m.close < m.atr) cautions.push(`A bearish order block sits less than 1 ATR above, at ${fmt(m.smc.obAbove.lo)}.`);
  if (verdict === "sell" && m.smc.obBelow && m.close - m.smc.obBelow.hi < m.atr) cautions.push(`A bullish order block sits less than 1 ATR below, at ${fmt(m.smc.obBelow.hi)}.`);

  return { verdict, score, grade, net, bull, factors: f, agree, against, total: f.length, cautions };
}
