const mongoose = require('mongoose');

// Simplified Sales & Purchase tracking schema
const simpleSalesPurchaseSchema = new mongoose.Schema({
  // Simple date tracking
  date: {
    type: Date,
    required: true,
    default: Date.now
  },
  year: {
    type: Number,
    required: true
  },
  month: {
    type: Number,
    required: true
  },
  day: {
    type: Number,
    required: true
  },
  
  // Transaction type
  type: {
    type: String,
    enum: ['purchase', 'sale'],
    required: true
  },
  
  // Financial data
  amount: {
    type: Number,
    required: true,
    default: 0
  },
  
  // Product details
  productId: String,
  productName: String,
  quantity: {
    type: Number,
    default: 0
  },
  unitPrice: {
    type: Number,
    default: 0
  },
  
  // Order details (for sales)
  orderId: String,
  userId: String
}, {
  timestamps: true
});

// Index for efficient queries
simpleSalesPurchaseSchema.index({ date: 1, type: 1 });
simpleSalesPurchaseSchema.index({ year: 1, month: 1, type: 1 });

// Static method to add purchase
simpleSalesPurchaseSchema.statics.addPurchase = async function(productData) {
  try {
    const currentDate = new Date();
    
    const purchaseRecord = new this({
      date: currentDate,
      year: currentDate.getFullYear(),
      month: currentDate.getMonth() + 1,
      day: currentDate.getDate(),
      type: 'purchase',
      amount: productData.costPrice * productData.quantity,
      productId: productData._id,
      productName: productData.name,
      quantity: productData.quantity,
      unitPrice: productData.costPrice
    });
    
    await purchaseRecord.save();
    console.log(`✅ Purchase tracked: ${productData.name} - ₹${purchaseRecord.amount}`);
    return purchaseRecord;
  } catch (error) {
    console.error('❌ Error tracking purchase:', error);
    throw error;
  }
};

// Static method to add sale
simpleSalesPurchaseSchema.statics.addSale = async function(orderData) {
  try {
    const currentDate = new Date();
    const saleRecords = [];
    
    for (const item of orderData.items) {
      const saleRecord = new this({
        date: currentDate,
        year: currentDate.getFullYear(),
        month: currentDate.getMonth() + 1,
        day: currentDate.getDate(),
        type: 'sale',
        amount: item.price * item.quantity,
        productId: item.productId,
        productName: item.name,
        quantity: item.quantity,
        unitPrice: item.price,
        orderId: orderData._id,
        userId: orderData.userId
      });
      
      await saleRecord.save();
      saleRecords.push(saleRecord);
      console.log(`✅ Sale tracked: ${item.name} - ₹${saleRecord.amount}`);
    }
    
    return saleRecords;
  } catch (error) {
    console.error('❌ Error tracking sale:', error);
    throw error;
  }
};

// Static method to get weekly data
simpleSalesPurchaseSchema.statics.getWeeklyData = async function() {
  try {
    const currentDate = new Date();
    const startOfWeek = new Date(currentDate);
    const day = startOfWeek.getDay();
    const diff = startOfWeek.getDate() - day; // Sunday is 0
    startOfWeek.setDate(diff);
    startOfWeek.setHours(0, 0, 0, 0);
    
    const endOfWeek = new Date(startOfWeek);
    endOfWeek.setDate(startOfWeek.getDate() + 6);
    endOfWeek.setHours(23, 59, 59, 999);
    
    // Get all transactions for this week
    const weekTransactions = await this.find({
      date: { $gte: startOfWeek, $lte: endOfWeek }
    }).sort({ date: 1 });
    
    // Calculate totals
    const purchases = weekTransactions.filter(t => t.type === 'purchase');
    const sales = weekTransactions.filter(t => t.type === 'sale');
    
    const totalPurchases = purchases.reduce((sum, t) => sum + t.amount, 0);
    const totalSales = sales.reduce((sum, t) => sum + t.amount, 0);
    
    // Create daily breakdown
    const dailyData = [];
    for (let i = 0; i < 7; i++) {
      const currentDay = new Date(startOfWeek);
      currentDay.setDate(startOfWeek.getDate() + i);
      
      const dayTransactions = weekTransactions.filter(t => {
        const transactionDate = new Date(t.date);
        return transactionDate.toDateString() === currentDay.toDateString();
      });
      
      const dayPurchases = dayTransactions.filter(t => t.type === 'purchase').reduce((sum, t) => sum + t.amount, 0);
      const daySales = dayTransactions.filter(t => t.type === 'sale').reduce((sum, t) => sum + t.amount, 0);
      
      dailyData.push({
        date: currentDay.toDateString(),
        day: ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][i],
        purchases: dayPurchases,
        sales: daySales,
        transactionCount: dayTransactions.length
      });
    }
    
    return {
      weekRange: {
        start: startOfWeek,
        end: endOfWeek
      },
      summary: {
        totalPurchases,
        totalSales,
        profit: totalSales - totalPurchases,
        totalTransactions: weekTransactions.length
      },
      dailyBreakdown: dailyData,
      transactions: weekTransactions
    };
  } catch (error) {
    console.error('❌ Error getting weekly data:', error);
    throw error;
  }
};

module.exports = mongoose.model('SimpleSalesPurchase', simpleSalesPurchaseSchema);
