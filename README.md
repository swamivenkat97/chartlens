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
| `ANTHROPIC_API_KEY` | AI reports, screenshots, follow-up questions | From console.anthropic.com |
| `ANTHROPIC_MODEL` | Reports and screenshot reading | Default `claude-sonnet-5-5` |
| `ANTHROPIC_FAST_MODEL` | Follow-up questions | Default `claude-haiku-5-5` |
| `TWELVE_DATA_API_KEY` | Forex, gold, NSE, BTCUSD candles | Without it these markets show demo data |
| `KV_REST_API_URL`, `KV_REST_API_TOKEN` | Waitlist | Set by the Upstash integration |
| `AI_RATE_LIMIT_PER_HOUR` | Abuse protection | Default 30 AI calls per IP per hour, per server instance |

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
  api/vision           AI reading of an uploaded screenshot
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
