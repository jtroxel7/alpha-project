const https = require('https');

function fetchPolymarketMarkets() {
  return new Promise((resolve, reject) => {
    const url = 'https://gamma-api.polymarket.com/events?active=true&closed=false&limit=200';
    https.get(url, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const events = JSON.parse(data);
          console.log(`Fetched ${events.length} active events from Polymarket\n`);

          // Get markets from first event to show sample
          if (events.length > 0) {
            const event = events[0];
            console.log(`Sample Event: ${event.title}`);
            console.log(`Markets count: ${event.markets ? event.markets.length : 0}\n`);

            // Filter and rank opportunities
            const opportunities = [];
            events.forEach(evt => {
              if (!evt.markets) return;
              evt.markets.forEach(market => {
                const yes_price = market.prices?.[0] || 0;
                const no_price = market.prices?.[1] || 0;
                const spread = Math.abs(yes_price - 0.5);

                // Filter: price between 15-85%, volume > $50k
                if (yes_price > 0.15 && yes_price < 0.85 && (market.volume24h || 0) > 50000) {
                  opportunities.push({
                    question: market.question,
                    condition_id: market.condition_id,
                    yes_price: yes_price,
                    volume: market.volume24h || 0,
                    spread: spread,
                    category: evt.title
                  });
                }
              });
            });

            // Sort by volume and spread
            opportunities.sort((a, b) => b.volume - a.volume);

            console.log(`=== TOP OPPORTUNITIES (price 15-85%, volume > $50k) ===\n`);
            opportunities.slice(0, 15).forEach((opp, i) => {
              const q = opp.question.length > 60 ? opp.question.substring(0, 60) + '...' : opp.question;
              console.log(`${i+1}. ${q}`);
              console.log(`   Price: ${(opp.yes_price*100).toFixed(0)}%, Volume: $${(opp.volume/1000).toFixed(0)}k, Category: ${opp.category}`);
              console.log('');
            });
          }
          resolve();
        } catch (e) {
          reject(e);
        }
      });
    }).on('error', reject);
  });
}

fetchPolymarketMarkets().catch(console.error);
