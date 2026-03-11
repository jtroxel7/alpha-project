const https = require('https');

function fetchPolymarketMarkets() {
  return new Promise((resolve, reject) => {
    const url = 'https://gamma-api.polymarket.com/events?active=true&closed=false&limit=10';
    https.get(url, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const events = JSON.parse(data);
          console.log('Sample event structure:');
          if (events.length > 0) {
            console.log(JSON.stringify(events[0], null, 2).substring(0, 500));
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
