import Link from "next/link";
import Logo from "@/components/Logo";
import HeroChart from "@/components/HeroChart";
import WaitlistForm from "@/components/WaitlistForm";

const TOOLS = [
  { k: "BOS · CHoCH · OB", h: "Smart money concepts", p: "Breaks of structure, changes of character and the order blocks that caused them, with premium and discount zones." },
  { k: "3-candle gaps", h: "Fair value gaps", p: "Every imbalance a fast move leaves behind, tracked until it fills. Open gaps stay on the chart; filled ones fade." },
  { k: "Wick through, close back", h: "Liquidity sweeps", p: "Stop runs beyond prior swings that fail to hold, plus equal highs and lows where the next stops are resting." },
  { k: "Power of 3", h: "AMD sessions", p: "Each session split into accumulation, manipulation and distribution, so you can see which side got trapped." },
  { k: "Δ · CVD · absorption", h: "Order flow", p: "Buying versus selling pressure per candle, cumulative delta and divergences, and heavy volume that failed to move price." },
  { k: "POC · VAH · VAL", h: "Volume profile", p: "Where the last 120 candles actually traded, with the point of control and the 70% value area." },
  { k: "±1σ ±2σ bands", h: "Anchored VWAP", p: "The average price paid since any candle you choose: a range low, a swing, or the highest-volume bar." },
  { k: "0.618 – 0.786 OTE", h: "Fibonacci", p: "Retracements and extensions on the dominant leg, with the optimal trade entry zone shaded." },
  { k: "Entry · TP1 · TP2 · SL · TSL", h: "Trade plan", p: "Rule-based levels from structure and ATR, reward-to-risk for each target, a trailing stop and position size." },
];

const MARKETS = [
  { h: "Crypto", s: "BTCUSDT · BTCUSD · ETHUSDT · SOLUSDT", p: "Live candles streamed from Binance, around the clock." },
  { h: "Forex & gold", s: "XAUUSD · EURUSD · GBPUSD · USDJPY · USDINR", p: "Major pairs and gold, refreshed every minute." },
  { h: "NSE", s: "NIFTY 50 · BANKNIFTY · RELIANCE · HDFCBANK · TCS", p: "Indian indices and large caps on IST session times." },
];

const STEPS = [
  { h: "Pick a market and timeframe", p: "Anything from 1-minute to weekly. Or upload a screenshot from TradingView, Kite or MT5." },
  { h: "Read the map", p: "Structure, order blocks, gaps, sweeps, volume and AMD are drawn for you and scored in plain cards." },
  { h: "Ask the AI analyst", p: "Get a structured report on what the chart shows, what would confirm it, and what would cancel it. Then ask follow-ups." },
];

