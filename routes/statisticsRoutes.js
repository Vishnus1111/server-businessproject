const express = require('express');
const router = express.Router();
const Product = require('../models/Product');
const Order = require('../models/Order');
const moment = require('moment');

// Helper function to get date ranges
const getDateRanges = (period = 'week') => {
  const now = moment();
  let current, previous;
  
  if (period === 'day') {
    current = {
      start: moment().startOf('day'),
      end: moment().endOf('day')
    };
    previous = {
      start: moment().subtract(1, 'day').startOf('day'),
      end: moment().subtract(1, 'day').endOf('day')
    };
  } else if (period === 'week') {
    // Sunday to Saturday of current week
    current = {
      start: moment().startOf('week'), // Sunday
      end: moment().endOf('week')     // Saturday
    };
    previous = {
      start: moment().subtract(1, 'week').startOf('week'), // Previous Sunday
      end: moment().subtract(1, 'week').endOf('week')     // Previous Saturday
    };
  } else if (period === 'month') {
    // January to December of current year
    current = {
      start: moment().startOf('year'), // January 1st
      end: moment().endOf('year')      // December 31st
    };
    previous = {
      start: moment().subtract(1, 'year').startOf('year'), // Previous year Jan 1st
      end: moment().subtract(1, 'year').endOf('year')      // Previous year Dec 31st
    };
  } else if (period === 'year') {
    // Current year only
    current = {
      start: moment().startOf('year'), // January 1st
      end: moment().endOf('year')      // December 31st
    };
    previous = {
      start: moment().subtract(1, 'year').startOf('year'), // Previous year
      end: moment().subtract(1, 'year').endOf('year')
    };
  }
  
  return { current, previous };
};

// Helper function to calculate percentage change
const calculatePercentageChange = (current, previous) => {
  if (previous === 0) return current > 0 ? 100 : 0;
  return ((current - previous) / previous * 100).toFixed(1);
};

