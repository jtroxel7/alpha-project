#!/usr/bin/env node
/**
 * Crypto Trader — Simulated 5-minute binary crypto market trading.
 *
 * Uses real crypto prices from CoinGecko to create synthetic binary markets:
 * "Will BTC be higher in 5 minutes?" and trades them using the same paper trading ledger.
 *
 * Usage:
 *   node scripts/crypto-trader.js                  # Run 6 rounds (30 min total)
 *   node scripts/crypto-trader.js --rounds 12      # Run 12 rounds (60 min)
 *   node scripts/crypto-trader.js --rounds 1       # Single round (for testing)
 *   node scripts/crypto-trader.js --continuous      # Run indefinitely
 *
 * Environment:
 *   CRYPTO_BANKROLL=100    # Separate bankroll for crypto trades (default: $100)
 *   INTERVAL_MS=300000     # Interval between rounds in ms (default: 5 min)
 */

const Database = require("better-sqlite3");
const path = require("path");

// ============ CONFIG ============

const DB_PATH = path.join(__dirname, "..", "data", "paper-trading.db");
const CRYPTO_BANKROLL = parseFloat(process.env.CRYPTO_BANKROLL || "100");
const INTERVAL_MS = parseInt(process.env.INTERVAL_MS || "300000"); // 5 minutes
const MIN_EDGE = 0.03;
const KELLY_FRACTION = 0.50; // Half Kelly
const MAX_POSITION_PCT = 0.15; // 15% of crypto bankroll per trade
const MAX_EXPOSURE_PCT = 0.70; // 70% of crypto bankroll max deployed

const COINS = [
  { id: "bitcoin", symbol: "BTC", name: "Bitcoin" },
  { id: "ethereum", symbol: "ETH", name: "Ethereum" },
  { id: "solana", symbol: "SOL", name: "Solana" },
  { id: "ripple", symbol: "XRP", name: "XRP" },
];

const COINGECKO_BASE = "https://api.coingecko.com/api/v3";

// ============ DB ============

let db;
function getDb() {
  if (!db) {
    db = new Database(DB_PATH);
    db.pragma("journal_mode = WAL");
    db.pragma("foreign_keys = ON");
  }
  return db;
}

function insertTrade(trade) {
  const d = getDb();
  const stmt = d.prepare(`
    INSERT INTO trades (market_id, source, question, side, entry_price, quantity, position_size,
      estimated_probability, market_price_at_entry, edge, reasoning, status, created_at)
    VALUES (?, 'crypto_sim', ?, ?, ?, ?, ?, ?, ?, ?, ?, 'open', datetime('now'))
  `);
  const result = stmt.run(
    trade.marketId, trade.question, trade.side,
    trade.entryPrice, trade.quantity, trade.positionSize,
    trade.estimatedProbability, trade.marketPriceAtEntry, trade.edge,
    trade.reasoning
  );
  return result.lastInsertRowid;
}

function closeTrade(tradeId, exitPrice, resolvedOutcome, status) {
  const d = getDb();
  const trade = d.prepare("SELECT * FROM trades WHERE id = ?").get(tradeId);
  if (!trade) throw new Error(`Trade ${tradeId} not found`);

  let realizedPnl;
  const won = (trade.side === "YES" && resolvedOutcome === "YES") ||
              (trade.side === "NO" && resolvedOutcome === "NO");
  if (won) {
    realizedPnl = (1 - trade.entry_price) * trade.quantity;
  } else {
    realizedPnl = -trade.entry_price * trade.quantity;
  }

  d.prepare(`
    UPDATE trades SET exit_price = ?, realized_pnl = ?, resolved_outcome = ?,
      status = ?, closed_at = datetime('now')
    WHERE id = ?
  `).run(exitPrice, realizedPnl, resolvedOutcome, status, tradeId);

  return { tradeId, realizedPnl, status };
}

function getOpenCryptoTrades() {
  const d = getDb();
  return d.prepare("SELECT * FROM trades WHERE source = 'crypto_sim' AND status = 'open' ORDER BY created_at ASC").all();
}

function getCryptoExposure() {
  const open = getOpenCryptoTrades();
  return open.reduce((sum, t) => sum + t.position_size, 0);
}

function getCryptoPnl() {
  const d = getDb();
  const rows = d.prepare("SELECT realized_pnl FROM trades WHERE source = 'crypto_sim' AND status != 'open'").all();
  return rows.reduce((sum, r) => sum + (r.realized_pnl || 0), 0);
}

// ============ PRICE FETCHING ============

