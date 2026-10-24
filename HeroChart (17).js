"use client";
import { useMemo } from "react";
import { MARKETS } from "@/lib/instruments";
import { demoSeries } from "@/lib/demo";
import { analyze, computePlan } from "@/lib/analysis";
import { makeFmt, makeFmtTime } from "@/lib/format";
import Chart from "./Chart";

// A static demo chart for the landing page: computed in the browser, no API calls.
export default function HeroChart() {
  const sym = MARKETS.crypto.symbols[0];
  const { data, ind, plan, fmt, fmtTime } = useMemo(() => {
    const data = demoSeries(sym, "4H", 300, Date.UTC(2026, 9, 16, 12));
    const ind = analyze(data, { src: "demo", tf: "4H", mkt: "crypto" });
    const fmt = makeFmt(sym.d);
    const plan = computePlan(data, ind, { side: ind.m.smc.trend >= 0 ? "long" : "short", targets: "levels" }, fmt);
    return { data, ind, plan, fmt, fmtTime: makeFmtTime(data, "4H", "demo") };
  }, [sym]);
  return (
    <div className="panel lp-chart">
      <div className="panel-head">
        <div className="quote"><h2>{sym.s}</h2><span className="px">{fmt(data.at(-1).c)}</span></div>
        <span className="tag demo">Sample chart · 4H</span>
      </div>
      <Chart data={data} ind={ind} vw={null} ov={{ smc: true, fvg: true, sweeps: true, fib: false, amd: false, vp: true, avwap: false, ema: false, levels: false }}
        pane="flow" plan={plan} fmt={fmt} fmtTime={fmtTime} picking={false} />
    </div>
  );
}
