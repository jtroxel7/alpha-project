const https = require("https");

function fetchJson(url) {
  return new Promise((resolve, reject) => {
    https.get(url, { headers: { "User-Agent": "Mozilla/5.0" } }, (res) => {
      let data = "";
      res.on("data", (chunk) => (data += chunk));
      res.on("end", () => {
        try {
          resolve(JSON.parse(data));
        } catch (e) {
          reject(e);
        }
      });
    }).on("error", reject);
  });
}

async function main() {
  console.log("Fetching current Polymarket prices...\n");

  // Fetch markets
  const markets = await fetchJson(
    "https://gamma-api.polymarket.com/markets?limit=200&active=true"
  );

  // Map of market names to our trades for quick lookup
  const tradeQuestions = [
    "Stellan Skarsgård Best Supporting Actor",
    "One Battle After Another Best Picture",
    "Trump visit China by March 31",
    "Starmer out by June 30",
    "2 Fed rate cuts in 2026",
    "Iranian regime fall by end of 2026"
  ];

  const matchedMarkets = markets.filter(m => {
    const q = m.question.toLowerCase();
    return tradeQuestions.some(tq => q.includes(tq.toLowerCase()));
  });

  console.log(`Found ${matchedMarkets.length} matching markets out of ${markets.length} total\n`);

  matchedMarkets.forEach(m => {
    console.log(`${m.question}`);
    console.log(`  Current Price (YES): ${(parseFloat(m.last_price_yes) * 100).toFixed(0)}¢`);
    console.log(`  Volume: $${(parseFloat(m.volume_24h) || 0).toFixed(0)}`);
    console.log(`  Market ID: ${m.condition_id}`);
    console.log();
  });
}

main().catch(console.error);
