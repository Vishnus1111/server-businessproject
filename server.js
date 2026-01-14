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
const Product = require("./models/Product");
const Order = require("./models/Order");
const Invoice = require("./models/Invoice");
const SimpleSalesPurchase = require("./models/SimpleSalesPurchase");
const User = require("./models/User");

dotenv.config();

const app = express();

// Middleware for handling different types of requests
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
// CORS configuration: allow Vercel app, local dev, and (optionally) Vercel previews
const stripTrailingSlash = (url) => (typeof url === 'string' ? url.replace(/\/$/, '') : url);
const ALLOWED_ORIGINS = [
  stripTrailingSlash(process.env.FRONTEND_URL),
  'http://localhost:3000',
  'http://localhost:3001'
].filter(Boolean);

const corsOptions = {
  origin: (origin, callback) => {
    // Allow non-browser requests (like curl/postman without Origin)
    if (!origin) return callback(null, true);

    const cleanOrigin = stripTrailingSlash(origin);
    const isWhitelisted =
      ALLOWED_ORIGINS.includes(cleanOrigin) ||
      /\.vercel\.app$/.test(cleanOrigin); // allow Vercel preview deployments

    if (isWhitelisted) return callback(null, true);
    return callback(new Error(`Not allowed by CORS: ${origin}`), false);
  },
  credentials: true,
  methods: ['GET', 'HEAD', 'PUT', 'PATCH', 'POST', 'DELETE', 'OPTIONS'],
  // Don't hardcode allowedHeaders; let cors reflect Access-Control-Request-Headers
};

app.use(cors(corsOptions));
// Ensure preflight requests are handled for all routes (Express 5 compatible path)
app.options(/.*/, cors(corsOptions));

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
  .connect(process.env.MONGO_URI, {
    serverSelectionTimeoutMS: 30000, // Increase timeout to 30 seconds
    socketTimeoutMS: 45000,
  })
  .then(() => {
    console.log("MongoDB connected successfully");
    console.log("Database:", mongoose.connection.name);
    
    // Start the daily cron job after database connection
    cronJobService.startDailyCronJob();
    // Ownership migration: ensure existing data is isolated under the correct account
    (async () => {
      try {
        // Correct target owner email
        const targetEmail = 'vishnus.21ece@cambridge.edu.in';
        const legacyTypoEmail = 'vishus.21ece@cambridge.edu.in';

        let user = await User.findOne({ email: targetEmail });
        if (!user) {
          console.warn(`Owner user not found for ${targetEmail}. Existing data will be tagged with ownerEmail only.`);
        }
        const ownerId = user?._id;

        // 1) Tag any documents missing ownerEmail
        const tagFilter = { $or: [ { ownerEmail: { $exists: false } }, { ownerEmail: null } ] };
        const ownerSet = { $set: { ownerEmail: targetEmail, ...(ownerId ? { userId: ownerId } : {}) } };

        const [pRes, oRes, iRes, sRes] = await Promise.all([
          Product.updateMany(tagFilter, ownerSet),
          Order.updateMany(tagFilter, ownerSet),
          Invoice.updateMany(tagFilter, ownerSet),
          SimpleSalesPurchase.updateMany(tagFilter, ownerSet)
        ]);

        // 2) Retag any documents that were previously tagged with the legacy/typo email
        const legacyFilter = { ownerEmail: legacyTypoEmail };
        const legacySet = { $set: { ownerEmail: targetEmail, ...(ownerId ? { userId: ownerId } : {}) } };
        const [lp, lo, li, ls] = await Promise.all([
          Product.updateMany(legacyFilter, legacySet),
          Order.updateMany(legacyFilter, legacySet),
          Invoice.updateMany(legacyFilter, legacySet),
          SimpleSalesPurchase.updateMany(legacyFilter, legacySet)
        ]);

        console.log(`Ownership tagging done -> Missing owner -> Products: ${pRes.modifiedCount}, Orders: ${oRes.modifiedCount}, Invoices: ${iRes.modifiedCount}, SimpleSP: ${sRes.modifiedCount}`);
        console.log(`Legacy email retagging -> Products: ${lp.modifiedCount}, Orders: ${lo.modifiedCount}, Invoices: ${li.modifiedCount}, SimpleSP: ${ls.modifiedCount}`);
      } catch (e) {
        console.error('Error during ownership migration:', e.message);
      }
    })();
    
    // For testing purposes, you can also start a test cron job that runs every minute
    // cronJobService.startTestCronJob();
  })
  .catch((err) => {
    console.error("MongoDB connection error:", err);
    console.error("Connection string format check - ensure MONGO_URI is set correctly");
    process.exit(1); // Exit if database connection fails
  });

// Handle MongoDB connection events
mongoose.connection.on('error', (err) => {
  console.error('MongoDB connection error:', err);
});

mongoose.connection.on('disconnected', () => {
  console.warn('MongoDB disconnected. Attempting to reconnect...');
});

mongoose.connection.on('reconnected', () => {
  console.log('MongoDB reconnected');
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
