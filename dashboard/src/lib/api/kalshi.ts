import type { Market } from "../engine/types";

const KALSHI_BASE = "https://api.elections.kalshi.com/trade-api/v2";

interface KalshiEvent {
  event_ticker: string;
  title: string;
  sub_title: string;
  category: string;
  mutually_exclusive: boolean;
  markets?: KalshiMarket[];
}

interface KalshiMarket {
  ticker: string;
  event_ticker: string;
  title?: string;
  subtitle?: string;
  yes_sub_title?: string;
  no_sub_title?: string;
  status: string;
  yes_bid_dollars: string;
  yes_ask_dollars: string;
  no_bid_dollars: string;
  no_ask_dollars: string;
  last_price_dollars: string;
  volume_fp: string;
  volume_24h_fp: string;
  open_interest_fp: string;
  open_time: string;
  close_time: string;
  market_type: string;
  result: string;
}

export async function fetchKalshiEvents(limit: number = 200): Promise<KalshiEvent[]> {
  const params = new URLSearchParams({
    with_nested_markets: "true",
    status: "open",
    limit: String(limit),
  });

  const res = await fetch(`${KALSHI_BASE}/events?${params}`);
  if (!res.ok) throw new Error(`Kalshi API error: ${res.status}`);
  const data = await res.json();
  return data.events || [];
}

export async function fetchKalshiMarkets(limit: number = 1000): Promise<KalshiMarket[]> {
  const params = new URLSearchParams({
    status: "open",
    limit: String(limit),
  });

  const res = await fetch(`${KALSHI_BASE}/markets?${params}`);
  if (!res.ok) throw new Error(`Kalshi API error: ${res.status}`);
  const data = await res.json();
  return data.markets || [];
}

export async function fetchKalshiOrderBook(ticker: string): Promise<{
  yes: [string, string][];
  no: [string, string][];
}> {
  const res = await fetch(`${KALSHI_BASE}/markets/${ticker}/orderbook`);
  if (!res.ok) throw new Error(`Kalshi orderbook error: ${res.status}`);
  const data = await res.json();
  const ob = data.orderbook_fp || data.orderbook;
  return {
    yes: ob?.yes_dollars || ob?.yes || [],
    no: ob?.no_dollars || ob?.no || [],
  };
}

function kalshiMarketToMarket(km: KalshiMarket, eventCategory?: string): Market {
  const yesPrice = parseFloat(km.yes_bid_dollars || "0.5");
  const noPrice = parseFloat(km.no_bid_dollars || "0.5");

  return {
    id: km.ticker,
    source: "kalshi",
    question: km.yes_sub_title
      ? `${km.yes_sub_title}`
      : km.ticker,
    category: eventCategory || "unknown",
    outcomes: ["Yes", "No"],
    outcomePrices: [yesPrice, noPrice],
    volume: parseFloat(km.volume_fp || "0"),
    volume24h: parseFloat(km.volume_24h_fp || "0"),
    liquidity: parseFloat(km.open_interest_fp || "0"),
    endDate: km.close_time,
    slug: km.ticker,
    ticker: km.ticker,
    eventTicker: km.event_ticker,
  };
}

export async function getKalshiMarkets(): Promise<Market[]> {
  const events = await fetchKalshiEvents();
  const markets: Market[] = [];

  for (const event of events) {
    if (!event.markets) continue;
    for (const km of event.markets) {
      if (km.status !== "open" && km.status !== "active") continue;
      markets.push(kalshiMarketToMarket(km, event.category));
    }
  }

  return markets;
}