// Get comprehensive statistics for dashboard
router.get('/dashboard', async (req, res) => {
  try {
    const { period = 'month' } = req.query; // day, week, month, year
    
    // Calculate date ranges using the new helper function
    const now = moment();
    let startDate, endDate;
    
    switch (period) {
      case 'day':
        startDate = now.clone().startOf('day');
        endDate = now.clone().endOf('day');
        break;
      case 'week':
        // Sunday to Saturday of current week
        startDate = now.clone().startOf('week'); // Sunday
        endDate = now.clone().endOf('week');     // Saturday
        break;
      case 'month':
        // January to December of current year
        startDate = now.clone().startOf('year'); // January 1st
        endDate = now.clone().endOf('year');     // December 31st
        break;
      case 'year':
        // Current year only
        startDate = now.clone().startOf('year'); // January 1st
        endDate = now.clone().endOf('year');     // December 31st
        break;
      default:
        startDate = now.clone().startOf('month');
        endDate = now.clone().endOf('month');
        break;
    }

    // 1. TOTAL REVENUE (from actual orders in database)
    const revenueData = await Order.aggregate([
      {
        $match: {
          createdAt: { $gte: startDate.toDate(), $lte: endDate.toDate() },
          orderStatus: { $ne: 'cancelled' }
        }
      },
      {
        $group: {
          _id: null,
          totalRevenue: { $sum: '$totalAmount' },
          totalOrders: { $sum: 1 },
          totalProductsSold: { $sum: '$quantityOrdered' }
        }
      }
    ]);

    // Previous period for comparison
    let prevStartDate, prevEndDate;
    switch (period) {
      case 'day':
        prevStartDate = now.clone().subtract(1, 'day').startOf('day');
        prevEndDate = now.clone().subtract(1, 'day').endOf('day');
        break;
      case 'week':
        // Previous Sunday to Saturday
        prevStartDate = now.clone().subtract(1, 'week').startOf('week'); // Previous Sunday
        prevEndDate = now.clone().subtract(1, 'week').endOf('week');     // Previous Saturday
        break;
      case 'month':
        // Previous year (January to December)
        prevStartDate = now.clone().subtract(1, 'year').startOf('year'); // Previous year Jan 1st
        prevEndDate = now.clone().subtract(1, 'year').endOf('year');     // Previous year Dec 31st
        break;
      case 'year':
        // Previous year
        prevStartDate = now.clone().subtract(1, 'year').startOf('year'); // Previous year
        prevEndDate = now.clone().subtract(1, 'year').endOf('year');
        break;
      default:
        prevStartDate = now.clone().subtract(1, 'month').startOf('month');
        prevEndDate = now.clone().subtract(1, 'month').endOf('month');
        break;
    }

    const prevRevenueData = await Order.aggregate([
      {
        $match: {
          createdAt: { $gte: prevStartDate.toDate(), $lte: prevEndDate.toDate() },
          orderStatus: { $ne: 'cancelled' }
        }
      },
      {
        $group: {
          _id: null,
          totalRevenue: { $sum: '$totalAmount' },
          totalProductsSold: { $sum: '$quantityOrdered' }
        }
      }
    ]);

    // 2. PRODUCTS IN STOCK (from actual products in database)
    const stockData = await Product.aggregate([
      {
        $match: { 
          status: 'active',
          costPrice: { $exists: true, $ne: null },
          sellingPrice: { $exists: true, $ne: null }
        }
      },
      {
        $group: {
          _id: null,
          totalProductsInStock: { $sum: 1 },
          totalQuantityInStock: { $sum: '$quantity' }
        }
      }
    ]);

    // Calculate percentage changes
    const currentRevenue = revenueData[0]?.totalRevenue || 0;
    const prevRevenue = prevRevenueData[0]?.totalRevenue || 0;
    const revenueChange = prevRevenue > 0 ? ((currentRevenue - prevRevenue) / prevRevenue * 100) : 0;

    const currentProductsSold = revenueData[0]?.totalProductsSold || 0;
    const prevProductsSold = prevRevenueData[0]?.totalProductsSold || 0;
    const productsSoldChange = prevProductsSold > 0 ? ((currentProductsSold - prevProductsSold) / prevProductsSold * 100) : 0;

    const summaryCards = {
      totalRevenue: {
        amount: currentRevenue,
        change: Math.round(revenueChange * 100) / 100,
        period: period,
        formatted: `₹${currentRevenue.toLocaleString('en-IN')}`
      },
      productsSold: {
        count: currentProductsSold,
        change: Math.round(productsSoldChange * 100) / 100,
        period: period
      },
      productsInStock: {
        count: stockData[0]?.totalProductsInStock || 0,
        totalQuantity: stockData[0]?.totalQuantityInStock || 0,
        change: 0 // Stock change calculation can be added if needed
      }
    };

    res.json({
      success: true,
      period: period,
      dateRange: {
        start: startDate.format('YYYY-MM-DD'),
        end: endDate.format('YYYY-MM-DD')
      },
      summaryCards: summaryCards
    });

  } catch (error) {
    console.error('Error fetching dashboard statistics:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch dashboard statistics',
      error: error.message
    });
  }
});