export default function Landing() {
  return (
    <main className="lp">
      <header className="lp-nav lp-in">
        <Link href="/" className="brand" style={{ textDecoration: "none" }}><Logo /><h1>ChartLens</h1></Link>
        <nav className="lp-links">
          <a href="#tools">Tools</a><a href="#markets">Markets</a><a href="#how">How it works</a>
          <Link className="btn primary" href="/app">Open the analyzer</Link>
        </nav>
      </header>

      <section className="lp-hero lp-in">
        <div className="lp-hero-copy">
          <p className="eyebrow">Crypto · Forex · Gold · NSE</p>
          <h2 className="lp-h1">See what the chart is actually doing.</h2>
          <p className="lp-lede">ChartLens maps structure, order blocks, fair value gaps, liquidity sweeps and order flow on your chart, then an AI analyst explains it in plain English.</p>
          <div className="lp-cta">
            <Link className="btn primary lp-big" href="/app">Open the analyzer</Link>
            <a className="btn lp-big" href="#waitlist">Get early access</a>
          </div>
        </div>
        <HeroChart />
      </section>

      <section id="tools" className="lp-sec lp-in">
        <div className="lp-sec-head">
          <p className="eyebrow">The toolkit</p>
          <h2 className="lp-h2">Nine ways to read one chart</h2>
          <p className="lp-sub">Every overlay is calculated from the candles in front of you and can be switched on or off.</p>
        </div>
        <div className="lp-tools">
          {TOOLS.map((t) => (
            <article key={t.h} className="lp-tool">
              <span className="lp-k">{t.k}</span>
              <h3>{t.h}</h3>
              <p>{t.p}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="lp-band">
        <div className="lp-in lp-ai">
          <div>
            <p className="eyebrow">AI analyst</p>
            <h2 className="lp-h2">A second pair of eyes on every setup</h2>
            <p className="lp-sub">The analyst reads the same numbers you see and writes a structured review: structure, SMC, AMD, momentum, liquidity, order flow, volume and risk. It lists the levels that matter and what would confirm or cancel the reading. If you have a trade plan on, it checks whether your stop sits inside an obvious stop pool.</p>
            <p className="lp-sub">Upload a screenshot instead, and it reads that chart the same way.</p>
          </div>
          <div className="panel lp-sample" aria-label="Sample AI report">
            <div className="panel-head"><div><div className="eyebrow">Sample report</div><div className="ptitle">BTCUSDT · 4H</div></div><span className="pill up">Bullish read</span></div>
            <div className="report">
              <p className="summary">Price broke the last swing high after sweeping equal lows, leaving a bullish order block and an open fair value gap below. It now trades in premium, so the gap is the first area a pullback would test.</p>
              <div className="sec"><div className="sec-h"><h4>Smart money concepts</h4><span className="tag">CHoCH up</span></div>
                <ul><li>CHoCH above the swing high confirmed a shift in order flow.</li><li>The order block below has not been retested yet.</li></ul></div>
              <div className="sec"><div className="sec-h"><h4>Risk</h4><span className="tag">Normal volatility</span></div>
                <ul><li>A stop under the equal lows would sit inside the stop pool that was just swept.</li></ul></div>
            </div>
          </div>
        </div>
      </section>

      <section id="markets" className="lp-sec lp-in">
        <div className="lp-sec-head">
          <p className="eyebrow">Markets</p>
          <h2 className="lp-h2">From Bitcoin to Bank Nifty</h2>
          <p className="lp-sub">Eight timeframes on every instrument: 1m, 5m, 15m, 30m, 1H, 4H, 1D and 1W.</p>
        </div>
        <div className="lp-markets">
          {MARKETS.map((m) => (
            <div key={m.h} className="lp-market"><h3>{m.h}</h3><p className="lp-sym">{m.s}</p><p>{m.p}</p></div>
          ))}
        </div>
      </section>

      <section id="how" className="lp-sec lp-in">
        <div className="lp-sec-head"><p className="eyebrow">How it works</p><h2 className="lp-h2">Three steps</h2></div>
        <ol className="lp-steps">
          {STEPS.map((s, i) => (<li key={s.h}><span className="lp-n">{i + 1}</span><div><h3>{s.h}</h3><p>{s.p}</p></div></li>))}
        </ol>
      </section>

      <section id="waitlist" className="lp-band">
        <div className="lp-in lp-wl">
          <div>
            <h2 className="lp-h2">Get early access</h2>
            <p className="lp-sub">Leave your email and we&apos;ll let you know when accounts open.</p>
          </div>
          <WaitlistForm />
        </div>
      </section>

      <footer className="lp-foot lp-in">
        <div className="brand"><Logo size={24} /><strong>ChartLens</strong></div>
        <p className="disc"><strong>Educational use only.</strong> ChartLens explains market structure and risk to help you learn to read charts. It does not give investment advice or recommendations and is not registered with SEBI or any regulator. Trade plans are calculated mechanically from rules you choose. Order flow is estimated from candle data. Trading carries risk of loss; decisions are yours.</p>
        <p className="lp-small">© {new Date().getFullYear()} ChartLens</p>
      </footer>
    </main>
  );
}
