const express = require('express');
const router = express.Router();
const SimpleSalesPurchase = require('../models/SimpleSalesPurchase');

// Endpoint to reset profit calculations
router.get('/reset-profits', async (req, res) => {
  try {
    console.log('🔄 Starting profit reset operation...');
    
    // Update all sale records to have zero profit initially
    const updateResult = await SimpleSalesPurchase.updateMany(
      { type: 'sale' },
      { $set: { profit: 0 } }
    );
    
    console.log(`✅ Reset profit for ${updateResult.modifiedCount} sale records`);
    
    res.json({
      success: true,
      message: 'Profit values have been reset to zero',
      recordsUpdated: updateResult.modifiedCount,
      recordsMatched: updateResult.matchedCount
    });
    
  } catch (error) {
    console.error('❌ Error resetting profits:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Endpoint to add a new profit field to all sale records (if needed)
router.get('/add-profit-field', async (req, res) => {
  try {
    console.log('🔄 Adding profit field to sale records...');
    
    // This will add the profit field if it doesn't exist
    const updateResult = await SimpleSalesPurchase.updateMany(
      { type: 'sale', profit: { $exists: false } },
      { $set: { profit: 0 } }
    );
    
    console.log(`✅ Added profit field to ${updateResult.modifiedCount} sale records`);
    
    res.json({
      success: true,
      message: 'Profit field has been added to all sale records',
      recordsUpdated: updateResult.modifiedCount
    });
    
  } catch (error) {
    console.error('❌ Error adding profit field:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Endpoint to check current profit data
router.get('/profit-status', async (req, res) => {
  try {
    // Count sales records
    const salesCount = await SimpleSalesPurchase.countDocuments({ type: 'sale' });
    
    // Count sales with profit field
    const salesWithProfitCount = await SimpleSalesPurchase.countDocuments({
      type: 'sale',
      profit: { $exists: true }
    });
    
    // Get total profit
    const profitAggregate = await SimpleSalesPurchase.aggregate([
      { $match: { type: 'sale' } },
      { $group: {
        _id: null,
        totalProfit: { $sum: '$profit' }
      }}
    ]);
    
    const totalProfit = profitAggregate.length > 0 ? profitAggregate[0].totalProfit : 0;
    
    // Get a few sample records
    const sampleRecords = await SimpleSalesPurchase.find({ type: 'sale' })
      .sort({ date: -1 })
      .limit(5)
      .select('date productName amount profit');
    
    res.json({
      success: true,
      salesRecords: salesCount,
      salesWithProfitField: salesWithProfitCount,
      totalProfit,
      sampleRecords
    });
    
  } catch (error) {
    console.error('❌ Error checking profit status:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

module.exports = router;
