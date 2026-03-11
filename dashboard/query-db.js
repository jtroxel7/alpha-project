const Database = require("better-sqlite3");
const path = require("path");

const dbPath = path.join(__dirname, "data/paper-trading.db");
const db = new Database(dbPath);

// ===== DAY 4 TRADE EXECUTION =====
console.log("=== DAY 4 TRADE EXECUTION (March 5, 2026) ===\n");

// 1. Close Skarsgård trade (Sean Penn now favored)
console.log("1. CLOSING: Skarsgård Best Supporting Actor");
const skarsgardTrade = db.prepare("SELECT * FROM trades WHERE question LIKE '%Skarsgård%' AND status = 'open'").get();
if (skarsgardTrade) {
  const exitPrice = 0.35;  // Fair value for 37% odds
  const realizedPnL = (exitPrice - skarsgardTrade.entry_price) * skarsgardTrade.quantity;
  db.prepare("UPDATE trades SET status = 'closed_loss', exit_price = ?, realized_pnl = ?, closed_at = datetime('now') WHERE id = ?")
    .run(exitPrice, realizedPnL, skarsgardTrade.id);
  console.log(`   Entry: $${skarsgardTrade.entry_price}, Exit: $${exitPrice}`);
  console.log(`   Realized P&L: $${realizedPnL.toFixed(2)}`);
  console.log(`   Reason: Sean Penn surged to 50% odds (vs Skarsgård 37%)\n`);
}

// 2. Open Crude Oil $100 by March 31 (MASSIVE EDGE)
console.log("2. OPENING: Crude Oil (WTI) reaches $100 by March 31, 2026");
const oilReason = "Strait of Hormuz effectively closed March 2-3 (IRGC threats, 150+ tankers anchored, insurance cancelled). Disrupts 20% of world oil supply. WTI at $74.42, needs 35% rally to $100. Historical: 1973 embargo spiked oil 140%+. Current supply shock similar magnitude. Geopolitical escalation ongoing (Iran missile strikes). Market at 34% odds significantly underprices supply disruption severity. Estimated true probability: 65%. EDGE: 31 percentage points.";

db.prepare(`
  INSERT INTO trades (market_id, source, question, side, entry_price, quantity, position_size, estimated_probability, market_price_at_entry, edge, reasoning, status, created_at)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'open', datetime('now'))
`).run(
  'crude-oil-100-mar31-2026',
  'polymarket',
  'Will crude oil (WTI) reach $100 per barrel by March 31, 2026?',
  'YES',
  0.34,
  73.53,
  25.00,
  0.65,
  0.34,
  0.31,
  oilReason
);
console.log(`   Entry: $0.34 (34% market odds)`);
console.log(`   Position Size: $25.00 (max single position)`);
console.log(`   Quantity: 73.53 shares`);
console.log(`   Estimated Probability: 65% (vs market 34%)`);
console.log(`   Edge: 31 percentage points\n`);

// Get open trades
const openTrades = db.prepare("SELECT * FROM trades WHERE status = 'open' ORDER BY created_at DESC").all();

// Get all trades for stats
const allTrades = db.prepare("SELECT * FROM trades ORDER BY created_at DESC").all();
const closedTrades = allTrades.filter(t => t.status !== 'open');

// Calculate portfolio state
const investedAmount = openTrades.reduce((sum, t) => sum + t.position_size, 0);
const realizedPnl = closedTrades.reduce((sum, t) => sum + (t.realized_pnl || 0), 0);
const wins = closedTrades.filter(t => t.status === 'closed_win').length;
const losses = closedTrades.filter(t => t.status === 'closed_loss').length;

const bankroll = 500;
const cashBalance = bankroll + realizedPnl - investedAmount;
const totalValue = cashBalance + investedAmount;

console.log("=== PORTFOLIO STATE ===");
console.log(`Total Value: $${totalValue.toFixed(2)}`);
console.log(`Cash Balance: $${cashBalance.toFixed(2)}`);
console.log(`Invested: $${investedAmount.toFixed(2)}`);
console.log(`Exposure: ${((investedAmount/bankroll)*100).toFixed(1)}%`);
console.log(`Realized P&L: $${realizedPnl.toFixed(2)}`);
console.log(`Total Trades: ${allTrades.length}`);
console.log(`Open Positions: ${openTrades.length}`);
console.log(`Closed (W/L): ${wins}/${losses}`);

console.log("\n=== OPEN TRADES ===");
openTrades.forEach((t, i) => {
  console.log(`${i+1}. ${t.question.substring(0,60)}`);
  console.log(`   Side: ${t.side} @ ${(t.entry_price*100).toFixed(0)}¢, Qty: ${t.quantity.toFixed(1)}`);
  console.log(`   Edge: ${(t.edge*100).toFixed(1)}%, Est Prob: ${(t.estimated_probability*100).toFixed(0)}%`);
  console.log(`   Created: ${t.created_at}`);
});

console.log("\n=== ALL TRADES ===");
allTrades.forEach((t, i) => {
  const statusStr = t.status === 'open' ? 'OPEN' : `${t.status.toUpperCase()} (${t.resolved_outcome || '?'})`;
  const pnl = t.realized_pnl ? ` PnL: $${t.realized_pnl.toFixed(2)}` : '';
  console.log(`${i+1}. ${statusStr}${pnl} - ${t.question.substring(0,50)}`);
});