// Get Sales & Purchase chart data based on actual database
router.get('/chart', async (req, res) => {
  try {
    const { period = 'month' } = req.query; // day, week, month, year
    
    const now = moment();
    let groupFormat, startDate, endDate, timeUnits;
    
    // Determine grouping and date range based on period
    switch (period) {
      case 'day':
        groupFormat = '%Y-%m-%d-%H'; // Hourly grouping for day view
        startDate = now.clone().startOf('day');
        endDate = now.clone().endOf('day');
        timeUnits = [];
        for (let i = 0; i < 24; i++) {
          timeUnits.push(startDate.clone().add(i, 'hours').format('YYYY-MM-DD-HH'));
        }
        break;
        
      case 'week':
        // Sunday to Saturday of current week
        groupFormat = '%Y-%m-%d'; // Daily grouping for week view
        startDate = now.clone().startOf('week'); // Sunday
        endDate = now.clone().endOf('week');     // Saturday
        timeUnits = [];
        for (let i = 0; i < 7; i++) {
          timeUnits.push(startDate.clone().add(i, 'days').format('YYYY-MM-DD'));
        }
        break;
        
      case 'month':
        // January to December of current year
        groupFormat = '%Y-%m'; // Monthly grouping for year view
        startDate = now.clone().startOf('year'); // January 1st
        endDate = now.clone().endOf('year');     // December 31st
        timeUnits = [];
        for (let i = 0; i < 12; i++) {
          timeUnits.push(startDate.clone().add(i, 'months').format('YYYY-MM'));
        }
        break;
        
      case 'year':
        // Current year only
        groupFormat = '%Y-%m'; // Monthly grouping for year view
        startDate = now.clone().startOf('year'); // January 1st
        endDate = now.clone().endOf('year');     // December 31st
        timeUnits = [];
        for (let i = 0; i < 12; i++) {
          timeUnits.push(startDate.clone().add(i, 'months').format('YYYY-MM'));
        }
        break;
        
      default:
        groupFormat = '%Y-%m-%d'; // Daily grouping for default
        startDate = now.clone().startOf('month');
        endDate = now.clone().endOf('month');
        timeUnits = [];
        const daysInMonth = endDate.date();
        for (let i = 0; i < daysInMonth; i++) {
          timeUnits.push(startDate.clone().add(i, 'days').format('YYYY-MM-DD'));
        }
        break;
    }

    // Sales data (Revenue from Orders) - ACTUAL DATABASE DATA
    const salesData = await Order.aggregate([
      {
        $match: {
          createdAt: { $gte: startDate.toDate(), $lte: endDate.toDate() },
          orderStatus: { $ne: 'cancelled' }
        }
      },
      {
        $group: {
          _id: {
            $dateToString: {
              format: groupFormat,
              date: '$createdAt'
            }
          },
          salesAmount: { $sum: '$totalAmount' },
          orderCount: { $sum: 1 },
          productsSold: { $sum: '$quantityOrdered' }
        }
      },
      { $sort: { '_id': 1 } }
    ]);

    // Purchase data (Products added with cost) - ACTUAL DATABASE DATA
    const purchaseData = await Product.aggregate([
      {
        $match: {
          createdAt: { $gte: startDate.toDate(), $lte: endDate.toDate() },
          status: 'active',
          costPrice: { $exists: true, $ne: null }
        }
      },
      {
        $group: {
          _id: {
            $dateToString: {
              format: groupFormat,
              date: '$createdAt'
            }
          },
          purchaseAmount: { $sum: { $multiply: ['$costPrice', '$quantity'] } },
          productCount: { $sum: 1 },
          totalQuantity: { $sum: '$quantity' }
        }
      },
      { $sort: { '_id': 1 } }
    ]);

    // Create complete chart data with all time units
    const chartData = timeUnits.map(timeUnit => {
      const salesRecord = salesData.find(s => s._id === timeUnit);
      const purchaseRecord = purchaseData.find(p => p._id === timeUnit);
      
      let label;
      if (period === 'week') {
        label = moment(timeUnit).format('ddd'); // Mon, Tue, Wed
      } else if (period === 'year') {
        label = moment(timeUnit + '-01').format('MMM'); // Jan, Feb, Mar
      } else {
        label = moment(timeUnit).format('DD'); // 01, 02, 03
      }
      
      return {
        period: timeUnit,
        label: label,
        sales: salesRecord?.salesAmount || 0,
        purchases: purchaseRecord?.purchaseAmount || 0,
        salesCount: salesRecord?.orderCount || 0,
        purchaseCount: purchaseRecord?.productCount || 0
      };
    });

    res.json({
      success: true,
      period: period,
      dateRange: {
        start: startDate.format('YYYY-MM-DD'),
        end: endDate.format('YYYY-MM-DD')
      },
      chartData: chartData
    });

  } catch (error) {
    console.error('Error fetching chart data:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch chart data',
      error: error.message
    });
  }
});

