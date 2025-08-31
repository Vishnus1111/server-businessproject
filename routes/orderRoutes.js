const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const Product = require('../models/Product');
const Order = require('../models/Order');
const Invoice = require('../models/Invoice');
const SalesPurchase = require('../models/SalesPurchase');
const SimpleSalesPurchase = require('../models/SimpleSalesPurchase');

// Get product details for ordering (including image and description)
router.get('/product/:productId', auth, async (req, res) => {
  try {
    const { productId } = req.params;
    
  const product = await Product.findOne({ productId: productId, ownerEmail: req.user.email });
    
    if (!product) {
      return res.status(404).json({
        success: false,
        message: 'Product not found'
      });
    }

    // Check if product is available for ordering
    const isAvailable = product.status === 'active' && 
                       product.availability !== 'Out of stock' && 
                       product.availability !== 'Expired';

    // Transform product data for ordering
    const productData = {
      _id: product._id,
      productId: product.productId,
      productName: product.productName,
      category: product.category,
      description: product.description || 'Description not available',
      sellingPrice: product.sellingPrice || product.price, // Use sellingPrice if available, fallback to price
      quantity: product.quantity,
      unit: product.unit,
      imageUrl: product.imageUrl || null,
      availability: product.availability,
      status: product.status,
      isAvailable: isAvailable,
      expiryDate: product.expiryDate
    };

    res.json({
      success: true,
      product: productData
    });

  } catch (error) {
    console.error('Error fetching product details:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch product details',
      error: error.message
    });
  }
});

// Check product availability before ordering
router.post('/check-availability', auth, async (req, res) => {
  try {
    const { productId, requestedQuantity } = req.body;

    if (!productId || !requestedQuantity || requestedQuantity < 1) {
      return res.status(400).json({
        success: false,
        message: 'Product ID and valid quantity are required'
      });
    }

  const product = await Product.findOne({ productId: productId, ownerEmail: req.user.email });
    
    if (!product) {
      return res.status(404).json({
        success: false,
        message: 'Product not found'
      });
    }

    // Check if product is active and not expired
    if (product.status !== 'active') {
      return res.status(400).json({
        success: false,
        message: 'Product is not available for ordering',
        availableQuantity: 0
      });
    }

    if (product.availability === 'Expired') {
      return res.status(400).json({
        success: false,
        message: 'Product has expired and cannot be ordered',
        availableQuantity: 0
      });
    }

    if (product.availability === 'Out of stock' || product.quantity === 0) {
      return res.status(400).json({
        success: false,
        message: 'Product is out of stock',
        availableQuantity: 0
      });
    }

    // Check if requested quantity is available
    if (requestedQuantity > product.quantity) {
      return res.status(400).json({
        success: false,
        message: `Only ${product.quantity} units available. Please order accordingly.`,
        availableQuantity: product.quantity,
        requestedQuantity: requestedQuantity
      });
    }

    res.json({
      success: true,
      message: 'Product is available for ordering',
      availableQuantity: product.quantity,
      requestedQuantity: requestedQuantity,
      canOrder: true
    });

  } catch (error) {
    console.error('Error checking availability:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to check product availability',
      error: error.message
    });
  }
});

