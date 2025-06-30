const express = require("express");
const helmet = require("helmet");
const cors = require("cors");
const cookieParser = require("cookie-parser");
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
require("dotenv").config({ path: "./config.env" });

const app = express();

app.use(express.json());

app.use(
  helmet.contentSecurityPolicy({
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://sandbox.vnpayment.vn"], // Cho phép inline styles và VNPay
      imgSrc: ["'self'", "data:", "https://sandbox.vnpayment.vn"], // Cho phép hình ảnh từ VNPay
      scriptSrc: [
        "'self'",
        "https://code.jquery.com",
        "https://sandbox.vnpayment.vn",
      ], // Cho phép jQuery và VNPay
      connectSrc: ["'self'", "https://sandbox.vnpayment.vn"], // Cho phép kết nối đến VNPay
      frameSrc: ["'self'", "https://sandbox.vnpayment.vn"], // Cho phép iframe từ VNPay
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

app.use(express.json({ limit: "10kb" }));
app.use(cookieParser());

app.use((req, res, next) => {
  req.requestTime = new Date().toISOString();
  console.log(req.cookies);
  next();
});

app.use("/user", UserRouter);
app.use("/rooms", RoomRouter);
app.use("/tenants", TenantRouter);
app.use("/api/accommodations", AccommodationRouter);
app.use("/agreement-confirmations", AgreementConfirmationRouter);
// Rental requests should be the last route to avoid conflicts with other routes
app.use("/rental-requests", rentalRequestRouter);
app.use("/cotenant", CotenantRouter);
app.use("/admin", AdminRouter);

app.use(handleError);

connectDB();

app.listen(process.env.PORT || 8080, () =>
  console.log("Server is running at ", process.env.PORT || 8080)
);
