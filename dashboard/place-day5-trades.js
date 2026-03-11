const Database = require('better-sqlite3');
const path = require('path');

const DB_PATH = path.join(__dirname, 'data', 'paper-trading.db');
const db = new Database(DB_PATH);

const BANKROLL = 500;
const MAX_POSITION = BANKROLL * 0.05;  // 5% = $25

// Kelly formula: f = 0.25 * ((b*p - q) / b)
// where b = (1-price)/price, p = estimated prob, q = 1-p
function calculateKellySize(entryPrice, estimatedProb) {
  const q = 1 - estimatedProb;
  const b = (1 - entryPrice) / entryPrice;
  const f = 0.25 * ((b * estimatedProb - q) / b);

  // Quantity: position_size / entry_price
  // With cap at 5% of bankroll
  const basePosSize = Math.max(0, f * BANKROLL);
  const cappedPosSize = Math.min(basePosSize, MAX_POSITION);
  const quantity = cappedPosSize / entryPrice;

  return {
    positionSize: cappedPosSize,
    quantity: Math.round(quantity * 100) / 100
  };
}

const trades = [
  {
    marketId: 'crude-oil-110-mar31',
    question: 'Will Crude Oil (CL) hit (HIGH) $110 by end of March 2026?',
    side: 'YES',
    entryPrice: 0.37,
    marketPriceAtEntry: 0.37,
    estimatedProbability: 0.60,
    edge: 0.23,
    reasoning: `Crude oil currently at $119/barrel. Strait of Hormuz effectively closed since March 2-3 (supply shock affecting 20% of global oil). Qatar LNG production halted. Supply disruption similar to 1973 oil embargo (140% spike). Target of $110 is highly achievable over 22 days given structural supply constraints. Entry at 37¢ provides 23% edge vs. 60% true probability estimate. Position sizing with quarter-Kelly criteria.`,
    source: 'polymarket'
  },
  {
    marketId: 'us-forces-iran-mar31',
    question: 'Will US forces enter Iran by March 31, 2026?',
    side: 'YES',
    entryPrice: 0.30,
    marketPriceAtEntry: 0.30,
    estimatedProbability: 0.50,
    edge: 0.20,
    reasoning: `Escalation pattern clear: Khamenei killed Feb 28, regime survived with new leader (Mojtaba) elected Mar 8 via IRGC pressure. Israeli airstrikes continue (bombed Assembly of Experts in Qom). US-Iran war underway since Mar 1. Pattern suggests direct US military engagement likely within 22 days. Market at 30% implies only 1-in-3 odds; historical precedent and current escalation trajectory suggest 50%+ true probability. 20% edge justifies trade.`,
    source: 'polymarket'
  },
  {
    marketId: 'iran-regime-fall-dec31',
    question: 'Will the Iranian regime fall by the end of 2026?',
    side: 'NO',
    entryPrice: 0.76,  // Betting NO that regime falls = buying NO at (1-0.24) ≈ 0.76
    marketPriceAtEntry: 0.24,  // YES market at 24¢, so NO at 76¢
    estimatedProbability: 0.20,  // Probability regime DOES fall (we're betting against this)
    edge: 0.10,
    reasoning: `Regime survival proven: Despite Khamenei assassination on Feb 28, Iranian government did NOT collapse. Instead, orderly succession occurred with new Supreme Leader (Mojtaba Khamenei) elected Mar 8 by Assembly of Experts. IRGC pledged allegiance. Institutional structures held firm even under Israeli bombing. Market now prices regime fall at 24% by Dec 31. Historical resistance suggests regime survives geopolitical crises; estimated true probability of collapse only 10-15%. Betting NO (regime survives) at 76¢ provides 10-15% edge.`,
    source: 'polymarket'
  }
];

console.log('=== PLACING DAY 5 TRADES ===\n');

let totalInvested = 0;
const openTrades = db.prepare("SELECT SUM(position_size) as total FROM trades WHERE status = 'open'").get();
let currentInvested = openTrades?.total || 0;

for (const trade of trades) {
  const { positionSize, quantity } = calculateKellySize(trade.entryPrice, trade.estimatedProbability);

  // Check risk limits
  const newTotal = currentInvested + positionSize;
  if (newTotal > BANKROLL * 0.40) {
    console.log(`⚠️  SKIP: ${trade.question.substring(0, 50)}...`);
    console.log(`   Would exceed 40% exposure limit ($${(BANKROLL*0.40).toFixed(2)})`);
    console.log(`   Current: $${currentInvested.toFixed(2)} + Position: $${positionSize.toFixed(2)} = $${newTotal.toFixed(2)}\n`);
    continue;
  }

  // Insert trade
  const stmt = db.prepare(`
    INSERT INTO trades (market_id, source, question, side, entry_price, quantity, position_size,
      estimated_probability, market_price_at_entry, edge, reasoning, status, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'open', datetime('now'))
  `);

  const result = stmt.run(
    trade.marketId,
    trade.source,
    trade.question,
    trade.side,
    trade.entryPrice,
    quantity,
    positionSize,
    trade.estimatedProbability,
    trade.marketPriceAtEntry,
    trade.edge,
    trade.reasoning
  );

  console.log(`✅ OPENED: ${trade.question.substring(0, 60)}...`);
  console.log(`   Side: ${trade.side} | Entry: $${trade.entryPrice.toFixed(2)} | Qty: ${quantity.toFixed(0)}`);
  console.log(`   Position: $${positionSize.toFixed(2)} | Est Prob: ${(trade.estimatedProbability*100).toFixed(0)}% | Edge: ${(trade.edge*100).toFixed(0)}%`);
  console.log(`   Trade #${result.lastInsertRowid}\n`);

  currentInvested += positionSize;
  totalInvested += positionSize;
}

// Show updated portfolio
const allTrades = db.prepare("SELECT * FROM trades WHERE status = 'open'").all();
const closedTrades = db.prepare("SELECT * FROM trades WHERE status != 'open'").all();

const investedAmount = allTrades.reduce((sum, t) => sum + t.position_size, 0);
const realizedPnlTotal = closedTrades.reduce((sum, t) => sum + (t.realized_pnl || 0), 0);
const cashBalance = BANKROLL + realizedPnlTotal - investedAmount;
const totalValue = cashBalance + investedAmount;

console.log('=== UPDATED PORTFOLIO ===');
console.log(`Total Value: $${totalValue.toFixed(2)}`);
console.log(`Cash: $${cashBalance.toFixed(2)}`);
console.log(`Invested: $${investedAmount.toFixed(2)} (${((investedAmount/BANKROLL)*100).toFixed(1)}% of bankroll)`);
console.log(`Exposure: ${((investedAmount/BANKROLL)*100).toFixed(1)}% / Max: 40%`);
console.log(`Realized P&L: +$${realizedPnlTotal.toFixed(2)} (+${((realizedPnlTotal/BANKROLL)*100).toFixed(1)}%)`);
console.log(`New Trades Placed: ${trades.length}`);
console.log(`Capital Deployed: $${totalInvested.toFixed(2)}`);

console.log(`\nOPEN TRADES (${allTrades.length}):`);
allTrades.forEach(t => {
  const edge = (t.edge * 100).toFixed(0);
  const side = t.side === 'YES' ? '✓' : '✗';
  console.log(`${side} ${t.question.substring(0, 55)}... ($${t.position_size.toFixed(2)}, ${edge}% edge)`);
});

db.close();