// Price history cache: { coinId: [{ time, price }] }
const priceHistory = {};

async function fetchCurrentPrices() {
  const ids = COINS.map(c => c.id).join(",");
  const url = `${COINGECKO_BASE}/simple/price?ids=${ids}&vs_currencies=usd&include_24hr_change=true`;

  try {
    const res = await fetch(url);
    if (!res.ok) {
      console.error(`CoinGecko price API error: ${res.status}`);
      return null;
    }
    const data = await res.json();

    // Store in history
    const now = Date.now();
    for (const coin of COINS) {
      if (data[coin.id]) {
        if (!priceHistory[coin.id]) priceHistory[coin.id] = [];
        priceHistory[coin.id].push({
          time: now,
          price: data[coin.id].usd,
          change24h: data[coin.id].usd_24h_change || 0,
        });
        // Keep last 30 data points (2.5 hours at 5-min intervals)
        if (priceHistory[coin.id].length > 30) {
          priceHistory[coin.id] = priceHistory[coin.id].slice(-30);
        }
      }
    }

    return data;
  } catch (err) {
    console.error(`CoinGecko fetch failed: ${err.message}`);
    return null;
  }
}

// ============ MOMENTUM ANALYSIS ============

function analyzeMomentum(coinId) {
  const history = priceHistory[coinId];
  if (!history || history.length < 2) {
    return { probability: 0.50, confidence: "low", reasoning: "Insufficient data" };
  }

  const current = history[history.length - 1];
  const signals = [];
  let bullishSignals = 0;
  let bearishSignals = 0;

  // Signal 1: Last interval direction (most recent 5-min move)
  if (history.length >= 2) {
    const prev = history[history.length - 2];
    const lastMove = (current.price - prev.price) / prev.price;
    if (lastMove > 0.001) { bullishSignals += 2; signals.push(`Last 5min: +${(lastMove * 100).toFixed(2)}%`); }
    else if (lastMove < -0.001) { bearishSignals += 2; signals.push(`Last 5min: ${(lastMove * 100).toFixed(2)}%`); }
    else { signals.push("Last 5min: flat"); }
  }

  // Signal 2: Short-term trend (last 3 intervals = 15 min)
  if (history.length >= 4) {
    const threeAgo = history[history.length - 4];
    const shortTrend = (current.price - threeAgo.price) / threeAgo.price;
    if (shortTrend > 0.002) { bullishSignals += 1.5; signals.push(`15min trend: +${(shortTrend * 100).toFixed(2)}%`); }
    else if (shortTrend < -0.002) { bearishSignals += 1.5; signals.push(`15min trend: ${(shortTrend * 100).toFixed(2)}%`); }
  }

  // Signal 3: Medium-term trend (last 6 intervals = 30 min)
  if (history.length >= 7) {
    const sixAgo = history[history.length - 7];
    const medTrend = (current.price - sixAgo.price) / sixAgo.price;
    if (medTrend > 0.003) { bullishSignals += 1; signals.push(`30min trend: +${(medTrend * 100).toFixed(2)}%`); }
    else if (medTrend < -0.003) { bearishSignals += 1; signals.push(`30min trend: ${(medTrend * 100).toFixed(2)}%`); }
  }

  // Signal 4: Consecutive direction (momentum persistence)
  let consecutive = 0;
  for (let i = history.length - 1; i >= 1; i--) {
    const move = history[i].price - history[i - 1].price;
    if (i === history.length - 1) {
      consecutive = move > 0 ? 1 : -1;
    } else {
      if ((move > 0 && consecutive > 0) || (move < 0 && consecutive < 0)) {
        consecutive += consecutive > 0 ? 1 : -1;
      } else {
        break;
      }
    }
  }
  if (Math.abs(consecutive) >= 3) {
    if (consecutive > 0) { bullishSignals += 1.5; signals.push(`${consecutive} consecutive up`); }
    else { bearishSignals += 1.5; signals.push(`${Math.abs(consecutive)} consecutive down`); }
  }

  // Signal 5: 24h change as background context
  if (current.change24h > 3) { bullishSignals += 0.5; signals.push(`24h: +${current.change24h.toFixed(1)}%`); }
  else if (current.change24h < -3) { bearishSignals += 0.5; signals.push(`24h: ${current.change24h.toFixed(1)}%`); }

  // Convert signals to probability
  const totalSignals = bullishSignals + bearishSignals;
  let probability;
  if (totalSignals === 0) {
    probability = 0.50;
  } else {
    // Base probability between 0.35 and 0.65 based on signal strength
    const bullishRatio = bullishSignals / (totalSignals || 1);
    probability = 0.35 + bullishRatio * 0.30; // Range: 0.35 to 0.65
  }

  // Confidence based on data availability and signal strength
  const confidence = history.length >= 6 && totalSignals >= 3 ? "medium" : "low";

  const direction = probability > 0.50 ? "UP" : probability < 0.50 ? "DOWN" : "NEUTRAL";
  const reasoning = `${direction} signal (${(probability * 100).toFixed(1)}%): ${signals.join(", ")}`;

  return { probability, confidence, reasoning };
}

