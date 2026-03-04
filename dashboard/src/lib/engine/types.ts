// Core types for the prediction market trading system

export interface Market {
  id: string;
  source: "polymarket" | "kalshi";
  question: string;
  category: string;
  outcomes: string[];
  outcomePrices: number[]; // [yes_price, no_price] — 0 to 1
  volume: number;
  volume24h: number;
  liquidity: number;
  endDate: string; // ISO 8601
  slug: string;
  imageUrl?: string;
  // Polymarket-specific
  conditionId?: string;
  tokenIds?: string[];
  // Kalshi-specific
  ticker?: string;
  eventTicker?: string;
}

export interface ProbabilityEstimate {
  id?: number;
  marketId: string;
  source: "polymarket" | "kalshi";
  question?: string;
  estimatedProbability: number; // 0 to 1 — our estimate of YES outcome
  marketPrice: number; // 0 to 1 — current market price for YES
  edge: number; // estimatedProbability - marketPrice (signed)
  absEdge: number; // |edge|
  reasoning: string;
  confidence: "low" | "medium" | "high";
  createdAt: string;
}

export interface TradeSignal {
  market: Market;
  estimate: ProbabilityEstimate;
  side: "YES" | "NO";
  entryPrice: number;
  positionSize: number; // dollar amount
  expectedValue: number; // expected profit per dollar
  kellyFraction: number;
}

export interface Trade {
  id?: number;
  marketId: string;
  source: "polymarket" | "kalshi";
  question: string;
  side: "YES" | "NO";
  entryPrice: number;
  quantity: number; // number of contracts
  positionSize: number; // total dollar cost
  estimatedProbability: number;
  marketPriceAtEntry: number;
  edge: number;
  reasoning: string;
  status: "open" | "closed_win" | "closed_loss" | "closed_exit";
  exitPrice?: number;
  realizedPnl?: number;
  resolvedOutcome?: "YES" | "NO";
  createdAt: string;
  closedAt?: string;
}

export interface Position {
  trade: Trade;
  currentPrice: number;
  unrealizedPnl: number;
  marketValue: number;
}

export interface PortfolioSnapshot {
  totalValue: number;
  cashBalance: number;
  investedAmount: number;
  unrealizedPnl: number;
  realizedPnl: number;
  totalPnl: number;
  pnlPercent: number;
  openPositions: number;
  totalTrades: number;
  wins: number;
  losses: number;
  winRate: number;
  brierScore: number | null;
}

export interface CalibrationBucket {
  bucketLow: number;
  bucketHigh: number;
  predicted: number; // average predicted probability in this bucket
  actual: number; // fraction that actually occurred
  count: number;
}

export interface ScannerFilters {
  categories: string[];
  minVolume: number;
  minLiquidity: number;
  maxDaysToResolution: number;
  minDaysToResolution: number;
  minEdge: number;
}

// Config
export const DEFAULT_CONFIG = {
  bankroll: 500,
  maxPositionPct: 0.05, // 5% of bankroll
  maxExposurePct: 0.40, // 40% of bankroll
  minEdge: 0.05, // 5 percentage points
  kellyFraction: 0.25, // quarter Kelly
  reassessmentThreshold: 0.15, // 15 point move against
} as const;
