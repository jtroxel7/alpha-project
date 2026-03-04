import type { Market } from "../engine/types";

const GAMMA_BASE = "https://gamma-api.polymarket.com";
const CLOB_BASE = "https://clob.polymarket.com";

interface GammaTag {
  id: string;
  label: string;
  slug: string;
  forceShow?: boolean;
  forceHide?: boolean;
}

interface GammaEvent {
  id: string;
  title: string;
  slug: string;
  tags?: GammaTag[];
  endDate: string;
  active: boolean;
  closed: boolean;
  liquidity: number;
  volume: number;
  markets: GammaMarket[];
}

interface GammaMarket {
  id: string;
  question: string;
  conditionId: string;
  slug: string;
  outcomes: string; // JSON stringified array
  outcomePrices: string; // JSON stringified array
  volume: number;
  volumeNum: number;
  volume24hr: number;
  liquidity: number;
  liquidityNum: number;
  bestBid: number;
  bestAsk: number;
  lastTradePrice: number;
  endDate: string;
  active: boolean;
  closed: boolean;
  clobTokenIds?: string; // JSON stringified array
}

// Top-level categories we care about. Pick the first matching tag.
const CATEGORY_SLUGS: Record<string, string> = {
  politics: "Politics",
  sports: "Sports",
  crypto: "Crypto",
  "crypto-prices": "Crypto",
  bitcoin: "Crypto",
  economy: "Economy",
  "fed-rates": "Economy",
  science: "Science",
  tech: "Tech",
  "pop-culture": "Culture",
  entertainment: "Culture",
  world: "World",
  geopolitics: "Geopolitics",
  soccer: "Sports",
  basketball: "Sports",
  nba: "Sports",
  baseball: "Sports",
  nfl: "Sports",
  mma: "Sports",
  elections: "Politics",
  "global-elections": "Politics",
  iran: "Geopolitics",
  "middle-east": "Geopolitics",
  china: "Geopolitics",
  "foreign-policy": "Geopolitics",
  ai: "Tech",
};

function extractCategory(tags?: GammaTag[]): string {
  if (!tags || tags.length === 0) return "Other";
  // Try to find a known category slug
  for (const tag of tags) {
    const cat = CATEGORY_SLUGS[tag.slug];
    if (cat) return cat;
  }
  // Fall back to first visible tag
  const visible = tags.find((t) => !t.forceHide);
  return visible?.label || tags[0]?.label || "Other";
}

export async function fetchActiveEvents(limit: number = 50, offset: number = 0): Promise<GammaEvent[]> {
  const params = new URLSearchParams({
    active: "true",
    closed: "false",
    limit: String(limit),
    offset: String(offset),
    order: "volume24hr",
    ascending: "false",
  });

  const res = await fetch(`${GAMMA_BASE}/events?${params}`);
  if (!res.ok) throw new Error(`Gamma API error: ${res.status}`);
  return res.json();
}

export async function fetchActiveMarkets(limit: number = 100, offset: number = 0): Promise<GammaMarket[]> {
  const params = new URLSearchParams({
    active: "true",
    closed: "false",
    limit: String(limit),
    offset: String(offset),
    order: "volume24hr",
    ascending: "false",
    liquidity_num_min: "500",
  });

  const res = await fetch(`${GAMMA_BASE}/markets?${params}`);
  if (!res.ok) throw new Error(`Gamma API error: ${res.status}`);
  return res.json();
}

export async function fetchMarketPrice(tokenId: string, side: "BUY" | "SELL" = "BUY"): Promise<number> {
  const params = new URLSearchParams({ token_id: tokenId, side });
  const res = await fetch(`${CLOB_BASE}/price?${params}`);
  if (!res.ok) throw new Error(`CLOB price error: ${res.status}`);
  const data = await res.json();
  return parseFloat(data.price);
}

export async function fetchOrderBook(tokenId: string): Promise<{
  bids: { price: string; size: string }[];
  asks: { price: string; size: string }[];
}> {
  const params = new URLSearchParams({ token_id: tokenId });
  const res = await fetch(`${CLOB_BASE}/book?${params}`);
  if (!res.ok) throw new Error(`CLOB book error: ${res.status}`);
  return res.json();
}

export async function fetchPriceHistory(
  tokenId: string,
  interval: string = "1d"
): Promise<{ t: number; p: number }[]> {
  const params = new URLSearchParams({ market: tokenId, interval });
  const res = await fetch(`${CLOB_BASE}/prices-history?${params}`);
  if (!res.ok) throw new Error(`CLOB history error: ${res.status}`);
  const data = await res.json();
  return data.history || [];
}

function parsePrice(val: unknown): number {
  if (typeof val === "number") return val;
  if (typeof val === "string") {
    const n = parseFloat(val);
    return isNaN(n) ? 0 : n;
  }
  return 0;
}

export function gammaMarketToMarket(gm: GammaMarket, eventCategory: string): Market {
  let outcomes: string[];
  try {
    outcomes = JSON.parse(gm.outcomes);
  } catch {
    outcomes = ["Yes", "No"];
  }

  let prices: number[];
  try {
    const raw = JSON.parse(gm.outcomePrices);
    prices = raw.map(parsePrice);
  } catch {
    prices = [0, 0];
  }

  // If parsed prices are both 0, try lastTradePrice or bestBid
  if (prices[0] === 0 && prices[1] === 0) {
    const ltp = parsePrice(gm.lastTradePrice);
    const bid = parsePrice(gm.bestBid);
    const p = ltp > 0 ? ltp : bid > 0 ? bid : 0.5;
    prices = [p, 1 - p];
  }

  let tokenIds: string[] | undefined;
  try {
    if (gm.clobTokenIds) {
      tokenIds = JSON.parse(gm.clobTokenIds);
    }
  } catch {
    tokenIds = undefined;
  }

  return {
    id: gm.id,
    source: "polymarket",
    question: gm.question,
    category: eventCategory,
    outcomes,
    outcomePrices: prices,
    volume: gm.volumeNum || gm.volume || 0,
    volume24h: gm.volume24hr || 0,
    liquidity: gm.liquidityNum || gm.liquidity || 0,
    endDate: gm.endDate,
    slug: gm.slug,
    conditionId: gm.conditionId,
    tokenIds,
  };
}

export async function getPolymarketMarkets(): Promise<Market[]> {
  const events = await fetchActiveEvents(100);
  const markets: Market[] = [];

  for (const event of events) {
    if (!event.markets) continue;
    const category = extractCategory(event.tags);
    for (const gm of event.markets) {
      if (!gm.active || gm.closed) continue;
      markets.push(gammaMarketToMarket(gm, category));
    }
  }

  return markets;
}
