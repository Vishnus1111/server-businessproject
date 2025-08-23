const mongoose = require('mongoose');

// Sales & Purchase tracking schema
const salesPurchaseSchema = new mongoose.Schema({
  // Date tracking
  year: {
    type: Number,
    required: true
  },
  month: {
    type: Number,
    required: true,
    min: 1,
    max: 12
  },
  week: {
    type: Number,
    required: true,
    min: 1,
    max: 53
  },
  weekStartDate: {
    type: Date,
    required: true
  },
  weekEndDate: {
    type: Date,
    required: true
  },
  
  // Financial data
  totalPurchases: {
    type: Number,
    default: 0
  },
  totalSales: {
    type: Number, 
    default: 0
  },
  
  // Transaction details
  purchaseTransactions: [{
    date: Date,
    productId: String,
    productName: String,
    quantity: Number,
    costPrice: Number,
    totalCost: Number,
    type: {
      type: String,
      enum: ['single_product', 'bulk_upload'],
      default: 'single_product'
    }
  }],
  
  salesTransactions: [{
    date: Date,
    orderId: String,
    productId: String,
    productName: String,
    quantity: Number,
    sellingPrice: Number,
    totalSales: Number
  }]
}, {
  timestamps: true
});

// Compound index for efficient queries
salesPurchaseSchema.index({ year: 1, month: 1, week: 1 }, { unique: true });
salesPurchaseSchema.index({ year: 1, month: 1 });
salesPurchaseSchema.index({ year: 1 });

// Static method to get current week info
salesPurchaseSchema.statics.getCurrentWeekInfo = function() {
  const now = new Date();
  const startOfYear = new Date(now.getFullYear(), 0, 1);
  
  // Find the first Sunday of the year
  const firstSunday = new Date(startOfYear);
  firstSunday.setDate(startOfYear.getDate() - startOfYear.getDay());
  
  // Calculate current week number
  const diffTime = now.getTime() - firstSunday.getTime();
  const diffWeeks = Math.floor(diffTime / (7 * 24 * 60 * 60 * 1000));
  const currentWeek = diffWeeks + 1;
  
  // Calculate current week's Sunday and Saturday
  const weekStart = new Date(firstSunday);
  weekStart.setDate(firstSunday.getDate() + (currentWeek - 1) * 7);
  
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekStart.getDate() + 6);
  weekEnd.setHours(23, 59, 59, 999);
  
  return {
    year: now.getFullYear(),
    month: now.getMonth() + 1,
    week: currentWeek,
    weekStartDate: weekStart,
    weekEndDate: weekEnd
  };
};

// Static method to add purchase transaction
salesPurchaseSchema.statics.addPurchase = async function(productData) {
  const weekInfo = this.getCurrentWeekInfo();
  
  const purchaseAmount = (productData.quantity || 1) * productData.costPrice;
  
  const transaction = {
    date: new Date(),
    productId: productData.productId,
    productName: productData.productName,
    quantity: productData.quantity || 1,
    costPrice: productData.costPrice,
    totalCost: purchaseAmount,
    type: productData.type || 'single_product'
  };
  
  // Update or create week record
  const weekRecord = await this.findOneAndUpdate(
    { year: weekInfo.year, month: weekInfo.month, week: weekInfo.week },
    {
      $inc: { totalPurchases: purchaseAmount },
      $push: { purchaseTransactions: transaction },
      $setOnInsert: {
        weekStartDate: weekInfo.weekStartDate,
        weekEndDate: weekInfo.weekEndDate
      }
    },
    { upsert: true, new: true }
  );
  
  return weekRecord;
};

// Static method to add sales transaction
salesPurchaseSchema.statics.addSale = async function(orderData) {
  const weekInfo = this.getCurrentWeekInfo();
  
  const salesAmount = orderData.totalAmount;
  
  const transaction = {
    date: new Date(),
    orderId: orderData.orderId,
    productId: orderData.productId,
    productName: orderData.productName,
    quantity: orderData.quantityOrdered,
    sellingPrice: orderData.pricePerUnit,
    totalSales: salesAmount
  };
  
  // Update or create week record
  const weekRecord = await this.findOneAndUpdate(
    { year: weekInfo.year, month: weekInfo.month, week: weekInfo.week },
    {
      $inc: { totalSales: salesAmount },
      $push: { salesTransactions: transaction },
      $setOnInsert: {
        weekStartDate: weekInfo.weekStartDate,
        weekEndDate: weekInfo.weekEndDate
      }
    },
    { upsert: true, new: true }
  );
  
  return weekRecord;
};

module.exports = mongoose.model('SalesPurchase', salesPurchaseSchema);
