const Database = require('better-sqlite3');
const db = new Database('./data/paper-trading.db');

const trades = db.prepare(`
  SELECT id, question, entry_price, position_size, status
  FROM trades
  WHERE status = 'open' AND (question LIKE '%Hungary%' OR question LIKE '%Iran regime%')
`).all();

console.log('Trades to potentially close:');
trades.forEach(t => {
  console.log('ID ' + t.id + ': ' + t.question.substring(0, 50));
  console.log('  Entry: ' + (t.entry_price*100).toFixed(0) + 'c, Size: $' + t.position_size.toFixed(2));
});

db.close();
