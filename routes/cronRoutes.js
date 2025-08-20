const express = require("express");
const cronJobService = require("../services/cronJobService");
const Product = require("../models/Product");

const router = express.Router();

// Get cron job status
router.get("/status", (req, res) => {
  try {
    const status = cronJobService.getStatus();
    res.status(200).json({
      success: true,
      cronJob: status
    });
  } catch (error) {
    console.error("Error getting cron job status:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message
    });
  }
});

// Manually trigger product status check
router.post("/trigger", async (req, res) => {
  try {
    await cronJobService.manualTrigger();
    res.status(200).json({
      success: true,
      message: "Product status check triggered successfully"
    });
  } catch (error) {
    console.error("Error manually triggering cron job:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message
    });
  }
});

// Get products by status (expired, low stock, out of stock)
router.get("/products/:status", async (req, res) => {
  try {
    const { status } = req.params;
    let query = {};

    switch (status.toLowerCase()) {
      case 'expired':
        query = { status: 'expired' };
        break;
      case 'low-stock':
        query = { availability: 'Low stock', status: 'active' };
        break;
      case 'out-of-stock':
        query = { availability: 'Out of stock', status: 'active' };
        break;
      case 'in-stock':
        query = { availability: 'In stock', status: 'active' };
        break;
      default:
        return res.status(400).json({
          success: false,
          message: "Invalid status. Use: expired, low-stock, out-of-stock, or in-stock"
        });
    }

    const products = await Product.find(query).sort({ lastStatusCheck: -1 });
    
    // Transform products to show proper price fields and hide sensitive data
    const transformedProducts = products.map(product => {
      return {
        _id: product._id,
        productName: product.productName,
        productId: product.productId,
        category: product.category,
        // Show only selling price (for display) - hide cost price
        price: product.sellingPrice || product.price, // Use sellingPrice if available, fallback to old price
        sellingPrice: product.sellingPrice || product.price,
        quantity: product.quantity,
        unit: product.unit,
        expiryDate: product.expiryDate,
        thresholdValue: product.thresholdValue,
        availability: product.availability,
        status: product.status,
        lastStatusCheck: product.lastStatusCheck,
        imageUrl: product.imageUrl,
        createdAt: product.createdAt,
        updatedAt: product.updatedAt
        // costPrice is intentionally excluded for security/business reasons
      };
    });
    
    res.status(200).json({
      success: true,
      count: transformedProducts.length,
      status: status,
      products: transformedProducts
    });
  } catch (error) {
    console.error("Error fetching products by status:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message
    });
  }
});

// Get dashboard summary
router.get("/dashboard", async (req, res) => {
  try {
    const [
      totalProducts,
      activeProducts,
      expiredProducts,
      outOfStock,
      lowStock,
      inStock
    ] = await Promise.all([
      Product.countDocuments(),
      Product.countDocuments({ status: 'active' }),
      Product.countDocuments({ status: 'expired' }),
      Product.countDocuments({ availability: 'Out of stock', status: 'active' }),
      Product.countDocuments({ availability: 'Low stock', status: 'active' }),
      Product.countDocuments({ availability: 'In stock', status: 'active' })
    ]);

    const recentlyExpired = await Product.find({ status: 'expired' })
      .sort({ lastStatusCheck: -1 })
      .limit(5)
      .select('productName productId expiryDate lastStatusCheck');

    const lowStockItems = await Product.find({ availability: 'Low stock', status: 'active' })
      .sort({ quantity: 1 })
      .limit(10)
      .select('productName productId quantity thresholdValue');

    res.status(200).json({
      success: true,
      summary: {
        total: totalProducts,
        active: activeProducts,
        expired: expiredProducts,
        outOfStock,
        lowStock,
        inStock
      },
      alerts: {
        recentlyExpired,
        lowStockItems
      },
      cronJob: cronJobService.getStatus()
    });
  } catch (error) {
    console.error("Error fetching dashboard data:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message
    });
  }
});

module.exports = router;
