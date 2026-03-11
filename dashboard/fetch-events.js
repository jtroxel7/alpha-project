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
          console.error("Parse error:", e.message);
          resolve({error: e.message});
        }
      });
    }).on("error", reject);
  });
}

async function main() {
  console.log("Fetching Polymarket events...\n");

  const response = await fetchJson(
    "https://gamma-api.polymarket.com/events?active=true&closed=false&limit=50"
  );

  console.log("Raw response keys:", Object.keys(response));
  console.log("Response:", JSON.stringify(response, null, 2).substring(0, 1000));
}

main().catch(console.error);
