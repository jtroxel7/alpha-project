const Database = require('better-sqlite3');
const db = new Database('./data/paper-trading.db');

// Get portfolio summary
const portfolio = db.prepare(`
  SELECT
    SUM(CASE WHEN status = 'open' THEN position_size ELSE 0 END) as invested_open,
    SUM(CASE WHEN status IN ('closed_win', 'closed_loss', 'closed_exit') THEN realized_pnl ELSE 0 END) as realized_pnl,
    COUNT(CASE WHEN status = 'open' THEN 1 END) as open_count,
    COUNT(CASE WHEN status = 'closed_win' THEN 1 END) as wins,
    COUNT(CASE WHEN status = 'closed_loss' THEN 1 END) as losses
  FROM trades
`).get();

console.log("=== PORTFOLIO SUMMARY ===");
console.log('Invested (Open): $' + (portfolio.invested_open?.toFixed(2) || '0.00'));
console.log('Open Positions: ' + portfolio.open_count);
console.log('Realized P&L: $' + (portfolio.realized_pnl?.toFixed(2) || '0.00'));
console.log('Wins: ' + portfolio.wins + ', Losses: ' + portfolio.losses);

// Get open trades
const trades = db.prepare(`
  SELECT id, question, side, entry_price, quantity, position_size, edge, status
  FROM trades
  WHERE status = 'open'
  ORDER BY created_at DESC
`).all();

console.log("\n=== OPEN POSITIONS ===");
trades.forEach((t, i) => {
  console.log((i+1) + '. ' + t.question.substring(0, 60));
  console.log('   Side: ' + t.side + ', Entry: ' + (t.entry_price*100).toFixed(0) + 'c, Size: $' + t.position_size.toFixed(2) + ', Edge: ' + (t.edge*100).toFixed(1) + '%');
});

db.close();
