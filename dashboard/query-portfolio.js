const Database = require('better-sqlite3');
const path = require('path');

const DB_PATH = path.join(__dirname, 'data', 'paper-trading.db');
const db = new Database(DB_PATH);

// Get all trades
const trades = db.prepare('SELECT * FROM trades ORDER BY created_at DESC').all();

console.log('=== CURRENT PORTFOLIO ===\n');
console.log(`Total trades: ${trades.length}`);

const openTrades = trades.filter(t => t.status === 'open');
const closedTrades = trades.filter(t => t.status !== 'open');

console.log(`\nOPEN TRADES (${openTrades.length}):`);
openTrades.forEach((t, i) => {
  console.log(`${i+1}. ${t.question}`);
  console.log(`   Side: ${t.side} | Entry: $${t.entry_price.toFixed(2)} | Qty: ${t.quantity.toFixed(0)}`);
  console.log(`   Position: $${t.position_size.toFixed(2)} | Est Prob: ${(t.estimated_probability*100).toFixed(0)}% | Edge: ${(t.edge*100).toFixed(1)}%`);
  console.log(`   Status: ${t.status}\n`);
});

console.log(`\nCLOSED TRADES (${closedTrades.length}):`);
closedTrades.forEach((t, i) => {
  const pnl = t.realized_pnl || 0;
  console.log(`${i+1}. ${t.question}`);
  console.log(`   ${t.status}: ${t.resolved_outcome ? `Resolved ${t.resolved_outcome}` : `Exited at $${t.exit_price?.toFixed(2)}`}`);
  console.log(`   P&L: ${pnl >= 0 ? '+' : ''}$${pnl.toFixed(2)}\n`);
});

// Calculate portfolio metrics
const investedAmount = openTrades.reduce((sum, t) => sum + t.position_size, 0);
const realizedPnl = closedTrades.reduce((sum, t) => sum + (t.realized_pnl || 0), 0);
const wins = closedTrades.filter(t => t.status === 'closed_win').length;
const losses = closedTrades.filter(t => t.status === 'closed_loss').length;
const bankroll = 500;
const cashBalance = bankroll + realizedPnl - investedAmount;
const totalValue = cashBalance + investedAmount;

console.log('=== PORTFOLIO METRICS ===');
console.log(`Total Value: $${totalValue.toFixed(2)}`);
console.log(`Cash: $${cashBalance.toFixed(2)}`);
console.log(`Invested: $${investedAmount.toFixed(2)} (${((investedAmount/bankroll)*100).toFixed(1)}% of bankroll)`);
console.log(`Exposure: ${((investedAmount/bankroll)*100).toFixed(1)}% (Max: 40%)`);
console.log(`Realized P&L: ${realizedPnl >= 0 ? '+' : ''}$${realizedPnl.toFixed(2)} (${((realizedPnl/bankroll)*100).toFixed(1)}%)`);
console.log(`Win Rate: ${closedTrades.length > 0 ? ((wins/closedTrades.length)*100).toFixed(1) : '0'}% (${wins}W ${losses}L)`);

db.close();
