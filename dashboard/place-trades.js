// Direct database trade insertion script
const Database = require('better-sqlite3');
const path = require('path');

const dbPath = path.join(__dirname, 'data', 'paper-trading.db');
const db = new Database(dbPath);

// Initialize schema if needed
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

// Trade 1: Trump visits China by March 31
const trade1 = {
  marketId: 'trump-china-march-31-2026',
  source: 'polymarket',
  question: 'Will Trump visit China by March 31, 2026?',
  side: 'YES',
  entryPrice: 0.48,
  quantity: Math.floor(25 / 0.48), // ~52 shares
  positionSize: 25,
  estimatedProbability: 0.57,
  marketPriceAtEntry: 0.48,
  edge: 0.09,
  reasoning: 'Visit scheduled Mar 31-Apr 2. Trade negotiations ongoing mid-March. Market overreacted to Iran crisis. Both sides committed despite geopolitical tension. 27 days to resolution - high probability of follow-through. Market priced at 48%, my estimate 57% = 9% edge.',
  status: 'open',
  createdAt: new Date().toISOString()
};

// Trade 2: Iran regime fall by Dec 31, 2026
const trade2 = {
  marketId: 'iran-regime-fall-2026',
  source: 'polymarket',
  question: 'Will the Iranian regime fall by the end of 2026?',
  side: 'YES',
  entryPrice: 0.47,
  quantity: Math.floor(16.5 / 0.47), // ~35 shares
  positionSize: 16.50,
  estimatedProbability: 0.54,
  marketPriceAtEntry: 0.47,
  edge: 0.07,
  reasoning: 'Khamenei killed March 2-3, 2026. Succession crisis with potential successors also targeted. US-Israel committed to regime change operations (Operation Roaring Lion / Epic Fury). Structural break in Iranian political system. Multiple scenarios lead to regime fall by year-end. Market at 47%, my estimate 54% = 7% edge.',
  status: 'open',
  createdAt: new Date().toISOString()
};

try {
  const stmt1 = db.prepare(`
    INSERT INTO trades (market_id, source, question, side, entry_price, quantity, position_size,
      estimated_probability, market_price_at_entry, edge, reasoning, status, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const result1 = stmt1.run(
    trade1.marketId, trade1.source, trade1.question, trade1.side,
    trade1.entryPrice, trade1.quantity, trade1.positionSize,
    trade1.estimatedProbability, trade1.marketPriceAtEntry, trade1.edge,
    trade1.reasoning, trade1.status, trade1.createdAt
  );

  const stmt2 = db.prepare(`
    INSERT INTO trades (market_id, source, question, side, entry_price, quantity, position_size,
      estimated_probability, market_price_at_entry, edge, reasoning, status, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const result2 = stmt2.run(
    trade2.marketId, trade2.source, trade2.question, trade2.side,
    trade2.entryPrice, trade2.quantity, trade2.positionSize,
    trade2.estimatedProbability, trade2.marketPriceAtEntry, trade2.edge,
    trade2.reasoning, trade2.status, trade2.createdAt
  );

  console.log('✓ Trade 1 (Trump-China) inserted. ID:', result1.lastInsertRowid);
  console.log('✓ Trade 2 (Iran Regime) inserted. ID:', result2.lastInsertRowid);

  // Verify insertion
  const openTrades = db.prepare("SELECT id, question, side, position_size, estimated_probability, edge FROM trades WHERE status = 'open'").all();

  console.log('\n=== Updated Portfolio ===');
  const investedAmount = openTrades.reduce((sum, t) => sum + t.position_size, 0);
  const cashBalance = 500 - investedAmount;
  console.log('Total Invested: $' + investedAmount.toFixed(2));
  console.log('Cash Balance: $' + cashBalance.toFixed(2));
  console.log('Exposure: ' + ((investedAmount / 500) * 100).toFixed(1) + '%');
  console.log('Open Positions: ' + openTrades.length);

} catch (error) {
  console.error('Error inserting trades:', error.message);
} finally {
  db.close();
}
