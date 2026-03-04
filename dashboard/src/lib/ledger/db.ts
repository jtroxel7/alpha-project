import Database from "better-sqlite3";
import path from "path";
import fs from "fs";
import type { Trade, ProbabilityEstimate, PortfolioSnapshot, CalibrationBucket } from "../engine/types";
import { DEFAULT_CONFIG } from "../engine/types";

const DB_PATH = path.join(process.cwd(), "data", "paper-trading.db");

let _db: Database.Database | null = null;

function getDb(): Database.Database {
  if (_db) return _db;

  // Ensure data directory exists
  const dir = path.dirname(DB_PATH);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  _db = new Database(DB_PATH);
  _db.pragma("journal_mode = WAL");
  _db.pragma("foreign_keys = ON");

  // Initialize schema
  const schemaPath = path.join(__dirname, "schema.sql");
  if (fs.existsSync(schemaPath)) {
    const schema = fs.readFileSync(schemaPath, "utf-8");
    _db.exec(schema);
  } else {
    // Inline schema fallback for production builds
    _db.exec(getSchemaSQL());
  }

  return _db;
}

function getSchemaSQL(): string {
  return `
    CREATE TABLE IF NOT EXISTS trades (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      market_id TEXT NOT NULL,
      source TEXT NOT NULL CHECK(source IN ('polymarket', 'kalshi')),
      question TEXT NOT NULL,
      side TEXT NOT NULL CHECK(side IN ('YES', 'NO')),
      entry_price REAL NOT NULL,
      quantity REAL NOT NULL,
      position_size REAL NOT NULL,
      estimated_probability REAL NOT NULL,
      market_price_at_entry REAL NOT NULL,
      edge REAL NOT NULL,
      reasoning TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'open' CHECK(status IN ('open', 'closed_win', 'closed_loss', 'closed_exit')),
      exit_price REAL,
      realized_pnl REAL,
      resolved_outcome TEXT CHECK(resolved_outcome IN ('YES', 'NO')),
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      closed_at TEXT
    );
    CREATE TABLE IF NOT EXISTS probability_estimates (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      market_id TEXT NOT NULL,
      source TEXT NOT NULL CHECK(source IN ('polymarket', 'kalshi')),
      question TEXT NOT NULL,
      estimated_probability REAL NOT NULL,
      market_price REAL NOT NULL,
      edge REAL NOT NULL,
      abs_edge REAL NOT NULL,
      reasoning TEXT NOT NULL,
      confidence TEXT NOT NULL CHECK(confidence IN ('low', 'medium', 'high')),
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE TABLE IF NOT EXISTS portfolio_snapshots (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      total_value REAL NOT NULL,
      cash_balance REAL NOT NULL,
      invested_amount REAL NOT NULL,
      unrealized_pnl REAL NOT NULL,
      realized_pnl REAL NOT NULL,
      open_positions INTEGER NOT NULL,
      total_trades INTEGER NOT NULL,
      wins INTEGER NOT NULL,
      losses INTEGER NOT NULL,
      brier_score REAL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_trades_status ON trades(status);
    CREATE INDEX IF NOT EXISTS idx_trades_market_id ON trades(market_id);
    CREATE INDEX IF NOT EXISTS idx_trades_created_at ON trades(created_at);
    CREATE INDEX IF NOT EXISTS idx_estimates_market_id ON probability_estimates(market_id);
    CREATE INDEX IF NOT EXISTS idx_estimates_abs_edge ON probability_estimates(abs_edge);
    CREATE INDEX IF NOT EXISTS idx_snapshots_created_at ON portfolio_snapshots(created_at);
  `;
}

// ============ TRADES ============

