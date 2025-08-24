const API_BASE_URL = 'http://localhost:5000'; // Adjust based on your server port

// Test cases for validation
const testCases = [
  {
    name: "Negative Cost Price",
    data: {
      productName: "Test Product 1",
      category: "Electronics",
      costPrice: "-100",
      sellingPrice: "150",
      quantity: "10",
      unit: "pieces",
      expiryDate: "31/12/25",
      thresholdValue: "5"
    },
    expectedError: "Cost price must be a positive number"
  },
  {
    name: "Negative Selling Price", 
    data: {
      productName: "Test Product 2",
      category: "Electronics",
      costPrice: "100",
      sellingPrice: "-150",
      quantity: "10", 
      unit: "pieces",
      expiryDate: "31/12/25",
      thresholdValue: "5"
    },
    expectedError: "Selling price must be a positive number"
  },
  {
    name: "Negative Quantity",
    data: {
      productName: "Test Product 3",
      category: "Electronics", 
      costPrice: "100",
      sellingPrice: "150",
      quantity: "-10",
      unit: "pieces",
      expiryDate: "31/12/25",
      thresholdValue: "5"
    },
    expectedError: "Quantity must be a positive number"
  },
  {
    name: "Negative Threshold Value",
    data: {
      productName: "Test Product 4",
      category: "Electronics",
      costPrice: "100", 
      sellingPrice: "150",
      quantity: "10",
      unit: "pieces",
      expiryDate: "31/12/25",
      thresholdValue: "-5"
    },
    expectedError: "Threshold value must be a positive number"
  },
  {
    name: "Selling Price Less Than Cost Price",
    data: {
      productName: "Test Product 5",
      category: "Electronics",
      costPrice: "200",
      sellingPrice: "150", 
      quantity: "10",
      unit: "pieces",
      expiryDate: "31/12/25",
      thresholdValue: "5"
    },
    expectedError: "Selling price should be greater than or equal to cost price"
  },
  {
    name: "Threshold Value Greater Than Quantity",
    data: {
      productName: "Test Product 6",
      category: "Electronics",
      costPrice: "100",
      sellingPrice: "150",
      quantity: "5",
      unit: "pieces", 
      expiryDate: "31/12/25",
      thresholdValue: "10"
    },
    expectedError: "Threshold value should not exceed quantity"
  },
  {
    name: "Past Expiry Date",
    data: {
      productName: "Test Product 7", 
      category: "Electronics",
      costPrice: "100",
      sellingPrice: "150",
      quantity: "10",
      unit: "pieces",
      expiryDate: "31/12/20", // Past date
      thresholdValue: "5"
    },
    expectedError: "Expiry date must be in the future"
  }
];

async function testValidation() {
  console.log("🧪 Testing Product Validation...\n");
  
  for (const testCase of testCases) {
    console.log(`Testing: ${testCase.name}`);
    
    try {
      // Create FormData
      const formData = new FormData();
      Object.keys(testCase.data).forEach(key => {
        formData.append(key, testCase.data[key]);
      });
      
      const response = await fetch(`${API_BASE_URL}/api/products/add-single`, {
        method: 'POST',
        headers: {
          'Authorization': 'Bearer YOUR_TOKEN_HERE', // Replace with actual token
        },
        body: formData
      });
      
      const result = await response.json();
      
      if (response.ok) {
        console.log(`❌ Expected error but got success: ${result.message}`);
      } else {
        if (result.message === testCase.expectedError) {
          console.log(`✅ Correct error: ${result.message}`);
        } else {
          console.log(`⚠️  Different error: Expected "${testCase.expectedError}", Got "${result.message}"`);
        }
      }
    } catch (error) {
      console.log(`🔥 Network error: ${error.message}`);
    }
    
    console.log(""); // Empty line for spacing
  }
}

// Instructions for manual testing
console.log(`
📋 VALIDATION TEST GUIDE
=======================

To test the enhanced validation system:

1. Start your backend server
2. Replace 'YOUR_TOKEN_HERE' with a valid JWT token
3. Run this script: node test_validation.js

Or test manually in the frontend:

FRONTEND TESTS:
- Try entering negative values in cost price, selling price, quantity, or threshold fields
- Try entering selling price less than cost price  
- Try entering threshold value greater than quantity
- Try entering past dates for expiry
- Try duplicate product names

EXPECTED BEHAVIORS:
✅ Client-side validation should prevent form submission
✅ Specific error toast messages should appear
✅ Server should return detailed error messages
✅ Product ID field should be read-only but look normal
✅ All numeric fields should have min="0" attribute

EDGE CASES COVERED:
- Negative values in all numeric fields
- Business logic validation (selling >= cost, threshold <= quantity)
- Date validation (format and future date requirement)
- Duplicate product name detection
- File size and type validation for CSV uploads
- Comprehensive error messages for different scenarios
`);

// Uncomment to run tests (make sure to add valid token and start server)
// testValidation();