// Place an order
router.post('/place-order', auth, async (req, res) => {
  try {
    const { 
      productId, 
      quantityOrdered,
      rating,
      review,
      customerInfo
    } = req.body;

    // Validation
    if (!productId || !quantityOrdered || rating === undefined || rating === null) {
      return res.status(400).json({
        success: false,
        message: 'Product ID, quantity, and rating are required'
      });
    }

    if (quantityOrdered < 1) {
      return res.status(400).json({
        success: false,
        message: 'Quantity must be at least 1'
      });
    }

    // Validate rating (mandatory field)
    if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
      return res.status(400).json({
        success: false,
        message: 'Rating is required and must be an integer between 1 and 5'
      });
    }

    // Find the product
  const product = await Product.findOne({ productId: productId, ownerEmail: req.user.email });
    
    if (!product) {
      return res.status(404).json({
        success: false,
        message: 'Product not found'
      });
    }

    // Check product availability
    if (product.status !== 'active') {
      return res.status(400).json({
        success: false,
        message: 'Product is not available for ordering'
      });
    }

    if (product.availability === 'Expired') {
      return res.status(400).json({
        success: false,
        message: 'Product has expired and cannot be ordered'
      });
    }

    if (product.availability === 'Out of stock' || product.quantity === 0) {
      return res.status(400).json({
        success: false,
        message: 'Product is out of stock'
      });
    }

    // Check if enough quantity is available
    if (quantityOrdered > product.quantity) {
      return res.status(400).json({
        success: false,
        message: `Only ${product.quantity} units available. Please order accordingly.`,
        availableQuantity: product.quantity
      });
    }

    // Calculate total amount
    const pricePerUnit = product.sellingPrice || product.price;
    const totalAmount = pricePerUnit * quantityOrdered;

    // Create the order
    const orderData = {
      productId: product.productId,
      productName: product.productName,
      quantityOrdered: quantityOrdered,
      pricePerUnit: pricePerUnit,
      totalAmount: totalAmount,
      rating: rating, // Mandatory field
      ownerEmail: req.user.email,
      userId: req.user.id
    };

    // Add optional fields if provided
    if (review) {
      orderData.review = review;
    }
    
    if (customerInfo) {
      orderData.customerInfo = customerInfo;
    }

    const order = new Order(orderData);

    // Save the order
    await order.save();

    // Track sales for analytics (FIXED - Using SimpleSalesPurchase)
    try {
      console.log(`🔍 Tracking Sale (Fixed): ${order.productName}`);
      console.log(`💰 Sale Amount: ₹${order.pricePerUnit} × ${order.quantityOrdered} = ₹${order.totalAmount}`);
      
      // Get the cost price from the product to calculate profit correctly
  const product = await Product.findOne({ productId: order.productId, ownerEmail: req.user.email });
      
      if (!product) {
        console.warn(`⚠️ Cannot find product ${order.productId} to calculate profit. Using default profit calculation.`);
      }
      
      // Calculate profit as selling price - cost price
      const costPrice = product ? product.costPrice : 0;
      const profit = (order.pricePerUnit - costPrice) * order.quantityOrdered;
      
      console.log(`💵 Profit calculation: (${order.pricePerUnit} - ${costPrice}) × ${order.quantityOrdered} = ₹${profit}`);
      
      // Create order data compatible with SimpleSalesPurchase.addSale
      const salesTrackingData = {
        _id: order._id,
        userId: order.userId,
        costPrice: costPrice, // Add cost price for profit calculation
        items: [{
          productId: order.productId,
          name: order.productName,
          quantity: order.quantityOrdered,
          price: order.pricePerUnit,
          costPrice: costPrice, // Include cost price for each item
          profit: profit // Include the calculated profit
        }]
      };
      
  const trackingResult = await SimpleSalesPurchase.addSale(salesTrackingData, req.user);
      console.log(`✅ Sale tracked successfully (Fixed):`, {
        productName: order.productName,
        amount: order.totalAmount,
        profit: profit,
        recordsCreated: trackingResult.length
      });
    } catch (trackingError) {
      console.error('❌ Error tracking sale (Fixed):', trackingError);
      // Don't fail order if tracking fails
    }

    // Update product quantity
    product.quantity -= quantityOrdered;
    
    // Update product ratings with the new rating
    product.totalRatings += 1;
    product.ratingSum += rating;
    product.averageRating = product.ratingSum / product.totalRatings;
    
    // Update product availability based on new quantity
    if (product.quantity === 0) {
      product.availability = 'Out of stock';
    } else if (product.quantity <= product.thresholdValue) {
      product.availability = 'Low stock';
    } else {
      product.availability = 'In stock';
    }

    await product.save();

  // Create invoice automatically (Force restart test v2)
    try {
      const invoiceData = {
        orderId: order.orderId,
        productId: product.productId,
        productName: product.productName,
        customerInfo: {
          name: 'Guest Customer',
          email: '',
          phone: ''
        },
        quantityOrdered: quantityOrdered,
        pricePerUnit: pricePerUnit,
        totalAmount: totalAmount,
        orderDate: order.createdAt,
        status: 'Unpaid',
        ownerEmail: req.user.email,
        userId: req.user.id
      };

      console.log('🔄 Creating invoice with data:', JSON.stringify(invoiceData, null, 2));

      const invoice = new Invoice(invoiceData);
      await invoice.save();

      console.log(`✅ Invoice created automatically: ${invoice.invoiceId} for order ${order.orderId}`);
    } catch (invoiceError) {
      console.error('❌ Error creating invoice:', invoiceError);
      console.error('Invoice error details:', invoiceError.message);
      // Don't fail the order if invoice creation fails, just log it
    }

    res.status(201).json({
      success: true,
      message: 'Order placed successfully',
      order: {
        orderId: order.orderId,
        productName: order.productName,
        quantityOrdered: order.quantityOrdered,
        totalAmount: order.totalAmount,
        orderStatus: order.orderStatus,
        orderDate: order.orderDate,
        rating: order.rating,
        review: order.review || '',
        customerInfo: order.customerInfo
      },
      updatedProduct: {
        productId: product.productId,
        productName: product.productName,
        remainingQuantity: product.quantity,
        availability: product.availability
      }
    });

  } catch (error) {
    console.error('Error placing order:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to place order',
      error: error.message
    });
  }
});

