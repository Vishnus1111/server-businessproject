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

      // Get all active products
      const products = await Product.find({ status: 'active' });
      
      if (products.length === 0) {
        console.log('📦 No active products found to check');
        return;
      }

      let updatedCount = 0;
      let expiredCount = 0;
      let lowStockCount = 0;
      let outOfStockCount = 0;

      for (const product of products) {
        let wasUpdated = false;
        const oldStatus = product.status;
        const oldAvailability = product.availability;
        
        // Check expiry date
        const expiryDateOnly = new Date(
          product.expiryDate.getFullYear(), 
          product.expiryDate.getMonth(), 
          product.expiryDate.getDate()
        );

        if (expiryDateOnly < today) {
          // Product has expired
          if (product.status !== 'expired') {
            product.status = 'expired';
            product.availability = 'Expired';
            product.lastStatusCheck = currentDate;
            wasUpdated = true;
            expiredCount++;
            console.log(`⚠️  EXPIRED: ${product.productName} (ID: ${product.productId}) - Expired on ${product.expiryDate.toDateString()}`);
          }
        } else {
          // Product is still valid, check stock levels
          const newAvailability = this.calculateAvailability(product.quantity, product.thresholdValue);
          
          if (product.availability !== newAvailability) {
            product.availability = newAvailability;
            product.lastStatusCheck = currentDate;
            wasUpdated = true;
            
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
      console.log(`   📦 Total products checked: ${products.length}`);
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
    if (quantity === 0) return 'Out of stock';
    if (quantity <= thresholdValue) return 'Low stock';
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
