const express = require("express");
const multer = require("multer");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const Product = require("../models/Product");

const router = express.Router();

// Configure multer for file uploads (images only)
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const uploadDir = path.join(__dirname, "../uploads");
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    cb(null, Date.now() + "-" + file.originalname);
  }
});

const upload = multer({ 
  storage: storage,
  fileFilter: (req, file, cb) => {
    // Only allow image files
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed'), false);
    }
  },
  limits: {
    fileSize: 5 * 1024 * 1024 // 5MB limit
  }
});

// Separate upload configuration for CSV files
const csvUpload = multer({ 
  storage: storage,
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'text/csv' || file.originalname.endsWith('.csv')) {
      cb(null, true);
    } else {
      cb(new Error('Only CSV files are allowed'), false);
    }
  },
  limits: {
    fileSize: 2 * 1024 * 1024 // 2MB limit for CSV
  }
});

// Generate unique product ID
function generateProductId() {
  const timestamp = Date.now().toString(36);
  const random = crypto.randomBytes(3).toString('hex').toUpperCase();
  return `PROD-${timestamp}-${random}`;
}

// Parse date in DD/MM/YY format
function parseDate(dateString) {
  if (!dateString) {
    throw new Error('Date is required');
  }
  
  // Check if date matches DD/MM/YY format
  const dateRegex = /^(\d{1,2})\/(\d{1,2})\/(\d{2})$/;
  const match = dateString.match(dateRegex);
  
  if (!match) {
    throw new Error('Date must be in DD/MM/YY format (e.g., 31/12/25)');
  }
  
  const [, day, month, year] = match;
  
  // Convert 2-digit year to 4-digit year (assuming 20xx)
  const fullYear = 2000 + parseInt(year);
  
  // Create date object (month is 0-indexed in JavaScript)
  const date = new Date(fullYear, parseInt(month) - 1, parseInt(day));
  
  // Validate the date
  if (date.getFullYear() !== fullYear || 
      date.getMonth() !== parseInt(month) - 1 || 
      date.getDate() !== parseInt(day)) {
    throw new Error('Invalid date provided');
  }
  
  return date;
}

// Custom CSV parser using built-in Node.js modules only
function parseCSV(filePath) {
  try {
    const data = fs.readFileSync(filePath, 'utf8');
    const lines = data.trim().split('\n');
    
    if (lines.length === 0) {
      throw new Error('CSV file is empty');
    }
    
    const headers = parseCSVLine(lines[0]);
    const products = [];
    
    for (let i = 1; i < lines.length; i++) {
      const values = parseCSVLine(lines[i]);
      
      if (values.length !== headers.length) {
        console.warn(`Line ${i + 1} has ${values.length} values but expected ${headers.length}. Skipping.`);
        continue;
      }
      
      const product = {};
      headers.forEach((header, index) => {
        product[header.trim()] = values[index].trim();
      });
      
      products.push(product);
    }
    
    return products;
  } catch (error) {
    throw new Error(`Error parsing CSV: ${error.message}`);
  }
}

// Parse a single CSV line handling quoted values
function parseCSVLine(line) {
  const result = [];
  let current = '';
  let inQuotes = false;
  
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    
    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === ',' && !inQuotes) {
      result.push(current);
      current = '';
    } else {
      current += char;
    }
  }
  
  result.push(current);
  return result;
}

// Generate a new product ID (for frontend preview)
router.get("/generate-id", (req, res) => {
  try {
    const productId = generateProductId();
    res.status(200).json({
      success: true,
      productId
    });
  } catch (error) {
    console.error("Error generating product ID:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message
    });
  }
});

