const express = require('express');
const router = express.Router();
const Invoice = require('../models/Invoice');
const Order = require('../models/Order');
const Product = require('../models/Product');

// Get all invoices with optional filtering
router.get('/', async (req, res) => {
  try {
    // Filter options
    const filter = {};
    if (req.query.status) {
      filter.status = req.query.status;
    }
    if (req.query.search) {
      filter.$or = [
        { invoiceId: { $regex: req.query.search, $options: 'i' } },
        { referenceNumber: { $regex: req.query.search, $options: 'i' } },
        { productName: { $regex: req.query.search, $options: 'i' } },
        { 'customerInfo.name': { $regex: req.query.search, $options: 'i' } }
      ];
    }

    const invoices = await Invoice.find(filter)
      .sort({ createdAt: -1 });

    res.json({
      success: true,
      invoices: invoices,
      totalInvoices: invoices.length
    });

  } catch (error) {
    console.error('Error fetching invoices:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch invoices',
      error: error.message
    });
  }
});

// Search invoices across all fields
router.get('/search', async (req, res) => {
  try {
    const { query, page = 1, limit = 20, status } = req.query;
    
    if (!query || query.trim() === '') {
      return res.status(400).json({
        success: false,
        message: "Search query is required"
      });
    }

    const searchRegex = new RegExp(query.trim(), 'i'); // Case-insensitive search
    const pageNumber = parseInt(page);
    const limitNumber = parseInt(limit);
    const skip = (pageNumber - 1) * limitNumber;

    // Build search conditions
    const searchConditions = {
      $or: [
        { invoiceId: searchRegex },
        { referenceNumber: searchRegex },
        { orderId: searchRegex },
        { productId: searchRegex },
        { productName: searchRegex },
        { 'customerInfo.name': searchRegex },
        { 'customerInfo.email': searchRegex },
        { 'customerInfo.phone': searchRegex },
        { status: searchRegex },
        { notes: searchRegex },
        // Search in numeric fields by converting to string
        { $expr: { $regexMatch: { input: { $toString: "$quantityOrdered" }, regex: query.trim(), options: "i" } } },
        { $expr: { $regexMatch: { input: { $toString: "$pricePerUnit" }, regex: query.trim(), options: "i" } } },
        { $expr: { $regexMatch: { input: { $toString: "$totalAmount" }, regex: query.trim(), options: "i" } } }
      ]
    };

    // Add status filter if provided
    if (status && status !== 'all') {
      searchConditions.status = status;
    }

    // Get total count for pagination
    const totalInvoices = await Invoice.countDocuments(searchConditions);
    
    // Get invoices with pagination
    const invoices = await Invoice.find(searchConditions)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limitNumber);

    const totalPages = Math.ceil(totalInvoices / limitNumber);

    // Calculate search statistics
    const searchStats = {
      totalFound: totalInvoices,
      byStatus: {}
    };

    // Get count by status for the search results
    const statusCounts = await Invoice.aggregate([
      { $match: searchConditions },
      { $group: { _id: '$status', count: { $sum: 1 } } }
    ]);

    statusCounts.forEach(item => {
      searchStats.byStatus[item._id] = item.count;
    });

    res.json({
      success: true,
      query: query.trim(),
      results: {
        invoices,
        statistics: searchStats,
        pagination: {
          currentPage: pageNumber,
          totalPages,
          totalInvoices,
          invoicesPerPage: limitNumber,
          hasNext: pageNumber < totalPages,
          hasPrevious: pageNumber > 1
        }
      }
    });

  } catch (error) {
    console.error('Error searching invoices:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to search invoices',
      error: error.message
    });
  }
});

