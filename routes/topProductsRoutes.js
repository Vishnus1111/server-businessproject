const express = require('express');
const router = express.Router();
const Product = require('../models/Product');

// Get top 6 products by average rating (descending order)
router.get('/top-products', async (req, res) => {
  try {
    const topProducts = await Product.find({
      status: 'active',
      averageRating: { $gt: 0 } // Only products with ratings
    })
    .sort({ averageRating: -1, totalRatings: -1 }) // Sort by highest rating first, then by most ratings
    .limit(6)
    .select({
      productId: 1,
      productName: 1,
      category: 1,
      sellingPrice: 1,
      costPrice: 1,
      quantity: 1,
      availability: 1,
      averageRating: 1,
      totalRatings: 1,
      imageUrl: 1,
      unit: 1
    });

    // Calculate additional metrics for each product
    const enhancedProducts = topProducts.map(product => ({
      ...product.toObject(),
      ratingStars: '★'.repeat(Math.round(product.averageRating)) + '☆'.repeat(5 - Math.round(product.averageRating)),
      ratingPercentage: ((product.averageRating / 5) * 100).toFixed(1),
      isTopRated: product.averageRating >= 4.0,
      popularityScore: (product.averageRating * 0.7) + (Math.min(product.totalRatings / 10, 1) * 0.3)
    }));

    res.json({
      success: true,
      message: 'Top products retrieved successfully',
      products: enhancedProducts,
      metadata: {
        totalProducts: enhancedProducts.length,
        averageRatingAcrossTop: enhancedProducts.length > 0 
          ? (enhancedProducts.reduce((sum, p) => sum + p.averageRating, 0) / enhancedProducts.length).toFixed(2)
          : 0,
        highestRating: enhancedProducts.length > 0 ? enhancedProducts[0].averageRating : 0,
        lowestRating: enhancedProducts.length > 0 ? enhancedProducts[enhancedProducts.length - 1].averageRating : 0
      }
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

// Get all products sorted by rating (for admin/analysis)
router.get('/products-by-rating', async (req, res) => {
  try {
    const { page = 1, limit = 20, minRating = 0 } = req.query;
    
    const products = await Product.find({
      status: 'active',
      averageRating: { $gte: parseFloat(minRating) }
    })
    .sort({ averageRating: -1, totalRatings: -1 })
    .limit(limit * 1)
    .skip((page - 1) * limit)
    .select({
      productId: 1,
      productName: 1,
      category: 1,
      sellingPrice: 1,
      averageRating: 1,
      totalRatings: 1,
      availability: 1
    });

    const totalProducts = await Product.countDocuments({
      status: 'active',
      averageRating: { $gte: parseFloat(minRating) }
    });

    res.json({
      success: true,
      products: products,
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(totalProducts / limit),
        totalProducts: totalProducts,
        hasNext: page * limit < totalProducts,
        hasPrev: page > 1
      }
    });

  } catch (error) {
    console.error('Error fetching products by rating:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch products by rating',
      error: error.message
    });
  }
});

// Get rating statistics for a specific product
router.get('/product/:productId/ratings', async (req, res) => {
  try {
    const { productId } = req.params;
    
    const product = await Product.findOne({ productId: productId })
      .select('productName averageRating totalRatings ratingSum');
    
    if (!product) {
      return res.status(404).json({
        success: false,
        message: 'Product not found'
      });
    }

    // Get rating distribution from orders
    const Order = require('../models/Order');
    const ratingDistribution = await Order.aggregate([
      { $match: { productId: productId, rating: { $exists: true, $ne: null } } },
      { $group: { _id: '$rating', count: { $sum: 1 } } },
      { $sort: { _id: -1 } }
    ]);

    const distributionMap = {};
    for (let i = 1; i <= 5; i++) {
      distributionMap[i] = 0;
    }
    ratingDistribution.forEach(item => {
      distributionMap[item._id] = item.count;
    });

    res.json({
      success: true,
      product: {
        productId: product.productId,
        productName: product.productName,
        averageRating: product.averageRating,
        totalRatings: product.totalRatings,
        ratingSum: product.ratingSum
      },
      ratingDistribution: distributionMap,
      ratingBreakdown: {
        fiveStars: distributionMap[5],
        fourStars: distributionMap[4],
        threeStars: distributionMap[3],
        twoStars: distributionMap[2],
        oneStar: distributionMap[1]
      }
    });

  } catch (error) {
    console.error('Error fetching product ratings:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch product ratings',
      error: error.message
    });
  }
});

module.exports = router;
