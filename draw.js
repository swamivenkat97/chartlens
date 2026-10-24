// Canvas renderer for the ChartLens chart. Colours come from the CSS tokens so it follows light/dark theme.
export function drawChart(cv, o) {
  const { data: d, ind: I, ov, pane, hover, plan: P, vw: VW, fmt, fmtTime } = o;
  if (!cv || !d || !d.length || !I) return null;
  const ctx = cv.getContext("2d"); if (!ctx) return null;
  const css = getComputedStyle(document.documentElement), tok = (n) => css.getPropertyValue(n).trim();
  const dpr=window.devicePixelRatio||1, W=cv.clientWidth, H=cv.clientHeight;
  cv.width=W*dpr; cv.height=H*dpr; ctx.setTransform(dpr,0,0,dpr,0,0); ctx.clearRect(0,0,W,H);
  const C={fg:tok("--fg"),mu:tok("--muted"),grid:tok("--grid"),up:tok("--up"),dn:tok("--down"),e20:tok("--ema20"),e50:tok("--ema50"),e200:tok("--ema200"),acc:tok("--accent"),line:tok("--line")};
  const N=Math.min(d.length, W<520?70:120), s0=d.length-N, view=d.slice(s0), m=I.m;
  const padR=W<520?58:72, padL=4, mainH=Math.round(H*.74), rsiTop=mainH+14, rsiH=H-rsiTop-18;
  const plotW=W-padR-padL, bw=plotW/N;
  let lo=Math.min(...view.map(x=>x.l)), hi=Math.max(...view.map(x=>x.h));
  for(const arr of [I.e20,I.e50,I.e200]) for(let i=s0;i<d.length;i++) if(arr[i]!=null&&arr[i]>lo-(hi-lo)*.15&&arr[i]<hi+(hi-lo)*.15){lo=Math.min(lo,arr[i]);hi=Math.max(hi,arr[i])}
  if(P) for(const p of [P.E,P.SL,P.TP1,P.TP2]){lo=Math.min(lo,p);hi=Math.max(hi,p)}
  const pad=(hi-lo)*.06; lo-=pad; hi+=pad;
  const y=p=>8+(1-(p-lo)/(hi-lo))*(mainH-16), x=i=>padL+(i-s0+.5)*bw;
  ctx.font="11px 'IBM Plex Mono', ui-monospace, monospace"; ctx.textBaseline="middle";
  // grid + price axis
  const ticks=5; ctx.lineWidth=1;
  for(let k=0;k<=ticks;k++){const p=lo+(hi-lo)*k/ticks, yy=Math.round(y(p))+.5; ctx.strokeStyle=C.grid; ctx.beginPath(); ctx.moveTo(padL,yy); ctx.lineTo(padL+plotW,yy); ctx.stroke(); ctx.fillStyle=C.mu; ctx.textAlign="left"; ctx.fillText(fmt(p),padL+plotW+6,yy)}
  // time labels
  ctx.textAlign="center"; ctx.fillStyle=C.mu;
  const every=Math.ceil(N/(W<520?3:6));
  for(let i=s0;i<d.length;i+=every){ if(d[i].t) ctx.fillText(fmtTime(d[i].t),x(i),H-7) }
  const RIGHT=padL+plotW, clampY=v=>Math.max(1,Math.min(mainH-1,v));
  const box=(i0,i1,top,bot,fill,stroke,alpha)=>{if(top<lo&&bot<lo||top>hi&&bot>hi)return;const x0=Math.max(padL,x(Math.max(i0,s0))-bw/2),x1=i1==null?RIGHT:Math.min(RIGHT,x(i1)+bw/2),y0=clampY(y(top)),y1=clampY(y(bot));
    ctx.globalAlpha=alpha;ctx.fillStyle=fill;ctx.fillRect(x0,y0,x1-x0,y1-y0);ctx.globalAlpha=1;if(stroke){ctx.strokeStyle=stroke;ctx.lineWidth=1;ctx.strokeRect(x0+.5,y0+.5,x1-x0-1,y1-y0-1)}return {x0,y0,x1,y1}};
  ctx.font="600 9.5px 'IBM Plex Mono', monospace";
  // AMD: session separators, accumulation box, manipulation extreme, distribution start
  if(ov.amd&&I.amd.length){
    const W3=tok("--warn");
    for(const S of I.amd){ if(S.e<s0) continue;
      if(S.s>=s0){const xs=Math.round(x(S.s)-bw/2)+.5;ctx.strokeStyle=C.line;ctx.setLineDash([2,3]);ctx.beginPath();ctx.moveTo(xs,0);ctx.lineTo(xs,mainH);ctx.stroke();ctx.setLineDash([])}
      const b=box(S.s,S.ae,S.accHi,S.accLo,C.mu,C.mu,.12); if(b&&S.ae>=s0){ctx.fillStyle=C.mu;ctx.textAlign="left";ctx.fillText("A",b.x0+3,b.y0+8)}
      if(S.manip&&S.manip.ej>=s0){const mx=x(S.manip.ej),my=y(S.manip.ext)+(S.manip.side==="low"?14:-14);ctx.fillStyle=W3;ctx.textAlign="center";ctx.beginPath();ctx.arc(mx,y(S.manip.ext)+(S.manip.side==="low"?5:-5),2.5,0,7);ctx.fill();ctx.fillText("M",mx,clampY(my))}
      if(S.dist&&S.dist.j>=s0){const dx=x(S.dist.j),col=S.dist.dir>0?C.up:C.dn,dy=y(d[S.dist.j].c);ctx.fillStyle=col;ctx.textAlign="center";ctx.fillText(S.dist.dir>0?"D ▲":"D ▼",dx,clampY(dy+(S.dist.dir>0?18:-18)))}
    }
  }
  // Fibonacci retracement + extensions with OTE band
  if(ov.fib){
    const FBI=I.fib, FC=tok("--fib"), x0=Math.max(padL,x(Math.max(FBI.startI,s0)));
    box(Math.max(FBI.startI,s0),null,Math.max(...FBI.ote),Math.min(...FBI.ote),FC,null,.09);
    for(const l of FBI.levels){ if(l.p<lo||l.p>hi) continue; const yy=Math.round(y(l.p))+.5;
      ctx.strokeStyle=FC;ctx.globalAlpha=l.r===.618||l.r===.5?.95:.6;ctx.lineWidth=l.r===.618?1.4:1;ctx.setLineDash(l.r>1?[4,3]:[]);
      ctx.beginPath();ctx.moveTo(x0,yy);ctx.lineTo(RIGHT,yy);ctx.stroke();ctx.setLineDash([]);ctx.globalAlpha=1;
      ctx.fillStyle=FC;ctx.textAlign="left";ctx.fillText(`${l.r} · ${fmt(l.p)}`,x0+3,yy-6)}
  }
  // fair value gaps (open ones extend to the right edge; filled ones stop where they filled)
  if(ov.fvg) for(const g of I.fvgs){ if((g.end??d.length)<s0) continue; if(g.end!=null&&g.end-g.i<2) continue;
    const col=g.dir>0?C.up:C.dn, b=box(g.i-1,g.end,g.top0,g.bot0,col,null,g.end==null?.16:.06);
    if(b&&g.end==null){ctx.fillStyle=col;ctx.textAlign="left";ctx.fillText("FVG",b.x0+2,(b.y0+b.y1)/2+3)} }
  // order blocks from SMC breaks (unbroken ones extend right)
  if(ov.smc){ const OBC=tok("--ob");
    for(const e of I.smc.events){const o=e.ob; if((o.end??d.length)<s0||o.state==="broken"&&o.end-o.i<3) continue;
      const b=box(o.i,o.end,o.hi,o.lo,OBC,o.state==="broken"?null:OBC,o.state==="broken"?.05:.14);
      if(b&&o.state!=="broken"){ctx.fillStyle=OBC;ctx.textAlign="left";ctx.fillText(o.dir>0?"Bull OB":"Bear OB",b.x0+2,b.y0+9)}}
  }
  ctx.font="11px 'IBM Plex Mono', monospace";
  // volume profile (behind everything): rows grow leftward from the price axis
  if(ov.vp&&I.vp){
    const vp=I.vp, mx=Math.max(...vp.bins), maxW=plotW*.24, accent=tok("--accent"), cva=tok("--vp-va"), cvp=tok("--vp");
    vp.bins.forEach((b,k)=>{const a=vp.lo+k*vp.step, z=a+vp.step; if(z<lo||a>hi) return;
      const y1=y(Math.min(z,hi)), y2=y(Math.max(a,lo)), w=b/mx*maxW;
      ctx.fillStyle=k===vp.pocIdx?accent:(k>=vp.vaLo&&k<=vp.vaHi?cva:cvp); ctx.globalAlpha=k===vp.pocIdx?.55:.75;
      ctx.fillRect(padL+plotW-w,y1+.5,w,Math.max(1,y2-y1-1))});
    ctx.globalAlpha=1;
    for(const [p,lab] of [[vp.vah,"VAH"],[vp.val,"VAL"],[vp.poc,"POC"]]){ if(p<lo||p>hi) continue;
      const yy=Math.round(y(p))+.5; ctx.strokeStyle=lab==="POC"?accent:cva; ctx.lineWidth=1; ctx.globalAlpha=.9; ctx.beginPath(); ctx.moveTo(padL+plotW-maxW,yy); ctx.lineTo(padL+plotW,yy); ctx.stroke(); ctx.globalAlpha=1;
      ctx.fillStyle=lab==="POC"?accent:C.mu; ctx.textAlign="right"; ctx.font="600 10px 'IBM Plex Mono', monospace"; ctx.fillText(lab,padL+plotW-maxW-4,yy); ctx.font="11px 'IBM Plex Mono', monospace"}
  }
  // key levels
  const lvls=!ov.levels?[]:[...m.resistance.map(l=>({...l,k:"R"})),...m.support.map(l=>({...l,k:"S"}))].filter(l=>l.p>lo&&l.p<hi);
  ctx.setLineDash([5,4]);
  for(const l of lvls){const yy=Math.round(y(l.p))+.5; ctx.strokeStyle=l.k==="R"?C.dn:C.up; ctx.globalAlpha=.7; ctx.beginPath(); ctx.moveTo(padL,yy); ctx.lineTo(padL+plotW,yy); ctx.stroke(); ctx.globalAlpha=1; ctx.fillStyle=l.k==="R"?C.dn:C.up; ctx.textAlign="left"; ctx.font="600 10px 'IBM Plex Mono', monospace"; ctx.fillText(l.k+(l.touches>1?"×"+l.touches:""),padL+4,yy-8); ctx.font="11px 'IBM Plex Mono', monospace"}
  ctx.setLineDash([]);
  // EMAs
  if(ov.ema) for(const [arr,col] of [[I.e200,C.e200],[I.e50,C.e50],[I.e20,C.e20]]){ctx.strokeStyle=col; ctx.lineWidth=1.5; ctx.beginPath(); let st=false; for(let i=s0;i<d.length;i++){if(arr[i]==null)continue; st?ctx.lineTo(x(i),y(arr[i])):ctx.moveTo(x(i),y(arr[i])); st=true} ctx.stroke()}
  // candles
  const cw=Math.max(1,bw*.62);
  for(let i=s0;i<d.length;i++){const b=d[i], up=b.c>=b.o, col=up?C.up:C.dn; ctx.strokeStyle=col; ctx.fillStyle=col; ctx.lineWidth=1;
    const xx=Math.round(x(i))+.5; ctx.beginPath(); ctx.moveTo(xx,y(b.h)); ctx.lineTo(xx,y(b.l)); ctx.stroke();
    const top=y(Math.max(b.o,b.c)), bh=Math.max(1,Math.abs(y(b.o)-y(b.c))); ctx.fillRect(x(i)-cw/2,top,cw,bh)}
  // swing markers
  for(const s of I.sw){ if(s.i<s0) continue; ctx.fillStyle=C.mu; const yy=s.type==="H"?y(s.p)-7:y(s.p)+7; ctx.beginPath(); ctx.arc(x(s.i),yy,1.8,0,7); ctx.fill() }
  // BOS / CHoCH: line from the broken swing to the breaking candle
  if(ov.smc) for(const e of I.smc.events){ if(e.i<s0) continue;
    const col=e.dir>0?C.up:C.dn, yy=Math.round(y(e.p))+.5, x1=x(Math.max(e.from,s0)), x2=x(e.i);
    ctx.strokeStyle=col; ctx.lineWidth=1; ctx.setLineDash(e.type==="CHoCH"?[4,3]:[]); ctx.beginPath(); ctx.moveTo(x1,yy); ctx.lineTo(x2,yy); ctx.stroke(); ctx.setLineDash([]);
    ctx.fillStyle=col; ctx.textAlign="center"; ctx.font=`${e.type==="CHoCH"?"700":"600"} 9.5px 'IBM Plex Mono', monospace`; ctx.fillText(e.type,(x1+x2)/2,yy+(e.dir>0?-6:9)); ctx.font="11px 'IBM Plex Mono', monospace";
  }
  // anchored VWAP + bands
  if(ov.avwap&&VW){
    const vw=VW, C2=tok("--vwap");
    const line=(fn,dash,alpha,wid)=>{ctx.strokeStyle=C2;ctx.globalAlpha=alpha;ctx.lineWidth=wid;ctx.setLineDash(dash);ctx.beginPath();let st=false;
      for(let i=Math.max(s0,vw.a);i<d.length;i++){const p=fn(i);if(p==null)continue;const yy=Math.max(2,Math.min(mainH-2,y(p)));st?ctx.lineTo(x(i),yy):ctx.moveTo(x(i),yy);st=true}ctx.stroke();ctx.setLineDash([]);ctx.globalAlpha=1};
    for(const k of [-2,-1,1,2]) line(i=>vw.v[i]+k*vw.sd[i],Math.abs(k)===2?[2,4]:[5,4],Math.abs(k)===2?.45:.65,1);
    line(i=>vw.v[i],[],1,2);
    if(vw.a>=s0){const ax=x(vw.a), ay=Math.min(mainH-8,y(d[vw.a].l)+12); ctx.fillStyle=C2; ctx.beginPath(); ctx.moveTo(ax,ay-5); ctx.lineTo(ax+5,ay); ctx.lineTo(ax,ay+5); ctx.lineTo(ax-5,ay); ctx.fill()}
  }
  // liquidity sweeps: dotted line from the swept swing to the sweep candle, plus a marker on the wick
  if(ov.sweeps) for(const s of I.sweeps){ if(s.i<s0) continue;
    const col=s.side==="high"?C.dn:C.up, yy=Math.round(y(s.p))+.5, x1=x(Math.max(s.from,s0)), x2=x(s.i);
    ctx.strokeStyle=col; ctx.lineWidth=1.2; ctx.setLineDash([2,3]); ctx.beginPath(); ctx.moveTo(x1,yy); ctx.lineTo(x2,yy); ctx.stroke(); ctx.setLineDash([]);
    const ty=s.side==="high"?y(s.ext)-6:y(s.ext)+6, dir=s.side==="high"?-1:1;
    ctx.fillStyle=col; ctx.beginPath(); ctx.moveTo(x2,ty); ctx.lineTo(x2-4,ty+dir*7); ctx.lineTo(x2+4,ty+dir*7); ctx.closePath(); ctx.fill();
    ctx.font="600 9.5px 'IBM Plex Mono', monospace"; ctx.textAlign="center"; ctx.fillText("SWP",x2,ty+dir*15); ctx.font="11px 'IBM Plex Mono', monospace";
  }
  // trade plan: trailing-stop line, risk/reward zones over the last bars, level lines and axis tags
  if(P){
    const W2=tok("--warn"), upS=tok("--up-soft"), dnS=tok("--down-soft");
    const zx=x(Math.max(s0,d.length-Math.min(24,Math.floor(N/4))))-bw/2, zw=padL+plotW-zx;
    ctx.globalAlpha=.85; ctx.fillStyle=upS; ctx.fillRect(zx,Math.min(y(P.E),y(P.TP2)),zw,Math.abs(y(P.TP2)-y(P.E)));
    ctx.fillStyle=dnS; ctx.fillRect(zx,Math.min(y(P.E),y(P.SL)),zw,Math.abs(y(P.SL)-y(P.E))); ctx.globalAlpha=1;
    const lines=[[P.TP2,"TP2",C.up],[P.TP1,"TP1",C.up],[P.E,"ENTRY",C.fg],[P.SL,"SL",C.dn]];
    if(Math.abs(P.tslNow-P.E)>1e-12) lines.push([P.tslNow,"TSL",W2]); else lines[2][1]="ENTRY · TSL";
    for(const [p,lab,col] of lines){const yy=Math.round(y(p))+.5;
      ctx.strokeStyle=col; ctx.lineWidth=lab==="ENTRY"?1.6:1.2; ctx.beginPath(); ctx.moveTo(zx,yy); ctx.lineTo(padL+plotW,yy); ctx.stroke();
      ctx.font="600 10px 'IBM Plex Mono', monospace"; ctx.textAlign="left"; ctx.fillStyle=col; ctx.fillText(lab,zx+4,yy-7);
      ctx.fillStyle=col; ctx.fillRect(padL+plotW+1,yy-8,padR-2,16); ctx.fillStyle=tok("--surface"); ctx.font="500 10.5px 'IBM Plex Mono', monospace"; ctx.fillText(fmt(p),padL+plotW+5,yy)}
    ctx.font="11px 'IBM Plex Mono', monospace";
  }
  // last price tag
  const ly=y(m.close); ctx.fillStyle=C.acc; ctx.fillRect(padL+plotW+1,ly-9,padR-2,18); ctx.fillStyle=tok("--accent-ink"); ctx.textAlign="left"; ctx.font="500 11px 'IBM Plex Mono', monospace"; ctx.fillText(fmt(m.close),padL+plotW+5,ly);
  ctx.font="11px 'IBM Plex Mono', monospace";
  // lower pane
  ctx.strokeStyle=C.line; ctx.lineWidth=1; ctx.strokeRect(padL+.5,rsiTop+.5,plotW,rsiH);
  if(pane==="flow"&&I.flow){
    const dl=I.flow.delta.slice(s0), cv_=I.flow.cvd.slice(s0), mD=Math.max(...dl.map(Math.abs))||1, mid=rsiTop+rsiH/2;
    const cLo=Math.min(...cv_), cHi=Math.max(...cv_), cy=v=>rsiTop+4+(1-(v-cLo)/((cHi-cLo)||1))*(rsiH-8);
    ctx.strokeStyle=C.grid; ctx.beginPath(); ctx.moveTo(padL,mid+.5); ctx.lineTo(padL+plotW,mid+.5); ctx.stroke();
    dl.forEach((v,j)=>{const h=v/mD*(rsiH/2-3); ctx.fillStyle=v>=0?C.up:C.dn; ctx.globalAlpha=.55; ctx.fillRect(x(s0+j)-cw/2,v>=0?mid-h:mid,cw,Math.abs(h))}); ctx.globalAlpha=1;
    ctx.strokeStyle=C.fg; ctx.lineWidth=1.4; ctx.beginPath(); cv_.forEach((v,j)=>j?ctx.lineTo(x(s0+j),cy(v)):ctx.moveTo(x(s0+j),cy(v))); ctx.stroke();
    for(const ab of I.flow.absorption){ if(ab.i<s0) continue; ctx.fillStyle=C.acc; ctx.beginPath(); ctx.arc(x(ab.i),rsiTop+6,2.6,0,7); ctx.fill() }
    ctx.fillStyle=C.mu; ctx.textAlign="left"; ctx.fillText("Δ / CVD",padL+plotW+6,rsiTop+8);
  } else {
    const ry=v=>rsiTop+(1-v/100)*rsiH;
    ctx.fillStyle=C.grid; ctx.fillRect(padL+1,ry(70),plotW-1,ry(30)-ry(70));
    ctx.fillStyle=C.mu; ctx.textAlign="left"; for(const v of [70,30]) ctx.fillText(v,padL+plotW+6,ry(v));
    ctx.strokeStyle=C.acc; ctx.lineWidth=1.4; ctx.beginPath(); let st=false;
    for(let i=s0;i<d.length;i++){const v=I.r[i]; if(v==null)continue; st?ctx.lineTo(x(i),ry(v)):ctx.moveTo(x(i),ry(v)); st=true} ctx.stroke();
  }
  // crosshair
  if(hover>=s0){const i=hover, xx=Math.round(x(i))+.5; ctx.strokeStyle=C.mu; ctx.globalAlpha=.6; ctx.setLineDash([3,3]); ctx.beginPath(); ctx.moveTo(xx,0); ctx.lineTo(xx,H-16); ctx.stroke(); ctx.setLineDash([]); ctx.globalAlpha=1}
  return {s0,padL,bw,N};
}