// Get invoice statistics for dashboard
router.get('/stats', async (req, res) => {
  try {
    const days = 7; // Fixed to 7 days as per dashboard requirements
    const daysAgo = new Date();
    daysAgo.setDate(daysAgo.getDate() - days);

    // Recent transactions (last 7 days)
    const recentTransactions = await Invoice.countDocuments({
      createdAt: { $gte: daysAgo }
    });

    // Total invoices count
    const totalInvoicesCount = await Invoice.countDocuments();
    
    // Processed invoices (Paid + Cancelled + Returned)
    const processedInvoices = await Invoice.countDocuments({
      status: { $in: ['Paid', 'Cancelled', 'Returned'] }
    });

    // Paid amount calculation
    const paidAmountData = await Invoice.aggregate([
      {
        $match: {
          status: 'Paid',
          createdAt: { $gte: daysAgo }
        }
      },
      {
        $group: {
          _id: null,
          totalPaidAmount: { $sum: '$totalAmount' },
          paidCustomers: { $sum: 1 }
        }
      }
    ]);

    // Unpaid amount calculation
    const unpaidAmountData = await Invoice.aggregate([
      {
        $match: {
          status: 'Unpaid'
        }
      },
      {
        $group: {
          _id: null,
          totalUnpaidAmount: { $sum: '$totalAmount' },
          unpaidCount: { $sum: 1 }
        }
      }
    ]);

    // Pending payments (overdue invoices)
    const today = new Date();
    const pendingPayments = await Invoice.countDocuments({
      status: 'Unpaid',
      dueDate: { $lt: today }
    });

    const stats = {
      success: true,
      period: `Last ${days} days`,
      recentTransactions: {
        count: recentTransactions,
        period: `Last ${days} days`
      },
      totalInvoices: {
        total: totalInvoicesCount,
        processed: processedInvoices
      },
      paidAmount: {
        amount: paidAmountData[0]?.totalPaidAmount || 0,
        customers: paidAmountData[0]?.paidCustomers || 0,
        period: `Last ${days} days`
      },
      unpaidAmount: {
        amount: unpaidAmountData[0]?.totalUnpaidAmount || 0,
        count: unpaidAmountData[0]?.unpaidCount || 0,
        pendingPayments: pendingPayments
      }
    };

    res.json(stats);

  } catch (error) {
    console.error('Error fetching invoice stats:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch invoice statistics',
      error: error.message
    });
  }
});

// Get single invoice by ID
router.get('/:invoiceId', async (req, res) => {
  try {
    const invoice = await Invoice.findOne({ invoiceId: req.params.invoiceId });
    
    if (!invoice) {
      return res.status(404).json({
        success: false,
        message: 'Invoice not found'
      });
    }

    res.json({
      success: true,
      invoice: invoice
    });

  } catch (error) {
    console.error('Error fetching invoice:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch invoice',
      error: error.message
    });
  }
});

// Create invoice from order (automatically called when order is placed)
router.post('/create-from-order', async (req, res) => {
  try {
    const { orderId } = req.body;

    if (!orderId) {
      return res.status(400).json({
        success: false,
        message: 'Order ID is required'
      });
    }

    // Check if invoice already exists for this order
    const existingInvoice = await Invoice.findOne({ orderId: orderId });
    if (existingInvoice) {
      return res.status(400).json({
        success: false,
        message: 'Invoice already exists for this order',
        invoice: existingInvoice
      });
    }

    // Get order details
    const order = await Order.findOne({ orderId: orderId });
    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'Order not found'
      });
    }

    // Create invoice from order data
    const invoiceData = {
      orderId: order.orderId,
      productId: order.productId,
      productName: order.productName,
      customerInfo: order.customerInfo,
      quantityOrdered: order.quantityOrdered,
      pricePerUnit: order.pricePerUnit,
      totalAmount: order.totalAmount,
      orderDate: order.createdAt,
      status: 'Unpaid'
    };

    const invoice = new Invoice(invoiceData);
    await invoice.save();

    res.status(201).json({
      success: true,
      message: 'Invoice created successfully',
      invoice: invoice
    });

  } catch (error) {
    console.error('Error creating invoice:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create invoice',
      error: error.message
    });
  }
});

// Mark invoice as paid
router.patch('/:invoiceId/pay', async (req, res) => {
  try {
    const { invoiceId } = req.params;
    const { notes } = req.body;

    const invoice = await Invoice.findOne({ invoiceId: invoiceId });
    
    if (!invoice) {
      return res.status(404).json({
        success: false,
        message: 'Invoice not found'
      });
    }

    if (invoice.status === 'Paid') {
      return res.status(400).json({
        success: false,
        message: 'Invoice is already paid'
      });
    }

    if (invoice.status === 'Cancelled' || invoice.status === 'Returned') {
      return res.status(400).json({
        success: false,
        message: `Cannot pay a ${invoice.status.toLowerCase()} invoice`
      });
    }

    // Update invoice status to paid
    invoice.status = 'Paid';
    invoice.paidDate = new Date();
    if (notes) {
      invoice.notes = notes;
    }

    await invoice.save();

    res.json({
      success: true,
      message: 'Invoice marked as paid successfully',
      invoice: invoice
    });

  } catch (error) {
    console.error('Error marking invoice as paid:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to mark invoice as paid',
      error: error.message
    });
  }
});

