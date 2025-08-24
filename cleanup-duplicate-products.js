const mongoose = require('mongoose');
const Product = require('./models/Product');
require('dotenv').config();

// Connect to MongoDB
mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/business', {
  useNewUrlParser: true,
  useUnifiedTopology: true,
});

async function cleanupDuplicateProducts() {
  try {
    console.log('🔍 Starting cleanup of duplicate and test products...');
    
    // First, let's see what we have
    const allProducts = await Product.find();
    console.log(`📊 Total products in database: ${allProducts.length}`);
    
    // Products to delete (test/duplicate patterns)
    const testPatterns = [
      /^macbook$/i,           // Multiple macbook entries
      /^prod \d+$/i,          // prod 1, prod 2, etc.
      /^vishnutest\d*$/i,     // vishnutest1, vishnutest2, etc.
      /^test/i,               // Any product starting with "test"
      /^debug/i,              // Any debug products
      /^analytics test/i,     // Analytics test products
      /^new test/i,           // New test products
      /^final debug/i,        // Final debug products
      /^expired/i,            // Expired test products
      /^valid product$/i,     // Valid test products (exact match)
      /^cost test/i,          // Cost test products
      /^lowstock/i,           // Low stock test products
      /^outofstock/i          // Out of stock test products
    ];
    
    // Find products to delete
    const productsToDelete = [];
    for (const product of allProducts) {
      const shouldDelete = testPatterns.some(pattern => 
        pattern.test(product.productName)
      );
      
      // Also delete products with very low prices (likely test data)
      const hasLowPrice = product.sellingPrice < 10 || product.price < 10;
      
      // Delete expired status products (test data)
      const isExpiredStatus = product.status === 'expired';
      
      if (shouldDelete || hasLowPrice || isExpiredStatus) {
        productsToDelete.push(product);
      }
    }
    
    console.log(`🗑️  Found ${productsToDelete.length} products to delete:`);
    productsToDelete.forEach(p => {
      console.log(`   - ${p.productName} (₹${p.sellingPrice || p.price || 0}) - ${p.productId}`);
    });
    
    if (productsToDelete.length > 0) {
      // Delete the products
      const productIds = productsToDelete.map(p => p._id);
      const deleteResult = await Product.deleteMany({ _id: { $in: productIds } });
      console.log(`✅ Deleted ${deleteResult.deletedCount} test/duplicate products`);
    }
    
    // Show remaining products
    const remainingProducts = await Product.find();
    console.log(`\n📈 Remaining products in database: ${remainingProducts.length}`);
    console.log('\n🎯 Remaining products:');
    remainingProducts.forEach(p => {
      console.log(`   - ${p.productName} (₹${p.sellingPrice || p.price || 0}) - ${p.category} - ${p.availability}`);
    });
    
    mongoose.connection.close();
    console.log('\n🎉 Cleanup completed successfully!');
    
  } catch (error) {
    console.error('❌ Error during cleanup:', error);
    process.exit(1);
  }
}

// Run the cleanup
cleanupDuplicateProducts();
