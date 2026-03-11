const Database = require('better-sqlite3');
const db = new Database('./data/paper-trading.db');

// Check status of trades we just closed
const toCheck = [5, 6, 7, 13];

const trades = db.prepare(`
  SELECT id, question, status, exit_price, realized_pnl
  FROM trades
  WHERE id IN (?, ?, ?, ?)
`).all(...toCheck);

console.log('=== VERIFICATION OF CLOSES ===\n');
trades.forEach(t => {
  console.log('ID ' + t.id + ': ' + t.question.substring(0, 50));
  console.log('  Status: ' + t.status);
  if (t.exit_price) console.log('  Exit: ' + (t.exit_price * 100).toFixed(0) + 'c');
  if (t.realized_pnl) console.log('  P&L: $' + t.realized_pnl.toFixed(2));
});

// Get fresh portfolio summary
const summary = db.prepare(`
  SELECT
    SUM(CASE WHEN status = 'open' THEN position_size ELSE 0 END) as invested_open,
    SUM(CASE WHEN status IN ('closed_win', 'closed_loss', 'closed_exit') THEN realized_pnl ELSE 0 END) as realized_pnl,
    COUNT(CASE WHEN status = 'open' THEN 1 END) as open_count,
    COUNT(CASE WHEN status = 'closed_loss' THEN 1 END) as losses
  FROM trades
`).get();

console.log('\n=== PORTFOLIO STATE ===');
console.log('Open Positions: ' + summary.open_count);
console.log('Invested: $' + summary.invested_open.toFixed(2));
console.log('Realized P&L: $' + summary.realized_pnl.toFixed(2));
console.log('Closed Losses: ' + summary.losses);

db.close();
