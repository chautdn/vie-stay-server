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
const PostRouter = require("./src/routes/postRoute");
const PaymentRouter = require("./src/routes/paymentRoute");
require("dotenv").config({ path: "./config.env" });

const app = express();

// ✅ THÊM: IMPORTANT - Handle PayOS webhook BEFORE general JSON parsing
// PayOS webhook needs raw body for signature verification
app.use(
  "/api/payment/payos-webhook",
  express.raw({ type: "application/json" })
);

// ✅ SỬA: General JSON parsing for all other routes (moved after PayOS webhook)
app.use(express.json({ limit: "10kb" }));

app.use(
  helmet.contentSecurityPolicy({
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: [
        "'self'",
        "'unsafe-inline'",
        "https://sandbox.vnpayment.vn",
        "https://dev.payos.vn", // ✅ THÊM: Added PayOS
      ],
      imgSrc: [
        "'self'",
        "data:",
        "https://sandbox.vnpayment.vn",
        "https://dev.payos.vn", // ✅ THÊM: Added PayOS
      ],
      scriptSrc: [
        "'self'",
        "https://code.jquery.com",
        "https://sandbox.vnpayment.vn",
        "https://dev.payos.vn", // ✅ THÊM: Added PayOS
      ],
      connectSrc: [
        "'self'",
        "https://sandbox.vnpayment.vn",
        "https://dev.payos.vn", // ✅ THÊM: Added PayOS
      ],
      frameSrc: [
        "'self'",
        "https://sandbox.vnpayment.vn",
        "https://dev.payos.vn", // ✅ THÊM: Added PayOS
      ],
    },
  })
);

app.use(
  cors({
    origin: process.env.CLIENT_URL,
    methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
    credentials: true,
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

app.use("/user", UserRouter);
app.use("/rooms", RoomRouter);
app.use("/api/posts", PostRouter);
app.use("/tenants", TenantRouter);
app.use("/api/accommodations", AccommodationRouter);
app.use("/agreement-confirmations", AgreementConfirmationRouter);
// Rental requests should be the last route to avoid conflicts with other routes
app.use("/rental-requests", rentalRequestRouter);
app.use("/api/withdrawals", withdrawalRoute); // Withdrawal routes
app.use("/cotenant", CotenantRouter);
app.use("/admin", AdminRouter);
app.use("/payment", PaymentRouter);
app.use(handleError);

connectDB();

app.listen(process.env.PORT || 8080, () =>
  console.log("Server is running at ", process.env.PORT || 8080)
);
