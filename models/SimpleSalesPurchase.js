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
  
  // Profit data (for sales only)
  profit: {
    type: Number,
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
    // Create a fresh date object for current date - ensure we're using the actual current date
    const currentDate = new Date();
    const currentDayOfWeek = currentDate.getDay(); // 0 = Sunday, 1 = Monday, ..., 6 = Saturday
    const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    
    console.log(`📆 PURCHASE DATE DEBUG: ${currentDate.toISOString()}`);
    console.log(`📆 Day of week: ${dayNames[currentDayOfWeek]} (${currentDayOfWeek})`);
    console.log(`📆 Date parts: Year=${currentDate.getFullYear()}, Month=${currentDate.getMonth() + 1}, Day=${currentDate.getDate()}`);
    
    // Use the actual current date instead of a fixed date
    const today = currentDate;
    console.log(`📆 Using current date: ${today.toISOString()} (${dayNames[today.getDay()]})`);
    
    const purchaseRecord = new this({
      date: today,
      year: today.getFullYear(),
      month: today.getMonth() + 1,
      day: today.getDate(),
      type: 'purchase',
      amount: productData.costPrice * productData.quantity,
      productId: productData._id,
      productName: productData.name,
      quantity: productData.quantity,
      unitPrice: productData.costPrice
    });
    
    await purchaseRecord.save();
    console.log(`✅ Purchase tracked: ${productData.name} - ₹${purchaseRecord.amount}`);
    console.log(`✅ Purchase record ID: ${purchaseRecord._id}`);
    console.log(`✅ Stored date: ${purchaseRecord.date.toISOString()}`);
    return purchaseRecord;
  } catch (error) {
    console.error('❌ Error tracking purchase:', error);
    throw error;
  }
};

