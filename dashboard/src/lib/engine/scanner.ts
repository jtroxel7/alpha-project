import type { Market, ScannerFilters } from "./types";
import { DEFAULT_CONFIG } from "./types";

const DEFAULT_FILTERS: ScannerFilters = {
  categories: [], // empty = all categories
  minVolume: 1000,
  minLiquidity: 500,
  maxDaysToResolution: 30,
  minDaysToResolution: 1,
  minEdge: DEFAULT_CONFIG.minEdge,
};

/**
 * Filter markets to find tradeable candidates.
 * This produces a shortlist for the AI to analyze more deeply.
 */
export function filterMarkets(
  markets: Market[],
  filters: Partial<ScannerFilters> = {}
): Market[] {
  const f = { ...DEFAULT_FILTERS, ...filters };
  const now = Date.now();

  return markets.filter((m) => {
    // Volume check
    if (m.volume < f.minVolume) return false;

    // Liquidity check
    if (m.liquidity < f.minLiquidity) return false;

    // Time horizon check
    if (m.endDate) {
      const daysToEnd = (new Date(m.endDate).getTime() - now) / (1000 * 60 * 60 * 24);
      if (daysToEnd < f.minDaysToResolution) return false;
      if (daysToEnd > f.maxDaysToResolution) return false;
    }

    // Category filter
    if (f.categories.length > 0 && !f.categories.includes(m.category)) return false;

    // Price sanity — skip markets that are essentially resolved
    const p = m.outcomePrices[0];
    if (p >= 0.97 || p <= 0.03) return false;

    return true;
  });
}

/**
 * Rank markets by how "interesting" they are for analysis.
 * Higher score = more worth analyzing.
 *
 * Factors:
 * - Mid-range prices (30-70) are more interesting — more room for mispricing
 * - Higher volume = more reliable price signal
 * - Shorter time to resolution = faster feedback loop
 * - Categories the AI has expertise in
 */
export function rankForAnalysis(markets: Market[]): Market[] {
  const scored = markets.map((m) => {
    let score = 0;
    const p = m.outcomePrices[0];

    // Mid-range price bonus (peaks at 50/50)
    const midRangeScore = 1 - Math.abs(p - 0.5) * 2; // 0 at extremes, 1 at 50/50
    score += midRangeScore * 30;

    // Volume score (log scale)
    score += Math.min(Math.log10(Math.max(m.volume, 1)) * 5, 30);

    // 24h volume bonus — active markets
    score += Math.min(Math.log10(Math.max(m.volume24h, 1)) * 3, 15);

    // Time horizon bonus — prefer 3-14 day resolution
    if (m.endDate) {
      const days = (new Date(m.endDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24);
      if (days >= 3 && days <= 14) score += 15;
      else if (days >= 1 && days <= 30) score += 8;
    }

    // Category bonus — AI has stronger priors on these
    const strongCategories = ["Politics", "Economy", "Geopolitics", "Tech"];
    if (strongCategories.includes(m.category)) score += 10;

    return { market: m, score };
  });

  scored.sort((a, b) => b.score - a.score);
  return scored.map((s) => s.market);
}

/**
 * Get the top N markets worth analyzing right now.
 */
export function getAnalysisCandidates(
  markets: Market[],
  filters?: Partial<ScannerFilters>,
  topN: number = 20
): Market[] {
  const filtered = filterMarkets(markets, filters);
  const ranked = rankForAnalysis(filtered);
  return ranked.slice(0, topN);
}
