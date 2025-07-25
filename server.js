const express = require("express");
const helmet = require("helmet");
const cors = require("cors");
const cookieParser = require("cookie-parser");
const path = require("path");
const connectDB = require("./src/config/mongo_config");
const UserRouter = require("./src/routes/userRoute");
const handleError = require("./src/utils/errorHandler");
const RoomRouter = require("./src/routes/roomRoute");
const TenantRouter = require("./src/routes/tenantRoute");
const rentalRequestRouter = require("./src/routes/rentalRequestRoute");
const AccommodationRouter = require("./src/routes/accommodationRoute");
const AgreementConfirmationRouter = require("./src/routes/agreementConfirmationRoute");
const AdminRouter = require("./src/routes/adminRoute");
const CotenantRouter = require("./src/routes/cotenantRouter");
const withdrawalRoute = require("./src/routes/withdrawalRoute");
const PaymentRouter = require("./src/routes/paymentRoute");
const paymentService = require("./src/services/paymentService");
const paymentRoutes = require("./src/routes/payment");
const ReportRouter = require("./src/routes/reportRoute");
const PostRouter = require("./src/routes/postRoute");
const TransactionRouter = require("./src/routes/transactionRoute");
require("dotenv").config({ path: "./config.env" });

const app = express();
app.use(
  "/api/payment/payos-webhook",
  express.raw({ type: "application/json" })
);

// ✅ SỬA: General JSON parsing for all other routes (moved after PayOS webhook)
app.use(express.json({ limit: "50mb" }));

app.use(
  helmet.contentSecurityPolicy({
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: [
        "'self'",
        "'unsafe-inline'",
        "https://sandbox.vnpayment.vn",
        "https://dev.payos.vn",
      ], // Added PayOS
      imgSrc: [
        "'self'",
        "data:",
        "https://sandbox.vnpayment.vn",
        "https://dev.payos.vn",
      ], // Added PayOS
      scriptSrc: [
        "'self'",
        "https://code.jquery.com",
        "https://sandbox.vnpayment.vn",
        "https://dev.payos.vn", // Added PayOS
      ],
      connectSrc: [
        "'self'",
        "https://sandbox.vnpayment.vn",
        "https://dev.payos.vn",
      ], // Added PayOS
      frameSrc: [
        "'self'",
        "https://sandbox.vnpayment.vn",
        "https://dev.payos.vn",
      ], // Added PayOS
    },
  })
);

app.use(
  cors({
    origin: process.env.CLIENT_URL || "http://localhost:3000",
    methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
    credentials: true,
    allowedHeaders: ["Content-Type", "Authorization"],
  })
);

app.use(cookieParser());

// Serve static files (for uploaded images)
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

// Create uploads directory if it doesn't exist
const fs = require("fs");
const uploadsDir = path.join(__dirname, "uploads/avatars");
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

app.use((req, res, next) => {
  req.requestTime = new Date().toISOString();
  next();
});
// Test BoldSign connection
app.get("/test-boldsign", async (req, res) => {
  try {
    const result = await paymentService.testBoldSignConnection();
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.use("/user", UserRouter);
app.use("/api/transactions", TransactionRouter);
app.use("/rooms", RoomRouter);
app.use("/api/posts", PostRouter);
app.use("/tenants", TenantRouter);
app.use("/api/accommodations", AccommodationRouter);
app.use("/agreement-confirmations", AgreementConfirmationRouter);
app.use("/rental-requests", rentalRequestRouter);
app.use("/api/withdrawals", withdrawalRoute); // Withdrawal routes
app.use("/cotenant", CotenantRouter);
app.use("/admin", AdminRouter);
app.use("/payment", PaymentRouter);
app.use("/api/payment", paymentRoutes);
console.log("Payment routes mounted at /api/payment");
app.use("/api/transactions", TransactionRouter);
app.use("/api/reports", ReportRouter); // Report routes
app.use(handleError);

connectDB();

app.listen(process.env.PORT || 8080, () =>
  console.log("Server is running at ", process.env.PORT || 8080)
);
