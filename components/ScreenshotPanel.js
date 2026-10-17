"use client";
import { useEffect, useRef, useState } from "react";
import Report, { Spinner } from "./Report";

// Downsize to ≤1568px on the long side (what the vision model uses anyway) and keep the upload small.
async function prepare(file) {
  const bmp = await createImageBitmap(file);
  const scale = Math.min(1, 1568 / Math.max(bmp.width, bmp.height));
  const c = document.createElement("canvas");
  c.width = Math.round(bmp.width * scale); c.height = Math.round(bmp.height * scale);
  c.getContext("2d").drawImage(bmp, 0, 0, c.width, c.height);
  const url = c.toDataURL("image/jpeg", 0.88);
  return { image: url.split(",")[1], mediaType: "image/jpeg" };
}

export default function ScreenshotPanel() {
  const [file, setFile] = useState(null), [preview, setPreview] = useState(null), [over, setOver] = useState(false);
  const [ctx, setCtx] = useState(""), [busy, setBusy] = useState(false), [report, setReport] = useState(null), [err, setErr] = useState(null);
  const input = useRef(null);

  const take = (f) => {
    if (!f) return;
    if (!/^image\/(png|jpeg|webp|gif)$/.test(f.type)) { setErr("That file isn't an image. Choose a PNG, JPG or WebP screenshot."); return; }
    setErr(null); setFile(f); setPreview((old) => { if (old) URL.revokeObjectURL(old); return URL.createObjectURL(f); });
  };
  useEffect(() => {
    const onPaste = (e) => { const it = [...(e.clipboardData?.items || [])].find((i) => i.type.startsWith("image/")); if (it) take(it.getAsFile()); };
    document.addEventListener("paste", onPaste);
    return () => document.removeEventListener("paste", onPaste);
  }, []);

  const run = async () => {
    if (!file || busy) return;
    setBusy(true); setErr(null); setReport(null);
    try {
      const body = { ...(await prepare(file)), context: ctx };
      const r = await fetch("/api/vision", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error);
      setReport(j.report);
    } catch (e) { setErr(e.message || "Couldn't analyze the screenshot. Try again."); }
    finally { setBusy(false); }
  };

  return (
    <div className="grid">
      <div className="col">
        <div className="panel">
          <div className="panel-head">
            <div><div className="eyebrow">Upload</div><div className="ptitle">Chart screenshot</div></div>
            {file && <button className="btn" onClick={() => { setFile(null); setPreview(null); setReport(null); if (input.current) input.current.value = ""; }}>Remove image</button>}
          </div>
          <label className={`drop${over ? " over" : ""}`} htmlFor="shotFile"
            onDragOver={(e) => { e.preventDefault(); setOver(true); }} onDragLeave={() => setOver(false)}
            onDrop={(e) => { e.preventDefault(); setOver(false); take(e.dataTransfer.files[0]); }}>
            {preview ? <img src={preview} alt="Uploaded chart screenshot" /> : (
              <div><strong>Drop a chart screenshot here</strong><p>or click to choose a PNG, JPG or WebP from TradingView, Zerodha Kite, Binance or MT5. You can also paste an image.</p></div>
            )}
          </label>
          <input ref={input} type="file" id="shotFile" accept="image/png,image/jpeg,image/webp" hidden onChange={(e) => take(e.target.files[0])} />
          <div className="shot-ctl">
            <div className="field" style={{ flex: 1, minWidth: 180 }}>
              <label htmlFor="shotCtx">Context (optional)</label>
              <input type="text" id="shotCtx" value={ctx} onChange={(e) => setCtx(e.target.value)} placeholder="e.g. BANKNIFTY 15m, focus on the range breakout" />
            </div>
            <button className="btn primary" disabled={!file || busy} onClick={run}>{report ? "Analyze again" : "Analyze screenshot"}</button>
          </div>
        </div>
      </div>
      <div className="col">
        <div className="panel">
          <div className="panel-head"><div><div className="eyebrow">AI review</div><div className="ptitle">What the chart shows</div></div></div>
          <div className="report">
            {busy ? <Spinner>Reading the screenshot…</Spinner> : report ? <Report report={report} /> : (
              <div className="empty"><span>Upload a screenshot and the AI reads it for:</span>
                <ul><li>Trend, structure, BOS and CHoCH</li><li>Order blocks, fair value gaps and liquidity sweeps</li><li>Momentum from visible indicators</li><li>Volatility and the levels that would change the picture</li></ul>
              </div>
            )}
            {err && <p className="err">{err}</p>}
          </div>
        </div>
      </div>
    </div>
  );
}
