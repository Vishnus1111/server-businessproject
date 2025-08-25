const express = require('express');
const router = express.Router();
const SimpleSalesPurchase = require('../models/SimpleSalesPurchase');

// Utility endpoint to apply correction factor to historical purchase data
router.get('/fix-historical-purchases', async (req, res) => {
  try {
    console.log('🔧 Starting historical purchase data correction...');
    
    // 1. Get all purchase records
    const allPurchases = await SimpleSalesPurchase.find({ type: 'purchase' });
    console.log(`📊 Found ${allPurchases.length} purchase records to analyze`);
    
    if (allPurchases.length === 0) {
      return res.json({
        success: true,
        message: 'No purchase records found to fix',
        corrected: 0
      });
    }
    
    // 2. Extract unique dates to process records by date
    const uniqueDates = [...new Set(allPurchases.map(p => 
      new Date(p.date).toISOString().split('T')[0]
    ))];
    
    console.log(`📅 Found purchases from ${uniqueDates.length} unique dates`);
    
    // 3. Get stats for each date
    const dateStats = [];
    
    for (const dateStr of uniqueDates) {
      const dateRecords = allPurchases.filter(p => 
        new Date(p.date).toISOString().split('T')[0] === dateStr
      );
      
      const totalAmount = dateRecords.reduce((sum, r) => sum + r.amount, 0);
      
      dateStats.push({
        date: dateStr,
        count: dateRecords.length,
        rawTotal: totalAmount,
        correctedTotal: totalAmount / 2
      });
    }
    
    // Generate report
    const totalRaw = dateStats.reduce((sum, d) => sum + d.rawTotal, 0);
    const totalCorrected = dateStats.reduce((sum, d) => sum + d.correctedTotal, 0);
    
    // Note: This endpoint doesn't actually modify any data - it just analyzes what would be corrected
    // You can add actual data modification if desired
    
    res.json({
      success: true,
      message: 'Historical purchase data analyzed successfully',
      summary: {
        uniqueDates: uniqueDates.length,
        totalRecords: allPurchases.length,
        rawTotal: totalRaw,
        correctedTotal: totalCorrected,
        difference: totalRaw - totalCorrected,
        correctionFactor: 2
      },
      dateStats
    });
    
  } catch (error) {
    console.error('❌ Error fixing historical purchases:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

module.exports = router;
