import type { Market, ProbabilityEstimate, TradeSignal } from "./types";
import { DEFAULT_CONFIG } from "./types";

/**
 * Calculate the edge between our estimate and market price.
 * Positive edge on YES side means market underprices YES.
 * Negative edge means market underprices NO.
 */
export function calculateEdge(estimatedProbability: number, marketPrice: number): {
  edge: number;
  absEdge: number;
  side: "YES" | "NO";
} {
  const edge = estimatedProbability - marketPrice;
  const absEdge = Math.abs(edge);
  const side = edge > 0 ? "YES" : "NO";
  return { edge, absEdge, side };
}

/**
 * Kelly criterion for binary outcomes.
 * f* = (bp - q) / b
 * where b = net odds (payout / stake), p = win probability, q = 1 - p
 *
 * For a binary contract at price `entryPrice` with true probability `trueProbability`:
 * - If buying YES at price p, payout is (1 - p) on success, loss is p on failure
 * - b = (1 - p) / p, prob = trueProbability
 */
export function kellyFraction(trueProbability: number, entryPrice: number): number {
  if (entryPrice <= 0 || entryPrice >= 1) return 0;
  if (trueProbability <= 0 || trueProbability >= 1) return 0;

  const b = (1 - entryPrice) / entryPrice; // net odds
  const p = trueProbability;
  const q = 1 - p;

  const f = (b * p - q) / b;
  return Math.max(0, f); // Never negative (don't bet if no edge)
}

/**
 * Calculate position size using fractional Kelly.
 */
export function calculatePositionSize(
  trueProbability: number,
  entryPrice: number,
  bankroll: number = DEFAULT_CONFIG.bankroll,
  kellyMultiplier: number = DEFAULT_CONFIG.kellyFraction,
  maxPositionPct: number = DEFAULT_CONFIG.maxPositionPct
): number {
  const fullKelly = kellyFraction(trueProbability, entryPrice);
  const fractionalKelly = fullKelly * kellyMultiplier;
  const kellyDollars = fractionalKelly * bankroll;
  const maxDollars = maxPositionPct * bankroll;

  return Math.min(kellyDollars, maxDollars);
}

/**
 * Calculate expected value per contract.
 */
export function calculateExpectedValue(
  trueProbability: number,
  entryPrice: number,
  side: "YES" | "NO"
): number {
  if (side === "YES") {
    // Buy YES at entryPrice, win (1 - entryPrice) with prob trueProbability, lose entryPrice with prob (1 - trueProbability)
    return trueProbability * (1 - entryPrice) - (1 - trueProbability) * entryPrice;
  } else {
    // Buy NO at (1 - entryPrice), win entryPrice with prob (1 - trueProbability), lose (1 - entryPrice) with prob trueProbability
    const noPrice = 1 - entryPrice;
    return (1 - trueProbability) * entryPrice - trueProbability * noPrice;
  }
}

/**
 * Generate a trade signal from a market and probability estimate.
 * Returns null if edge is below threshold.
 */
export function generateTradeSignal(
  market: Market,
  estimatedProbability: number,
  reasoning: string,
  confidence: "low" | "medium" | "high",
  currentBankroll: number = DEFAULT_CONFIG.bankroll,
  currentExposure: number = 0
): TradeSignal | null {
  const marketPrice = market.outcomePrices[0]; // YES price
  const { edge, absEdge, side } = calculateEdge(estimatedProbability, marketPrice);

  // Check minimum edge threshold
  if (absEdge < DEFAULT_CONFIG.minEdge) return null;

  // Determine entry price based on side
  const entryPrice = side === "YES" ? marketPrice : 1 - marketPrice;
  const trueProbForSide = side === "YES" ? estimatedProbability : 1 - estimatedProbability;

  // Calculate position size
  let positionSize = calculatePositionSize(trueProbForSide, entryPrice, currentBankroll);

  // Check max exposure
  const maxExposure = DEFAULT_CONFIG.maxExposurePct * currentBankroll;
  if (currentExposure + positionSize > maxExposure) {
    positionSize = Math.max(0, maxExposure - currentExposure);
  }

  if (positionSize < 1) return null; // Too small to trade

  const ev = calculateExpectedValue(estimatedProbability, marketPrice, side);
  const kelly = kellyFraction(trueProbForSide, entryPrice);

  const estimate: ProbabilityEstimate = {
    marketId: market.id,
    source: market.source,
    estimatedProbability,
    marketPrice,
    edge,
    absEdge,
    reasoning,
    confidence,
    createdAt: new Date().toISOString(),
  };

  return {
    market,
    estimate,
    side,
    entryPrice,
    positionSize: Math.round(positionSize * 100) / 100, // Round to cents
    expectedValue: Math.round(ev * 10000) / 10000,
    kellyFraction: kelly,
  };
}

/**
 * Rank a list of trade signals by expected value per dollar risked.
 */
export function rankSignals(signals: TradeSignal[]): TradeSignal[] {
  return [...signals].sort((a, b) => {
    const evPerDollarA = a.expectedValue / a.entryPrice;
    const evPerDollarB = b.expectedValue / b.entryPrice;
    return evPerDollarB - evPerDollarA;
  });
}
