const { MongoClient } = require('mongodb');
const bcrypt = require('bcryptjs');

async function createTestUser() {
  const client = new MongoClient('mongodb://localhost:27017/business_management');
  await client.connect();
  const db = client.db();
  
  // Check if test user exists
  const existing = await db.collection('users').findOne({ email: 'test@example.com' });
  if (!existing) {
    const hashedPassword = await bcrypt.hash('password123', 10);
    await db.collection('users').insertOne({
      email: 'test@example.com',
      password: hashedPassword,
      firstName: 'Test',
      lastName: 'User'
    });
    console.log('Test user created: test@example.com');
  } else {
    console.log('Test user already exists: test@example.com');
  }
  
  await client.close();
}

createTestUser().catch(console.error);
