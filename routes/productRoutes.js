const express = require("express");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const Product = require("../models/Product");
const SimpleSalesPurchase = require("../models/SimpleSalesPurchase");

const router = express.Router();

// Create uploads directory if it doesn't exist
const uploadsDir = path.join(__dirname, "../uploads");
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

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

// Parse multipart form data manually (built-in Node.js only)
function parseMultipartData(req) {
  return new Promise((resolve, reject) => {
    const contentType = req.headers['content-type'];
    if (!contentType || !contentType.includes('multipart/form-data')) {
      return reject(new Error('Content type is not multipart/form-data'));
    }
    
    // Extract boundary
    const boundaryMatch = contentType.match(/boundary=(.+)$/);
    if (!boundaryMatch) {
      return reject(new Error('No boundary found in content-type'));
    }
    const boundary = boundaryMatch[1].trim();
    
    let body = Buffer.alloc(0);
    
    req.on('data', chunk => {
      body = Buffer.concat([body, chunk]);
    });
    
    req.on('end', () => {
      try {
        const fields = {};
        let fileData = null;
        let fileName = null;
        let fileType = null;
        
        console.log('Parsing multipart data with boundary:', boundary);
        console.log('Body length:', body.length);
        
        // Convert to string for easier parsing
        const bodyStr = body.toString('binary');
        const boundaryStr = `--${boundary}`;
        
        // Split by boundary
        const parts = bodyStr.split(boundaryStr);
        console.log('Found parts:', parts.length);
        
        for (let i = 0; i < parts.length; i++) {
          const part = parts[i];
          
          if (part.includes('Content-Disposition: form-data')) {
            console.log(`Processing part ${i}:`, part.substring(0, 200));
            
            // Find the headers section
            const headerEndIndex = part.indexOf('\r\n\r\n');
            if (headerEndIndex === -1) continue;
            
            const headers = part.substring(0, headerEndIndex);
            const nameMatch = headers.match(/name="([^"]+)"/);
            const filenameMatch = headers.match(/filename="([^"]+)"/);
            
            if (nameMatch) {
              const fieldName = nameMatch[1];
              console.log('Field name:', fieldName);
              
              if (filenameMatch) {
                // This is a file field
                fileName = filenameMatch[1];
                const contentTypeMatch = headers.match(/Content-Type:\s*([^\r\n]+)/i);
                fileType = contentTypeMatch ? contentTypeMatch[1].trim() : 'application/octet-stream';
                
                console.log('File found:', { fileName, fileType });
                
                // Extract file data (after headers)
                const dataStart = headerEndIndex + 4;
                let dataEnd = part.length;
                
                // Remove trailing CRLF if present
                if (part.endsWith('\r\n')) {
                  dataEnd -= 2;
                }
                
                if (dataStart < dataEnd) {
                  fileData = Buffer.from(part.substring(dataStart, dataEnd), 'binary');
                  console.log('File data length:', fileData.length);
                }
              } else {
                // This is a text field
                const dataStart = headerEndIndex + 4;
                let dataEnd = part.length;
                
                // Remove trailing CRLF if present
                if (part.endsWith('\r\n')) {
                  dataEnd -= 2;
                }
                
                if (dataStart < dataEnd) {
                  fields[fieldName] = part.substring(dataStart, dataEnd);
                  console.log('Text field:', fieldName, '=', fields[fieldName]);
                }
              }
            }
          }
        }
        
        console.log('Parsed fields:', Object.keys(fields));
        console.log('File info:', { fileName, fileType, hasData: !!fileData });
        
        resolve({ fields, fileData, fileName, fileType });
      } catch (error) {
        console.error('Error parsing multipart data:', error);
        reject(error);
      }
    });
    
    req.on('error', reject);
  });
}

