const Database = require('better-sqlite3');
const db = new Database('./data/paper-trading.db');

// Close the three trades that are now heavily underwater due to oil crash
// 1. Crude Oil $120 - entry 37c, now ~8c (oil fell from $119 to $83)
// 2. Crude Oil $110 - entry 37c, now ~22c (oil at $83, needs $110)
// 3. US Forces Iran - entry 30c, now ~18c (deescalation signal from Trump)

const closures = [
  {
    id: 5, // Crude Oil $120
    question: 'Will Crude Oil (CL) hit (HIGH) $120 by end of March 2026?',
    exitPrice: 0.08,
    realized_pnl: -51.19, // 56.68 * (0.08 - 0.37)
    status: 'closed_loss'
  },
  {
    id: 6, // Crude Oil $110
    question: 'Will Crude Oil (CL) hit (HIGH) $110 by end of March 2026?',
    exitPrice: 0.22,
    realized_pnl: -3.75, // 25.00 * (0.22 - 0.37)
    status: 'closed_loss'
  },
  {
    id: 7, // US Forces Iran
    question: 'Will US forces enter Iran by March 31, 2026?',
    exitPrice: 0.18,
    realized_pnl: -3.00, // 25.00 * (0.18 - 0.30)
    status: 'closed_loss'
  }
];

const updateTrade = db.prepare(`
  UPDATE trades
  SET status = ?, exit_price = ?, realized_pnl = ?, closed_at = datetime('now')
  WHERE id = ?
`);

console.log('=== CLOSING UNDERWATER TRADES ===\n');
let totalLoss = 0;

closures.forEach(trade => {
  updateTrade.run(trade.status, trade.exitPrice, trade.realized_pnl, trade.id);
  totalLoss += trade.realized_pnl;
  console.log(`✗ ${trade.question.substring(0, 50)}`);
  console.log(`  Loss: $${trade.realized_pnl.toFixed(2)}\n`);
});

console.log(`TOTAL REALIZED LOSS: $${totalLoss.toFixed(2)}`);
console.log(`New cumulative P&L: $${(66.82 + totalLoss).toFixed(2)}`);

db.close();
