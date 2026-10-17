"use client";
import { useEffect, useRef, useState } from "react";
import { tradingViewSymbol, TV_INTERVALS } from "@/lib/tradingview";

export default function TradingViewChart({ market, symbol, timeframe }) {
  const host = useRef(null);
  const [error, setError] = useState(false);
  const [theme, setTheme] = useState("light");
  const ticker = tradingViewSymbol(market, symbol);
  useEffect(() => {
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const sync = () => {
      const selected = document.documentElement.getAttribute("data-theme");
      setTheme(selected === "dark" || (selected !== "light" && media.matches) ? "dark" : "light");
    };
    sync();
    media.addEventListener("change", sync);
    const observer = new MutationObserver(sync);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
    return () => { media.removeEventListener("change", sync); observer.disconnect(); };
  }, []);
  useEffect(() => {
    const container = host.current;
    if (!container || !ticker) return;
    setError(false);
    const widget = document.createElement("div");
    widget.className = "tradingview-widget-container__widget";
    widget.style.height = "calc(100% - 32px)";
    widget.style.width = "100%";
    const copyright = document.createElement("div");
    copyright.className = "tradingview-widget-copyright";
    const link = document.createElement("a");
    link.href = "https://www.tradingview.com/";
    link.target = "_blank";
    link.rel = "noopener nofollow";
    link.textContent = "Track all markets on TradingView";
    copyright.appendChild(link);
    const script = document.createElement("script");
    script.src = "https://s3.tradingview.com/external-embedding/embed-widget-advanced-chart.js";
    script.type = "text/javascript";
    script.async = true;
    script.textContent = JSON.stringify({
      autosize: true, symbol: ticker, interval: TV_INTERVALS[timeframe] || "D",
      timezone: market === "nse" ? "Asia/Kolkata" : "Etc/UTC",
      theme, style: "1", locale: "en", allow_symbol_change: false,
      hide_top_toolbar: true, hide_side_toolbar: false, hide_legend: false,
      hide_volume: false, calendar: false, details: false,
      save_image: true, withdateranges: false, studies: [],
      support_host: "https://www.tradingview.com"
    });
    script.onerror = () => setError(true);
    container.replaceChildren(widget, copyright, script);
    return () => { script.onerror = null; container.replaceChildren(); };
  }, [ticker, timeframe, theme, market]);
  return (
    <div style={{ padding: "12px 6px 8px" }}>
      <div ref={host} className="tradingview-widget-container" style={{ height: 520, width: "100%", minWidth: 0 }} aria-label={`TradingView chart for ${symbol}`} />
      {error && <p className="err" role="alert">TradingView could not load. Check your connection or content blocker, then refresh.</p>}
      <p style={{ padding: "0 8px", fontSize: 12, color: "var(--muted)" }}>
        Select the market and timeframe above to update the chart and scores. Scores, quotes and trade plans use ChartLens data, not TradingView candles; prices may differ. TradingView data may be delayed or unavailable for some instruments. Custom ChartLens overlays and trade-plan lines are not drawn on this widget.
      </p>
    </div>
  );
}