// Custom CSV parser using built-in Node.js modules only
function parseCSV(filePath) {
  try {
    const data = fs.readFileSync(filePath, 'utf8');
    const lines = data.trim().split('\n');
    
    if (lines.length === 0) {
      throw new Error('CSV file is empty');
    }
    
    // Define the expected column order (matching frontend form order)
    const columnOrder = ['productName', 'productId', 'category', 'costPrice', 'sellingPrice', 'quantity', 'unit', 'expiryDate', 'thresholdValue', 'description'];
    
    console.log('Expected CSV column order (matching frontend):', columnOrder.join(', '));
    console.log(`Processing ${lines.length} data rows from CSV`);
    
    const products = [];
    
    // Process all lines as data (no header line)
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      if (line === '') continue; // Skip empty lines
      
      const values = parseCSVLine(line);
      
      if (values.length !== columnOrder.length) {
        console.warn(`Row ${i + 1}: Expected ${columnOrder.length} columns but found ${values.length}. Skipping.`);
        console.warn(`Expected: ${columnOrder.join(', ')}`);
        console.warn(`Row data: ${values.join(', ')}`);
        continue;
      }
      
      const product = { 
        rowNumber: i + 1, // Track 1-based row number for error reporting
        originalLine: line // Keep original line for debugging
      };
      
      // Map values to product fields based on column order
      columnOrder.forEach((fieldName, index) => {
        product[fieldName] = values[index].trim();
      });
      
      products.push(product);
    }
    
    console.log(`Successfully parsed ${products.length} products from CSV`);
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
    
    const { productName, category, costPrice, sellingPrice, quantity, unit, expiryDate, thresholdValue } = req.body;
    
    // Validate required fields
    if (!productName || !category || !costPrice || !sellingPrice || !unit || !expiryDate || !thresholdValue) {
      return res.status(400).json({
        success: false,
        message: "Missing required fields: productName, category, costPrice, sellingPrice, unit, expiryDate (DD/MM/YY), and thresholdValue are required"
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
      costPrice: parseFloat(costPrice),
      sellingPrice: parseFloat(sellingPrice),
      quantity: parseInt(quantity) || 1,
      unit,
      expiryDate: parsedDate,
      thresholdValue: parseInt(thresholdValue),
      imageUrl: null // No images for JSON endpoint
    });
    
    await product.save();
    
    // Track purchase in simplified analytics (FIXED)
    try {
      console.log(`🔍 Tracking Purchase (Fixed): ${product.productName}`);
      console.log(`💰 Purchase Amount: ₹${product.costPrice} × ${product.quantity} = ₹${product.costPrice * product.quantity}`);
      
      const trackingResult = await SimpleSalesPurchase.addPurchase({
        _id: product._id,
        name: product.productName,
        costPrice: product.costPrice,
        quantity: product.quantity
      });
      
      console.log(`✅ Purchase tracked successfully (Fixed):`, {
        productName: product.productName,
        amount: product.costPrice * product.quantity,
        trackingId: trackingResult._id
      });
    } catch (trackingError) {
      console.error('❌ Error tracking purchase (Fixed):', trackingError);
      // Don't fail product creation if tracking fails
    }
    
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

// Get CSV format requirements and sample data
router.get("/csv-format", (req, res) => {
  try {
    const columnOrder = ['productName', 'productId', 'category', 'costPrice', 'sellingPrice', 'quantity', 'unit', 'expiryDate', 'thresholdValue', 'description'];
    
    res.status(200).json({
      success: true,
      message: "CSV format requirements (matching frontend form order)",
      format: {
        columnOrder: columnOrder,
        description: "CSV file should contain only data rows without headers, in the same order as frontend form",
        requirements: {
          "productName": "Text - Name of the product (required)",
          "productId": "Text - Product ID (leave empty for auto-generation)",
          "category": "Text - Product category (required)",
          "costPrice": "Number - Cost price for internal calculations (required)",
          "sellingPrice": "Number - Selling price displayed in inventory (required)",
          "quantity": "Number - Current stock quantity (required)",
          "unit": "Text - Unit of measurement (piece, kg, liter, etc.) (required)",
          "expiryDate": "Date - Format: DD/MM/YY (e.g., 31/12/25) (required)",
          "thresholdValue": "Number - Minimum stock threshold (required)",
          "description": "Text - Product description (optional)"
        },
        example: [
          "Laptop Pro,,Electronics,800,1200,15,piece,31/12/26,5,High-performance laptop for professionals",
          "Gaming Mouse,,Electronics,40,75,50,piece,30/06/27,10,Wireless gaming mouse with RGB lighting",
          "Office Chair,,Furniture,200,350,25,piece,15/03/28,3,Ergonomic office chair with lumbar support"
        ],
        notes: [
          "No header row required in CSV file",
          "Each row represents one product",
          "Columns must be in the exact order specified (matching frontend form)",
          "Use commas to separate fields",
          "Leave productId empty for auto-generation",
          "Cost price is for internal calculations only",
          "Selling price will be displayed in inventory",
          "Date format must be DD/MM/YY",
          "Empty lines will be skipped"
        ]
      }
    });
  } catch (error) {
    console.error("Error getting CSV format:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message
    });
  }
});

// Add a single product (with optional image upload using built-in Node.js only)
router.post("/add-single", async (req, res) => {
  try {
    console.log("Processing multipart form data...");
    
    // Parse multipart form data manually
    const { fields, fileData, fileName, fileType } = await parseMultipartData(req);
    
    console.log("Parsed fields:", fields);
    console.log("File info:", { fileName, fileType });
    
    const { productName, category, costPrice, sellingPrice, quantity, unit, expiryDate, thresholdValue } = fields;
    
    // Validate required fields
    if (!productName || !category || !costPrice || !sellingPrice || !unit || !expiryDate || !thresholdValue) {
      return res.status(400).json({
        success: false,
        message: "Missing required fields: productName, category, costPrice, sellingPrice, unit, expiryDate (DD/MM/YY), and thresholdValue are required"
      });
    }

    // Validate numeric fields and convert
    const parsedCostPrice = parseFloat(costPrice);
    const parsedSellingPrice = parseFloat(sellingPrice);
    const parsedQuantity = parseInt(quantity) || 1;
    const parsedThresholdValue = parseInt(thresholdValue);

    // Validation for negative or invalid values
    if (isNaN(parsedCostPrice) || parsedCostPrice < 0) {
      return res.status(400).json({
        success: false,
        message: "Cost price must be a positive number"
      });
    }

    if (isNaN(parsedSellingPrice) || parsedSellingPrice < 0) {
      return res.status(400).json({
        success: false,
        message: "Selling price must be a positive number"
      });
    }

    if (isNaN(parsedQuantity) || parsedQuantity < 0) {
      return res.status(400).json({
        success: false,
        message: "Quantity must be a positive number"
      });
    }

    if (isNaN(parsedThresholdValue) || parsedThresholdValue < 0) {
      return res.status(400).json({
        success: false,
        message: "Threshold value must be a positive number"
      });
    }

    // Business logic validation
    if (parsedSellingPrice < parsedCostPrice) {
      return res.status(400).json({
        success: false,
        message: "Selling price should be greater than or equal to cost price"
      });
    }

    if (parsedThresholdValue > parsedQuantity) {
      return res.status(400).json({
        success: false,
        message: "Threshold value should not exceed quantity"
      });
    }

    // Check for duplicate product name
    const existingProduct = await Product.findOne({ 
      productName: { $regex: new RegExp(`^${productName.trim()}$`, 'i') } 
    });
    if (existingProduct) {
      return res.status(409).json({
        success: false,
        message: "A product with this name already exists"
      });
    }
    
    // Parse and validate date format
    let parsedDate;
    try {
      parsedDate = parseDate(expiryDate);
      
      // Validate that expiry date is in the future
      const today = new Date();
      today.setHours(0, 0, 0, 0); // Set to start of day for comparison
      
      if (parsedDate < today) {
        return res.status(400).json({
          success: false,
          message: "Expiry date must be in the future"
        });
      }
    } catch (dateError) {
      return res.status(400).json({
        success: false,
        message: `Date error: ${dateError.message}`
      });
    }
    
    // Generate unique product ID
    const productId = generateProductId();
    
    // Handle image upload (if provided)
    let imageUrl = null;
    if (fileData && fileName && fileType && fileType.startsWith('image/')) {
      try {
        const fileExtension = path.extname(fileName);
        const uniqueFileName = `${Date.now()}-${crypto.randomBytes(4).toString('hex')}${fileExtension}`;
        const filePath = path.join(uploadsDir, uniqueFileName);
        
        // Write file using built-in fs module
        fs.writeFileSync(filePath, fileData, 'binary');
        imageUrl = `/uploads/${uniqueFileName}`;
        
        console.log("Image saved successfully:", imageUrl);
      } catch (fileError) {
        console.error("Error saving file:", fileError);
        return res.status(500).json({
          success: false,
          message: "Error saving uploaded image",
          error: fileError.message
        });
      }
    }
    
    const product = new Product({
      productName,
      productId,
      category,
      costPrice: parsedCostPrice,
      sellingPrice: parsedSellingPrice,
      quantity: parsedQuantity,
      unit,
      expiryDate: parsedDate,
      thresholdValue: parsedThresholdValue,
      imageUrl
    });
    
    await product.save();
    
    // Track purchase in simplified analytics (FIXED)
    try {
      console.log(`🔍 Tracking Purchase (Form-data): ${product.productName}`);
      console.log(`💰 Purchase Amount: ₹${product.costPrice} × ${product.quantity} = ₹${product.costPrice * product.quantity}`);
      
      const trackingResult = await SimpleSalesPurchase.addPurchase({
        _id: product._id,
        name: product.productName,
        costPrice: product.costPrice,
        quantity: product.quantity
      });
      
      console.log(`✅ Purchase tracked successfully (Form-data):`, {
        productName: product.productName,
        amount: product.costPrice * product.quantity,
        trackingId: trackingResult._id
      });
    } catch (trackingError) {
      console.error('❌ Error tracking purchase (Form-data):', trackingError);
      // Don't fail product creation if tracking fails
    }
    
    res.status(201).json({
      success: true,
      message: "Product added successfully",
      product
    });
    
  } catch (error) {
    console.error("Error adding single product:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message
    });
  }
});

