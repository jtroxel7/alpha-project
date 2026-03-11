const https = require('https');

const GAMMA_BASE = 'gamma-api.polymarket.com';

function fetchEvents() {
  return new Promise((resolve, reject) => {
    const params = new URLSearchParams({
      active: 'true',
      closed: 'false',
      limit: '100',
      order: 'volume24hr',
      ascending: 'false',
    });

    const url = `https://${GAMMA_BASE}/events?${params}`;

    https.get(url, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch (e) {
          reject(e);
        }
      });
    }).on('error', reject);
  });
}

async function main() {
  console.log('=== DAY 5 MARKET SCAN ===\n');

  try {
    const events = await fetchEvents();

    // Filter for high-opportunity categories and look for specific themes
    const keywords = [
      'dollar', 'euro', 'usd', 'eur', 'currency', 'exchange',
      'iran', 'middle east', 'us military', 'invasion',
      'fed', 'interest rate', 'recession',
      'sp500', 's&p', 'stock market', 'nasdaq',
      'crude', 'oil', 'energy', 'gas',
      'election', 'tariff'
    ];

    const candidates = [];

    for (const event of events.slice(0, 200)) {
      if (!event.markets || event.markets.length === 0) continue;

      const eventTitle = event.title.toLowerCase();
      const matchesKeyword = keywords.some(kw => eventTitle.includes(kw));

      if (!matchesKeyword) continue;

      for (const market of event.markets) {
        if (!market.active || market.closed) continue;

        // Skip very high or very low probability (not tradeable)
        const prices = market.outcomePrices ? JSON.parse(market.outcomePrices) : [];
        const yesPrice = parseFloat(prices[0]) || 0;

        if (yesPrice < 0.1 || yesPrice > 0.9) continue;
        if (!market.volumeNum || market.volumeNum < 10000) continue;

        candidates.push({
          title: event.title,
          question: market.question,
          yesPrice,
          noPrice: 1 - yesPrice,
          volume: market.volumeNum,
          liquidity: market.liquidityNum,
          slug: market.slug,
          conditionId: market.conditionId,
        });
      }
    }

    // Sort by volume/liquidity
    candidates.sort((a, b) => b.volume - a.volume);

    console.log(`Found ${candidates.length} candidate markets\n`);
    console.log('TOP OPPORTUNITIES:\n');

    // Show top 15 candidates for manual analysis
    candidates.slice(0, 15).forEach((c, i) => {
      console.log(`${i+1}. ${c.question}`);
      console.log(`   YES: ${(c.yesPrice * 100).toFixed(0)}% | Volume: $${(c.volume/1000).toFixed(0)}k | Liquidity: $${(c.liquidity/1000).toFixed(0)}k`);
      console.log();
    });

    // Highlight specific opportunities
    console.log('\n=== STRATEGIC OPPORTUNITIES ===\n');

    const iranWar = candidates.find(c => c.question.toLowerCase().includes('us') && c.question.toLowerCase().includes('iran') && c.question.toLowerCase().includes('invasion|military|forces|enter'.toLowerCase()));
    if (iranWar) {
      console.log(`💣 IRAN WAR ESCALATION: ${iranWar.question}`);
      console.log(`   Current: ${(iranWar.yesPrice*100).toFixed(0)}% | Edge: Could be 15-20% underpriced`);
    }

    const dollarMarket = candidates.find(c => c.question.toLowerCase().includes('dollar') || c.question.toLowerCase().includes('usd') || c.question.toLowerCase().includes('euro'));
    if (dollarMarket) {
      console.log(`\n💵 DOLLAR STRENGTH: ${dollarMarket.question}`);
      console.log(`   Current: ${(dollarMarket.yesPrice*100).toFixed(0)}% | Edge: 10-15% from safe-haven bid`);
    }

    const energyMarket = candidates.find(c => c.question.toLowerCase().includes('oil') || c.question.toLowerCase().includes('gas') || c.question.toLowerCase().includes('energy'));
    if (energyMarket) {
      console.log(`\n⚡ ENERGY CRISIS: ${energyMarket.question}`);
      console.log(`   Current: ${(energyMarket.yesPrice*100).toFixed(0)}% | Edge: Monitor for LNG/natural gas plays`);
    }

  } catch (error) {
    console.error('Error fetching markets:', error.message);
    process.exit(1);
  }
}

main();
