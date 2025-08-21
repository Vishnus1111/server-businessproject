const axios = require('axios');

async function testChartDataAPI() {
  try {
    console.log('🔍 Testing Chart Data API with COGS calculation...\n');
    
    const response = await axios.get('http://localhost:5000/api/statistics/chart-data', {
      params: { period: 'daily' },
      headers: { 'Content-Type': 'application/json' }
    });
    
    console.log('📊 API Response Status:', response.status);
    
    if (response.data && response.data.chartData) {
      const chartData = response.data.chartData;
      console.log(`📈 Chart Data Length: ${chartData.length} data points\n`);
      
      // Show first few data points
      const sampleData = chartData.slice(0, 5);
      sampleData.forEach((point, index) => {
        console.log(`Day ${index + 1}:`);
        console.log(`  📅 Date: ${point.label}`);
        console.log(`  💰 Sales Revenue: ₹${point.sales || 0}`);
        console.log(`  🛒 Cost of Goods Sold: ₹${point.purchases || 0}`);
        console.log(`  📈 Gross Profit: ₹${(point.sales || 0) - (point.purchases || 0)}`);
        console.log(`  ---`);
      });
      
      // Calculate totals
      const totals = chartData.reduce((acc, point) => ({
        sales: acc.sales + (point.sales || 0),
        cogs: acc.cogs + (point.purchases || 0)
      }), { sales: 0, cogs: 0 });
      
      console.log('\n💰 Summary:');
      console.log(`  Total Sales: ₹${totals.sales}`);
      console.log(`  Total COGS: ₹${totals.cogs}`);
      console.log(`  Total Gross Profit: ₹${totals.sales - totals.cogs}`);
      
      if (totals.cogs > 0) {
        console.log('\n✅ SUCCESS: COGS calculation is working!');
        const profitMargin = ((totals.sales - totals.cogs) / totals.sales * 100).toFixed(1);
        console.log(`📊 Profit Margin: ${profitMargin}%`);
      } else {
        console.log('\n❌ WARNING: COGS is still showing as 0');
      }
    } else {
      console.log('\n❌ No chart data found in response');
    }
    
  } catch (error) {
    console.error('\n❌ Error testing API:', error.message);
    if (error.response) {
      console.error('Response status:', error.response.status);
      console.error('Response data:', error.response.data);
    }
  }
}

// Also test weekly and monthly to verify all periods work
async function testAllPeriods() {
  const periods = ['daily', 'weekly', 'monthly'];
  
  for (const period of periods) {
    try {
      console.log(`\n🔍 Testing ${period.toUpperCase()} period...`);
      const response = await axios.get(`http://localhost:5000/api/statistics/chart-data?period=${period}`);
      
      if (response.data && response.data.chartData) {
        const chartData = response.data.chartData;
        const totals = chartData.reduce((acc, point) => ({
          sales: acc.sales + (point.sales || 0),
          cogs: acc.cogs + (point.purchases || 0)
        }), { sales: 0, cogs: 0 });
        
        console.log(`  📊 ${period} - Sales: ₹${totals.sales}, COGS: ₹${totals.cogs}, Profit: ₹${totals.sales - totals.cogs}`);
      }
    } catch (error) {
      console.log(`  ❌ Error with ${period}: ${error.message}`);
    }
  }
}

// Run tests
async function runAllTests() {
  await testChartDataAPI();
  await testAllPeriods();
}

runAllTests();
