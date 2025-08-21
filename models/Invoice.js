const mongoose = require('mongoose');

const invoiceSchema = new mongoose.Schema({
  invoiceId: {
    type: String,
    unique: true,
    required: false  // Auto-generated in pre-save
  },
  referenceNumber: {
    type: String,
    unique: true,
    required: false  // Auto-generated in pre-save
  },
  orderId: {
    type: String,
    required: true,
    ref: 'Order'
  },
  productId: {
    type: String,
    required: true,
    ref: 'Product'
  },
  productName: {
    type: String,
    required: true
  },
  customerInfo: {
    name: {
      type: String,
      required: false,
      default: 'Guest Customer'
    },
    email: {
      type: String,
      required: false,
      default: ''
    },
    phone: {
      type: String,
      required: false,
      default: ''
    }
  },
  quantityOrdered: {
    type: Number,
    required: true,
    min: 1
  },
  pricePerUnit: {
    type: Number,
    required: true
  },
  totalAmount: {
    type: Number,
    required: true
  },
  status: {
    type: String,
    enum: ['Paid', 'Unpaid', 'Cancelled', 'Returned'],
    default: 'Unpaid'
  },
  orderDate: {
    type: Date,
    required: true
  },
  dueDate: {
    type: Date,
    required: false  // Auto-calculated in pre-save
  },
  paidDate: {
    type: Date,
    default: null
  },
  notes: {
    type: String,
    default: ''
  }
}, {
  timestamps: true
});

// Generate invoice ID and reference number before saving
invoiceSchema.pre('save', function(next) {
  if (this.isNew) {
    // Generate Invoice ID: INV-1001, INV-1002, etc.
    const timestamp = Date.now().toString().slice(-4);
    const random = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
    this.invoiceId = `INV-${timestamp}${random.slice(0,1)}`;
    
    // Generate Reference Number: INV-052, INV-047, etc.
    const refRandom = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
    this.referenceNumber = `INV-${refRandom}`;
    
    // Calculate due date (15 days from order date)
    const dueDate = new Date(this.orderDate);
    dueDate.setDate(dueDate.getDate() + 15);
    this.dueDate = dueDate;
  }
  next();
});

module.exports = mongoose.model('Invoice', invoiceSchema);