export function insertTrade(trade: Omit<Trade, "id">): number {
  const db = getDb();
  const stmt = db.prepare(`
    INSERT INTO trades (market_id, source, question, side, entry_price, quantity, position_size,
      estimated_probability, market_price_at_entry, edge, reasoning, status, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  const result = stmt.run(
    trade.marketId, trade.source, trade.question, trade.side,
    trade.entryPrice, trade.quantity, trade.positionSize,
    trade.estimatedProbability, trade.marketPriceAtEntry, trade.edge,
    trade.reasoning, trade.status, trade.createdAt
  );
  return result.lastInsertRowid as number;
}

export function closeTrade(
  tradeId: number,
  exitPrice: number,
  resolvedOutcome: "YES" | "NO" | null,
  status: "closed_win" | "closed_loss" | "closed_exit"
): void {
  const db = getDb();
  const trade = getTradeById(tradeId);
  if (!trade) throw new Error(`Trade ${tradeId} not found`);

  let realizedPnl: number;
  if (status === "closed_exit") {
    // Exited before resolution
    if (trade.side === "YES") {
      realizedPnl = (exitPrice - trade.entryPrice) * trade.quantity;
    } else {
      realizedPnl = ((1 - exitPrice) - (1 - trade.entryPrice)) * trade.quantity;
    }
  } else {
    // Resolved
    const won = (trade.side === "YES" && resolvedOutcome === "YES") ||
                (trade.side === "NO" && resolvedOutcome === "NO");
    if (won) {
      realizedPnl = (1 - trade.entryPrice) * trade.quantity;
    } else {
      realizedPnl = -trade.entryPrice * trade.quantity;
    }
  }

  const stmt = db.prepare(`
    UPDATE trades SET exit_price = ?, realized_pnl = ?, resolved_outcome = ?,
      status = ?, closed_at = datetime('now')
    WHERE id = ?
  `);
  stmt.run(exitPrice, realizedPnl, resolvedOutcome, status, tradeId);
}

export function getTradeById(id: number): Trade | null {
  const db = getDb();
  const row = db.prepare("SELECT * FROM trades WHERE id = ?").get(id) as Record<string, unknown> | undefined;
  return row ? mapTradeRow(row) : null;
}

export function getOpenTrades(): Trade[] {
  const db = getDb();
  const rows = db.prepare("SELECT * FROM trades WHERE status = 'open' ORDER BY created_at DESC").all() as Record<string, unknown>[];
  return rows.map(mapTradeRow);
}

export function getAllTrades(): Trade[] {
  const db = getDb();
  const rows = db.prepare("SELECT * FROM trades ORDER BY created_at DESC").all() as Record<string, unknown>[];
  return rows.map(mapTradeRow);
}

export function getClosedTrades(): Trade[] {
  const db = getDb();
  const rows = db.prepare("SELECT * FROM trades WHERE status != 'open' ORDER BY closed_at DESC").all() as Record<string, unknown>[];
  return rows.map(mapTradeRow);
}

function mapTradeRow(row: Record<string, unknown>): Trade {
  return {
    id: row.id as number,
    marketId: row.market_id as string,
    source: row.source as "polymarket" | "kalshi",
    question: row.question as string,
    side: row.side as "YES" | "NO",
    entryPrice: row.entry_price as number,
    quantity: row.quantity as number,
    positionSize: row.position_size as number,
    estimatedProbability: row.estimated_probability as number,
    marketPriceAtEntry: row.market_price_at_entry as number,
    edge: row.edge as number,
    reasoning: row.reasoning as string,
    status: row.status as Trade["status"],
    exitPrice: row.exit_price as number | undefined,
    realizedPnl: row.realized_pnl as number | undefined,
    resolvedOutcome: row.resolved_outcome as "YES" | "NO" | undefined,
    createdAt: row.created_at as string,
    closedAt: row.closed_at as string | undefined,
  };
}

// ============ ESTIMATES ============

export function insertEstimate(est: Omit<ProbabilityEstimate, "id">): number {
  const db = getDb();
  const stmt = db.prepare(`
    INSERT INTO probability_estimates (market_id, source, question, estimated_probability,
      market_price, edge, abs_edge, reasoning, confidence, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  const result = stmt.run(
    est.marketId, est.source, est.question || "", est.estimatedProbability,
    est.marketPrice, est.edge, est.absEdge, est.reasoning, est.confidence, est.createdAt
  );
  return result.lastInsertRowid as number;
}

export function getRecentEstimates(limit: number = 50): ProbabilityEstimate[] {
  const db = getDb();
  const rows = db.prepare(
    "SELECT * FROM probability_estimates ORDER BY created_at DESC LIMIT ?"
  ).all(limit) as Record<string, unknown>[];
  return rows.map(row => ({
    id: row.id as number,
    marketId: row.market_id as string,
    source: row.source as "polymarket" | "kalshi",
    estimatedProbability: row.estimated_probability as number,
    marketPrice: row.market_price as number,
    edge: row.edge as number,
    absEdge: row.abs_edge as number,
    reasoning: row.reasoning as string,
    confidence: row.confidence as "low" | "medium" | "high",
    createdAt: row.created_at as string,
  }));
}

// ============ PORTFOLIO ============

export function getPortfolioSnapshot(): PortfolioSnapshot {
  const db = getDb();
  const openTrades = getOpenTrades();
  const allTrades = getAllTrades();
  const closedTrades = allTrades.filter(t => t.status !== "open");

  const investedAmount = openTrades.reduce((sum, t) => sum + t.positionSize, 0);
  const realizedPnl = closedTrades.reduce((sum, t) => sum + (t.realizedPnl || 0), 0);
  const wins = closedTrades.filter(t => t.status === "closed_win").length;
  const losses = closedTrades.filter(t => t.status === "closed_loss").length;

  // Cash = starting bankroll + realized P&L - currently invested
  const cashBalance = DEFAULT_CONFIG.bankroll + realizedPnl - investedAmount;
  const totalValue = cashBalance + investedAmount; // Approximate (ignores unrealized)

  return {
    totalValue,
    cashBalance,
    investedAmount,
    unrealizedPnl: 0, // Updated when we have live prices
    realizedPnl,
    totalPnl: realizedPnl,
    pnlPercent: (realizedPnl / DEFAULT_CONFIG.bankroll) * 100,
    openPositions: openTrades.length,
    totalTrades: allTrades.length,
    wins,
    losses,
    winRate: closedTrades.length > 0 ? wins / closedTrades.length : 0,
    brierScore: calculateBrierScore(closedTrades),
  };
}

function calculateBrierScore(closedTrades: Trade[]): number | null {
  const resolved = closedTrades.filter(t => t.resolvedOutcome);
  if (resolved.length === 0) return null;

  const totalScore = resolved.reduce((sum, t) => {
    const predicted = t.side === "YES" ? t.estimatedProbability : 1 - t.estimatedProbability;
    const actual = (t.side === "YES" && t.resolvedOutcome === "YES") ||
                   (t.side === "NO" && t.resolvedOutcome === "NO") ? 1 : 0;
    return sum + Math.pow(predicted - actual, 2);
  }, 0);

  return totalScore / resolved.length;
}

export function getCalibrationData(): CalibrationBucket[] {
  const db = getDb();
  const resolved = db.prepare(
    "SELECT * FROM trades WHERE resolved_outcome IS NOT NULL"
  ).all() as Record<string, unknown>[];

  const buckets: CalibrationBucket[] = [];
  for (let low = 0; low < 1; low += 0.1) {
    const high = low + 0.1;
    const tradesInBucket = resolved.filter(t => {
      const est = t.estimated_probability as number;
      return est >= low && est < high;
    });

    if (tradesInBucket.length > 0) {
      const predicted = tradesInBucket.reduce((s, t) => s + (t.estimated_probability as number), 0) / tradesInBucket.length;
      const actual = tradesInBucket.filter(t => {
        const side = t.side as string;
        const outcome = t.resolved_outcome as string;
        return (side === "YES" && outcome === "YES") || (side === "NO" && outcome === "NO");
      }).length / tradesInBucket.length;

      buckets.push({ bucketLow: low, bucketHigh: high, predicted, actual, count: tradesInBucket.length });
    }
  }

  return buckets;
}

export function savePortfolioSnapshot(): void {
  const db = getDb();
  const snapshot = getPortfolioSnapshot();
  const stmt = db.prepare(`
    INSERT INTO portfolio_snapshots (total_value, cash_balance, invested_amount,
      unrealized_pnl, realized_pnl, open_positions, total_trades, wins, losses, brier_score)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  stmt.run(
    snapshot.totalValue, snapshot.cashBalance, snapshot.investedAmount,
    snapshot.unrealizedPnl, snapshot.realizedPnl, snapshot.openPositions,
    snapshot.totalTrades, snapshot.wins, snapshot.losses, snapshot.brierScore
  );
}

export function getPortfolioHistory(): { createdAt: string; totalValue: number; realizedPnl: number }[] {
  const db = getDb();
  const rows = db.prepare(
    "SELECT created_at, total_value, realized_pnl FROM portfolio_snapshots ORDER BY created_at ASC"
  ).all() as { created_at: string; total_value: number; realized_pnl: number }[];
  return rows.map(r => ({
    createdAt: r.created_at,
    totalValue: r.total_value,
    realizedPnl: r.realized_pnl,
  }));
}