// Validate CSV file before upload
router.post("/validate-csv", async (req, res) => {
  try {
    console.log("🚀 POST /validate-csv route hit!");
    console.log("Request headers:", req.headers);
    console.log("Request content-type:", req.headers['content-type']);
    console.log("Validating CSV file...");
    
    // Parse multipart form data manually
    const { fileData, fileName, fileType } = await parseMultipartData(req);
    
    if (!fileData || !fileName) {
      return res.status(400).json({
        success: false,
        message: "No CSV file uploaded"
      });
    }
    
    // Check if it's a CSV file
    if (!fileName.toLowerCase().endsWith('.csv') && fileType !== 'text/csv') {
      return res.status(400).json({
        success: false,
        message: "Invalid file format. Please upload a CSV file"
      });
    }
    
    // Parse CSV content
    const csvContent = fileData.toString('utf8');
    const lines = csvContent.split('\n').map(line => line.trim()).filter(line => line);
    
    if (lines.length === 0) {
      return res.status(400).json({
        success: false,
        message: "CSV file is empty"
      });
    }
    
    // Expected headers
    const expectedHeaders = ['productName', 'category', 'costPrice', 'sellingPrice', 'quantity', 'unit', 'expiryDate', 'thresholdValue'];
    const headers = lines[0].split(',').map(h => h.trim().replace(/['"]/g, ''));
    
    // Check if all required headers are present
    const missingHeaders = expectedHeaders.filter(header => !headers.includes(header));
    if (missingHeaders.length > 0) {
      return res.status(400).json({
        success: false,
        message: `Missing required columns: ${missingHeaders.join(', ')}`
      });
    }
    
    const errors = [];
    let validProducts = 0;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    // Validate each row
    for (let i = 1; i < lines.length; i++) {
      const values = lines[i].split(',').map(v => v.trim().replace(/['"]/g, ''));
      const rowNumber = i + 1;
      
      if (values.length !== headers.length) {
        errors.push({
          row: rowNumber,
          message: "Incorrect number of columns"
        });
        continue;
      }
      
      const product = {};
      headers.forEach((header, index) => {
        product[header] = values[index];
      });
      
      // Validate required fields
      const requiredFields = ['productName', 'category', 'costPrice', 'sellingPrice', 'quantity', 'unit', 'expiryDate', 'thresholdValue'];
      const emptyFields = requiredFields.filter(field => !product[field] || product[field].trim() === '');
      
      if (emptyFields.length > 0) {
        errors.push({
          row: rowNumber,
          message: `Empty required fields: ${emptyFields.join(', ')}`
        });
        continue;
      }
      
      // Validate numeric fields
      const costPrice = parseFloat(product.costPrice);
      const sellingPrice = parseFloat(product.sellingPrice);
      const quantity = parseInt(product.quantity);
      const thresholdValue = parseInt(product.thresholdValue);
      
      if (isNaN(costPrice) || costPrice < 0) {
        errors.push({
          row: rowNumber,
          message: "Invalid cost price (must be positive number)"
        });
        continue;
      }
      
      if (isNaN(sellingPrice) || sellingPrice < 0) {
        errors.push({
          row: rowNumber,
          message: "Invalid selling price (must be positive number)"
        });
        continue;
      }
      
      if (isNaN(quantity) || quantity < 0) {
        errors.push({
          row: rowNumber,
          message: "Invalid quantity (must be positive number)"
        });
        continue;
      }
      
      if (isNaN(thresholdValue) || thresholdValue < 0) {
        errors.push({
          row: rowNumber,
          message: "Invalid threshold value (must be positive number)"
        });
        continue;
      }
      
      // Business logic validation
      if (sellingPrice < costPrice) {
        errors.push({
          row: rowNumber,
          message: "Selling price should be greater than or equal to cost price"
        });
        continue;
      }
      
      if (thresholdValue > quantity) {
        errors.push({
          row: rowNumber,
          message: "Threshold value should not exceed quantity"
        });
        continue;
      }
      
      // Date validation
      try {
        const expiryDate = parseDate(product.expiryDate);
        if (expiryDate < today) {
          errors.push({
            row: rowNumber,
            message: "Expiry date must be in the future"
          });
          continue;
        }
      } catch (dateError) {
        errors.push({
          row: rowNumber,
          message: `Invalid expiry date: ${dateError.message}`
        });
        continue;
      }
      
      // Check for duplicate product names in database
      try {
        const existingProduct = await Product.findOne({ 
          productName: { $regex: new RegExp(`^${product.productName.trim()}$`, 'i') } 
        });
        if (existingProduct) {
          errors.push({
            row: rowNumber,
            message: `Product "${product.productName}" already exists in database`
          });
          continue;
        }
      } catch (dbError) {
        console.error('Database error while checking duplicates:', dbError);
      }
      
      validProducts++;
    }
    
    console.log(`Validation complete: ${validProducts} valid products, ${errors.length} errors`);
    
    res.json({
      success: true,
      message: "CSV validation completed",
      validProducts,
      totalRows: lines.length - 1, // Exclude header
      errors
    });
    
  } catch (error) {
    console.error("CSV validation error:", error);
    res.status(500).json({
      success: false,
      message: "Server error during CSV validation",
      error: error.message
    });
  }
});

// Add multiple products via CSV upload (no images, built-in modules only)
router.post("/add-multiple", async (req, res) => {
  try {
    console.log("Processing CSV upload...");
    
    // Parse multipart form data manually
    const { fields, fileData, fileName, fileType } = await parseMultipartData(req);
    
    if (!fileData || !fileName) {
      return res.status(400).json({
        success: false,
        message: "No CSV file uploaded"
      });
    }
    
    // Check if it's a CSV file
    if (!fileName.toLowerCase().endsWith('.csv') && fileType !== 'text/csv') {
      return res.status(400).json({
        success: false,
        message: "Please upload a CSV file"
      });
    }
    
    console.log("Uploaded CSV file:", fileName);
    
    // Save CSV file temporarily
    const tempFileName = `temp-${Date.now()}-${crypto.randomBytes(4).toString('hex')}.csv`;
    const tempFilePath = path.join(uploadsDir, tempFileName);
    
    try {
      fs.writeFileSync(tempFilePath, fileData, 'binary');
      
      // Parse CSV file
      const products = parseCSV(tempFilePath);
      console.log(`Parsed ${products.length} products from CSV`);
      
      const results = {
        successful: [],
        failed: [],
        duplicates: []
      };
      
      for (const productData of products) {
        const rowNumber = productData.rowNumber;
        
        try {
          // Detailed field validation with specific error messages
          const missingFields = [];
          const invalidFields = [];
          
          // Check required fields
          if (!productData.productName || productData.productName.trim() === '') {
            missingFields.push('productName');
          }
          if (!productData.category || productData.category.trim() === '') {
            missingFields.push('category');
          }
          if (!productData.costPrice || productData.costPrice.trim() === '') {
            missingFields.push('costPrice');
          }
          if (!productData.sellingPrice || productData.sellingPrice.trim() === '') {
            missingFields.push('sellingPrice');
          }
          if (!productData.unit || productData.unit.trim() === '') {
            missingFields.push('unit');
          }
          if (!productData.expiryDate || productData.expiryDate.trim() === '') {
            missingFields.push('expiryDate');
          }
          if (!productData.thresholdValue || productData.thresholdValue.trim() === '') {
            missingFields.push('thresholdValue');
          }
          
          // Validate price formats
          if (productData.costPrice && isNaN(parseFloat(productData.costPrice))) {
            invalidFields.push('costPrice (must be a valid number)');
          }
          if (productData.sellingPrice && isNaN(parseFloat(productData.sellingPrice))) {
            invalidFields.push('sellingPrice (must be a valid number)');
          }
          
          // Validate quantity format (if provided)
          if (productData.quantity && productData.quantity.trim() !== '' && isNaN(parseInt(productData.quantity))) {
            invalidFields.push('quantity (must be a valid number)');
          }
          
          // Validate threshold format
          if (productData.thresholdValue && isNaN(parseInt(productData.thresholdValue))) {
            invalidFields.push('thresholdValue (must be a valid number)');
          }
          
          // Report missing fields
          if (missingFields.length > 0) {
            results.failed.push({
              rowNumber,
              productName: productData.productName || 'Unknown',
              error: `Row ${rowNumber}: Missing required fields: ${missingFields.join(', ')}`,
              errorType: 'MISSING_FIELDS',
              details: {
                missingFields,
                originalData: productData
              }
            });
            continue;
          }
          
          // Report invalid fields
          if (invalidFields.length > 0) {
            results.failed.push({
              rowNumber,
              productName: productData.productName || 'Unknown',
              error: `Row ${rowNumber}: Invalid field format: ${invalidFields.join(', ')}`,
              errorType: 'INVALID_FORMAT',
              details: {
                invalidFields,
                originalData: productData
              }
            });
            continue;
          }
          
          // Parse and validate date format with specific error message
          let parsedDate;
          try {
            parsedDate = parseDate(productData.expiryDate);
          } catch (dateError) {
            results.failed.push({
              rowNumber,
              productName: productData.productName || 'Unknown',
              error: `Row ${rowNumber}: Date format error - ${dateError.message}. Expected format: DD/MM/YY (e.g., 31/12/25)`,
              errorType: 'DATE_FORMAT_ERROR',
              details: {
                providedDate: productData.expiryDate,
                expectedFormat: 'DD/MM/YY',
                originalData: productData
              }
            });
            continue;
          }
          
          // Generate unique product ID for each product (no duplicate checking)
          const productId = productData.productId && productData.productId.trim() !== '' 
            ? productData.productId.trim() 
            : generateProductId(); // Auto-generate if not provided
          
          const product = new Product({
            productName: productData.productName.trim(),
            productId: productId,
            category: productData.category.trim(),
            costPrice: parseFloat(productData.costPrice),
            sellingPrice: parseFloat(productData.sellingPrice),
            quantity: parseInt(productData.quantity) || 1, // Default to 1
            unit: productData.unit.trim(),
            expiryDate: parsedDate,
            thresholdValue: parseInt(productData.thresholdValue),
            imageUrl: null // No images for bulk upload
          });
          
          await product.save();
          results.successful.push({
            rowNumber,
            productId: product.productId,
            productName: product.productName,
            category: product.category,
            price: product.price,
            message: `Row ${rowNumber}: Successfully added '${product.productName}' with ID ${product.productId}`
          });
          
        } catch (error) {
          console.error(`Error processing row ${rowNumber}:`, error);
          results.failed.push({
            rowNumber,
            productName: productData.productName || 'Unknown',
            error: `Row ${rowNumber}: Database error - ${error.message}`,
            errorType: 'DATABASE_ERROR',
            details: {
              originalData: productData,
              errorMessage: error.message
            }
          });
        }
      }
      
      // Clean up temporary file
      fs.unlinkSync(tempFilePath);
      
      // Generate summary messages for toast notifications
      const summaryMessages = [];
      const errorSummary = {};
      
      if (results.successful.length > 0) {
        summaryMessages.push(`✅ ${results.successful.length} products added successfully`);
      }
      
      if (results.failed.length > 0) {
        // Group errors by type for better summary
        results.failed.forEach(failure => {
          const type = failure.errorType || 'UNKNOWN_ERROR';
          if (!errorSummary[type]) {
            errorSummary[type] = [];
          }
          errorSummary[type].push(failure.rowNumber);
        });
        
        // Create user-friendly error messages
        Object.keys(errorSummary).forEach(errorType => {
          const rows = errorSummary[errorType];
          const rowText = rows.length === 1 ? `row ${rows[0]}` : `rows ${rows.join(', ')}`;
          
          switch (errorType) {
            case 'MISSING_FIELDS':
              summaryMessages.push(`❌ Missing required fields in ${rowText}`);
              break;
            case 'DATE_FORMAT_ERROR':
              summaryMessages.push(`📅 Invalid date format in ${rowText} (use DD/MM/YY)`);
              break;
            case 'INVALID_FORMAT':
              summaryMessages.push(`⚠️ Invalid field format in ${rowText}`);
              break;
            default:
              summaryMessages.push(`❌ Processing errors in ${rowText}`);
          }
        });
      }
      
      // Overall status
      const overallSuccess = results.failed.length === 0;
      const statusMessage = overallSuccess 
        ? `🎉 All ${results.successful.length} products uploaded successfully!`
        : `⚠️ ${results.successful.length}/${products.length} products uploaded successfully`;
      
      res.status(200).json({
        success: overallSuccess,
        message: statusMessage,
        summary: summaryMessages,
        results: {
          total: products.length,
          successful: results.successful.length,
          failed: results.failed.length,
          duplicates: 0 // No duplicate checking anymore
        },
        details: {
          successful: results.successful,
          failed: results.failed,
          duplicates: [] // No duplicates since we don't check for them
        },
        // Quick reference for toast notifications
        toastMessages: {
          success: results.successful.length > 0 ? `${results.successful.length} products added successfully with unique IDs` : null,
          errors: results.failed.length > 0 ? `${results.failed.length} rows had errors` : null,
          duplicates: null // No duplicate checking
        }
      });
      
    } catch (fileError) {
      // Clean up temporary file if it exists
      try {
        if (fs.existsSync(tempFilePath)) {
          fs.unlinkSync(tempFilePath);
        }
      } catch (cleanupError) {
        console.error("Error cleaning up temp file:", cleanupError);
      }
      
      throw fileError;
    }
    
  } catch (error) {
    console.error("Error adding multiple products:", error);
    
    res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message
    });
  }
});

// Search products across all fields
router.get("/search", async (req, res) => {
  try {
    const { query, page = 1, limit = 20 } = req.query;
    
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

    // Search across multiple fields
    const searchConditions = {
      $or: [
        { productId: searchRegex },
        { productName: searchRegex },
        { category: searchRegex },
        { description: searchRegex },
        { brand: searchRegex },
        { unit: searchRegex },
        { status: searchRegex },
        { availability: searchRegex },
        { supplier: searchRegex },
        { location: searchRegex },
        { tags: { $in: [searchRegex] } },
        // Convert numbers to string for searching
        { $expr: { $regexMatch: { input: { $toString: "$price" }, regex: query.trim(), options: "i" } } },
        { $expr: { $regexMatch: { input: { $toString: "$sellingPrice" }, regex: query.trim(), options: "i" } } },
        { $expr: { $regexMatch: { input: { $toString: "$quantity" }, regex: query.trim(), options: "i" } } },
        { $expr: { $regexMatch: { input: { $toString: "$thresholdValue" }, regex: query.trim(), options: "i" } } },
        // Search in date fields - convert date to string format
        { $expr: { $regexMatch: { input: { $dateToString: { format: "%d/%m/%Y", date: "$expiryDate" } }, regex: query.trim(), options: "i" } } },
        { $expr: { $regexMatch: { input: { $dateToString: { format: "%Y-%m-%d", date: "$expiryDate" } }, regex: query.trim(), options: "i" } } }
      ]
    };

    // Get total count for pagination
    const totalProducts = await Product.countDocuments(searchConditions);
    
    // Get products with pagination
    const products = await Product.find(searchConditions)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limitNumber);

    const totalPages = Math.ceil(totalProducts / limitNumber);

    res.status(200).json({
      success: true,
      query: query.trim(),
      results: {
        products,
        pagination: {
          currentPage: pageNumber,
          totalPages,
          totalProducts,
          productsPerPage: limitNumber,
          hasNext: pageNumber < totalPages,
          hasPrevious: pageNumber > 1
        }
      }
    });

  } catch (error) {
    console.error("Error searching products:", error);
    res.status(500).json({
      success: false,
      message: "Failed to search products",
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

// Test route for debugging
router.get("/test", (req, res) => {
  res.json({ message: "Product routes are working!" });
});

// Get single product by ID (keep this last as it's a wildcard route)
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
