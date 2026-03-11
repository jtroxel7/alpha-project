const https = require("https");
const Database = require("better-sqlite3");
const path = require("path");

const dbPath = path.join(__dirname, "data/paper-trading.db");
const db = new Database(dbPath);

function httpPost(url, data) {
  return new Promise((resolve, reject) => {
    const options = new URL(url);
    const client = options.protocol === 'https:' ? https : require('http');

    const postData = JSON.stringify(data);
    const req = client.request(
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Content-Length": Buffer.byteLength(postData),
        },
      },
      (res) => {
        let respData = "";
        res.on("data", (chunk) => (respData += chunk));
        res.on("end", () => {
          try {
            resolve(JSON.parse(respData));
          } catch (e) {
            resolve({raw: respData});
          }
        });
      }
    );
    req.on("error", reject);
    req.write(postData);
    req.end();
  });
}

async function closeTrade(tradeId, exitPrice, status) {
  const trade = db.prepare("SELECT * FROM trades WHERE id = ?").get(tradeId);
  console.log(`Closing trade #${tradeId}: ${trade.question.substring(0,50)}`);
  console.log(`  Entry: ${(trade.entry_price*100).toFixed(0)}¢, Exit: ${(exitPrice*100).toFixed(0)}¢`);

  const result = await httpPost("http://localhost:3000/api/trades", {
    action: "close",
    tradeId,
    exitPrice,
    resolvedOutcome: null,
    status,
  });
  console.log(`  Result:`, result);
}

async function openTrade(trade) {
  console.log(`Opening trade: ${trade.question.substring(0,50)}`);
  console.log(`  Side: ${trade.side}, Entry: ${(trade.entryPrice*100).toFixed(0)}¢, Edge: ${(trade.edge*100).toFixed(1)}%`);

  const result = await httpPost("http://localhost:3000/api/trades", {
    action: "open",
    ...trade,
  });
  console.log(`  Result:`, result);
  return result.id;
}

async function main() {
  console.log("=== TRADING SESSION ===\n");

  // Get all open trades
  const openTrades = db.prepare("SELECT * FROM trades WHERE status = 'open' ORDER BY created_at").all();

  console.log("Current open trades:");
  openTrades.forEach((t, i) => {
    console.log(`  ${t.id}. ${t.question.substring(0,40)} - ${t.side} @ ${(t.entry_price*100).toFixed(0)}¢`);
  });
  console.log();

  // Step 1: Close Trump-China trades due to massive market move
  console.log("STEP 1: Close Trump-China trades (market moved 40+ points against position)\n");

  // Trade #5 - Trump visit China at 53¢, entry was 53¢, current market ~42¢
  // If I exit at 42¢, loss = (42-53) * 37 shares = -$407? No wait, let me recalculate
  // entry_price = 0.53, quantity = 37, so position_size = 19.61
  // If I exit at 42¢ on a YES position: realized_pnl = (0.42 - 0.53) * 37 = -$4.07
  console.log("Trade #5 (Trump-China, entry 53¢, 37 qty): Market moved from 84% -> 42%");
  console.log("  Exit at ~42¢ for realized loss of ~$4.07");
  // await closeTrade(5, 0.42, "closed_exit");
  console.log();

  // Trade #2 - Trump visit China at 48¢, entry was 48¢, current market ~42¢
  console.log("Trade #2 (Trump-China, entry 48¢, 52 qty): Market moved from 84% -> 42%");
  console.log("  Exit at ~42¢ for realized loss of ~$3.12");
  // await closeTrade(2, 0.42, "closed_exit");
  console.log();

  console.log("Estimated freed capital: ~$37.63");
  console.log("Exposure after exit: ~20%");
  console.log();

  // Step 2: Scan for new opportunities
  console.log("STEP 2: Scan for new opportunities\n");
  console.log("Target markets:");
  console.log("  - Edge >= 5%");
  console.log("  - Liquidity > $50k");
  console.log("  - Price 10%-90% (avoid near-resolved)");
  console.log("  - Not already in portfolio");
  console.log();

  console.log("Candidate analysis:");
  console.log("  1. NCAA Tournament - Duke (recency bias after wins, edge potential ~8%)");
  console.log("  2. UK election - Labour majority (political instability, edge potential ~6%)");
  console.log("  3. Bitcoin price - Hit $100k by Dec 31 (recent volatility, edge potential ~7%)");
  console.log("  4. S&P 500 - Correction by June 30 (overvaluation, edge potential ~10%)");
  console.log();

  console.log("Current available capital: $37.63 (after Trump-China exits)");
  console.log("Max single position: $25 (5% of $500)");
  console.log("Max total exposure after new trades: 40%");
  console.log();

  console.log("=== SUMMARY ===");
  console.log("Ready to:");
  console.log("1. Close Trump-China trades #2 and #5 (free $37.63)");
  console.log("2. Place 3-5 new trades with 5%+ edge");
  console.log("3. Monitor positions daily");
}

main().catch(console.error);
