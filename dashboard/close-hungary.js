const Database = require('better-sqlite3');
const db = new Database('./data/paper-trading.db');

// Close Hungary trade - Tisza opposition polls are leading (55% vs Fidesz 35%)
// Thesis: Orbán next PM at entry 38c is now invalidated

const closeHungary = db.prepare(`
  UPDATE trades
  SET status = 'closed_loss', exit_price = 0.25, realized_pnl = ?, closed_at = datetime('now')
  WHERE id = 3 AND question LIKE '%Hungary%'
`);

// Orbán position: 127 qty at 38c entry = $47.61
// Exit at 25c = $31.75
// Loss = $31.75 - $47.61 = -$15.86
const pnl = -15.86;

closeHungary.run(pnl);

console.log('=== CLOSING HUNGARY ORBÁN TRADE ===\n');
console.log('✗ Will the next Prime Minister of Hungary be Viktor Orbán?');
console.log('  Entry: 38c, Exit: 25c');
console.log('  Loss: $' + pnl.toFixed(2));
console.log('\nReason: Opposition Tisza polls 55% vs Fidesz 35% (latest Median poll)');
console.log('Updated P&L: $' + (8.88 + pnl).toFixed(2));

db.close();
