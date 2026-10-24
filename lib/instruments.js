// Instruments and how each one is fetched.
// binance: public Binance market data (free, no key, live WebSocket in the browser)
// td: Twelve Data symbol (needs TWELVE_DATA_API_KEY). Verify NSE index symbols in Twelve Data's symbol search for your plan.
// p / v / d: demo base price, demo daily volatility, price decimals.

export const MARKETS = {
  crypto: {
    label: "Crypto", session: "24×7",
    symbols: [
      { s: "BTCUSDT", n: "Bitcoin / Tether", binance: "BTCUSDT", p: 66000, v: 0.028, d: 1 },
      { s: "BTCUSD", n: "Bitcoin / US Dollar", td: "BTC/USD", binance: "BTCUSDT", p: 66050, v: 0.028, d: 1 },
      { s: "ETHUSDT", n: "Ether / Tether", binance: "ETHUSDT", p: 3150, v: 0.034, d: 2 },
      { s: "SOLUSDT", n: "Solana / Tether", binance: "SOLUSDT", p: 152, v: 0.045, d: 2 },
    ],
  },
  forex: {
    label: "Forex & Gold", session: "24×5",
    symbols: [
      { s: "XAUUSD", n: "Gold / US Dollar", td: "XAU/USD", p: 3900, v: 0.011, d: 2 },
      { s: "EURUSD", n: "Euro / US Dollar", td: "EUR/USD", p: 1.085, v: 0.0045, d: 5 },
      { s: "GBPUSD", n: "Pound / US Dollar", td: "GBP/USD", p: 1.27, v: 0.0055, d: 5 },
      { s: "USDJPY", n: "US Dollar / Yen", td: "USD/JPY", p: 149.8, v: 0.0055, d: 3 },
      { s: "USDINR", n: "US Dollar / Rupee", td: "USD/INR", p: 84.2, v: 0.0018, d: 4 },
    ],
  },
  nse: {
    label: "NSE", session: "09:15–15:30 IST",
    symbols: [
      { s: "NIFTY 50", n: "Nifty 50 Index", td: "NIFTY 50", exchange: "NSE", p: 25100, v: 0.008, d: 2 },
      { s: "BANKNIFTY", n: "Nifty Bank Index", td: "NIFTY BANK", exchange: "NSE", p: 52400, v: 0.01, d: 2 },
      { s: "RELIANCE", n: "Reliance Industries", td: "RELIANCE", exchange: "NSE", p: 2880, v: 0.014, d: 2 },
      { s: "HDFCBANK", n: "HDFC Bank", td: "HDFCBANK", exchange: "NSE", p: 1660, v: 0.012, d: 2 },
      { s: "TCS", n: "Tata Consultancy Services", td: "TCS", exchange: "NSE", p: 4120, v: 0.013, d: 2 },
    ],
  },
};

export const TIMEFRAMES = {
  "1m": { ms: 60e3, f: 0.028, binance: "1m", td: "1min" },
  "5m": { ms: 300e3, f: 0.06, binance: "5m", td: "5min" },
  "15m": { ms: 900e3, f: 0.1, binance: "15m", td: "15min" },
  "30m": { ms: 1800e3, f: 0.14, binance: "30m", td: "30min" },
  "1H": { ms: 3600e3, f: 0.2, binance: "1h", td: "1h" },
  "4H": { ms: 4 * 3600e3, f: 0.42, binance: "4h", td: "4h" },
  "1D": { ms: 864e5, f: 1, binance: "1d", td: "1day" },
  "1W": { ms: 7 * 864e5, f: 2.2, binance: "1w", td: "1week" },
};

export function findSymbol(market, s) {
  return MARKETS[market]?.symbols.find((x) => x.s === s) || null;
}
