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
  price: {
    type: Number,
    required: true,
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
    enum: ['In stock', 'Out of stock', 'Low stock'],
    default: function() {
      if (this.quantity === 0) return 'Out of stock';
      if (this.quantity <= this.thresholdValue) return 'Low stock';
      return 'In stock';
    }
  },
  imageUrl: {
    type: String,
    default: null
  }
}, {
  timestamps: true
});

// Update availability before saving
productSchema.pre('save', function(next) {
  if (this.quantity === 0) {
    this.availability = 'Out of stock';
  } else if (this.quantity <= this.thresholdValue) {
    this.availability = 'Low stock';
  } else {
    this.availability = 'In stock';
  }
  next();
});

module.exports = mongoose.model("Product", productSchema);