// Get top performing products from actual database
router.get('/top-products', async (req, res) => {
  try {
    const { period = 'month', limit = 6 } = req.query;
    
    const now = moment();
    let startDate, endDate;
    
    switch (period) {
      case 'week':
        startDate = now.clone().startOf('week');
        endDate = now.clone().endOf('week');
        break;
      case 'year':
        startDate = now.clone().startOf('year');
        endDate = now.clone().endOf('year');
        break;
      case 'month':
      default:
        startDate = now.clone().startOf('month');
        endDate = now.clone().endOf('month');
        break;
    }

    // Get top products from actual orders in database
    const topProducts = await Order.aggregate([
      {
        $match: {
          createdAt: { $gte: startDate.toDate(), $lte: endDate.toDate() },
          orderStatus: { $ne: 'cancelled' }
        }
      },
      {
        $group: {
          _id: '$productId',
          productName: { $first: '$productName' },
          totalRevenue: { $sum: '$totalAmount' },
          totalQuantitySold: { $sum: '$quantityOrdered' },
          orderCount: { $sum: 1 },
          avgOrderValue: { $avg: '$totalAmount' }
        }
      },
      { $sort: { totalRevenue: -1 } },
      { $limit: parseInt(limit) }
    ]);

    // Get product details from actual products
    const enrichedProducts = await Promise.all(
      topProducts.map(async (product) => {
        const productDetails = await Product.findOne({ productId: product._id });
        return {
          ...product,
          category: productDetails?.category || 'Unknown',
          costPrice: productDetails?.costPrice || 0,
          sellingPrice: productDetails?.sellingPrice || 0,
          currentStock: productDetails?.quantity || 0,
          profit: (product.totalRevenue - (productDetails?.costPrice || 0) * product.totalQuantitySold),
          rating: Math.floor(Math.random() * 2) + 4 // 4 or 5 stars for top products
        };
      })
    );

    res.json({
      success: true,
      period: period,
      topProducts: enrichedProducts
    });

  } catch (error) {
    console.error('Error fetching top products:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch top products',
      error: error.message
    });
  }
});

module.exports = router;

// Get detailed analytics summary
router.get('/analytics', async (req, res) => {
  try {
    const { period = 'month' } = req.query;
    
    const now = moment();
    let startDate, endDate;
    
    switch (period) {
      case 'week':
        startDate = now.clone().startOf('week');
        endDate = now.clone().endOf('week');
        break;
      case 'year':
        startDate = now.clone().startOf('year');
        endDate = now.clone().endOf('year');
        break;
      case 'month':
      default:
        startDate = now.clone().startOf('month');
        endDate = now.clone().endOf('month');
        break;
    }

    // Overall analytics
    const analytics = await Order.aggregate([
      {
        $match: {
          createdAt: { $gte: startDate.toDate(), $lte: endDate.toDate() }
        }
      },
      {
        $group: {
          _id: '$orderStatus',
          count: { $sum: 1 },
          totalAmount: { $sum: '$totalAmount' },
          avgOrderValue: { $avg: '$totalAmount' }
        }
      }
    ]);

    // Category-wise performance
    const categoryPerformance = await Order.aggregate([
      {
        $match: {
          createdAt: { $gte: startDate.toDate(), $lte: endDate.toDate() },
          orderStatus: { $ne: 'cancelled' }
        }
      },
      {
        $lookup: {
          from: 'products',
          localField: 'productId',
          foreignField: 'productId',
          as: 'productInfo'
        }
      },
      {
        $unwind: '$productInfo'
      },
      {
        $group: {
          _id: '$productInfo.category',
          totalRevenue: { $sum: '$totalAmount' },
          productsSold: { $sum: '$quantityOrdered' },
          orderCount: { $sum: 1 }
        }
      },
      { $sort: { totalRevenue: -1 } }
    ]);

    res.json({
      success: true,
      period: period,
      analytics: {
        orderStatus: analytics,
        categoryPerformance: categoryPerformance,
        totalOrders: analytics.reduce((sum, item) => sum + item.count, 0),
        totalRevenue: analytics.reduce((sum, item) => sum + item.totalAmount, 0)
      }
    });

  } catch (error) {
    console.error('Error fetching analytics:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch analytics',
      error: error.message
    });
  }
});

