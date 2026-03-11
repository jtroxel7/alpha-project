const Database = require('better-sqlite3');
const db = new Database('./data/paper-trading.db');

// Close Hungary Orbán trade (ID 13)
// Entry: 38c, position: $47.61
// Exit: 25c (based on Tisza opposition leading)
// Loss: 47.61 * (0.25 - 0.38) = -$6.19

const pnl = -6.19;

const update = db.prepare(`
  UPDATE trades
  SET status = 'closed_loss', exit_price = 0.25, realized_pnl = ?, closed_at = datetime('now')
  WHERE id = 13
`);

update.run(pnl);

console.log('=== CLOSING HUNGARY ORBÁN TRADE ===\n');
console.log('✗ Will the next Prime Minister of Hungary be Viktor Orbán?');
console.log('  Entry: 38c, Exit: 25c (expected)');
console.log('  Loss: $' + pnl.toFixed(2));
console.log('\nReason: Opposition Tisza party polling 55% vs Fidesz 35% (latest Median poll)');
console.log('Cumulative P&L after all Day 7 closures: $' + (8.88 + pnl).toFixed(2));

db.close();
