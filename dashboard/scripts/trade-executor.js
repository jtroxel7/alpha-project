#!/usr/bin/env node
/**
 * Trade Executor — Standalone script to open/close trades directly in SQLite.
 * Used by scheduled tasks that run without the Next.js server.
 *
 * Usage:
 *   node scripts/trade-executor.js open '<json>'
 *   node scripts/trade-executor.js close <tradeId> <exitPrice> <status> [resolvedOutcome]
 *
 * Examples:
 *   node scripts/trade-executor.js open '{"marketId":"btc_5min_123","source":"crypto_sim","question":"Will BTC be higher in 5 min?","side":"YES","entryPrice":0.50,"quantity":20,"positionSize":10,"estimatedProbability":0.55,"marketPriceAtEntry":0.50,"edge":0.05,"reasoning":"Momentum signal"}'
 *
 *   node scripts/trade-executor.js close 25 0.95 closed_win YES
 *   node scripts/trade-executor.js close 25 0.60 closed_exit
 */

const Database = require("better-sqlite3");
const path = require("path");

const DB_PATH = path.join(__dirname, "..", "data", "paper-trading.db");
const db = new Database(DB_PATH);
db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");

const action = process.argv[2];

if (!action || !["open", "close"].includes(action)) {
  console.error("Usage:");
  console.error("  node trade-executor.js open '<json>'");
  console.error("  node trade-executor.js close <tradeId> <exitPrice> <status> [resolvedOutcome]");
  process.exit(1);
}

try {
  if (action === "open") {
    const jsonStr = process.argv[3];
    if (!jsonStr) {
      console.error("Error: Must provide trade JSON as second argument");
      process.exit(1);
    }

    const trade = JSON.parse(jsonStr);

    // Validate required fields
    const required = ["marketId", "source", "question", "side", "entryPrice", "quantity", "positionSize", "estimatedProbability", "marketPriceAtEntry", "edge", "reasoning"];
    for (const field of required) {
      if (trade[field] === undefined) {
        console.error(`Error: Missing required field '${field}'`);
        process.exit(1);
      }
    }

    const stmt = db.prepare(`
      INSERT INTO trades (market_id, source, question, side, entry_price, quantity, position_size,
        estimated_probability, market_price_at_entry, edge, reasoning, status, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'open', datetime('now'))
    `);

    const result = stmt.run(
      trade.marketId, trade.source, trade.question, trade.side,
      trade.entryPrice, trade.quantity, trade.positionSize,
      trade.estimatedProbability, trade.marketPriceAtEntry, trade.edge,
      trade.reasoning
    );

    const id = result.lastInsertRowid;
    console.log(JSON.stringify({
      success: true,
      action: "open",
      tradeId: id,
      question: trade.question,
      side: trade.side,
      entryPrice: trade.entryPrice,
      positionSize: trade.positionSize,
    }));

  } else if (action === "close") {
    const tradeId = parseInt(process.argv[3]);
    const exitPrice = parseFloat(process.argv[4]);
    const status = process.argv[5]; // closed_win, closed_loss, closed_exit
    const resolvedOutcome = process.argv[6] || null; // YES, NO, or null

    if (isNaN(tradeId) || isNaN(exitPrice) || !status) {
      console.error("Error: close requires tradeId, exitPrice, and status");
      process.exit(1);
    }

    if (!["closed_win", "closed_loss", "closed_exit"].includes(status)) {
      console.error("Error: status must be closed_win, closed_loss, or closed_exit");
      process.exit(1);
    }

    // Get the trade
    const trade = db.prepare("SELECT * FROM trades WHERE id = ?").get(tradeId);
    if (!trade) {
      console.error(`Error: Trade ${tradeId} not found`);
      process.exit(1);
    }

    // Calculate P&L
    let realizedPnl;
    if (status === "closed_exit") {
      if (trade.side === "YES") {
        realizedPnl = (exitPrice - trade.entry_price) * trade.quantity;
      } else {
        realizedPnl = ((1 - exitPrice) - (1 - trade.entry_price)) * trade.quantity;
      }
    } else {
      const won = (trade.side === "YES" && resolvedOutcome === "YES") ||
                  (trade.side === "NO" && resolvedOutcome === "NO");
      if (won) {
        realizedPnl = (1 - trade.entry_price) * trade.quantity;
      } else {
        realizedPnl = -trade.entry_price * trade.quantity;
      }
    }

    const stmt = db.prepare(`
      UPDATE trades SET exit_price = ?, realized_pnl = ?, resolved_outcome = ?,
        status = ?, closed_at = datetime('now')
      WHERE id = ?
    `);
    stmt.run(exitPrice, realizedPnl, resolvedOutcome, status, tradeId);

    console.log(JSON.stringify({
      success: true,
      action: "close",
      tradeId,
      status,
      exitPrice,
      realizedPnl: Math.round(realizedPnl * 100) / 100,
      resolvedOutcome,
    }));
  }
} catch (err) {
  console.error("Error:", err.message);
  process.exit(1);
} finally {
  db.close();
}