// Dashboard Summary with Period Comparison
router.get('/dashboard-summary', async (req, res) => {
  try {
    const period = req.query.period || 'month'; // day, week, month
    const { current, previous } = getDateRanges(period);
    
    // Get products with valid pricing (active only)
    const validProducts = await Product.find({
      status: 'active',
      costPrice: { $exists: true, $ne: null },
      sellingPrice: { $exists: true, $ne: null }
    });
    
    const totalProductsInStock = validProducts.length;
    const lowStockProducts = validProducts.filter(p => p.availability === 'Low stock').length;
    
    // Current period stats
    const currentRevenue = await Order.aggregate([
      { 
        $match: { 
          orderStatus: { $ne: 'cancelled' },
          createdAt: { $gte: current.start.toDate(), $lte: current.end.toDate() }
        } 
      },
      { $group: { _id: null, total: { $sum: '$totalAmount' } } }
    ]);
    
    const currentProductsSold = await Order.aggregate([
      { 
        $match: { 
          orderStatus: { $ne: 'cancelled' },
          createdAt: { $gte: current.start.toDate(), $lte: current.end.toDate() }
        } 
      },
      { $group: { _id: null, total: { $sum: '$quantityOrdered' } } }
    ]);
    
    // Previous period stats
    const previousRevenue = await Order.aggregate([
      { 
        $match: { 
          orderStatus: { $ne: 'cancelled' },
          createdAt: { $gte: previous.start.toDate(), $lte: previous.end.toDate() }
        } 
      },
      { $group: { _id: null, total: { $sum: '$totalAmount' } } }
    ]);
    
    const previousProductsSold = await Order.aggregate([
      { 
        $match: { 
          orderStatus: { $ne: 'cancelled' },
          createdAt: { $gte: previous.start.toDate(), $lte: previous.end.toDate() }
        } 
      },
      { $group: { _id: null, total: { $sum: '$quantityOrdered' } } }
    ]);
    
    // Calculate current values
    const currentRevenueValue = currentRevenue[0]?.total || 0;
    const currentProductsSoldValue = currentProductsSold[0]?.total || 0;
    
    // Calculate previous values
    const previousRevenueValue = previousRevenue[0]?.total || 0;
    const previousProductsSoldValue = previousProductsSold[0]?.total || 0;
    
    // Calculate percentage changes
    const revenueChange = calculatePercentageChange(currentRevenueValue, previousRevenueValue);
    const productsSoldChange = calculatePercentageChange(currentProductsSoldValue, previousProductsSoldValue);
    
    // For stock comparison, compare with previous period's stock levels
    const previousStockCount = await Product.countDocuments({
      status: 'active',
      costPrice: { $exists: true, $ne: null },
      sellingPrice: { $exists: true, $ne: null },
      updatedAt: { $gte: previous.start.toDate(), $lte: previous.end.toDate() }
    });
    
    const stockChange = calculatePercentageChange(totalProductsInStock, previousStockCount || totalProductsInStock);
    
    res.json({
      period: period,
      currentPeriod: {
        start: current.start.format('YYYY-MM-DD'),
        end: current.end.format('YYYY-MM-DD')
      },
      previousPeriod: {
        start: previous.start.format('YYYY-MM-DD'),
        end: previous.end.format('YYYY-MM-DD')
      },
      metrics: {
        revenue: {
          current: currentRevenueValue,
          previous: previousRevenueValue,
          change: parseFloat(revenueChange),
          trend: revenueChange > 0 ? 'up' : revenueChange < 0 ? 'down' : 'stable'
        },
        productsSold: {
          current: currentProductsSoldValue,
          previous: previousProductsSoldValue,
          change: parseFloat(productsSoldChange),
          trend: productsSoldChange > 0 ? 'up' : productsSoldChange < 0 ? 'down' : 'stable'
        },
        productsInStock: {
          current: totalProductsInStock,
          previous: previousStockCount || totalProductsInStock,
          change: parseFloat(stockChange),
          trend: stockChange > 0 ? 'up' : stockChange < 0 ? 'down' : 'stable'
        },
        lowStockAlerts: {
          current: lowStockProducts,
          trend: 'warning'
        }
      }
    });
  } catch (error) {
    console.error('Dashboard summary error:', error);
    res.status(500).json({ error: 'Failed to fetch dashboard summary' });
  }
});

