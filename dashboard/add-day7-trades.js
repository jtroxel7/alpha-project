const Database = require('better-sqlite3');
const db = new Database('./data/paper-trading.db');

// Two new trades for Day 7 evening:
// 1. Scale S&P 500 correction (already have $20, add $30)
// 2. New trade: US equity volatility / risk-off trade

const trades = [
  {
    market_id: 'sp500-correction-scale',
    source: 'polymarket',
    question: 'Will the S&P 500 drop 15% by June 30, 2026? [SCALE]',
    side: 'YES',
    entry_price: 0.42, // Mid-market after oil crash
    quantity: 71,
    position_size: 29.82,
    estimated_probability: 0.55,
    market_price_at_entry: 0.42,
    edge: 0.13,
    reasoning: 'CAPE ratio at 39.8 (highest since dot-com). Top 10 stocks are 35% of index weight (exceeds 1929/2000 crash levels). Midterm election year historically volatile. Oil shock and geopolitical crisis increase recession odds. Adding to existing $20 position. Target: scale to $50 total exposure.'
  },
  {
    market_id: 'trump-market-rally-reversal',
    source: 'polymarket',
    question: 'Will the Dow Jones drop 10% by June 30, 2026?',
    side: 'YES',
    entry_price: 0.38,
    quantity: 79,
    position_size: 30.02,
    estimated_probability: 0.50,
    market_price_at_entry: 0.38,
    edge: 0.12,
    reasoning: 'Oil shock (Strait of Hormuz crisis) + geopolitical escalation + extreme valuations = classic risk-off conditions. Market has not yet priced in potential recession from sustained high oil prices. Tariff uncertainty continues. Diversify correction bet across Dow (vs S&P). Entry at 38c offers 12% edge vs estimated 50% true probability.'
  }
];

const insert = db.prepare(`
  INSERT INTO trades (
    market_id, source, question, side, entry_price, quantity, position_size,
    estimated_probability, market_price_at_entry, edge, reasoning, status, created_at
  ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
`);

console.log('=== PLACING DAY 7 EVENING TRADES ===\n');
let totalSize = 0;

trades.forEach(t => {
  insert.run(
    t.market_id, t.source, t.question, t.side, t.entry_price, t.quantity,
    t.position_size, t.estimated_probability, t.market_price_at_entry, t.edge,
    t.reasoning, 'open'
  );
  totalSize += t.position_size;
  console.log('✓ ' + t.question.substring(0, 50));
  console.log('  Entry: ' + (t.entry_price*100).toFixed(0) + 'c, Size: $' + t.position_size.toFixed(2) + ', Edge: ' + (t.edge*100).toFixed(0) + '%\n');
});

console.log('Total New Capital Deployed: $' + totalSize.toFixed(2));
console.log('Remaining Cash: $' + (270.40 - totalSize).toFixed(2));

db.close();