// Static method to add sale
simpleSalesPurchaseSchema.statics.addSale = async function(orderData) {
  try {
    // Create a fresh date object for current date
    const currentDate = new Date();
    const currentDayOfWeek = currentDate.getDay(); // 0 = Sunday, 1 = Monday, ..., 6 = Saturday
    const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    
    console.log(`📆 SALE DATE DEBUG: ${currentDate.toISOString()}`);
    console.log(`📆 Day of week: ${dayNames[currentDayOfWeek]} (${currentDayOfWeek})`);
    console.log(`📆 Date parts: Year=${currentDate.getFullYear()}, Month=${currentDate.getMonth() + 1}, Day=${currentDate.getDate()}`);
    
    // Use the actual current date instead of a fixed date
    const today = currentDate;
    console.log(`📆 Using current date: ${today.toISOString()} (${dayNames[today.getDay()]})`);
    
    const saleRecords = [];
    
    for (const item of orderData.items) {
      // Calculate profit based on selling price - cost price
      const profit = item.profit || (item.price - (item.costPrice || 0)) * item.quantity;
      
      const saleRecord = new this({
        date: today,
        year: today.getFullYear(),
        month: today.getMonth() + 1,
        day: today.getDate(),
        type: 'sale',
        amount: item.price * item.quantity,
        productId: item.productId,
        productName: item.name,
        quantity: item.quantity,
        unitPrice: item.price,
        orderId: orderData._id,
        userId: orderData.userId,
        profit: profit // Store the actual profit
      });
      
      await saleRecord.save();
      saleRecords.push(saleRecord);
      console.log(`✅ Sale tracked: ${item.name} - ₹${saleRecord.amount} - Profit: ₹${profit}`);
      console.log(`✅ Sale record ID: ${saleRecord._id}`);
      console.log(`✅ Stored date: ${saleRecord.date.toISOString()}`);
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
    // Use a rolling 7-day window ending today to avoid empty charts on Sundays
    const today = new Date();
    const startOfWindow = new Date(today);
    startOfWindow.setDate(today.getDate() - 6);
    startOfWindow.setHours(0, 0, 0, 0);

    const endOfWindow = new Date(today);
    endOfWindow.setHours(23, 59, 59, 999);

    console.log(`📅 Getting transactions for last 7 days: ${startOfWindow.toISOString()} to ${endOfWindow.toISOString()}`);

    // Get all transactions for this window
    const windowTransactions = await this.find({
      date: { $gte: startOfWindow, $lte: endOfWindow }
    }).sort({ date: 1 });

    console.log(`📊 Found ${windowTransactions.length} transactions in last 7 days`);

    if (windowTransactions.length > 0) {
      console.log(`📄 First tx: ${windowTransactions[0].type} - ${windowTransactions[0].amount} - ${windowTransactions[0].date}`);
      console.log(`📄 Last tx: ${windowTransactions[windowTransactions.length-1].type} - ${windowTransactions[windowTransactions.length-1].amount} - ${windowTransactions[windowTransactions.length-1].date}`);
    }

    // Calculate totals
    const purchases = windowTransactions.filter(t => t.type === 'purchase');
    const sales = windowTransactions.filter(t => t.type === 'sale');

    const rawPurchasesTotal = purchases.reduce((sum, t) => sum + t.amount, 0);
    const totalPurchases = rawPurchasesTotal / 2; // correction factor
    const totalSales = sales.reduce((sum, t) => sum + t.amount, 0);
    const totalProfit = sales.reduce((sum, t) => sum + (t.profit || 0), 0);

    // Build daily breakdown for each day in the 7-day window
    const dailyData = [];
    for (let i = 0; i < 7; i++) {
      const currentDay = new Date(startOfWindow);
      currentDay.setDate(startOfWindow.getDate() + i);
      const nextDay = new Date(currentDay);
      nextDay.setHours(23, 59, 59, 999);

      const dayTransactions = windowTransactions.filter(t => {
        const d = new Date(t.date);
        return d >= currentDay && d <= nextDay;
      });

      const rawDayPurchases = dayTransactions.filter(t => t.type === 'purchase').reduce((sum, t) => sum + t.amount, 0);
      const dayPurchases = rawDayPurchases / 2; // correction
      const daySales = dayTransactions.filter(t => t.type === 'sale').reduce((sum, t) => sum + t.amount, 0);
      const dayProfit = dayTransactions.filter(t => t.type === 'sale').reduce((sum, t) => sum + (t.profit || 0), 0);

      const dayName = currentDay.toLocaleDateString('en-US', { weekday: 'long' });
      console.log(`📅 ${dayName} purchases: Raw ₹${rawDayPurchases} -> Corrected ₹${dayPurchases}, Sales ₹${daySales}`);

      dailyData.push({
        date: currentDay.toDateString(),
        day: dayName,
        purchases: dayPurchases,
        sales: daySales,
        profit: dayProfit,
        transactionCount: dayTransactions.length
      });
    }

    return {
      weekRange: {
        start: startOfWindow,
        end: endOfWindow
      },
      summary: {
        totalPurchases,
        totalSales,
        profit: totalProfit,
        totalTransactions: windowTransactions.length
      },
      dailyBreakdown: dailyData,
      transactions: windowTransactions
    };
  } catch (error) {
    console.error('❌ Error getting weekly data:', error);
    throw error;
  }
};

// Static method to get monthly data
simpleSalesPurchaseSchema.statics.getMonthlyData = async function() {
  try {
    const currentDate = new Date();
    const currentYear = currentDate.getFullYear();
    
    // Data for all 12 months of the current year
    const monthlyData = [];
    
    for (let month = 0; month < 12; month++) {
      const startOfMonth = new Date(currentYear, month, 1);
      const endOfMonth = new Date(currentYear, month + 1, 0, 23, 59, 59, 999);
      
      // Get all transactions for this month
      const monthTransactions = await this.find({
        date: { $gte: startOfMonth, $lte: endOfMonth }
      }).sort({ date: 1 });
      
      // Calculate totals
      const purchases = monthTransactions.filter(t => t.type === 'purchase');
      const sales = monthTransactions.filter(t => t.type === 'sale');
      
      // Calculate raw purchases sum
      const rawPurchasesTotal = purchases.reduce((sum, t) => sum + t.amount, 0);
      
      // Apply correction factor to fix the duplicate counting issue
      const totalPurchases = rawPurchasesTotal / 2;
      console.log(`📊 MONTHLY PURCHASE CORRECTION: Month: ${month+1}, Raw: ₹${rawPurchasesTotal}, Corrected: ₹${totalPurchases}`);
      
      const totalSales = sales.reduce((sum, t) => sum + t.amount, 0);
      
      // Calculate profit directly from sale records
      const totalProfit = sales.reduce((sum, t) => sum + (t.profit || 0), 0);
      console.log(`📊 MONTHLY PROFIT CALCULATION: Month: ${month+1}, Profit: ₹${totalProfit}`);
      
      const monthName = startOfMonth.toLocaleString('default', { month: 'long' });
      
      monthlyData.push({
        month: monthName,
        startDate: startOfMonth,
        endDate: endOfMonth,
        purchases: totalPurchases,
        sales: totalSales,
        profit: totalProfit, // Use actual profit from sales
        transactionCount: monthTransactions.length
      });
    }
    
    // Calculate the summary data
    const yearTotalPurchases = monthlyData.reduce((sum, m) => sum + m.purchases, 0);
    const yearTotalSales = monthlyData.reduce((sum, m) => sum + m.sales, 0);
    const yearProfit = monthlyData.reduce((sum, m) => sum + m.profit, 0);
    const yearTotalTransactions = monthlyData.reduce((sum, m) => sum + m.transactionCount, 0);
    
    console.log(`📊 YEARLY SUMMARY: Total Purchases: ₹${yearTotalPurchases}, Total Sales: ₹${yearTotalSales}, Profit: ₹${yearProfit}`);
    
    return {
      year: currentYear,
      summary: {
        totalPurchases: yearTotalPurchases,
        totalSales: yearTotalSales,
        profit: yearProfit,
        totalTransactions: yearTotalTransactions
      },
      monthlyBreakdown: monthlyData
    };
  } catch (error) {
    console.error('❌ Error getting monthly data:', error);
    throw error;
  }
};

// Static method to get yearly data
simpleSalesPurchaseSchema.statics.getYearlyData = async function() {
  try {
    const currentDate = new Date();
    const currentYear = currentDate.getFullYear();
    
    // Get all transactions for the current year
    const startOfYear = new Date(currentYear, 0, 1);
    const endOfYear = new Date(currentYear, 11, 31, 23, 59, 59, 999);
    
    const yearTransactions = await this.find({
      date: { $gte: startOfYear, $lte: endOfYear }
    }).sort({ date: 1 });
    
    // Calculate totals
    const purchases = yearTransactions.filter(t => t.type === 'purchase');
    const sales = yearTransactions.filter(t => t.type === 'sale');
    
    // Calculate raw purchases sum
    const rawPurchasesTotal = purchases.reduce((sum, t) => sum + t.amount, 0);
    
    // Apply correction factor to fix the duplicate counting issue
    const totalPurchases = rawPurchasesTotal / 2;
    console.log(`📊 YEARLY PURCHASE CORRECTION: Raw: ₹${rawPurchasesTotal}, Corrected: ₹${totalPurchases}`);
    
    const totalSales = sales.reduce((sum, t) => sum + t.amount, 0);
    
    // Calculate profit directly from sale records
    const totalProfit = sales.reduce((sum, t) => sum + (t.profit || 0), 0);
    console.log(`📊 YEARLY PROFIT CALCULATION: Profit: ₹${totalProfit}`);
    
    return {
      year: currentYear,
      summary: {
        totalPurchases,
        totalSales,
        profit: totalProfit, // Use actual profit from sales
        totalTransactions: yearTransactions.length
      },
      yearlyData: {
        year: currentYear,
        startDate: startOfYear,
        endDate: endOfYear,
        purchases: totalPurchases,
        sales: totalSales,
        profit: totalProfit, // Use actual profit from sales
        transactionCount: yearTransactions.length
      }
    };
  } catch (error) {
    console.error('❌ Error getting yearly data:', error);
    throw error;
  }
};

module.exports = mongoose.model('SimpleSalesPurchase', simpleSalesPurchaseSchema);
