const express = require("express");
const cors = require("cors");
const cookieParser = require("cookie-parser");
const path = require("path");
const connectDB = require("./src/config/mongo_config");
const UserRouter = require("./src/routes/userRoute");
const RoomRouter = require("./src/routes/roomRoutes");
const handleError = require("./src/utils/errorHandler");

require("dotenv").config({ path: "./config.env" });

const app = express();

// Kết nối DB
connectDB();

// Middlewares
app.use(express.json({ limit: "10kb" }));
app.use(cookieParser());

// CORS
app.use(
  cors({
    origin: process.env.CLIENT_URL || "http://localhost:3000", // fallback nếu .env thiếu
    methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
    credentials: true,
  })
);

// Middleware tĩnh để hiển thị ảnh đại diện
app.use("/uploads", express.static(path.join(__dirname, "src/uploads")));

// Test middleware
app.use((req, res, next) => {
  req.requestTime = new Date().toISOString();
  console.log(`[${req.method}] ${req.originalUrl}`);
  next();
});

// ROUTES
app.use("/user", UserRouter);
app.use("/room", RoomRouter);

// Error Handler cuối cùng
app.use(handleError);

// Run server
const PORT = process.env.PORT || 8080;
app.listen(PORT, () => {
  console.log(`✅ Server is running at http://localhost:${PORT}`);
});