// Return/Cancel invoice
router.patch('/:invoiceId/return', async (req, res) => {
  try {
    const { invoiceId } = req.params;
    const { action, notes } = req.body; // action: 'return' or 'cancel'

    const invoice = await Invoice.findOne({ invoiceId: invoiceId });
    
    if (!invoice) {
      return res.status(404).json({
        success: false,
        message: 'Invoice not found'
      });
    }

    if (invoice.status === 'Paid') {
      return res.status(400).json({
        success: false,
        message: 'Cannot return/cancel a paid invoice'
      });
    }

    if (invoice.status === 'Cancelled' || invoice.status === 'Returned') {
      return res.status(400).json({
        success: false,
        message: `Invoice is already ${invoice.status.toLowerCase()}`
      });
    }

    // Update invoice status
    if (action === 'return') {
      invoice.status = 'Returned';
    } else {
      invoice.status = 'Cancelled';
    }

    if (notes) {
      invoice.notes = notes;
    }

    await invoice.save();

    // Also update the corresponding order status
    const order = await Order.findOne({ orderId: invoice.orderId });
    if (order) {
      order.orderStatus = 'cancelled';
      await order.save();

      // Restore product quantity
      const product = await Product.findOne({ productId: invoice.productId });
      if (product) {
        product.quantity += invoice.quantityOrdered;
        await product.save();
      }
    }

    res.json({
      success: true,
      message: `Invoice ${action === 'return' ? 'returned' : 'cancelled'} successfully`,
      invoice: invoice
    });

  } catch (error) {
    console.error('Error processing invoice return/cancel:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to process invoice return/cancel',
      error: error.message
    });
  }
});

// Get overdue invoices
router.get('/reports/overdue', async (req, res) => {
  try {
    const today = new Date();
    
    const overdueInvoices = await Invoice.find({
      status: 'Unpaid',
      dueDate: { $lt: today }
    }).sort({ dueDate: 1 });

    const totalOverdueAmount = overdueInvoices.reduce((sum, invoice) => sum + invoice.totalAmount, 0);

    res.json({
      success: true,
      overdueInvoices: overdueInvoices,
      totalOverdueAmount: totalOverdueAmount,
      count: overdueInvoices.length
    });

  } catch (error) {
    console.error('Error fetching overdue invoices:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch overdue invoices',
      error: error.message
    });
  }
});

// Get detailed invoice view (for invoice display/printing)
router.get('/:invoiceId/view', async (req, res) => {
  try {
    const { invoiceId } = req.params;

    // Find the invoice
    const invoice = await Invoice.findOne({ invoiceId: invoiceId });
    
    if (!invoice) {
      return res.status(404).json({
        success: false,
        message: 'Invoice not found'
      });
    }

    // Get product details
    const product = await Product.findOne({ productId: invoice.productId });
    
    // Get order details for additional information
    const order = await Order.findOne({ orderId: invoice.orderId });

    // Format the invoice data for display
    const invoiceView = {
      // Invoice header information
      invoiceInfo: {
        invoiceId: invoice.invoiceId,
        referenceNumber: invoice.referenceNumber,
        invoiceDate: invoice.orderDate,
        dueDate: invoice.dueDate,
        status: invoice.status
      },

      // Business information (you can customize this)
      businessInfo: {
        name: "Your Business Name",
        address: "City, State, PIN - 000 000",
        taxId: "TAX ID 000000XX1234000XX",
        contact: {
          phone: "+91 00000 00000",
          email: "hello@email.com"
        }
      },

      // Customer information
      customerInfo: {
        name: invoice.customerInfo.name || 'Guest Customer',
        email: invoice.customerInfo.email || '',
        phone: invoice.customerInfo.phone || '',
        address: order?.customerInfo?.address || ''
      },

      // Product details
      products: [
        {
          name: invoice.productName,
          productId: invoice.productId,
          quantity: invoice.quantityOrdered,
          pricePerUnit: invoice.pricePerUnit,
          totalAmount: invoice.totalAmount,
          unit: product?.unit || 'pcs'
        }
      ],

      // Calculation breakdown
      calculations: {
        subtotal: invoice.totalAmount,
        taxRate: 0.15, // 15% tax rate (you can customize this)
        taxAmount: Math.round(invoice.totalAmount * 0.15 * 100) / 100,
        totalDue: Math.round((invoice.totalAmount * 1.15) * 100) / 100
      },

      // Payment information
      paymentInfo: {
        status: invoice.status,
        paidDate: invoice.paidDate,
        paymentMethod: order?.paymentMethod || '',
        notes: invoice.notes || ''
      },

      // Additional metadata
      metadata: {
        createdAt: invoice.createdAt,
        updatedAt: invoice.updatedAt,
        orderDate: invoice.orderDate
      }
    };

    // Add a note about payment terms
    invoiceView.paymentTerms = "Please pay within 15 days of receiving this invoice.";

    res.json({
      success: true,
      invoice: invoiceView
    });

  } catch (error) {
    console.error('Error fetching invoice view:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch invoice view',
      error: error.message
    });
  }
});

module.exports = router;
