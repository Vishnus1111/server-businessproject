const mongoose = require('mongoose');

const orderSchema = new mongoose.Schema({
  orderId: {
    type: String,
    unique: true,
    required: false
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
  orderStatus: {
    type: String,
    enum: ['pending', 'confirmed', 'shipped', 'delivered', 'cancelled'],
    default: 'pending'
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
    },
    address: {
      type: String,
      required: false,
      default: ''
    }
  },
  orderDate: {
    type: Date,
    default: Date.now
  },
  notes: {
    type: String,
    default: ''
  },
  rating: {
    type: Number,
    required: true,
    min: 1,
    max: 5,
    validate: {
      validator: function(v) {
        return Number.isInteger(v) && v >= 1 && v <= 5;
      },
      message: 'Rating must be an integer between 1 and 5'
    }
  },
  review: {
    type: String,
    default: ''
  }
}, {
  timestamps: true
});

// Generate order ID before saving
orderSchema.pre('save', function(next) {
  if (!this.orderId) {
    const timestamp = Date.now().toString(36);
    const random = Math.random().toString(36).substr(2, 5);
    this.orderId = `ORD-${timestamp}-${random}`.toUpperCase();
  }
  next();
});

module.exports = mongoose.model('Order', orderSchema);
