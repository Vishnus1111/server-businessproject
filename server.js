const express = require("express");
const mongoose = require("mongoose");
const dotenv = require("dotenv");
const cors = require("cors");
const path = require("path");
const authRoutes = require("./routes/authRoutes");
const userRoutes = require("./routes/userRoutes");
const productRoutes = require("./routes/productRoutes");
const cronRoutes = require("./routes/cronRoutes");
const orderRoutes = require("./routes/orderRoutes");
const dashboardRoutes = require("./routes/dashboardRoutes");
const invoiceRoutes = require("./routes/invoiceRoutes");
const statisticsRoutes = require("./routes/statisticsRoutes");
const topProductsRoutes = require("./routes/topProductsRoutes");
const dataFixRoutes = require("./routes/dataFixRoutes");
const profitFixRoutes = require("./routes/profitFixRoutes");
const cronJobService = require("./services/cronJobService");

dotenv.config();

const app = express();

// Middleware for handling different types of requests
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(cors({ 
  origin: [process.env.FRONTEND_URL, 'http://localhost:3000', 'http://localhost:3001'], 
  credentials: true 
}));

// Serve static files from uploads directory
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Request logging middleware - Log ALL incoming requests
app.use((req, res, next) => {
  console.log(`🌐 ${req.method} ${req.url} - Headers:`, Object.keys(req.headers));
  console.log(`🔍 Request body keys:`, req.body ? Object.keys(req.body) : 'No body');
  console.log(`📝 Content-Type:`, req.get('Content-Type'));
  next();
});

app.use("/api/auth", authRoutes);
app.use("/api/users", userRoutes);
app.use("/api/products", productRoutes);
app.use("/api/cron", cronRoutes);
app.use("/api/orders", orderRoutes);
app.use("/api/dashboard", dashboardRoutes);
app.use("/api/invoices", invoiceRoutes);
app.use("/api/statistics", statisticsRoutes);
app.use("/api/top-products", topProductsRoutes);
app.use("/api/data-fix", dataFixRoutes);
app.use("/api/profit-fix", profitFixRoutes);

// Debug: Log all registered routes
console.log("📋 Registered routes:");
console.log("  - /api/auth/*");
console.log("  - /api/users/*");
console.log("  - /api/products/*");
console.log("  - /api/cron/*");
console.log("  - /api/orders/*");
console.log("  - /api/dashboard/*");
console.log("  - /api/invoices/*");
console.log("  - /api/statistics/*");
console.log("  - /api/top-products/*");

// Debug middleware to log all incoming requests
app.use((req, res, next) => {
  console.log(`🌐 ${req.method} ${req.url} - Headers:`, Object.keys(req.headers));
  next();
});

mongoose
  .connect(process.env.MONGO_URI)
  .then(() => {
    console.log("MongoDB connected");
    
    // Start the daily cron job after database connection
    cronJobService.startDailyCronJob();
    
    // For testing purposes, you can also start a test cron job that runs every minute
    // cronJobService.startTestCronJob();
  })
  .catch((err) => console.error(err));

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
