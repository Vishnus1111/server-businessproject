const mongoose = require("mongoose");

const productSchema = new mongoose.Schema({
  productName: {
    type: String,
    required: true,
    trim: true
  },
  productId: {
    type: String,
    required: true,
    unique: true,
    trim: true
  },
  category: {
    type: String,
    required: true,
    trim: true
  },
  costPrice: {
    type: Number,
    required: true,
    min: 0
  },
  sellingPrice: {
    type: Number,
    required: true,
    min: 0
  },
  // Keep 'price' field for backward compatibility, will use sellingPrice
  price: {
    type: Number,
    required: false,
    min: 0
  },
  quantity: {
    type: Number,
    required: true,
    min: 0
  },
  unit: {
    type: String,
    required: true,
    trim: true
  },
  expiryDate: {
    type: Date,
    required: true
  },
  thresholdValue: {
    type: Number,
    required: true,
    min: 0
  },
  availability: {
    type: String,
    enum: ['In stock', 'Out of stock', 'Low stock', 'Expired'],
    default: function() {
      if (this.quantity === 0) return 'Out of stock';
      if (this.quantity <= this.thresholdValue) return 'Low stock';
      return 'In stock';
    }
  },
  status: {
    type: String,
    enum: ['active', 'expired'],
    default: 'active'
  },
  lastStatusCheck: {
    type: Date,
    default: Date.now
  },
  imageUrl: {
    type: String,
    default: null
  }
}, {
  timestamps: true
});

// Update availability and status before saving
productSchema.pre('save', function(next) {
  const currentDate = new Date();
  const today = new Date(currentDate.getFullYear(), currentDate.getMonth(), currentDate.getDate());
  const expiryDateOnly = new Date(this.expiryDate.getFullYear(), this.expiryDate.getMonth(), this.expiryDate.getDate());
  
  // Set price field to sellingPrice for backward compatibility
  if (this.sellingPrice) {
    this.price = this.sellingPrice;
  }
  
  // Check if product has expired
  if (expiryDateOnly < today) {
    this.status = 'expired';
    this.availability = 'Expired';
  } else {
    this.status = 'active';
    // Update availability based on quantity
    if (this.quantity === 0) {
      this.availability = 'Out of stock';
    } else if (this.quantity <= this.thresholdValue) {
      this.availability = 'Low stock';
    } else {
      this.availability = 'In stock';
    }
  }
  
  this.lastStatusCheck = new Date();
  next();
});

module.exports = mongoose.model("Product", productSchema);
