export const TV_INTERVALS = { "1m": "1", "5m": "5", "15m": "15", "30m": "30", "1H": "60", "4H": "240", "1D": "D", "1W": "W" };
export function tradingViewSymbol(market, symbol) {
  if (market === "crypto") return symbol === "BTCUSD" ? "COINBASE:BTCUSD" : `BINANCE:${symbol}`;
  if (market === "forex") return `FX_IDC:${symbol}`;
  if (market === "nse") return `NSE:${symbol === "NIFTY 50" ? "NIFTY" : symbol}`;
  return null;
}
