const Database = require('better-sqlite3');
const db = new Database('./data/paper-trading.db');

const trades = db.prepare(`
  SELECT id, question, entry_price, position_size, status, created_at
  FROM trades
  ORDER BY created_at DESC
`).all();

console.log('=== ALL TRADES (MOST RECENT FIRST) ===\n');
trades.forEach(t => {
  const status = t.status === 'open' ? '🟢 OPEN' : '🔴 ' + t.status;
  console.log('ID ' + t.id + ' [' + status + ']: ' + t.question);
  console.log('  Entry: ' + (t.entry_price*100).toFixed(0) + 'c, Size: $' + t.position_size.toFixed(2) + ', Created: ' + t.created_at.substring(0,10));
});

db.close();
