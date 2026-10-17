"use client";
import { useEffect, useRef, useState } from "react";
import { drawChart } from "@/lib/draw";
import { compact } from "@/lib/format";

export default function Chart({ data, ind, vw, ov, pane, plan, fmt, fmtTime, picking, onPick }) {
  const cv = useRef(null), geom = useRef(null), props = useRef(null);
  const [hover, setHover] = useState(-1);
  props.current = { data, ind, vw, ov, pane, plan, fmt, fmtTime, hover };

  const redraw = () => { geom.current = drawChart(cv.current, props.current); };
  useEffect(redraw);

  useEffect(() => {
    const ro = new ResizeObserver(() => redraw());
    ro.observe(cv.current);
    const mq = matchMedia("(prefers-color-scheme: dark)"); mq.addEventListener("change", redraw);
    const mo = new MutationObserver(redraw); mo.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
    return () => { ro.disconnect(); mq.removeEventListener("change", redraw); mo.disconnect(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const indexAt = (e) => {
    const g = geom.current; if (!g) return -1;
    const r = cv.current.getBoundingClientRect();
    const i = g.s0 + Math.floor((e.clientX - r.left - g.padL) / g.bw);
    return Math.max(g.s0, Math.min(data.length - 1, i));
  };

  const b = hover >= 0 ? data[hover] : null;
  return (
    <>
      <div className="readout">
        {b ? (
          <>
            {fmtTime(b.t)}  O <b>{fmt(b.o)}</b>  H <b>{fmt(b.h)}</b>  L <b>{fmt(b.l)}</b>  C <b>{fmt(b.c)}</b>  RSI <b>{ind.r[hover]?.toFixed(1) ?? "—"}</b>
            {ind.hasVol && <>  Vol <b>{compact(b.v)}</b>  Δ <b>{ind.flow.delta[hover] > 0 ? "+" : ""}{compact(ind.flow.delta[hover])}</b></>}
            {vw && vw.v[hover] != null && <>  AVWAP <b>{fmt(vw.v[hover])}</b></>}
          </>
        ) : picking ? "Click a candle to anchor the VWAP" : "Hover the chart to read a candle"}
      </div>
      <div className="chart-box">
        <canvas
          id="chart"
          ref={cv}
          style={{
  width: "100%",
  height: "100%",
  display: "block",
  cursor: picking ? "copy" : "crosshair"
}}
          aria-label="Candlestick chart with smart money concepts, fair value gaps, liquidity sweeps, volume profile and an indicator pane"
          onPointerMove={(e) => { const i = indexAt(e); if (i !== hover) setHover(i); }}
          onPointerLeave={() => setHover(-1)}
          onClick={(e) => { if (picking) onPick?.(indexAt(e)); }}
        />
      </div>
    </>
  );
}
