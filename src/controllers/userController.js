const mongoose = require('mongoose');
const User = require('../models/user');
const catchAsync = require('../utils/catchAsync');

exports.getAllUsers = catchAsync(async (req, res, next) => {
  const users = await User.find();

  res.status(200).json({
    status: 'success',
    results: users.length,
    data: {
      users,
    },
  });
});

exports.getUser = (req, res) => {
  res.status(500).json({
    status: 'error',
    message: 'This route is not yet defined!',
  });
};
exports.createUser = (req, res) => {
  res.status(500).json({
    status: 'error',
    message: 'This route is not yet defined!',
  });
};
exports.updateUser = (req, res) => {
  res.status(500).json({
    status: 'error',
    message: 'This route is not yet defined!',
  });
};
exports.deleteUser = (req, res) => {
  res.status(500).json({
    status: 'error',
    message: 'This route is not yet defined!',
  });
};
exports.getUserById = catchAsync(async (req, res, next) => {
  const userId = req.params.id;

  // Kiểm tra ID hợp lệ
  if (!mongoose.Types.ObjectId.isValid(userId)) {
    return res.status(400).json({
      status: 'fail',
      message: 'ID không hợp lệ!',
    });
  }

  const user = await User.findById(userId);

  if (!user) {
    return res.status(404).json({
      status: 'fail',
      message: 'Không tìm thấy người dùng!',
    });
  }

  res.status(200).json({
    status: 'success',
    user,
  });
});
