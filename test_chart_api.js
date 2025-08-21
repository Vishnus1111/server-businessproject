const http = require('http');

const options = {
  hostname: 'localhost',
  port: 5000,
  path: '/api/statistics/chart-data?period=daily',
  method: 'GET',
  headers: {
    'Content-Type': 'application/json'
  }
};

const req = http.request(options, (res) => {
  console.log(`Status: ${res.statusCode}`);
  console.log(`Headers: ${JSON.stringify(res.headers)}`);
  
  let data = '';
  res.on('data', (chunk) => {
    data += chunk;
  });
  
  res.on('end', () => {
    try {
      const jsonData = JSON.parse(data);
      console.log('\n✅ API Response received successfully!');
      console.log('📊 Sample data:');
      if (jsonData.chartData && jsonData.chartData.length > 0) {
        console.log('First 3 data points:');
        jsonData.chartData.slice(0, 3).forEach((point, index) => {
          console.log(`  ${index + 1}. ${point.label}: Sales=₹${point.sales}, COGS=₹${point.purchases}, Profit=₹${point.profit}`);
        });
        console.log(`\n📈 Total data points: ${jsonData.chartData.length}`);
        if (jsonData.metadata) {
          console.log(`💰 Total Sales: ₹${jsonData.metadata.totalSales}`);
          console.log(`🛒 Total COGS: ₹${jsonData.metadata.totalCOGS}`);
          console.log(`📊 Total Profit: ₹${jsonData.metadata.totalProfit}`);
        }
      } else {
        console.log('⚠️ No chartData found in response');
        console.log('Response:', jsonData);
      }
    } catch (error) {
      console.error('❌ Failed to parse JSON:', error.message);
      console.log('Raw response:', data.substring(0, 500));
    }
  });
});

req.on('error', (e) => {
  console.error(`❌ Request failed: ${e.message}`);
});

req.setTimeout(10000, () => {
  console.error('❌ Request timeout');
  req.destroy();
});

req.end();
