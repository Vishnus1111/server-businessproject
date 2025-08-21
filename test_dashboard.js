const http = require('http');

const testEndpoint = (path) => {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'localhost',
      port: 5000,
      path: `/api/dashboard${path}`,
      method: 'GET'
    };

    const req = http.request(options, (res) => {
      let data = '';
      
      res.on('data', (chunk) => {
        data += chunk;
      });
      
      res.on('end', () => {
        try {
          const jsonData = JSON.parse(data);
          console.log(`✅ ${path} - Status: ${res.statusCode}`);
          console.log('Response:', JSON.stringify(jsonData, null, 2));
          resolve(jsonData);
        } catch (error) {
          console.log(`❌ ${path} - Status: ${res.statusCode}`);
          console.log('Raw response:', data);
          reject(error);
        }
      });
    });

    req.on('error', (error) => {
      console.error(`❌ ${path} - Error:`, error.message);
      reject(error);
    });

    req.end();
  });
};

async function testDashboardEndpoints() {
  console.log('🧪 Testing Dashboard Endpoints...\n');
  
  const endpoints = ['/stats', '/inventory-summary', '/trends', '/live-status'];
  
  for (const endpoint of endpoints) {
    try {
      await testEndpoint(endpoint);
      console.log('\n' + '='.repeat(50) + '\n');
    } catch (error) {
      console.error(`Failed to test ${endpoint}:`, error.message);
      console.log('\n' + '='.repeat(50) + '\n');
    }
  }
}

testDashboardEndpoints();
