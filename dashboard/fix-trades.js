const Database = require("better-sqlite3");
const path = require("path");

const dbPath = path.join(__dirname, "data/paper-trading.db");
const db = new Database(dbPath);

// Get the open trades to identify Trump-China ones by question
const openTrades = db.prepare("SELECT * FROM trades WHERE status = 'open'").all();

console.log("=== IDENTIFYING TRUMP-CHINA TRADES ===\n");
let trumpChinaIds = [];

openTrades.forEach(t => {
  if (t.question.toLowerCase().includes("trump") && t.question.toLowerCase().includes("china")) {
    trumpChinaIds.push(t.id);
    console.log(`Found Trump-China trade: ID ${t.id}, Entry ${(t.entry_price*100).toFixed(0)}¢, Qty ${t.quantity.toFixed(1)}`);
  }
});

console.log(`\nTotal Trump-China trades to close: ${trumpChinaIds.length}\n`);

if (trumpChinaIds.length === 0) {
  console.log("ERROR: Could not find Trump-China trades!");
  process.exit(1);
}

console.log("=== CLOSING TRUMP-CHINA TRADES ===\n");

function closeTrade(tradeId, exitPrice) {
  const trade = db.prepare("SELECT * FROM trades WHERE id = ?").get(tradeId);

  // Calculate PnL
  let realizedPnl;
  if (trade.side === "YES") {
    realizedPnl = (exitPrice - trade.entry_price) * trade.quantity;
  } else {
    realizedPnl = ((1 - exitPrice) - (1 - trade.entry_price)) * trade.quantity;
  }

  const stmt = db.prepare(`
    UPDATE trades SET exit_price = ?, realized_pnl = ?, status = 'closed_exit', closed_at = datetime('now')
    WHERE id = ?
  `);
  stmt.run(exitPrice, realizedPnl, tradeId);

  console.log(`Closed ID ${tradeId}: ${trade.question.substring(0,40)}`);
  console.log(`  Entry: ${(trade.entry_price*100).toFixed(0)}¢, Exit: ${(exitPrice*100).toFixed(0)}¢, Qty: ${trade.quantity.toFixed(1)}`);
  console.log(`  PnL: ${realizedPnl > 0 ? '+' : ''}$${realizedPnl.toFixed(2)}\n`);

  return realizedPnl;
}

let totalPnl = 0;
trumpChinaIds.forEach(id => {
  totalPnl += closeTrade(id, 0.42); // Exit at 42¢ (current market odds)
});

console.log(`Total PnL from Trump-China exits: ${totalPnl > 0 ? '+' : ''}$${totalPnl.toFixed(2)}\n`);

// Summary
const allTrades = db.prepare("SELECT * FROM trades").all();
const openCount = allTrades.filter(t => t.status === 'open').length;
const investedAmount = db.prepare("SELECT * FROM trades WHERE status = 'open'").all()
  .reduce((sum, t) => sum + t.position_size, 0);

console.log("=== PORTFOLIO STATUS ===");
console.log(`Open positions: ${openCount}`);
console.log(`Invested: $${investedAmount.toFixed(2)}`);
console.log(`Cash available: $${(500 - investedAmount).toFixed(2)}`);
console.log(`Exposure: ${((investedAmount/500)*100).toFixed(1)}%`);
