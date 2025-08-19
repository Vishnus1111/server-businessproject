const Product = require('../models/Product');

class CronJobService {
  constructor() {
    this.isRunning = false;
    this.intervalId = null;
  }

  // Start the daily cron job (runs every 24 hours)
  startDailyCronJob() {
    console.log('🕐 Starting daily product status monitoring cron job...');
    
    // Run immediately on startup
    this.checkProductStatus();
    
    // Then run every 24 hours (86400000 milliseconds)
    this.intervalId = setInterval(() => {
      this.checkProductStatus();
    }, 24 * 60 * 60 * 1000); // 24 hours
    
    this.isRunning = true;
    console.log('✅ Daily cron job started successfully');
  }

  // Alternative: Run every minute for testing (remove in production)
  startTestCronJob() {
    console.log('🧪 Starting TEST cron job (runs every minute)...');
    
    // Run immediately
    this.checkProductStatus();
    
    // Then run every minute for testing
    this.intervalId = setInterval(() => {
      this.checkProductStatus();
    }, 60 * 1000); // 1 minute
    
    this.isRunning = true;
    console.log('✅ Test cron job started successfully');
  }

  // Stop the cron job
  stopCronJob() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
      this.isRunning = false;
      console.log('🛑 Cron job stopped');
    }
  }

  // Main function to check and update product status
  async checkProductStatus() {
    try {
      const currentDate = new Date();
      const today = new Date(currentDate.getFullYear(), currentDate.getMonth(), currentDate.getDate());
      
      console.log(`\n🔍 [${currentDate.toLocaleString()}] Running daily product status check...`);
      console.log(`📅 Today's date for comparison: ${today.toDateString()}`);

      // Get all products (not just active ones for debugging)
      const allProducts = await Product.find({});
      const activeProducts = await Product.find({ status: 'active' });
      
      console.log(`📦 Total products in database: ${allProducts.length}`);
      console.log(`📦 Active products to check: ${activeProducts.length}`);
      
      if (activeProducts.length === 0) {
        console.log('📦 No active products found to check');
        // Still show some info about all products
        if (allProducts.length > 0) {
          console.log('📊 All products status:');
          allProducts.forEach(p => {
            console.log(`   - ${p.productName}: status=${p.status}, availability=${p.availability}, expiry=${p.expiryDate.toDateString()}`);
          });
        }
        return;
      }

      let updatedCount = 0;
      let expiredCount = 0;
      let lowStockCount = 0;
      let outOfStockCount = 0;

      for (const product of activeProducts) {
        let wasUpdated = false;
        const oldStatus = product.status;
        const oldAvailability = product.availability;
        
        console.log(`\n🔍 Checking: ${product.productName} (ID: ${product.productId})`);
        console.log(`   Current: status=${product.status}, availability=${product.availability}`);
        console.log(`   Stock: quantity=${product.quantity}, threshold=${product.thresholdValue}`);
        console.log(`   Expiry: ${product.expiryDate.toDateString()}`);
        
        // Check expiry date
        const expiryDateOnly = new Date(
          product.expiryDate.getFullYear(), 
          product.expiryDate.getMonth(), 
          product.expiryDate.getDate()
        );

        console.log(`   Expiry date only: ${expiryDateOnly.toDateString()}`);
        console.log(`   Is expired? ${expiryDateOnly < today} (${expiryDateOnly.getTime()} < ${today.getTime()})`);

        if (expiryDateOnly < today) {
          // Product has expired - only count as expired, not in stock categories
          if (product.status !== 'expired') {
            product.status = 'expired';
            product.availability = 'Expired';
            product.lastStatusCheck = currentDate;
            wasUpdated = true;
            console.log(`⚠️  EXPIRED: ${product.productName} (ID: ${product.productId}) - Expired on ${product.expiryDate.toDateString()}`);
          }
          expiredCount++;
        } else {
          // Product is still valid, check stock levels
          const newAvailability = this.calculateAvailability(product.quantity, product.thresholdValue);
          
          console.log(`   Not expired. Checking stock...`);
          console.log(`   Current availability: ${product.availability}`);
          console.log(`   Calculated availability: ${newAvailability}`);
          
          if (product.availability !== newAvailability) {
            product.availability = newAvailability;
            product.lastStatusCheck = currentDate;
            wasUpdated = true;
            console.log(`   ✅ Updated availability: ${product.availability} → ${newAvailability}`);
          } else {
            console.log(`   ℹ️ No change needed - availability already ${product.availability}`);
          }
          
          // Count stock levels only for non-expired products
          switch (newAvailability) {
            case 'Out of stock':
              outOfStockCount++;
              console.log(`❌ OUT OF STOCK: ${product.productName} (ID: ${product.productId}) - Quantity: ${product.quantity}`);
              break;
            case 'Low stock':
              lowStockCount++;
              console.log(`⚠️  LOW STOCK: ${product.productName} (ID: ${product.productId}) - Quantity: ${product.quantity}, Threshold: ${product.thresholdValue}`);
              break;
            case 'In stock':
              console.log(`✅ IN STOCK: ${product.productName} (ID: ${product.productId}) - Quantity: ${product.quantity}`);
              break;
          }
        }

        // Save if updated
        if (wasUpdated) {
          await product.save();
          updatedCount++;
          console.log(`   📝 Updated: ${oldAvailability} → ${product.availability}`);
        }
      }

      // Summary report
      console.log(`\n📊 Daily Status Check Summary:`);
      console.log(`   📦 Total products checked: ${activeProducts.length}`);
      console.log(`   📝 Products updated: ${updatedCount}`);
      console.log(`   ⚠️  Expired products: ${expiredCount}`);
      console.log(`   ❌ Out of stock: ${outOfStockCount}`);
      console.log(`   ⚠️  Low stock: ${lowStockCount}`);
      console.log(`   ✅ Products checked successfully at ${currentDate.toLocaleString()}\n`);

    } catch (error) {
      console.error('❌ Error in cron job status check:', error);
    }
  }

  // Helper function to calculate availability based on quantity and threshold
  calculateAvailability(quantity, thresholdValue) {
    console.log(`   🧮 Calculate availability: quantity=${quantity}, threshold=${thresholdValue}`);
    
    if (quantity === 0) {
      console.log(`   ❌ Result: Out of stock (quantity is 0)`);
      return 'Out of stock';
    }
    if (quantity <= thresholdValue) {
      console.log(`   ⚠️ Result: Low stock (${quantity} <= ${thresholdValue})`);
      return 'Low stock';
    }
    console.log(`   ✅ Result: In stock (${quantity} > ${thresholdValue})`);
    return 'In stock';
  }

  // Get cron job status
  getStatus() {
    return {
      isRunning: this.isRunning,
      hasInterval: this.intervalId !== null,
      message: this.isRunning ? 'Cron job is running' : 'Cron job is stopped'
    };
  }

  // Manual trigger for testing
  async manualTrigger() {
    console.log('🔄 Manually triggering product status check...');
    await this.checkProductStatus();
  }
}

module.exports = new CronJobService();
