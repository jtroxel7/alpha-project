const Database = require("better-sqlite3");
const path = require("path");

const dbPath = path.join(__dirname, "data/paper-trading.db");
const db = new Database(dbPath);

function closeTrade(tradeId, exitPrice, status = "closed_exit") {
  const trade = db.prepare("SELECT * FROM trades WHERE id = ?").get(tradeId);
  if (!trade) {
    console.error(`Trade ${tradeId} not found`);
    return;
  }

  // Calculate realized PnL for exit
  let realizedPnl;
  if (trade.side === "YES") {
    realizedPnl = (exitPrice - trade.entry_price) * trade.quantity;
  } else {
    realizedPnl = ((1 - exitPrice) - (1 - trade.entry_price)) * trade.quantity;
  }

  const stmt = db.prepare(`
    UPDATE trades SET exit_price = ?, realized_pnl = ?, status = ?, closed_at = datetime('now')
    WHERE id = ?
  `);
  stmt.run(exitPrice, realizedPnl, status, tradeId);

  console.log(`✓ Closed trade #${tradeId}: ${trade.question.substring(0,50)}`);
  console.log(`  Entry: ${(trade.entry_price*100).toFixed(0)}¢, Exit: ${(exitPrice*100).toFixed(0)}¢`);
  console.log(`  Realized PnL: ${realizedPnl > 0 ? '+' : ''}$${realizedPnl.toFixed(2)}`);
  console.log();
  return realizedPnl;
}

function openTrade(marketId, source, question, side, entryPrice, quantity, estimatedProbability, marketPriceAtEntry, edge, reasoning) {
  const positionSize = entryPrice * quantity;

  const stmt = db.prepare(`
    INSERT INTO trades (market_id, source, question, side, entry_price, quantity, position_size,
      estimated_probability, market_price_at_entry, edge, reasoning, status, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'open', datetime('now'))
  `);

  const result = stmt.run(
    marketId, source, question, side, entryPrice, quantity, positionSize,
    estimatedProbability, marketPriceAtEntry, edge, reasoning
  );

  console.log(`✓ Opened trade #${result.lastInsertRowid}: ${question.substring(0,50)}`);
  console.log(`  Side: ${side} @ ${(entryPrice*100).toFixed(0)}¢, Qty: ${quantity.toFixed(1)}, Position: $${positionSize.toFixed(2)}`);
  console.log(`  Edge: ${(edge*100).toFixed(1)}%, Est Prob: ${(estimatedProbability*100).toFixed(0)}%`);
  console.log();

  return result.lastInsertRowid;
}

function getPortfolioSnapshot() {
  const openTrades = db.prepare("SELECT * FROM trades WHERE status = 'open'").all();
  const allTrades = db.prepare("SELECT * FROM trades").all();
  const closedTrades = allTrades.filter(t => t.status !== 'open');

  const investedAmount = openTrades.reduce((sum, t) => sum + t.position_size, 0);
  const realizedPnl = closedTrades.reduce((sum, t) => sum + (t.realized_pnl || 0), 0);
  const wins = closedTrades.filter(t => t.status === 'closed_win').length;
  const losses = closedTrades.filter(t => t.status === 'closed_loss').length;

  const bankroll = 500;
  const cashBalance = bankroll + realizedPnl - investedAmount;
  const totalValue = cashBalance + investedAmount;

  return {
    totalValue,
    cashBalance,
    investedAmount,
    exposure: (investedAmount / bankroll) * 100,
    realizedPnl,
    openPositions: openTrades.length,
    wins,
    losses,
  };
}

async function main() {
  console.log("=== EXECUTING TRADES ===\n");

  const before = getPortfolioSnapshot();
  console.log("BEFORE:");
  console.log(`  Total Value: $${before.totalValue.toFixed(2)}`);
  console.log(`  Cash: $${before.cashBalance.toFixed(2)}, Invested: $${before.investedAmount.toFixed(2)}, Exposure: ${before.exposure.toFixed(1)}%`);
  console.log(`  Realized PnL: ${before.realizedPnl > 0 ? '+' : ''}$${before.realizedPnl.toFixed(2)}`);
  console.log(`  Open Positions: ${before.openPositions}\n`);

  // Step 1: Close Trump-China trades
  console.log("STEP 1: Close underperforming trades\n");
  let totalLoss = 0;
  totalLoss += closeTrade(5, 0.42, "closed_exit"); // Trade #5: Trump China at 53¢, exit 42¢
  totalLoss += closeTrade(2, 0.42, "closed_exit"); // Trade #6: Trump China at 48¢, exit 42¢

  console.log(`Total loss from exits: $${totalLoss.toFixed(2)}\n`);

  // Step 2: Open new trades
  console.log("STEP 2: Open new high-edge opportunities\n");

  openTrade(
    "sp500-correction-june-2026", // marketId
    "polymarket",
    "Will the S&P 500 drop 15% by June 30, 2026?",
    "YES",
    0.39, // entry price (market odds at ~39%)
    51.28, // quantity to get ~$20 position (0.39 * 51.28 ≈ 20)
    0.50, // estimated probability (historical data suggests 50%)
    0.39, // market price at entry
    0.11, // edge (50% - 39% = 11%)
    "Historical data shows 50% probability of 21%+ decline in midterm election years. Kalshi markets only price 39% for 15%+ drop - clear edge. Current S&P at 21.5x forward earnings (premium to 5-yr avg). Earnings need 15% growth to justify valuations; if missed, expect selloff. Three-month timeframe (Mar 31 - Jun 30) gives ample window for correction."
  );

  // Portfolio snapshot after trades
  const after = getPortfolioSnapshot();
  console.log("\nAFTER:");
  console.log(`  Total Value: $${after.totalValue.toFixed(2)}`);
  console.log(`  Cash: $${after.cashBalance.toFixed(2)}, Invested: $${after.investedAmount.toFixed(2)}, Exposure: ${after.exposure.toFixed(1)}%`);
  console.log(`  Realized PnL: ${after.realizedPnl > 0 ? '+' : ''}$${after.realizedPnl.toFixed(2)}`);
  console.log(`  Open Positions: ${after.openPositions}\n`);

  // Summary
  console.log("=== SUMMARY ===");
  console.log(`Closed: 2 trades (Trump-China, loss $${Math.abs(totalLoss).toFixed(2)})`);
  console.log(`Opened: 1 trade (S&P 500 correction, 11% edge)`);
  console.log(`Portfolio: $${after.investedAmount.toFixed(2)} invested (${after.exposure.toFixed(1)}% exposure), $${after.cashBalance.toFixed(2)} cash`);
  console.log(`Realized PnL: ${after.realizedPnl > 0 ? '+' : ''}$${after.realizedPnl.toFixed(2)}`);
  console.log("\nNext: Monitor positions daily, watch for Oscars results (Mar 15), consider additional trades if opportunities emerge.");
}

main().catch(console.error);