// Enhanced Chart Data with Period Support
router.get('/chart-data', async (req, res) => {
  try {
    const period = req.query.period || 'week';
    
    let chartData = [];
    let salesData = [];
    let purchaseData = [];
    let dateFormat = 'MMM DD';
    
    const now = moment();
    
    if (period === 'day') {
      // Hourly data for current day
      dateFormat = 'HH:mm';
      for (let i = 0; i < 24; i++) {
        const hour = now.clone().startOf('day').add(i, 'hours');
        const startOfHour = hour.clone();
        const endOfHour = hour.clone().endOf('hour');
        
        // Get sales for this hour
        const hourlySales = await Order.aggregate([
          {
            $match: {
              orderStatus: { $ne: 'cancelled' },
              createdAt: { $gte: startOfHour.toDate(), $lte: endOfHour.toDate() }
            }
          },
          { $group: { _id: null, total: { $sum: '$totalAmount' } } }
        ]);
        
        // Calculate cost of goods sold for this hour
        const hourlyCOGS = await Order.aggregate([
          {
            $match: {
              orderStatus: { $ne: 'cancelled' },
              createdAt: { $gte: startOfHour.toDate(), $lte: endOfHour.toDate() }
            }
          },
          {
            $lookup: {
              from: 'products',
              localField: 'productId',
              foreignField: 'productId',
              as: 'product'
            }
          },
          {
            $unwind: '$product'
          },
          {
            $group: {
              _id: null,
              total: {
                $sum: {
                  $multiply: ['$quantityOrdered', '$product.costPrice']
                }
              }
            }
          }
        ]);
        
        chartData.push(hour.format(dateFormat));
        salesData.push(hourlySales[0]?.total || 0);
        purchaseData.push(hourlyCOGS[0]?.total || 0);
      }
    } else if (period === 'week') {
      // Daily data for current week (Sunday to Saturday)
      dateFormat = 'ddd'; // Short day name
      const startOfWeek = now.clone().startOf('week'); // Sunday
      
      for (let i = 0; i < 7; i++) {
        const day = startOfWeek.clone().add(i, 'days');
        const startOfDay = day.clone().startOf('day');
        const endOfDay = day.clone().endOf('day');
        
        // Get sales for this day
        const dailySales = await Order.aggregate([
          {
            $match: {
              orderStatus: { $ne: 'cancelled' },
              createdAt: { $gte: startOfDay.toDate(), $lte: endOfDay.toDate() }
            }
          },
          { $group: { _id: null, total: { $sum: '$totalAmount' } } }
        ]);
        
        // Calculate cost of goods sold for this day
        const dailyCOGS = await Order.aggregate([
          {
            $match: {
              orderStatus: { $ne: 'cancelled' },
              createdAt: { $gte: startOfDay.toDate(), $lte: endOfDay.toDate() }
            }
          },
          {
            $lookup: {
              from: 'products',
              localField: 'productId',
              foreignField: 'productId',
              as: 'product'
            }
          },
          {
            $unwind: '$product'
          },
          {
            $group: {
              _id: null,
              total: {
                $sum: {
                  $multiply: ['$quantityOrdered', '$product.costPrice']
                }
              }
            }
          }
        ]);
        
        chartData.push(day.format(dateFormat));
        salesData.push(dailySales[0]?.total || 0);
        purchaseData.push(dailyCOGS[0]?.total || 0);
      }
    } else if (period === 'month') {
      // Monthly data for current year (January to December)
      dateFormat = 'MMM'; // Short month name
      const startOfYear = now.clone().startOf('year'); // January 1st
      
      for (let i = 0; i < 12; i++) {
        const month = startOfYear.clone().add(i, 'months');
        const startOfMonth = month.clone().startOf('month');
        const endOfMonth = month.clone().endOf('month');
        
        // Get sales for this month
        const monthlySales = await Order.aggregate([
          {
            $match: {
              orderStatus: { $ne: 'cancelled' },
              createdAt: { $gte: startOfMonth.toDate(), $lte: endOfMonth.toDate() }
            }
          },
          { $group: { _id: null, total: { $sum: '$totalAmount' } } }
        ]);
        
        // Calculate cost of goods sold for this month
        const monthlyCOGS = await Order.aggregate([
          {
            $match: {
              orderStatus: { $ne: 'cancelled' },
              createdAt: { $gte: startOfMonth.toDate(), $lte: endOfMonth.toDate() }
            }
          },
          {
            $lookup: {
              from: 'products',
              localField: 'productId',
              foreignField: 'productId',
              as: 'product'
            }
          },
          {
            $unwind: '$product'
          },
          {
            $group: {
              _id: null,
              total: {
                $sum: {
                  $multiply: ['$quantityOrdered', '$product.costPrice']
                }
              }
            }
          }
        ]);
        
        chartData.push(month.format(dateFormat));
        salesData.push(monthlySales[0]?.total || 0);
        purchaseData.push(monthlyCOGS[0]?.total || 0);
      }
    } else if (period === 'year') {
      // Monthly data for current year only
      dateFormat = 'MMM YYYY'; // Month with year
      const startOfYear = now.clone().startOf('year'); // January 1st
      
      for (let i = 0; i < 12; i++) {
        const month = startOfYear.clone().add(i, 'months');
        const startOfMonth = month.clone().startOf('month');
        const endOfMonth = month.clone().endOf('month');
        
        // Get sales for this month
        const monthlySales = await Order.aggregate([
          {
            $match: {
              orderStatus: { $ne: 'cancelled' },
              createdAt: { $gte: startOfMonth.toDate(), $lte: endOfMonth.toDate() }
            }
          },
          { $group: { _id: null, total: { $sum: '$totalAmount' } } }
        ]);
        
        // Calculate cost of goods sold for this month
        const monthlyCOGS = await Order.aggregate([
          {
            $match: {
              orderStatus: { $ne: 'cancelled' },
              createdAt: { $gte: startOfMonth.toDate(), $lte: endOfMonth.toDate() }
            }
          },
          {
            $lookup: {
              from: 'products',
              localField: 'productId',
              foreignField: 'productId',
              as: 'product'
            }
          },
          {
            $unwind: '$product'
          },
          {
            $group: {
              _id: null,
              total: {
                $sum: {
                  $multiply: ['$quantityOrdered', '$product.costPrice']
                }
              }
            }
          }
        ]);
        
        chartData.push(month.format(dateFormat));
        salesData.push(monthlySales[0]?.total || 0);
        purchaseData.push(monthlyCOGS[0]?.total || 0);
      }
    }
    
    // Transform data to expected format
    const transformedChartData = chartData.map((label, index) => ({
      label: label,
      sales: salesData[index] || 0,
      purchases: purchaseData[index] || 0,
      profit: (salesData[index] || 0) - (purchaseData[index] || 0)
    }));

    res.json({
      success: true,
      chartData: transformedChartData,
      metadata: {
        period: period,
        totalDataPoints: transformedChartData.length,
        dateRange: `${chartData[0]} to ${chartData[chartData.length - 1]}`,
        totalSales: salesData.reduce((sum, val) => sum + val, 0),
        totalCOGS: purchaseData.reduce((sum, val) => sum + val, 0),
        totalProfit: salesData.reduce((sum, val) => sum + val, 0) - purchaseData.reduce((sum, val) => sum + val, 0)
      }
    });
  } catch (error) {
    console.error('Chart data error:', error);
    res.status(500).json({ error: 'Failed to fetch chart data' });
  }
});