// Add a single product via JSON (no image upload)
router.post("/add-single-json", async (req, res) => {
  try {
    console.log("Add single product (JSON) request:", req.body);
    
    const { productName, category, price, quantity, unit, expiryDate, thresholdValue } = req.body;
    
    // Validate required fields
    if (!productName || !category || !price || !unit || !expiryDate || !thresholdValue) {
      return res.status(400).json({
        success: false,
        message: "Missing required fields: productName, category, price, unit, expiryDate (DD/MM/YY), and thresholdValue are required"
      });
    }
    
    // Parse and validate date format
    let parsedDate;
    try {
      parsedDate = parseDate(expiryDate);
    } catch (dateError) {
      return res.status(400).json({
        success: false,
        message: `Date error: ${dateError.message}`
      });
    }
    
    // Generate unique product ID
    const productId = generateProductId();
    
    const product = new Product({
      productName,
      productId,
      category,
      price: parseFloat(price),
      quantity: parseInt(quantity) || 1,
      unit,
      expiryDate: parsedDate,
      thresholdValue: parseInt(thresholdValue),
      imageUrl: null // No images for JSON endpoint
    });
    
    await product.save();
    
    res.status(201).json({
      success: true,
      message: "Product added successfully",
      product
    });
    
  } catch (error) {
    console.error("Error adding single product (JSON):", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message
    });
  }
});