// Get order details
router.get('/order/:orderId', auth, async (req, res) => {
  try {
    const { orderId } = req.params;
    
  const order = await Order.findOne({ orderId: orderId, ownerEmail: req.user.email });
    
    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'Order not found'
      });
    }

    res.json({
      success: true,
      order: order
    });

  } catch (error) {
    console.error('Error fetching order details:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch order details',
      error: error.message
    });
  }
});

// Get all orders (for admin/management)
router.get('/orders', auth, async (req, res) => {
  try {
    const { status, page = 1, limit = 10 } = req.query;
    
    let filter = { ownerEmail: req.user.email };
    if (status) {
      filter.orderStatus = status;
    }

    const skip = (page - 1) * limit;
    
    const orders = await Order.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    const totalOrders = await Order.countDocuments(filter);

    res.json({
      success: true,
      orders: orders,
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(totalOrders / limit),
        totalOrders: totalOrders,
        limit: parseInt(limit)
      }
    });

  } catch (error) {
    console.error('Error fetching orders:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch orders',
      error: error.message
    });
  }
});

// Update order status
router.patch('/order/:orderId/status', auth, async (req, res) => {
  try {
    const { orderId } = req.params;
    const { status } = req.body;

    const validStatuses = ['pending', 'confirmed', 'shipped', 'delivered', 'cancelled'];
    
    if (!status || !validStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        message: 'Valid status is required',
        validStatuses: validStatuses
      });
    }

  const order = await Order.findOne({ orderId: orderId, ownerEmail: req.user.email });
    
    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'Order not found'
      });
    }

    // If cancelling an order, return the quantity back to inventory
    if (status === 'cancelled' && order.orderStatus !== 'cancelled') {
  const product = await Product.findOne({ productId: order.productId, ownerEmail: req.user.email });
      if (product) {
        product.quantity += order.quantityOrdered;
        
        // Update availability based on new quantity
        if (product.quantity === 0) {
          product.availability = 'Out of stock';
        } else if (product.quantity <= product.thresholdValue) {
          product.availability = 'Low stock';
        } else {
          product.availability = 'In stock';
        }
        
        await product.save();
      }
    }

    order.orderStatus = status;
    await order.save();

    res.json({
      success: true,
      message: 'Order status updated successfully',
      order: {
        orderId: order.orderId,
        orderStatus: order.orderStatus,
        updatedAt: order.updatedAt
      }
    });

  } catch (error) {
    console.error('Error updating order status:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update order status',
      error: error.message
    });
  }
});

module.exports = router;
