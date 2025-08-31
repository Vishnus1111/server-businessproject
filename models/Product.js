const mongoose = require("mongoose");

const productSchema = new mongoose.Schema({
  // Ownership fields for per-account isolation
  ownerEmail: { type: String, index: true },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', index: true },
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
  description: {
    type: String,
    trim: true,
    default: ''
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
  },
  averageRating: {
    type: Number,
    min: 0,
    max: 5,
    default: 0
  },
  totalRatings: {
    type: Number,
    default: 0
  },
  ratingSum: {
    type: Number,
    default: 0
  }
}, {
  timestamps: true
});

// Update availability and status before saving
productSchema.pre('save', function(next) {
  try {
    console.log(`Pre-save hook for product: ${this.productName}`);
    
    // Ensure all dates are valid Date objects
    if (!(this.expiryDate instanceof Date) || isNaN(this.expiryDate)) {
      console.error(`Invalid expiry date for product ${this.productName}: ${this.expiryDate}`);
      this.expiryDate = new Date(this.expiryDate);
      if (isNaN(this.expiryDate)) {
        throw new Error(`Invalid expiry date format: ${this.expiryDate}`);
      }
    }
    
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
      console.log(`Product ${this.productName} marked as expired (${expiryDateOnly} < ${today})`);
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
      console.log(`Product ${this.productName} availability set to: ${this.availability}`);
    }
    
    this.lastStatusCheck = new Date();
    next();
  } catch (error) {
    console.error(`Error in Product pre-save hook: ${error.message}`);
    next(error); // Pass error to next middleware
  }
});

module.exports = mongoose.model("Product", productSchema);
