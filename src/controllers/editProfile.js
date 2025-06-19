const User = require("../models/user");
const catchAsync = require("../utils/catchAsync");
const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const multer = require("multer");
const path = require("path");
const fs = require("fs");

// Kiểm tra ID hợp lệ
const validateId = (id) => mongoose.Types.ObjectId.isValid(id);

// Cập nhật tên
const updateName = catchAsync(async (req, res) => {
  const { id } = req.params;
  const { name } = req.body;

  if (!validateId(id) || !name) {
    return res.status(400).json({ message: "Dữ liệu không hợp lệ" });
  }

  const user = await User.findByIdAndUpdate(id, { name }, { new: true });
  res.status(200).json({ message: "Đã cập nhật tên", user });
});

// Cập nhật số điện thoại
const updatePhone = catchAsync(async (req, res) => {
  const { id } = req.params;
  const { phoneNumber } = req.body;

  if (!validateId(id) || !phoneNumber) {
    return res.status(400).json({ message: "Dữ liệu không hợp lệ" });
  }

  const user = await User.findByIdAndUpdate(id, { phoneNumber }, { new: true });
  res.status(200).json({ message: "Đã cập nhật số điện thoại", user });
});

// Cập nhật mật khẩu
const updatePassword = catchAsync(async (req, res) => {
  const { id } = req.params;
  const { password } = req.body;

  if (!validateId(id) || !password) {
    return res.status(400).json({ message: "Dữ liệu không hợp lệ" });
  }

  const hashed = await bcrypt.hash(password, 12);
  const user = await User.findByIdAndUpdate(id, { password: hashed }, { new: true });

  res.status(200).json({ message: "Đã cập nhật mật khẩu", user });
});

// Upload avatar
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const folder = path.join(__dirname, "../uploads/avatars");
    fs.mkdirSync(folder, { recursive: true });
    cb(null, folder);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `avatar-${Date.now()}${ext}`);
  },
});
const upload = multer({ storage });

const uploadAvatar = upload.single("profileImage");

const updateAvatar = catchAsync(async (req, res) => {
  const { id } = req.params;
  if (!validateId(id) || !req.file) {
    return res.status(400).json({ message: "Dữ liệu không hợp lệ" });
  }

  const imagePath = `/uploads/avatars/${req.file.filename}`;
  const user = await User.findByIdAndUpdate(id, { profileImage: imagePath }, { new: true });

  res.status(200).json({ message: "Đã cập nhật ảnh đại diện", user });
});

module.exports = {
  updateName,
  updatePhone,
  updatePassword,
  updateAvatar,
  uploadAvatar,
};
