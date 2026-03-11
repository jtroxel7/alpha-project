const Database = require('better-sqlite3');
const db = new Database('./data/paper-trading.db');

console.log('=== CURRENT PORTFOLIO (Day 4, March 5) ===\n');

const trades = db.prepare(`
  SELECT * FROM trades ORDER BY created_at DESC
`).all();

console.log('Recent Trades:');
trades.slice(0, 10).forEach((t, i) => {
  const q = t.question.length > 50 ? t.question.substring(0, 50) + '...' : t.question;
  console.log(`${i+1}. ${q}`);
  console.log(`   Side: ${t.side}, Entry: $${t.entryPrice}, Qty: ${t.quantity}, Status: ${t.status}`);
  if (t.exitPrice) console.log(`   Exit: $${t.exitPrice}`);
  console.log('');
});

const openPositions = db.prepare(`
  SELECT * FROM trades WHERE status = 'open' ORDER BY created_at DESC
`).all();
console.log(`\n=== OPEN POSITIONS (${openPositions.length} total) ===\n`);
let totalInvested = 0;
openPositions.forEach((p, i) => {
  const q = p.question.length > 50 ? p.question.substring(0, 50) + '...' : p.question;
  console.log(`${i+1}. ${q}`);
  console.log(`   Side: ${p.side}, Qty: ${p.quantity}, Entry: $${p.entry_price}, Position: $${p.position_size.toFixed(2)}`);
  console.log(`   Market Price at Entry: $${p.market_price_at_entry}, Edge: ${(p.edge * 100).toFixed(1)}%`);
  totalInvested += p.position_size;
  console.log('');
});

const totalCash = 500 - totalInvested;
console.log(`\n=== PORTFOLIO SUMMARY ===`);
console.log(`Total Invested: $${totalInvested.toFixed(2)}`);
console.log(`Exposure: ${(totalInvested / 500 * 100).toFixed(1)}%`);
console.log(`Cash Available: $${totalCash.toFixed(2)}`);
console.log(`Total Value: $${(totalInvested + totalCash).toFixed(2)}`);
