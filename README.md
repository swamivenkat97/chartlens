
# ChartLens

AI chart analysis for crypto, forex, gold and NSE. One Next.js project with:

- **`/`** – landing page with a sample chart and an email waitlist
- **`/app`** – the analyzer: live charts, smart money concepts, FVGs, liquidity sweeps, AMD, Fibonacci, order flow, volume profile, anchored VWAP, a rule-based trade plan and an AI analyst

## Run it locally

Requires Node.js 20 or newer.

```bash
npm install
cp .env.example .env.local   # then fill in ANTHROPIC_API_KEY at least
npm run dev                  # http://localhost:3000
```

## Deploy to Vercel

1. Push this folder to a GitHub repo.
2. In Vercel: **Add New → Project**, import the repo. The framework preset is detected as Next.js; no build settings to change.
3. In **Settings → Environment Variables**, add the keys below, then redeploy.
4. Optional: **Storage / Marketplace → Upstash (Redis)** and connect it to the project. It sets `KV_REST_API_URL` and `KV_REST_API_TOKEN`, which turns the waitlist on.
5. Add your domain under **Settings → Domains**.

`vercel.json` pins serverless functions to Mumbai (`bom1`), close to Indian users and to Binance's servers. Change it if your users are elsewhere.

## Environment variables

| Variable | Needed for | Notes |
|---|---|---|
| `ANTHROPIC_API_KEY` | Optional ticker AI reports and follow-up questions; not screenshot review | From console.anthropic.com |
| `ANTHROPIC_MODEL` | Optional ticker AI reports | Default `claude-sonnet-5-5` |
| `ANTHROPIC_FAST_MODEL` | Follow-up questions | Default `claude-haiku-5-5` |
| `TWELVE_DATA_API_KEY` | Forex, gold, NSE, BTCUSD candles | Without it these markets show demo data |
| `KV_REST_API_URL`, `KV_REST_API_TOKEN` | Waitlist | Set by the Upstash integration |
| `AI_RATE_LIMIT_PER_HOUR` | Abuse protection | Default 30 AI calls per IP per hour, per server instance |

## Current upload workflow: 4H → 1H → 15m → 5m

The **Chart + live analysis** tab accepts a screenshot reference and automatically
loads current candles for the selected instrument. No indicator, direction or trade
price fields are required. The image is local and is **not read or uploaded**.
This is live-market analysis beside an image, not automated screenshot interpretation;
it cannot analyze historical image content or infer the symbol/time from pixels.

`/api/hierarchy` fetches 300 candles for each of 4H, 1H, 15m and 5m. Closed candles
only are used. 4H sets direction, 1H confirms swing structure, 15m requires a setup,
and 5m supplies the entry trigger. EMA9/21, UTC-session VWAP, actual volume, RSI14
and risk checks must agree before BUY/SELL. Otherwise the result is NO TRADE.
The seven technical reviews remain visible below the four-stage assessment.

The entry is the last completed 5m close. SL uses the prior three completed 5m
candles plus 0.1 ATR; TP1 and TP2 are 2R and 3R. A nearer opposing 1H level within
2R blocks the plan. TSL is a conditional rule: reassess after TP1, consider breakeven
after costs, then trail newly confirmed 5m swings with an ATR buffer, never widening.
No stop or order is executed or actively managed.

The upload selector offers XAUUSD and BTCUSD, mapped to Twelve Data XAU/USD and BTC/USD. Both require `TWELVE_DATA_API_KEY` in Vercel. Check coverage for all four
intervals and volume. No AI key is used. Every uncached refresh needs four provider
time-series requests; the 60-second cache is per server instance, not a global limit.
Failed, insufficient, stale, duplicate or gapped data blocks signals. Missing volume
or incomplete UTC-session history blocks VWAP-dependent approval rather than being
estimated. The opening range is explicitly UTC 00:00–00:15.

Tests: `node --test tests/hierarchy-analysis.test.mjs`.

## Previous standalone market scanner

The previous **Automatic analysis** implementation provides
a seven-technique market scanner. No screenshot, manually entered direction,
indicator readings, entry, SL or targets are required. The server reads real
one-minute candles and derives complete 5m and 15m candles. It computes swing
structure/BOS/CHoCH, support/resistance, EMA9/EMA21, RSI14, volume ratios,
UTC-session VWAP, breakouts/retests, sweeps/reversals and a generated trade plan.

The seven results cover market structure, VWAP/EMA, momentum, breakouts, opening
range, reversals and the automatic validator of the generated setup. The strongest
confirmed setup must also pass the validator's trend, VWAP, EMA, volume, momentum
and risk checks. Missing/conflicting evidence, stale data, gaps or demo data mean
NO TRADE. It never substitutes another symbol for XAUUSD.