// Top Products by Rating (Descending Order)
router.get('/top-products', async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 5;
    const sortBy = req.query.sortBy || 'rating'; // rating, sales, revenue
    
    let pipeline = [];
    
    if (sortBy === 'rating') {
      // Top products by average rating
      pipeline = [
        {
          $match: {
            status: 'active',
            averageRating: { $gt: 0 }
          }
        },
        {
          $sort: { averageRating: -1, totalRatings: -1 }
        },
        {
          $limit: limit
        },
        {
          $project: {
            productName: 1,
            productId: 1,
            category: 1,
            averageRating: 1,
            totalRatings: 1,
            sellingPrice: 1,
            quantity: 1,
            availability: 1
          }
        }
      ];
    } else {
      // Top products by sales or revenue
      pipeline = [
        {
          $lookup: {
            from: 'orders',
            localField: 'productId',
            foreignField: 'productId',
            as: 'orders'
          }
        },
        {
          $match: {
            status: 'active',
            'orders.orderStatus': { $ne: 'cancelled' }
          }
        },
        {
          $addFields: {
            totalSales: {
              $sum: {
                $map: {
                  input: { $filter: { input: '$orders', cond: { $ne: ['$$this.orderStatus', 'cancelled'] } } },
                  as: 'order',
                  in: '$$order.quantityOrdered'
                }
              }
            },
            totalRevenue: {
              $sum: {
                $map: {
                  input: { $filter: { input: '$orders', cond: { $ne: ['$$this.orderStatus', 'cancelled'] } } },
                  as: 'order',
                  in: '$$order.totalAmount'
                }
              }
            }
          }
        },
        {
          $sort: sortBy === 'sales' ? { totalSales: -1 } : { totalRevenue: -1 }
        },
        {
          $limit: limit
        },
        {
          $project: {
            productName: 1,
            productId: 1,
            category: 1,
            averageRating: 1,
            totalRatings: 1,
            sellingPrice: 1,
            quantity: 1,
            availability: 1,
            totalSales: 1,
            totalRevenue: 1
          }
        }
      ];
    }
    
    const topProducts = await Product.aggregate(pipeline);
    
    res.json({
      sortBy: sortBy,
      products: topProducts
    });
  } catch (error) {
    console.error('Top products error:', error);
    res.status(500).json({ error: 'Failed to fetch top products' });
  }
});

