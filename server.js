const express = require("express");
const cors = require("cors");
const cookieParser = require("cookie-parser");
const connectDB = require("./src/config/mongo_config");
const UserRouter = require("./src/routes/userRoute");
const RoomRouter = require("./src/routes/roomRoutes"); // <-- thêm dòng này
const handleError = require("./src/utils/errorHandler");
const session = require("express-session");
require("dotenv").config();

const app = express();

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const allowedOrigins = process.env.CLIENT_URL;

app.use(
  cors({
    origin: function (origin, callback) {
      console.log(`Lỗi đến từ ${origin}`);
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error("Not allowed by CORS"));
      }
    },
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS", "PATCH"],
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

//Session setting
app.use(
  session({
    secret: process.env.SECRET_KEY,
    resave: false,
    saveUninitialized: false,
    cookie: {
      maxAge: 5 * 60 * 1000,
    },
  })
);

app.use("/user", UserRouter);
app.use("/api/v1/rooms", RoomRouter); // <-- thêm dòng này để định tuyến phòng

app.use(handleError);

connectDB();

app.listen(process.env.PORT || 8080, () =>
  console.log("Server is running at ", process.env.PORT || 8080)
);
