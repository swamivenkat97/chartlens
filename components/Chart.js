"use client";

import { useEffect, useRef, useState } from "react";
import { drawChart } from "@/lib/draw";
import { compact } from "@/lib/format";

export default function Chart({
  data,
  ind,
  vw,
  ov,
  pane,
  plan,
  fmt,
  fmtTime,
  picking,
  onPick,
}) {
  const cv = useRef(null);
  const geom = useRef(null);
  const props = useRef(null);
  const [hover, setHover] = useState(-1);

  props.current = {
    data,
    ind,
    vw,
    ov,
    pane,
    plan,
    fmt,
    fmtTime,
    hover,
  };

  const redraw = () => {
    if (!cv.current || !props.current) return;
    geom.current = drawChart(cv.current, props.current);
  };

  useEffect(redraw);

  useEffect(() => {
    const canvas = cv.current;
    if (!canvas) return;

    const observer = new ResizeObserver(() => redraw());
    observer.observe(canvas);

    const media = window.matchMedia("(prefers-color-scheme: dark)");
    media.addEventListener("change", redraw);

    const themeObserver = new MutationObserver(() => redraw());
    themeObserver.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["data-theme"],
    });

    return () => {
      observer.disconnect();
      themeObserver.disconnect();
      media.removeEventListener("change", redraw);
    };
  }, []);

  const indexAt = (event) => {
    const geometry = geom.current;
    const canvas = cv.current;

    if (!geometry || !canvas || !data?.length) return -1;

    const rect = canvas.getBoundingClientRect();
    const index =
      geometry.s0 +
      Math.floor(
        (event.clientX - rect.left - geometry.padL) / geometry.bw
      );

    return Math.max(
      geometry.s0,
      Math.min(data.length - 1, index)
    );
  };

  const candle = hover >= 0 ? data?.[hover] : null;

  return (
    <>
      <div className="readout">
        {candle ? (
          <>
            {fmtTime(candle.t)}
            {"  "}O <b>{fmt(candle.o)}</b>
            {"  "}H <b>{fmt(candle.h)}</b>
            {"  "}L <b>{fmt(candle.l)}</b>
            {"  "}C <b>{fmt(candle.c)}</b>
            {"  "}RSI <b>{ind.r[hover]?.toFixed(1) ?? "—"}</b>

            {ind.hasVol && (
              <>
                {"  "}Vol <b>{compact(candle.v)}</b>
                {"  "}Δ{" "}
                <b>
                  {ind.flow.delta[hover] > 0 ? "+" : ""}
                  {compact(ind.flow.delta[hover])}
                </b>
              </>
            )}

            {vw && vw.v[hover] != null && (
              <>
                {"  "}AVWAP <b>{fmt(vw.v[hover])}</b>
              </>
            )}
          </>
        ) : picking ? (
          "Click a candle to anchor the VWAP"
        ) : (
          "Hover the chart to read a candle"
        )}
      </div>

      <div className="chart-box">
        <canvas
          ref={cv}
          style={{
            width: style="width:100%;height:100%;display:block;cursor:crosshair;touch-action:pan-y"
            height: "100%",
            display: "block",
            cursor: picking ? "copy" : "crosshair",
            touchAction: "pan-y",
          }}
          aria-label="Candlestick chart with smart money concepts, fair value gaps, liquidity sweeps, volume profile and an indicator pane"
          onPointerMove={(event) => {
            const index = indexAt(event);
            if (index !== hover) setHover(index);
          }}
          onPointerLeave={() => setHover(-1)}
          onClick={(event) => {
            if (!picking) return;
            const index = indexAt(event);
            if (index >= 0) onPick?.(index);
          }}
        />
      </div>
    </>
  );
}
