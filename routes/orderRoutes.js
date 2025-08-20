const express = require('express');
const router = express.Router();
const Product = require('../models/Product');
const Order = require('../models/Order');

// Get product details for ordering (including image and description)
router.get('/product/:productId', async (req, res) => {
  try {
    const { productId } = req.params;
    
    const product = await Product.findOne({ productId: productId });
    
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
router.post('/check-availability', async (req, res) => {
  try {
    const { productId, requestedQuantity } = req.body;

    if (!productId || !requestedQuantity || requestedQuantity < 1) {
      return res.status(400).json({
        success: false,
        message: 'Product ID and valid quantity are required'
      });
    }

    const product = await Product.findOne({ productId: productId });
    
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
router.post('/place-order', async (req, res) => {
  try {
    const { 
      productId, 
      quantityOrdered
    } = req.body;

    // Validation
    if (!productId || !quantityOrdered) {
      return res.status(400).json({
        success: false,
        message: 'Product ID and quantity are required'
      });
    }

    if (quantityOrdered < 1) {
      return res.status(400).json({
        success: false,
        message: 'Quantity must be at least 1'
      });
    }

    // Find the product
    const product = await Product.findOne({ productId: productId });
    
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
    const order = new Order({
      productId: product.productId,
      productName: product.productName,
      quantityOrdered: quantityOrdered,
      pricePerUnit: pricePerUnit,
      totalAmount: totalAmount
    });

    // Save the order
    await order.save();

    // Update product quantity
    product.quantity -= quantityOrdered;
    
    // Update product availability based on new quantity
    if (product.quantity === 0) {
      product.availability = 'Out of stock';
    } else if (product.quantity <= product.thresholdValue) {
      product.availability = 'Low stock';
    } else {
      product.availability = 'In stock';
    }

    await product.save();

    res.status(201).json({
      success: true,
      message: 'Order placed successfully',
      order: {
        orderId: order.orderId,
        productName: order.productName,
        quantityOrdered: order.quantityOrdered,
        totalAmount: order.totalAmount,
        orderStatus: order.orderStatus,
        orderDate: order.orderDate
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
router.get('/order/:orderId', async (req, res) => {
  try {
    const { orderId } = req.params;
    
    const order = await Order.findOne({ orderId: orderId });
    
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
router.get('/orders', async (req, res) => {
  try {
    const { status, page = 1, limit = 10 } = req.query;
    
    let filter = {};
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
router.patch('/order/:orderId/status', async (req, res) => {
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

    const order = await Order.findOne({ orderId: orderId });
    
    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'Order not found'
      });
    }

    // If cancelling an order, return the quantity back to inventory
    if (status === 'cancelled' && order.orderStatus !== 'cancelled') {
      const product = await Product.findOne({ productId: order.productId });
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
