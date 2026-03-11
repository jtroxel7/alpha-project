const Database = require('better-sqlite3');
const db = new Database('./data/paper-trading.db');

// Close the three open trades that are now underwater
// ID 15: Crude Oil $120 (entry 37c, position $56.68)
// ID 10: Crude Oil $110 (entry 37c, position $25.00)
// ID 11: US Forces Iran (entry 30c, position $25.00)

const closes = [
  {
    id: 15,
    exitPrice: 0.08,  // Oil at $83, very far from $120
    pnl: 56.68 * (0.08 - 0.37) // -$16.40
  },
  {
    id: 10,
    exitPrice: 0.22,  // Oil at $83, needs $110 = very unlikely
    pnl: 25.00 * (0.22 - 0.37) // -$3.75
  },
  {
    id: 11,
    exitPrice: 0.18,  // Trump deescalation signal
    pnl: 25.00 * (0.18 - 0.30) // -$3.00
  }
];

const update = db.prepare(`
  UPDATE trades
  SET status = 'closed_loss', exit_price = ?, realized_pnl = ?, closed_at = datetime('now')
  WHERE id = ?
`);

console.log('=== CLOSING THREE CORRECT TRADES ===\n');
let totalLoss = 0;

closes.forEach(trade => {
  const [pnl, exitPrice, id] = [trade.pnl, trade.exitPrice, trade.id];
  update.run(exitPrice, pnl, id);
  totalLoss += pnl;
  console.log('ID ' + id + ': Loss $' + pnl.toFixed(2));
});

console.log('\nTotal New Loss: $' + totalLoss.toFixed(2));
console.log('Previous cumulative: +$66.82');
console.log('New cumulative P&L: $' + (66.82 + totalLoss).toFixed(2));

db.close();
