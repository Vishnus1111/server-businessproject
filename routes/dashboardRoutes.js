const express = require('express');
const router = express.Router();
const Product = require('../models/Product');
const Order = require('../models/Order');
const SalesPurchase = require('../models/SalesPurchase');
const SimpleSalesPurchase = require('../models/SimpleSalesPurchase');

// Test SalesPurchase data endpoint
router.get('/test-salespurchase', async (req, res) => {
  try {
    console.log('🔍 Testing SimpleSalesPurchase collection...');
    const count = await SimpleSalesPurchase.countDocuments();
    console.log(`📊 SimpleSalesPurchase documents count: ${count}`);
    
    if (count > 0) {
      const recent = await SimpleSalesPurchase.find().sort({ createdAt: -1 }).limit(5);
      console.log('📄 Recent 5 documents:');
      recent.forEach((doc, index) => {
        console.log(`${index + 1}. Type: ${doc.type}, Amount: ₹${doc.amount}, Date: ${doc.createdAt}`);
      });
    }
    
    res.json({
      success: true,
      count,
      recent: count > 0 ? await SimpleSalesPurchase.find().sort({ createdAt: -1 }).limit(5) : [],
      message: 'SimpleSalesPurchase collection test complete'
    });
  } catch (error) {
    console.error('❌ Error testing SimpleSalesPurchase:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get comprehensive dashboard statistics
router.get('/stats', async (req, res) => {
  try {
    // Fixed to 7 days only as per requirements
    const days = 7;
    const daysAgo = new Date();
    daysAgo.setDate(daysAgo.getDate() - days);

    // Overall Inventory Stats
    const totalProducts = await Product.countDocuments();
    const activeProducts = await Product.countDocuments({ status: 'active' });
    
    // Categories count
    const categoriesCount = await Product.aggregate([
      { $group: { _id: '$category' } },
      { $count: 'total' }
    ]);
    
    // Total Products with revenue (last X days)
    const recentProducts = await Product.countDocuments({
      createdAt: { $gte: daysAgo }
    });
    
    // Calculate total revenue from orders (last X days)
    const revenueData = await Order.aggregate([
      {
        $match: {
          createdAt: { $gte: daysAgo },
          orderStatus: { $ne: 'cancelled' }
        }
      },
      {
        $group: {
          _id: null,
          totalRevenue: { $sum: '$totalAmount' },
          totalOrders: { $sum: 1 }
        }
      }
    ]);

    // Top Selling Products (last X days)
    const topSellingProducts = await Order.aggregate([
      {
        $match: {
          createdAt: { $gte: daysAgo },
          orderStatus: { $ne: 'cancelled' }
        }
      },
      {
        $group: {
          _id: '$productId',
          productName: { $first: '$productName' },
          totalQuantitySold: { $sum: '$quantityOrdered' },
          totalRevenue: { $sum: '$totalAmount' },
          orderCount: { $sum: 1 }
        }
      },
      { $sort: { totalQuantitySold: -1 } },
      { $limit: 5 }
    ]);

    // Low Stock Analysis - only count products that were ordered
    const lowStockProductsOrdered = await Order.aggregate([
      {
        $match: {
          createdAt: { $gte: daysAgo },
          orderStatus: { $ne: 'cancelled' }
        }
      },
      {
        $lookup: {
          from: 'products',
          localField: 'productId',
          foreignField: 'productId',
          as: 'productData'
        }
      },
      {
        $unwind: { path: '$productData', preserveNullAndEmptyArrays: true }
      },
      {
        $match: {
          'productData.availability': 'Low stock'
        }
      },
      {
        $group: {
          _id: '$productId'
        }
      },
      {
        $count: 'totalLowStockOrdered'
      }
    ]);

    const lowStockOrderedCount = lowStockProductsOrdered[0]?.totalLowStockOrdered || 0;

    // Recent orders for trending
    const recentOrders = await Order.countDocuments({
      createdAt: { $gte: daysAgo }
    });

    // Get some additional stats that were moved
    const outOfStockProducts = await Product.countDocuments({
      availability: 'Out of stock'
    });

    const expiredProducts = await Product.countDocuments({
      status: 'expired'
    });

    const lowStockProducts = await Product.countDocuments({
      availability: 'Low stock',
      status: 'active'
    });

    const notInStockCount = outOfStockProducts + expiredProducts;

    // Calculate cost vs revenue (if cost data available)
    const costRevenueData = await Order.aggregate([
      {
        $match: {
          createdAt: { $gte: daysAgo },
          orderStatus: { $ne: 'cancelled' }
        }
      },
      {
        $lookup: {
          from: 'products',
          localField: 'productId',
          foreignField: 'productId',
          as: 'productData'
        }
      },
      {
        $unwind: {
          path: '$productData',
          preserveNullAndEmptyArrays: true
        }
      },
      {
        $group: {
          _id: null,
          totalRevenue: { $sum: '$totalAmount' },
          totalCost: {
            $sum: {
              $multiply: [
                '$quantityOrdered',
                { $ifNull: ['$productData.costPrice', 0] }
              ]
            }
          }
        }
      }
    ]);

    // Stock levels distribution
    const stockDistribution = await Product.aggregate([
      {
        $match: { status: 'active' }
      },
      {
        $group: {
          _id: '$availability',
          count: { $sum: 1 },
          totalQuantity: { $sum: '$quantity' }
        }
      }
    ]);

    // Recent activity (last X days)
    const recentActivity = {
      newProducts: recentProducts,
      newOrders: recentOrders,
      revenue: revenueData[0]?.totalRevenue || 0
    };

    const response = {
      success: true,
      period: `Last ${days} days`,
      generatedAt: new Date(),
      overallInventory: {
        categories: categoriesCount[0]?.total || 0,
        lastDays: days,
        totalProducts: {
          count: totalProducts,
          recent: recentProducts,
          revenue: revenueData[0]?.totalRevenue || 0
        },
        topSelling: {
          count: topSellingProducts.length > 0 ? topSellingProducts[0].totalQuantitySold : 0,
          cost: costRevenueData[0]?.totalCost || 0
        },
        lowStocks: {
          ordered: lowStockOrderedCount,
          notInStock: notInStockCount
        }
      },
      detailed: {
        products: {
          total: totalProducts,
          active: activeProducts,
          expired: expiredProducts,
          categories: categoriesCount[0]?.total || 0
        },
        inventory: {
          inStock: stockDistribution.find(s => s._id === 'In stock')?.count || 0,
          lowStock: lowStockProducts,
          outOfStock: outOfStockProducts,
          expired: expiredProducts
        },
        sales: {
          totalOrders: recentOrders,
          totalRevenue: revenueData[0]?.totalRevenue || 0,
          totalCost: costRevenueData[0]?.totalCost || 0,
          profit: (revenueData[0]?.totalRevenue || 0) - (costRevenueData[0]?.totalCost || 0)
        },
        topProducts: topSellingProducts
      },
      stockDistribution: stockDistribution,
      recentActivity: recentActivity
    };

    res.json(response);

  } catch (error) {
    console.error('Error fetching dashboard stats:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch dashboard statistics',
      error: error.message
    });
  }
});

// Get real-time inventory summary (matching your image format)
router.get('/inventory-summary', async (req, res) => {
  try {
    // Fixed to 7 days only as per requirements
    const days = 7;
    const daysAgo = new Date();
    daysAgo.setDate(daysAgo.getDate() - days);

    // Categories count
    const categoriesResult = await Product.aggregate([
      { $group: { _id: '$category' } },
      { $count: 'total' }
    ]);
    const categoriesCount = categoriesResult[0]?.total || 0;

    // Total Products with recent count
    const totalProducts = await Product.countDocuments();
    const recentProducts = await Product.countDocuments({
      createdAt: { $gte: daysAgo }
    });

    // Revenue calculation from orders
    const revenueData = await Order.aggregate([
      {
        $match: {
          createdAt: { $gte: daysAgo },
          orderStatus: { $ne: 'cancelled' }
        }
      },
      {
        $group: {
          _id: null,
          totalRevenue: { $sum: '$totalAmount' }
        }
      }
    ]);
    const totalRevenue = revenueData[0]?.totalRevenue || 0;

    // Top Selling - most ordered product
    const topSellingData = await Order.aggregate([
      {
        $match: {
          createdAt: { $gte: daysAgo },
          orderStatus: { $ne: 'cancelled' }
        }
      },
      {
        $group: {
          _id: '$productId',
          totalQuantity: { $sum: '$quantityOrdered' },
          totalRevenue: { $sum: '$totalAmount' }
        }
      },
      { $sort: { totalQuantity: -1 } },
      { $limit: 1 }
    ]);

    // Cost calculation for top selling
    const topProductCost = await Order.aggregate([
      {
        $match: {
          createdAt: { $gte: daysAgo },
          orderStatus: { $ne: 'cancelled' }
        }
      },
      {
        $lookup: {
          from: 'products',
          localField: 'productId',
          foreignField: 'productId',
          as: 'productData'
        }
      },
      {
        $unwind: { path: '$productData', preserveNullAndEmptyArrays: true }
      },
      {
        $group: {
          _id: null,
          totalCost: {
            $sum: {
              $multiply: [
                '$quantityOrdered',
                { $ifNull: ['$productData.costPrice', '$productData.price', 0] }
              ]
            }
          }
        }
      }
    ]);

    // Low Stocks - only count products that were ordered
    const lowStockProductsOrdered = await Order.aggregate([
      {
        $match: {
          createdAt: { $gte: daysAgo },
          orderStatus: { $ne: 'cancelled' }
        }
      },
      {
        $lookup: {
          from: 'products',
          localField: 'productId',
          foreignField: 'productId',
          as: 'productData'
        }
      },
      {
        $unwind: { path: '$productData', preserveNullAndEmptyArrays: true }
      },
      {
        $match: {
          'productData.availability': 'Low stock'
        }
      },
      {
        $group: {
          _id: '$productId'
        }
      },
      {
        $count: 'totalLowStockOrdered'
      }
    ]);

    const lowStockOrderedCount = lowStockProductsOrdered[0]?.totalLowStockOrdered || 0;

    const orderedCount = await Order.countDocuments({
      createdAt: { $gte: daysAgo }
    });

    const notInStockCount = await Product.countDocuments({
      $or: [
        { availability: 'Out of stock' },
        { status: 'expired' }
      ]
    });

    // Format response to match your UI
    const summary = {
      success: true,
      period: `Last ${days} days`,
      updatedAt: new Date(),
      overallInventory: {
        categories: {
          count: categoriesCount,
          period: `Last ${days} days`
        },
        totalProducts: {
          count: totalProducts,
          recent: recentProducts,
          period: `Last ${days} days`,
          revenue: totalRevenue
        },
        topSelling: {
          count: topSellingData[0]?.totalQuantity || 0,
          period: `Last ${days} days`,
          cost: topProductCost[0]?.totalCost || 0
        },
        lowStocks: {
          ordered: lowStockOrderedCount,
          notInStock: notInStockCount
        }
      }
    };

    res.json(summary);

  } catch (error) {
    console.error('Error fetching inventory summary:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch inventory summary',
      error: error.message
    });
  }
});

// Get trending data for charts
router.get('/trends', async (req, res) => {
  try {
    // Fixed to 7 days only as per requirements
    const days = 7;
    const daysAgo = new Date();
    daysAgo.setDate(daysAgo.getDate() - days);

    // Daily trends for the period
    const dailyTrends = await Order.aggregate([
      {
        $match: {
          createdAt: { $gte: daysAgo },
          orderStatus: { $ne: 'cancelled' }
        }
      },
      {
        $group: {
          _id: {
            $dateToString: {
              format: '%Y-%m-%d',
              date: '$createdAt'
            }
          },
          orders: { $sum: 1 },
          revenue: { $sum: '$totalAmount' },
          quantity: { $sum: '$quantityOrdered' }
        }
      },
      { $sort: { '_id': 1 } }
    ]);

    // Category wise distribution
    const categoryTrends = await Product.aggregate([
      {
        $group: {
          _id: '$category',
          totalProducts: { $sum: 1 },
          inStock: {
            $sum: {
              $cond: [{ $eq: ['$availability', 'In stock'] }, 1, 0]
            }
          },
          lowStock: {
            $sum: {
              $cond: [{ $eq: ['$availability', 'Low stock'] }, 1, 0]
            }
          },
          outOfStock: {
            $sum: {
              $cond: [{ $eq: ['$availability', 'Out of stock'] }, 1, 0]
            }
          }
        }
      },
      { $sort: { totalProducts: -1 } }
    ]);

    res.json({
      success: true,
      period: `Last ${days} days`,
      dailyTrends: dailyTrends,
      categoryTrends: categoryTrends,
      generatedAt: new Date()
    });

  } catch (error) {
    console.error('Error fetching trends:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch trends data',
      error: error.message
    });
  }
});

// Get live inventory status (updates every call)
router.get('/live-status', async (req, res) => {
  try {
    const totalProducts = await Product.countDocuments();
    const activeProducts = await Product.countDocuments({ status: 'active' });
    const lowStockProducts = await Product.countDocuments({ availability: 'Low stock' });
    const outOfStockProducts = await Product.countDocuments({ availability: 'Out of stock' });
    const inStockProducts = await Product.countDocuments({ availability: 'In stock' });
    
    const totalOrders = await Order.countDocuments();
    const pendingOrders = await Order.countDocuments({ orderStatus: 'pending' });
    
    res.json({
      success: true,
      timestamp: new Date(),
      inventory: {
        total: totalProducts,
        active: activeProducts,
        inStock: inStockProducts,
        lowStock: lowStockProducts,
        outOfStock: outOfStockProducts
      },
      orders: {
        total: totalOrders,
        pending: pendingOrders
      }
    });

  } catch (error) {
    console.error('Error fetching live status:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch live status',
      error: error.message
    });
  }
});

module.exports = router;
