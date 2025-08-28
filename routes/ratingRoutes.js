const express = require('express');
const router = express.Router();
const Product = require('../models/Product');
const Order = require('../models/Order');

// Rate a product directly without requiring a previous order
router.post('/rate-product', async (req, res) => {
  try {
    console.log('Rating request received:', req.body);
    const { productId, rating } = req.body;
    
    // Validate inputs
    if (!productId || !rating || rating < 1 || rating > 5) {
      console.error('Invalid rating inputs:', { productId, rating });
      return res.status(400).json({
        success: false,
        error: 'Product ID and rating (1-5) are required'
      });
    }
    
    // Find the product by either _id or productId
    let product;
    
    // First try to find by MongoDB _id if it looks like a valid ObjectId
    if (productId.match(/^[0-9a-fA-F]{24}$/)) {
      product = await Product.findById(productId);
    }
    
    // If not found, try by productId field
    if (!product) {
      product = await Product.findOne({ productId });
    }
    
    // Still not found
    if (!product) {
      console.error(`Product not found with ID: ${productId}`);
      return res.status(404).json({
        success: false,
        error: 'Product not found'
      });
    }
    
    console.log('Found product:', {
      _id: product._id,
      productId: product.productId,
      name: product.productName
    });
    
    // Create a test order for this rating (this simulates having purchased the product)
    const testOrder = new Order({
      productId: product.productId,
      productName: product.productName,
      quantityOrdered: 1,
      pricePerUnit: product.sellingPrice || product.price,
      totalAmount: product.sellingPrice || product.price,
      orderStatus: 'delivered', // Set as delivered so it can be rated
      customerInfo: {
        name: 'Test Customer'
      },
      rating: rating
    });
    
    await testOrder.save();
    console.log('Test order created for rating:', testOrder._id);
    
    // Update product's average rating
    product.ratingSum = (product.ratingSum || 0) + rating;
    product.totalRatings = (product.totalRatings || 0) + 1;
    product.averageRating = (product.ratingSum / product.totalRatings).toFixed(1);
    await product.save();
    
    res.json({
      success: true,
      message: 'Rating submitted successfully',
      productRating: {
        averageRating: product.averageRating,
        totalRatings: product.totalRatings
      }
    });
    
  } catch (error) {
    console.error('Error rating product:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to submit rating'
    });
  }
});

module.exports = router;