// ============ POSITION SIZING (Kelly) ============

function kellySize(trueProbability, entryPrice, bankroll) {
  if (entryPrice <= 0 || entryPrice >= 1) return 0;
  if (trueProbability <= 0 || trueProbability >= 1) return 0;

  const b = (1 - entryPrice) / entryPrice;
  const p = trueProbability;
  const q = 1 - p;
  const f = (b * p - q) / b;
  if (f <= 0) return 0;

  const kellyDollars = f * KELLY_FRACTION * bankroll;
  const maxDollars = MAX_POSITION_PCT * bankroll;
  return Math.min(kellyDollars, maxDollars);
}

// ============ TRADING LOGIC ============

async function resolveOpenTrades(prices) {
  const openTrades = getOpenCryptoTrades();
  let resolved = 0;

  for (const trade of openTrades) {
    // Extract coin from market_id (format: "btc_5min_<timestamp>")
    const coinSymbol = trade.market_id.split("_")[0].toUpperCase();
    const coin = COINS.find(c => c.symbol === coinSymbol);
    if (!coin || !prices[coin.id]) continue;

    // Check if trade is old enough to resolve (at least 5 minutes)
    const tradeTime = new Date(trade.created_at + "Z").getTime();
    const now = Date.now();
    const ageMs = now - tradeTime;
    if (ageMs < INTERVAL_MS - 30000) continue; // Allow 30s slack

    // Extract target price from question (format: "Will BTC be above $X in 5 min?")
    const match = trade.question.match(/above \$([0-9,.]+)/);
    if (!match) continue;
    const targetPrice = parseFloat(match[1].replace(/,/g, ""));

    const currentPrice = prices[coin.id].usd;
    const wentUp = currentPrice > targetPrice;
    const resolvedOutcome = wentUp ? "YES" : "NO";
    const won = trade.side === resolvedOutcome;
    const status = won ? "closed_win" : "closed_loss";
    const exitPrice = won ? 1 : 0;

    const result = closeTrade(trade.id, exitPrice, resolvedOutcome, status);
    console.log(`  RESOLVED #${trade.id}: ${trade.question.substring(0, 50)}... => ${resolvedOutcome} | ${won ? "WIN" : "LOSS"} | P&L: $${result.realizedPnl.toFixed(2)}`);
    resolved++;
  }

  return resolved;
}

async function placeTrades(prices) {
  const currentExposure = getCryptoExposure();
  const realizedPnl = getCryptoPnl();
  const effectiveBankroll = CRYPTO_BANKROLL + realizedPnl;
  const maxExposure = MAX_EXPOSURE_PCT * effectiveBankroll;
  let availableCapital = maxExposure - currentExposure;

  if (availableCapital < 2) {
    console.log(`  Capital fully deployed ($${currentExposure.toFixed(2)} / $${maxExposure.toFixed(2)}). Skipping new trades.`);
    return 0;
  }

  let placed = 0;

  for (const coin of COINS) {
    if (!prices[coin.id] || availableCapital < 2) continue;

    const currentPrice = prices[coin.id].usd;
    const { probability, confidence, reasoning } = analyzeMomentum(coin.id);

    // Generate synthetic market price (centered at 0.50 with noise)
    const noise = (Math.random() - 0.5) * 0.06; // +/- 3%
    const syntheticMarketPrice = Math.max(0.35, Math.min(0.65, 0.50 + noise));

    // Determine side and edge
    const edge = Math.abs(probability - syntheticMarketPrice);

    if (edge < MIN_EDGE) {
      console.log(`  ${coin.symbol}: Edge ${(edge * 100).toFixed(1)}% < ${MIN_EDGE * 100}% min. Skip.`);
      continue;
    }

    // Which side to trade?
    const side = probability > syntheticMarketPrice ? "YES" : "NO";
    const entryPrice = side === "YES" ? syntheticMarketPrice : (1 - syntheticMarketPrice);
    const trueProbForSide = side === "YES" ? probability : (1 - probability);

    // Kelly sizing
    const positionSize = kellySize(trueProbForSide, entryPrice, effectiveBankroll);
    if (positionSize < 1) {
      console.log(`  ${coin.symbol}: Position size too small ($${positionSize.toFixed(2)}). Skip.`);
      continue;
    }

    const actualSize = Math.min(positionSize, availableCapital);
    const quantity = actualSize / entryPrice;

    const marketId = `${coin.symbol.toLowerCase()}_5min_${Date.now()}`;
    const question = `Will ${coin.symbol} be above $${currentPrice.toLocaleString("en-US", { maximumFractionDigits: 2 })} in 5 min?`;

    const tradeId = insertTrade({
      marketId,
      question,
      side,
      entryPrice: Math.round(entryPrice * 100) / 100,
      quantity: Math.round(quantity * 100) / 100,
      positionSize: Math.round(actualSize * 100) / 100,
      estimatedProbability: Math.round(probability * 1000) / 1000,
      marketPriceAtEntry: Math.round(syntheticMarketPrice * 100) / 100,
      edge: Math.round(edge * 1000) / 1000,
      reasoning,
    });

    console.log(`  TRADE #${tradeId}: ${side} "${question}" @ ${(entryPrice * 100).toFixed(0)}c | $${actualSize.toFixed(2)} | Edge: ${(edge * 100).toFixed(1)}%`);
    availableCapital -= actualSize;
    placed++;
  }

  return placed;
}