**XAUUSD needs a real feed:** add `TWELVE_DATA_API_KEY` to the existing Vercel
project and redeploy. The key must have access to `XAU/USD` one-minute history.
Without it the UI displays Feed not connected / NO TRADE. No AI key is required.
BTCUSDT and ETHUSDT use the existing Binance public market-data host without a key.
No live gold data has been verified locally; data-plan access and volume coverage
must be checked with the provider. Missing volume disables volume/VWAP-dependent
signals rather than being estimated. Provider volume is not assumed to represent
centralized spot-gold trading volume.

Refresh interval and per-instance shared fetch cache: 60 seconds. The cache is
best-effort and is not a global quota limit across serverless instances. The latest
complete 1m candle must be no more than two minutes old. A full UTC-midnight session
is required for VWAP; the opening range is explicitly 00:00–00:15 UTC, not a London
or New York opening range. With limited history, session-based checks remain unavailable.

Entry is the latest completed 1m close, within 0.25 × 5m ATR of the latest 5m close.
SL is beyond the last three completed 5m candles plus a 0.1 ATR buffer. Targets are
2R and 3R and are risk multiples, not forecasts. A known nearer opposing level
within 2R blocks approval. Volume must be at least 1.5× the prior 20 bars. RSI BUY
band is 55–70; SELL is 30–45. Momentum's 1–10 score is rule agreement, not win probability.
Signals are reference levels before costs, not executable broker quotes or orders.

Tests: `node --test tests/automatic-technical.test.mjs`.

The manual screenshot form is retired. The old `/api/vision` route remains HTTP
410; automatic analysis never invokes a model. The ticker UI is a separate feature
and loads only when selected.

## Where the data comes from

| Market | Source | Updates |
|---|---|---|
| Crypto (BTCUSDT, ETHUSDT, SOLUSDT) | Binance public market data (free, no key) | Live: the browser streams Binance's kline WebSocket |
| BTCUSD, forex, gold (XAUUSD) | Twelve Data | Refreshed every 60 s |
| NSE (NIFTY 50, BANKNIFTY, stocks) | Twelve Data, `exchange=NSE` | Refreshed every 60 s |
| Anything else | Your CSV upload | Static |

Before relying on NSE data, confirm in Twelve Data's symbol search that the index symbols in `lib/instruments.js` (`NIFTY 50`, `NIFTY BANK`) are covered by your plan, and check your data licence allows showing it to users. For tick-by-tick NSE data, use Zerodha Kite Connect or Upstox. Their WebSockets need your API secret, so they must run on a small always-on Node server (Railway, Render or a VPS) that relays to the browser; Vercel functions can't hold those connections.

Order flow is **estimated** from candles (volume split by where each candle closed in its range). True delta and footprint need trade-level data, such as Binance's `@aggTrade` stream for crypto.

## Project layout

```
app/
  page.js              Landing page
  app/page.js          Analyzer page (/app)
  api/candles          Binance / Twelve Data / demo candles
  api/analyze          AI report from computed metrics (Claude API)
  api/vision           Retired AI endpoint (HTTP 410)
  api/ask              Follow-up questions on a report
  api/waitlist         Saves emails to Upstash Redis
components/            React UI (Analyzer, Chart, TradePlan, Report, ScreenshotPanel, landing parts)
lib/
  analysis.js          All indicators and detection: EMA, RSI, MACD, ATR, swings, S/R, sweeps,
                       order flow, volume profile, AVWAP, SMC (BOS/CHoCH/OB), FVG, Fibonacci, AMD, trade plan
  draw.js              Canvas chart renderer (follows light/dark theme)
  cards.js             Scorecards under the chart
  context.js           Compact JSON the AI reads
  instruments.js       Markets, symbols, timeframes, data-source mapping
  demo.js              Synthetic demo candles
  server/prompts.js    AI instructions (server-only, never sent to browsers)
  server/claude.js     Anthropic client, rate limit, same-origin check
```

## Before a public launch

- **Protect the AI routes.** Anyone who finds them can spend your Anthropic credit. The built-in limit is per server instance only; add login (Clerk or NextAuth) or an edge rate limiter (Upstash Ratelimit) and set a monthly spend limit in the Anthropic console.
- **Move the analysis server-side if it's your IP.** `lib/analysis.js` runs in the browser so the chart can update every second, which means its rules are visible in the shipped JavaScript. The AI prompts are already server-only.
- **Legal.** Showing entries, targets and stops to users in India may count as research analyst activity under SEBI rules. Get a securities lawyer's view, and add terms, privacy policy and risk disclosure pages.
- **Data licences.** Check that your market data plans allow public display (NSE data in particular).
