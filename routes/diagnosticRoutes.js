const express = require('express');
const router = express.Router();
const SimpleSalesPurchase = require('../models/SimpleSalesPurchase');

// Utility endpoint to diagnose purchase tracking issues
router.get('/diagnostic', async (req, res) => {
  try {
    console.log('🔍 Running sales/purchase diagnostic...');
    
    // 1. Check total counts
    const totalRecords = await SimpleSalesPurchase.countDocuments();
    const purchaseRecords = await SimpleSalesPurchase.countDocuments({ type: 'purchase' });
    const salesRecords = await SimpleSalesPurchase.countDocuments({ type: 'sale' });
    
    console.log(`📊 Total records: ${totalRecords} (${purchaseRecords} purchases, ${salesRecords} sales)`);
    
    // 2. Get current week range
    const now = new Date();
    const startOfWeek = new Date(now);
    const dayOfWeek = startOfWeek.getDay(); // 0 = Sunday, 1 = Monday, ...
    startOfWeek.setDate(now.getDate() - dayOfWeek); // Go to beginning of week (Sunday)
    startOfWeek.setHours(0, 0, 0, 0);
    
    const endOfWeek = new Date(startOfWeek);
    endOfWeek.setDate(startOfWeek.getDate() + 6);
    endOfWeek.setHours(23, 59, 59, 999);
    
    console.log(`📅 Current week: ${startOfWeek.toISOString()} to ${endOfWeek.toISOString()}`);
    
    // 3. Check current week records
    const weekRecords = await SimpleSalesPurchase.find({
      date: { $gte: startOfWeek, $lte: endOfWeek }
    });
    
    const weekPurchases = weekRecords.filter(r => r.type === 'purchase');
    const weekSales = weekRecords.filter(r => r.type === 'sale');
    
    console.log(`📊 Current week: ${weekRecords.length} records (${weekPurchases.length} purchases, ${weekSales.length} sales)`);
    
    // 4. Calculate totals
    const rawTotalPurchaseAmount = weekPurchases.reduce((sum, r) => sum + r.amount, 0);
    // Apply correction factor
    const totalPurchaseAmount = rawTotalPurchaseAmount / 2;
    const totalSalesAmount = weekSales.reduce((sum, r) => sum + r.amount, 0);
    
    // Calculate profit directly from sale records
    const totalProfitAmount = weekSales.reduce((sum, r) => sum + (r.profit || 0), 0);
    
    console.log(`💰 Current week totals: Raw Purchases ₹${rawTotalPurchaseAmount}, Corrected Purchases ₹${totalPurchaseAmount}, Sales ₹${totalSalesAmount}`);
    console.log(`💵 Current week profit (calculated from sales records): ₹${totalProfitAmount}`);
    
    // 5. Detailed breakdown by day
    const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const dailyBreakdown = [];
    
    for (let i = 0; i < 7; i++) {
      const dayDate = new Date(startOfWeek);
      dayDate.setDate(startOfWeek.getDate() + i);
      
      // Find records for this day
      const dayRecords = weekRecords.filter(record => {
        const recordDate = new Date(record.date);
        return recordDate.getDate() === dayDate.getDate() &&
               recordDate.getMonth() === dayDate.getMonth() &&
               recordDate.getFullYear() === dayDate.getFullYear();
      });
      
      const dayPurchases = dayRecords.filter(r => r.type === 'purchase');
      const daySales = dayRecords.filter(r => r.type === 'sale');
      
      const rawPurchaseAmount = dayPurchases.reduce((sum, r) => sum + r.amount, 0);
      // Apply correction factor
      const purchaseAmount = rawPurchaseAmount / 2;
      const salesAmount = daySales.reduce((sum, r) => sum + r.amount, 0);
      
      console.log(`📊 ${dayNames[i]} - Raw purchase amount: ₹${rawPurchaseAmount}, Corrected: ₹${purchaseAmount}`);
      
      dailyBreakdown.push({
        day: dayNames[i],
        date: dayDate.toISOString().split('T')[0],
        records: dayRecords.length,
        purchases: dayPurchases.length,
        sales: daySales.length,
        rawPurchaseAmount,
        purchaseAmount,  // Corrected amount
        salesAmount
      });
    }
    
    // Return diagnostic data
    res.json({
      success: true,
      diagnostic: {
        totalCounts: {
          all: totalRecords,
          purchases: purchaseRecords,
          sales: salesRecords
        },
        currentWeek: {
          range: {
            start: startOfWeek,
            end: endOfWeek
          },
          counts: {
            all: weekRecords.length,
            purchases: weekPurchases.length,
            sales: weekSales.length
          },
          amounts: {
            rawPurchases: rawTotalPurchaseAmount,
            purchases: totalPurchaseAmount,  // Corrected value (divided by 2)
            sales: totalSalesAmount,
            profit: totalProfitAmount, // Use actual profit calculated from sales records
            oldProfit: totalSalesAmount - totalPurchaseAmount, // Old calculation method for reference
            correctionFactor: "Purchase amounts are divided by 2 to correct for double-counting"
          },
          dailyBreakdown
        },
        recentRecords: {
          purchases: await SimpleSalesPurchase.find({ type: 'purchase' })
            .sort({ date: -1 })
            .limit(5)
            .lean(),
          sales: await SimpleSalesPurchase.find({ type: 'sale' })
            .sort({ date: -1 })
            .limit(5)
            .lean()
        }
      }
    });
    
  } catch (error) {
    console.error('❌ Diagnostic error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

module.exports = router;
