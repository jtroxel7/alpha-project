const Database = require('better-sqlite3');
const path = require('path');

const DB_PATH = path.join(__dirname, 'data', 'paper-trading.db');
const db = new Database(DB_PATH);

// Get open trades
const trades = db.prepare("SELECT * FROM trades WHERE status = 'open'").all();

console.log('=== DAY 5 TRADING ACTIONS ===\n');

// Find the trades we want to close
const crudeTrade = trades.find(t => t.question.toLowerCase().includes('crude oil') && t.question.toLowerCase().includes('100'));
const iranTrade = trades.find(t => t.question.toLowerCase().includes('iranian regime fall'));

if (crudeTrade) {
  console.log(`CLOSING: ${crudeTrade.question}`);
  console.log(`  Entry: $${crudeTrade.entry_price.toFixed(2)} | Exit: $0.95 (oil at $119, target $100 exceeded)`);

  const pnl = (0.95 - crudeTrade.entry_price) * crudeTrade.quantity;
  console.log(`  P&L: +$${pnl.toFixed(2)} ✅ PROFIT LOCK`);

  // Update trade to closed_exit
  const stmt = db.prepare(`
    UPDATE trades SET
      exit_price = ?,
      realized_pnl = ?,
      status = 'closed_exit',
      closed_at = datetime('now')
    WHERE id = ?
  `);
  stmt.run(0.95, pnl, crudeTrade.id);
  console.log(`  Database updated: Trade #${crudeTrade.id} closed\n`);
}

if (iranTrade) {
  console.log(`CLOSING: ${iranTrade.question}`);
  console.log(`  Entry: $${iranTrade.entry_price.toFixed(2)} | Exit: $0.22 (regime survived succession, new leader elected)`);

  const pnl = (0.22 - iranTrade.entry_price) * iranTrade.quantity;
  console.log(`  P&L: $${pnl.toFixed(2)} ❌ CUT LOSS`);

  // Update trade to closed_exit
  const stmt = db.prepare(`
    UPDATE trades SET
      exit_price = ?,
      realized_pnl = ?,
      status = 'closed_exit',
      closed_at = datetime('now')
    WHERE id = ?
  `);
  stmt.run(0.22, pnl, iranTrade.id);
  console.log(`  Database updated: Trade #${iranTrade.id} closed\n`);
}

// Show updated portfolio
const updatedTrades = db.prepare("SELECT * FROM trades WHERE status = 'open'").all();
const closedTrades = db.prepare("SELECT * FROM trades WHERE status != 'open'").all();

const investedAmount = updatedTrades.reduce((sum, t) => sum + t.position_size, 0);
const realizedPnlTotal = closedTrades.reduce((sum, t) => sum + (t.realized_pnl || 0), 0);
const bankroll = 500;
const cashBalance = bankroll + realizedPnlTotal - investedAmount;
const totalValue = cashBalance + investedAmount;

console.log('=== UPDATED PORTFOLIO ===');
console.log(`Total Value: $${totalValue.toFixed(2)}`);
console.log(`Cash: $${cashBalance.toFixed(2)}`);
console.log(`Invested: $${investedAmount.toFixed(2)} (${((investedAmount/bankroll)*100).toFixed(1)}% of bankroll)`);
console.log(`Exposure: ${((investedAmount/bankroll)*100).toFixed(1)}% / Max: 40%`);
console.log(`Realized P&L: +$${realizedPnlTotal.toFixed(2)} (+${((realizedPnlTotal/bankroll)*100).toFixed(1)}%)`);

console.log(`\nREMAINING OPEN TRADES (${updatedTrades.length}):`);
updatedTrades.forEach(t => {
  console.log(`- ${t.question.substring(0, 60)}...`);
  console.log(`  Side: ${t.side} | Entry: $${t.entry_price.toFixed(2)} | Position: $${t.position_size.toFixed(2)}`);
});

db.close();