// Update Product Rating (called when order is rated)
router.post('/update-rating/:productId', async (req, res) => {
  try {
    const { productId } = req.params;
    const { orderId, rating, review } = req.body;
    
    // Validate rating
    if (!rating || rating < 1 || rating > 5) {
      return res.status(400).json({ error: 'Rating must be between 1 and 5' });
    }
    
    // Update the order with rating
    const order = await Order.findOne({ orderId: orderId, productId: productId });
    if (!order) {
      return res.status(404).json({ error: 'Order not found' });
    }
    
    // Check if already rated
    if (order.rating) {
      return res.status(400).json({ error: 'Order already rated' });
    }
    
    // Update order with rating
    order.rating = rating;
    order.review = review || '';
    await order.save();
    
    // Update product's average rating
    const product = await Product.findOne({ productId: productId });
    if (product) {
      product.ratingSum += rating;
      product.totalRatings += 1;
      product.averageRating = (product.ratingSum / product.totalRatings).toFixed(1);
      await product.save();
    }
    
    res.json({
      message: 'Rating updated successfully',
      productRating: {
        averageRating: product.averageRating,
        totalRatings: product.totalRatings
      }
    });
  } catch (error) {
    console.error('Update rating error:', error);
    res.status(500).json({ error: 'Failed to update rating' });
  }
});

// Get Product Reviews
router.get('/product-reviews/:productId', async (req, res) => {
  try {
    const { productId } = req.params;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    
    const reviews = await Order.find({
      productId: productId,
      rating: { $exists: true, $ne: null }
    })
    .select('rating review customerInfo.name createdAt')
    .sort({ createdAt: -1 })
    .limit(limit * 1)
    .skip((page - 1) * limit);
    
    const totalReviews = await Order.countDocuments({
      productId: productId,
      rating: { $exists: true, $ne: null }
    });
    
    res.json({
      reviews: reviews,
      currentPage: page,
      totalPages: Math.ceil(totalReviews / limit),
      totalReviews: totalReviews
    });
  } catch (error) {
    console.error('Product reviews error:', error);
    res.status(500).json({ error: 'Failed to fetch product reviews' });
  }
});

module.exports = router;