// Test endpoint - basic form-data without file upload
router.post("/add-single-test", (req, res) => {
  try {
    console.log("Test endpoint - Request body:", req.body);
    console.log("Test endpoint - Request headers:", req.headers);
    
    res.status(200).json({
      success: true,
      message: "Test endpoint working",
      receivedData: req.body,
      headers: req.headers['content-type']
    });
  } catch (error) {
    console.error("Test endpoint error:", error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Test file upload endpoint
router.post("/test-file-upload", (req, res) => {
  upload.single('productImage')(req, res, (err) => {
    if (err) {
      console.error("File upload test error:", err);
      return res.status(400).json({
        success: false,
        message: "File upload failed",
        error: err.message
      });
    }
    
    console.log("File upload test - Body:", req.body);
    console.log("File upload test - File:", req.file);
    
    // Clean up test file
    if (req.file) {
      try {
        fs.unlinkSync(req.file.path);
      } catch (cleanupError) {
        console.error("Error cleaning up test file:", cleanupError);
      }
    }
    
    res.status(200).json({
      success: true,
      message: "File upload test successful",
      body: req.body,
      file: req.file ? {
        filename: req.file.filename,
        originalname: req.file.originalname,
        mimetype: req.file.mimetype,
        size: req.file.size
      } : null
    });
  });
});

// Add a single product (with optional image upload only - no URLs)
router.post("/add-single", (req, res) => {
  // Use multer upload as middleware
  upload.single('productImage')(req, res, async (err) => {
    if (err) {
      console.error("Multer error:", err);
      return res.status(400).json({
        success: false,
        message: "File upload error",
        error: err.message
      });
    }

    try {
      console.log("Add single product request:", req.body);
      console.log("Uploaded image:", req.file);
      
      const { productName, category, price, quantity, unit, expiryDate, thresholdValue } = req.body;
      
      // Validate required fields
      if (!productName || !category || !price || !unit || !expiryDate || !thresholdValue) {
        // Clean up uploaded file if validation fails
        if (req.file) {
          try {
            fs.unlinkSync(req.file.path);
          } catch (cleanupError) {
            console.error("Error cleaning up file:", cleanupError);
          }
        }
        
        return res.status(400).json({
          success: false,
          message: "Missing required fields: productName, category, price, unit, expiryDate (DD/MM/YY), and thresholdValue are required"
        });
      }
      
      // Parse and validate date format
      let parsedDate;
      try {
        parsedDate = parseDate(expiryDate);
      } catch (dateError) {
        // Clean up uploaded file if date validation fails
        if (req.file) {
          try {
            fs.unlinkSync(req.file.path);
          } catch (cleanupError) {
            console.error("Error cleaning up file:", cleanupError);
          }
        }
        
        return res.status(400).json({
          success: false,
          message: `Date error: ${dateError.message}`
        });
      }
      
      // Generate unique product ID
      const productId = generateProductId();
      
      // Handle image upload (file only)
      let imageUrl = null;
      if (req.file) {
        imageUrl = `/uploads/${req.file.filename}`;
        console.log("Image saved as:", imageUrl);
      }
      
      const product = new Product({
        productName,
        productId,
        category,
        price: parseFloat(price),
        quantity: parseInt(quantity) || 1,
        unit,
        expiryDate: parsedDate,
        thresholdValue: parseInt(thresholdValue),
        imageUrl
      });
      
      await product.save();
      
      res.status(201).json({
        success: true,
        message: "Product added successfully",
        product
      });
      
    } catch (error) {
      console.error("Error adding single product:", error);
      
      // Clean up uploaded image if product creation fails
      if (req.file) {
        try {
          fs.unlinkSync(req.file.path);
        } catch (cleanupError) {
          console.error("Error cleaning up image:", cleanupError);
        }
      }
      
      res.status(500).json({
        success: false,
        message: "Internal server error",
        error: error.message
      });
    }
  });
});

// Add multiple products via CSV upload (no images)
router.post("/add-multiple", csvUpload.single('csvFile'), async (req, res) => {
  try {
    console.log("Add multiple products request");
    
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: "No CSV file uploaded"
      });
    }
    
    console.log("Uploaded file:", req.file.filename);
    
    // Parse CSV file
    const products = parseCSV(req.file.path);
    console.log(`Parsed ${products.length} products from CSV`);
    
    const results = {
      successful: [],
      failed: [],
      duplicates: []
    };
    
    for (const productData of products) {
      try {
        // Validate required fields (productId should NOT be in CSV)
        if (!productData.productName || !productData.category || !productData.price || 
            !productData.unit || !productData.expiryDate || !productData.thresholdValue) {
          results.failed.push({
            productData,
            error: "Missing required fields: productName, category, price, unit, expiryDate (DD/MM/YY), thresholdValue"
          });
          continue;
        }
        
        // Parse and validate date format
        let parsedDate;
        try {
          parsedDate = parseDate(productData.expiryDate);
        } catch (dateError) {
          results.failed.push({
            productData,
            error: `Date error: ${dateError.message}`
          });
          continue;
        }
        
        // Generate unique product ID for each product
        const productId = generateProductId();
        
        const product = new Product({
          productName: productData.productName,
          productId: productId, // Auto-generated
          category: productData.category,
          price: parseFloat(productData.price),
          quantity: parseInt(productData.quantity) || 1, // Default to 1
          unit: productData.unit,
          expiryDate: parsedDate,
          thresholdValue: parseInt(productData.thresholdValue),
          imageUrl: null // No images for bulk upload
        });
        
        await product.save();
        results.successful.push(product);
        
      } catch (error) {
        results.failed.push({
          productData,
          error: error.message
        });
      }
    }
    
    // Clean up uploaded file
    fs.unlinkSync(req.file.path);
    
    res.status(200).json({
      success: true,
      message: `Processed ${products.length} products`,
      results: {
        total: products.length,
        successful: results.successful.length,
        failed: results.failed.length,
        duplicates: results.duplicates.length
      },
      details: results
    });
    
  } catch (error) {
    console.error("Error adding multiple products:", error);
    
    // Clean up uploaded file if it exists
    if (req.file) {
      try {
        fs.unlinkSync(req.file.path);
      } catch (cleanupError) {
        console.error("Error cleaning up file:", cleanupError);
      }
    }
    
    res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message
    });
  }
});

// Get all products
router.get("/all", async (req, res) => {
  try {
    const products = await Product.find();
    res.status(200).json({
      success: true,
      count: products.length,
      products
    });
  } catch (error) {
    console.error("Error fetching products:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message
    });
  }
});

// Get single product by ID
router.get("/:productId", async (req, res) => {
  try {
    const product = await Product.findOne({ productId: req.params.productId });
    
    if (!product) {
      return res.status(404).json({
        success: false,
        message: "Product not found"
      });
    }
    
    res.status(200).json({
      success: true,
      product
    });
  } catch (error) {
    console.error("Error fetching product:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message
    });
  }
});

module.exports = router;
