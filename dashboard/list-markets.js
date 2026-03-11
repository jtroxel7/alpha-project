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
  console.log("Fetching active Polymarket markets...\n");

  const response = await fetchJson(
    "https://gamma-api.polymarket.com/markets?limit=300&active=true"
  );

  const markets = Array.isArray(response) ? response : response.data || [];
  console.log(`Found ${markets.length} active markets\n`);

  // Show first 10 to understand structure
  console.log("=== FIRST 20 MARKETS ===");
  markets.slice(0, 20).forEach((m, i) => {
    console.log(`${i+1}. ${m.question}`);
    console.log(`   ID: ${m.condition_id}`);
    console.log(`   Price: ${(parseFloat(m.last_price_yes) * 100).toFixed(0)}¢`);
    console.log();
  });
}

main().catch(console.error);
