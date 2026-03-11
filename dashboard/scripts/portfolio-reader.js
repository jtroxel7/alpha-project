#!/usr/bin/env node
/**
 * Portfolio Reader — Standalone script to read portfolio state from SQLite.
 * Used by scheduled tasks that run without the Next.js server.
 *
 * Usage:
 *   node scripts/portfolio-reader.js              # Full portfolio summary
 *   node scripts/portfolio-reader.js --open        # Open positions only
 *   node scripts/portfolio-reader.js --all         # All trades
 *   node scripts/portfolio-reader.js --crypto      # Crypto sim stats only
 */

const Database = require("better-sqlite3");
const path = require("path");

const DB_PATH = path.join(__dirname, "..", "data", "paper-trading.db");
const BANKROLL = 500;

const db = new Database(DB_PATH, { readonly: true });
db.pragma("journal_mode = WAL");

const mode = process.argv[2] || "--summary";

function getOpenTrades() {
  return db.prepare("SELECT * FROM trades WHERE status = 'open' ORDER BY created_at DESC").all();
}

function getAllTrades() {
  return db.prepare("SELECT * FROM trades ORDER BY created_at DESC").all();
}

function getPortfolioSummary() {
  const all = getAllTrades();
  const open = all.filter(t => t.status === "open");
  const closed = all.filter(t => t.status !== "open");

  const investedAmount = open.reduce((sum, t) => sum + t.position_size, 0);
  const realizedPnl = closed.reduce((sum, t) => sum + (t.realized_pnl || 0), 0);

  const wins = closed.filter(t =>
    t.status === "closed_win" || (t.status === "closed_exit" && (t.realized_pnl || 0) > 0)
  ).length;
  const losses = closed.filter(t =>
    t.status === "closed_loss" || (t.status === "closed_exit" && (t.realized_pnl || 0) <= 0)
  ).length;

  const cashBalance = BANKROLL + realizedPnl - investedAmount;
  const totalValue = cashBalance + investedAmount;

  // Separate crypto stats
  const cryptoTrades = all.filter(t => t.source === "crypto_sim");
  const cryptoOpen = cryptoTrades.filter(t => t.status === "open");
  const cryptoClosed = cryptoTrades.filter(t => t.status !== "open");
  const cryptoInvested = cryptoOpen.reduce((sum, t) => sum + t.position_size, 0);
  const cryptoPnl = cryptoClosed.reduce((sum, t) => sum + (t.realized_pnl || 0), 0);
  const cryptoWins = cryptoClosed.filter(t =>
    t.status === "closed_win" || (t.status === "closed_exit" && (t.realized_pnl || 0) > 0)
  ).length;
  const cryptoLosses = cryptoClosed.filter(t =>
    t.status === "closed_loss" || (t.status === "closed_exit" && (t.realized_pnl || 0) <= 0)
  ).length;

  // Non-crypto stats
  const marketTrades = all.filter(t => t.source !== "crypto_sim");
  const marketOpen = marketTrades.filter(t => t.status === "open");
  const marketInvested = marketOpen.reduce((sum, t) => sum + t.position_size, 0);

  return {
    portfolio: {
      totalValue: Math.round(totalValue * 100) / 100,
      cashBalance: Math.round(cashBalance * 100) / 100,
      investedAmount: Math.round(investedAmount * 100) / 100,
      exposurePct: Math.round((investedAmount / BANKROLL) * 1000) / 10,
      realizedPnl: Math.round(realizedPnl * 100) / 100,
      pnlPercent: Math.round((realizedPnl / BANKROLL) * 1000) / 10,
      totalTrades: all.length,
      openPositions: open.length,
      wins,
      losses,
      winRate: (wins + losses) > 0 ? Math.round((wins / (wins + losses)) * 1000) / 10 : 0,
    },
    marketTrading: {
      openPositions: marketOpen.length,
      invested: Math.round(marketInvested * 100) / 100,
      totalTrades: marketTrades.length,
    },
    cryptoTrading: {
      openPositions: cryptoOpen.length,
      invested: Math.round(cryptoInvested * 100) / 100,
      totalTrades: cryptoTrades.length,
      realizedPnl: Math.round(cryptoPnl * 100) / 100,
      wins: cryptoWins,
      losses: cryptoLosses,
      winRate: (cryptoWins + cryptoLosses) > 0
        ? Math.round((cryptoWins / (cryptoWins + cryptoLosses)) * 1000) / 10
        : 0,
    },
    openPositions: open.map(t => ({
      id: t.id,
      source: t.source,
      question: t.question.substring(0, 80),
      side: t.side,
      entryPrice: t.entry_price,
      positionSize: t.position_size,
      edge: t.edge,
      createdAt: t.created_at,
    })),
  };
}

function getCryptoStats() {
  const all = db.prepare("SELECT * FROM trades WHERE source = 'crypto_sim' ORDER BY created_at DESC").all();
  const open = all.filter(t => t.status === "open");
  const closed = all.filter(t => t.status !== "open");
  const invested = open.reduce((sum, t) => sum + t.position_size, 0);
  const pnl = closed.reduce((sum, t) => sum + (t.realized_pnl || 0), 0);
  const wins = closed.filter(t => t.status === "closed_win").length;
  const losses = closed.filter(t => t.status === "closed_loss").length;

  // Group by coin
  const byCoin = {};
  for (const t of all) {
    const coin = t.market_id.split("_")[0] || "unknown";
    if (!byCoin[coin]) byCoin[coin] = { total: 0, wins: 0, losses: 0, pnl: 0 };
    byCoin[coin].total++;
    if (t.status === "closed_win") { byCoin[coin].wins++; byCoin[coin].pnl += (t.realized_pnl || 0); }
    if (t.status === "closed_loss") { byCoin[coin].losses++; byCoin[coin].pnl += (t.realized_pnl || 0); }
  }

  return {
    totalTrades: all.length,
    openTrades: open.length,
    closedTrades: closed.length,
    invested: Math.round(invested * 100) / 100,
    realizedPnl: Math.round(pnl * 100) / 100,
    wins,
    losses,
    winRate: (wins + losses) > 0 ? Math.round((wins / (wins + losses)) * 1000) / 10 : 0,
    byCoin,
  };
}

// Main
try {
  switch (mode) {
    case "--open":
      console.log(JSON.stringify(getOpenTrades(), null, 2));
      break;
    case "--all":
      console.log(JSON.stringify(getAllTrades(), null, 2));
      break;
    case "--crypto":
      console.log(JSON.stringify(getCryptoStats(), null, 2));
      break;
    case "--summary":
    default:
      console.log(JSON.stringify(getPortfolioSummary(), null, 2));
      break;
  }
} finally {
  db.close();
}