// ============ MAIN LOOP ============

async function runRound(roundNum, totalRounds) {
  const label = totalRounds === Infinity ? `Round ${roundNum}` : `Round ${roundNum}/${totalRounds}`;
  console.log(`\n=== ${label} | ${new Date().toLocaleTimeString()} ===`);

  // Fetch prices
  const prices = await fetchCurrentPrices();
  if (!prices) {
    console.log("  Failed to fetch prices. Skipping round.");
    return;
  }

  // Print current prices
  for (const coin of COINS) {
    if (prices[coin.id]) {
      const p = prices[coin.id];
      console.log(`  ${coin.symbol}: $${p.usd.toLocaleString("en-US", { maximumFractionDigits: 2 })} (24h: ${p.usd_24h_change?.toFixed(1) || "?"}%)`);
    }
  }

  // Resolve old trades first
  const resolved = await resolveOpenTrades(prices);
  if (resolved > 0) console.log(`  Resolved ${resolved} trades`);

  // Place new trades
  const placed = await placeTrades(prices);
  if (placed > 0) console.log(`  Placed ${placed} new trades`);

  // Summary
  const exposure = getCryptoExposure();
  const pnl = getCryptoPnl();
  const openCount = getOpenCryptoTrades().length;
  console.log(`  Portfolio: $${(CRYPTO_BANKROLL + pnl).toFixed(2)} | Exposure: $${exposure.toFixed(2)} | Open: ${openCount} | P&L: $${pnl.toFixed(2)}`);
}

async function main() {
  // Parse args
  let rounds = 6; // Default: 6 rounds = 30 minutes
  const args = process.argv.slice(2);
  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--rounds" && args[i + 1]) {
      rounds = parseInt(args[i + 1]);
      i++;
    }
    if (args[i] === "--continuous") {
      rounds = Infinity;
    }
  }

  console.log("=== Crypto Trader Started ===");
  console.log(`Bankroll: $${CRYPTO_BANKROLL} | Interval: ${INTERVAL_MS / 1000}s | Rounds: ${rounds === Infinity ? "continuous" : rounds}`);
  console.log(`Coins: ${COINS.map(c => c.symbol).join(", ")}`);
  console.log(`Risk: Half-Kelly | Max position: ${MAX_POSITION_PCT * 100}% | Max exposure: ${MAX_EXPOSURE_PCT * 100}% | Min edge: ${MIN_EDGE * 100}%`);

  for (let round = 1; round <= rounds; round++) {
    await runRound(round, rounds);

    if (round < rounds) {
      console.log(`  Waiting ${INTERVAL_MS / 1000}s until next round...`);
      await new Promise(resolve => setTimeout(resolve, INTERVAL_MS));
    }
  }

  console.log("\n=== Crypto Trader Finished ===");
  const finalPnl = getCryptoPnl();
  const openCount = getOpenCryptoTrades().length;
  console.log(`Final P&L: $${finalPnl.toFixed(2)} | Remaining open: ${openCount}`);

  if (db) db.close();
}

main().catch(err => {
  console.error("Fatal error:", err);
  if (db) db.close();
  process.exit(1);
});
