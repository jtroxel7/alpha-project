const https = require('https');

async function fetchActiveMarkets() {
  return new Promise((resolve, reject) => {
    const url = 'https://gamma-api.polymarket.com/markets?active=true&closed=false&limit=100&order=volume24hr&ascending=false&liquidity_num_min=500';

    https.get(url, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const markets = JSON.parse(data);
          resolve(markets);
        } catch (e) {
          reject(e);
        }
      });
    }).on('error', reject);
  });
}

async function main() {
  try {
    const markets = await fetchActiveMarkets();
    console.log(`Fetched ${markets.length} active markets\n`);

    // Filter and rank
    const opportunities = markets.filter(m => {
      try {
        const prices = JSON.parse(m.outcomePrices || '[]');
        const yesPrice = prices[0] || 0;
        const volume = m.volume24hr || 0;

        // Filter: price 10-90%, volume > $50k
        return yesPrice > 0.1 && yesPrice < 0.9 && volume > 50000;
      } catch {
        return false;
      }
    }).map(m => {
      const prices = JSON.parse(m.outcomePrices || '[]');
      const yesPrice = prices[0] || 0;
      return {
        question: m.question,
        conditionId: m.conditionId,
        yesPrice: yesPrice,
        volume: m.volume24hr || 0,
        liquidity: m.liquidityNum || 0,
        endDate: m.endDate
      };
    }).sort((a, b) => b.volume - a.volume);

    console.log('=== TOP OPPORTUNITIES (price 10-90%, volume > $50k) ===\n');
    opportunities.slice(0, 20).forEach((opp, i) => {
      const q = opp.question.length > 65 ? opp.question.substring(0, 65) + '...' : opp.question;
      const days = Math.ceil((new Date(opp.endDate) - new Date()) / (1000 * 60 * 60 * 24));
      console.log(`${i+1}. ${q}`);
      console.log(`   Price: ${(opp.yesPrice*100).toFixed(0)}% | Vol: $${(opp.volume/1000).toFixed(0)}k | Expires: ${days}d`);
      console.log('');
    });

  } catch (error) {
    console.error('Error:', error.message);
  }
}

main();
