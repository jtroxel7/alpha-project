const Database = require('better-sqlite3');
const db = new Database('./data/paper-trading.db');

// Get remaining open trades
const open = db.prepare(`
  SELECT id, question, entry_price, position_size, edge, status
  FROM trades
  WHERE status = 'open'
  ORDER BY id DESC
`).all();

// Get P&L summary
const summary = db.prepare(`
  SELECT
    SUM(CASE WHEN status = 'open' THEN position_size ELSE 0 END) as invested_open,
    SUM(CASE WHEN status IN ('closed_win', 'closed_loss', 'closed_exit') THEN realized_pnl ELSE 0 END) as realized_pnl,
    COUNT(CASE WHEN status = 'open' THEN 1 END) as open_count,
    COUNT(CASE WHEN status = 'closed_loss' THEN 1 END) as losses,
    COUNT(CASE WHEN status = 'closed_exit' THEN 1 END) as closed_exits
  FROM trades
`).get();

console.log('=== DAY 7 FINAL STATE ===\n');
console.log('Portfolio Value: $' + (500 + summary.realized_pnl).toFixed(2));
console.log('Realized P&L: $' + summary.realized_pnl.toFixed(2));
console.log('Cash Available: $' + (500 + summary.realized_pnl - summary.invested_open).toFixed(2));
console.log('');
console.log('Open Positions: ' + summary.open_count);
console.log('Total Invested: $' + summary.invested_open.toFixed(2));
console.log('Exposure: ' + ((summary.invested_open / (500 + summary.realized_pnl)) * 100).toFixed(1) + '%');
console.log('');
console.log('Closed Losses: ' + summary.losses);
console.log('Closed Exits: ' + summary.closed_exits);

console.log('\n=== REMAINING OPEN POSITIONS ===\n');
open.forEach(t => {
  console.log('ID ' + t.id + ': ' + t.question.substring(0, 55));
  console.log('  Entry: ' + (t.entry_price*100).toFixed(0) + 'c, Size: $' + t.position_size.toFixed(2) + ', Edge: ' + (t.edge*100).toFixed(1) + '%\n');
});

db.close();
