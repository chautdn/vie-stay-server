// src/controllers/withdrawalController.js
const User = require("../models/User");
const Transaction = require("../models/Transaction");
const catchAsync = require("../utils/catchAsync");
const AppError = require("../utils/appError");
const nodemailer = require("nodemailer");

// Email Transporter
const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.AUTH_EMAIL,
    pass: process.env.AUTH_PASSWORD,
  },
});

// Generate unique transaction ID
const generateTransactionId = () => {
  return `WD${Date.now()}${Math.floor(Math.random() * 1000)}`;
};

// Send withdrawal confirmation email
const sendWithdrawalConfirmationEmail = async (
  user,
  withdrawalAmount,
  transactionId
) => {
  const emailTemplate = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background-color: #f8f9fa; padding: 20px; text-align: center; border-radius: 8px; }
        .content { padding: 20px 0; }
        .highlight { background-color: #e3f2fd; padding: 15px; border-radius: 8px; margin: 15px 0; }
        .footer { background-color: #f8f9fa; padding: 15px; text-align: center; border-radius: 8px; margin-top: 20px; }
        .amount { font-size: 24px; font-weight: bold; color: #1976d2; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h2 style="color: #1976d2; margin: 0;">Xác Nhận Yêu Cầu Rút Tiền</h2>
        </div>
        
        <div class="content">
          <p>Xin chào <strong>${user.name}</strong>,</p>
          
          <p>Chúng tôi đã nhận được yêu cầu rút tiền từ ví điện tử của bạn với thông tin như sau:</p>
          
          <div class="highlight">
            <p><strong>Mã giao dịch:</strong> ${transactionId}</p>
            <p><strong>Số tiền rút:</strong> <span class="amount">${withdrawalAmount.toLocaleString("vi-VN")}₫</span></p>
            <p><strong>Thời gian yêu cầu:</strong> ${new Date().toLocaleString("vi-VN")}</p>
            <p><strong>Tài khoản nhận:</strong> ${user.bankAccount.accountNumber} - ${user.bankAccount.bankName}</p>
            <p><strong>Chủ tài khoản:</strong> ${user.bankAccount.accountHolderName}</p>
          </div>
          
          <p><strong>Thời gian xử lý:</strong> Yêu cầu rút tiền của bạn sẽ được xử lý trong vòng <strong>7 ngày làm việc</strong> kể từ khi được phê duyệt bởi bộ phận quản lý.</p>
          
          <p>Cảm ơn bạn đã sử dụng dịch vụ của chúng tôi!</p>
        </div>
        
        <div class="footer">
          <p style="margin: 0; color: #666;">
            Email này được gửi tự động. Vui lòng không trả lời email này.<br>
            Để được hỗ trợ, vui lòng liên hệ: support@yourapp.com
          </p>
        </div>
      </div>
    </body>
    </html>
  `;

  await transporter.sendMail({
    from: process.env.AUTH_EMAIL,
    to: user.email,
    subject: "Xác nhận yêu cầu rút tiền - Đang chờ xử lý",
    html: emailTemplate,
  });
};

// Send withdrawal success email
const sendWithdrawalSuccessEmail = async (
  user,
  withdrawalAmount,
  transactionId
) => {
  const emailTemplate = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background-color: #e8f5e8; padding: 20px; text-align: center; border-radius: 8px; }
        .content { padding: 20px 0; }
        .highlight { background-color: #e8f5e8; padding: 15px; border-radius: 8px; margin: 15px 0; }
        .footer { background-color: #f8f9fa; padding: 15px; text-align: center; border-radius: 8px; margin-top: 20px; }
        .amount { font-size: 24px; font-weight: bold; color: #4caf50; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h2 style="color: #4caf50; margin: 0;">✅ Rút Tiền Thành Công</h2>
        </div>
        
        <div class="content">
          <p>Xin chào <strong>${user.name}</strong>,</p>
          
          <p>Yêu cầu rút tiền của bạn đã được xử lý thành công!</p>
          
          <div class="highlight">
            <p><strong>Mã giao dịch:</strong> ${transactionId}</p>
            <p><strong>Số tiền đã rút:</strong> <span class="amount">${withdrawalAmount.toLocaleString("vi-VN")}₫</span></p>
            <p><strong>Thời gian hoàn tất:</strong> ${new Date().toLocaleString("vi-VN")}</p>
            <p><strong>Tài khoản nhận:</strong> ${user.bankAccount.accountNumber} - ${user.bankAccount.bankName}</p>
          </div>
          
          <p>Số tiền sẽ được chuyển vào tài khoản ngân hàng của bạn trong vòng 1-2 giờ làm việc.</p>
          
          <p>Cảm ơn bạn đã sử dụng dịch vụ của chúng tôi!</p>
        </div>
        
        <div class="footer">
          <p style="margin: 0; color: #666;">
            Email này được gửi tự động. Vui lòng không trả lời email này.<br>
            Để được hỗ trợ, vui lòng liên hệ: support@yourapp.com
          </p>
        </div>
      </div>
    </body>
    </html>
  `;

  await transporter.sendMail({
    from: process.env.AUTH_EMAIL,
    to: user.email,
    subject: "Rút tiền thành công - Đã hoàn tất",
    html: emailTemplate,
  });
};

// Send bank account verification email
const sendBankVerificationEmail = async (user) => {
  const emailTemplate = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background-color: #e8f5e8; padding: 20px; text-align: center; border-radius: 8px; }
        .content { padding: 20px 0; }
        .highlight { background-color: #e8f5e8; padding: 15px; border-radius: 8px; margin: 15px 0; }
        .footer { background-color: #f8f9fa; padding: 15px; text-align: center; border-radius: 8px; margin-top: 20px; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h2 style="color: #4caf50; margin: 0;">✅ Tài Khoản Ngân Hàng Đã Được Xác Minh</h2>
        </div>
        
        <div class="content">
          <p>Xin chào <strong>${user.name}</strong>,</p>
          
          <p>Tài khoản ngân hàng của bạn đã được xác minh thành công!</p>
          
          <div class="highlight">
            <p><strong>Ngân hàng:</strong> ${user.bankAccount.bankName}</p>
            <p><strong>Số tài khoản:</strong> ${user.bankAccount.accountNumber}</p>
            <p><strong>Chủ tài khoản:</strong> ${user.bankAccount.accountHolderName}</p>
            <p><strong>Thời gian xác minh:</strong> ${new Date().toLocaleString("vi-VN")}</p>
          </div>
          
          <p>Bạn có thể bắt đầu tạo yêu cầu rút tiền từ ví điện tử của mình. Tất cả các yêu cầu rút tiền sẽ được chuyển vào tài khoản ngân hàng đã xác minh này.</p>
          
          <p>Cảm ơn bạn đã sử dụng dịch vụ của chúng tôi!</p>
        </div>
        
        <div class="footer">
          <p style="margin: 0; color: #666;">
            Email này được gửi tự động. Vui lòng không trả lời email này.<br>
            Để được hỗ trợ, vui lòng liên hệ: support@yourapp.com
          </p>
        </div>
      </div>
    </body>
    </html>
  `;

  await transporter.sendMail({
    from: process.env.AUTH_EMAIL,
    to: user.email,
    subject: "Tài khoản ngân hàng đã được xác minh",
    html: emailTemplate,
  });
};

// Check if user can withdraw
exports.checkEligibility = catchAsync(async (req, res, next) => {
  const userId = req.user._id;
  const user = await User.findById(userId);

  if (!user) {
    return next(new AppError("User not found", 404));
  }

  const hasBankAccountData = !!(user.bankAccount && user.bankAccount.bankName);
  const isVerified = user.bankAccount?.isBankAccountVerified || false;
  const walletBalance = user.wallet?.balance || 0;

  // ✅ Add the missing canWithdraw logic
  const canWithdraw =
    hasBankAccountData &&
    isVerified &&
    user.isActive !== false &&
    walletBalance >= 50000; // Minimum withdrawal amount

  const eligibilityData = {
    walletBalance,
    hasBankAccountData, // ✅ Should be boolean, not string
    bankAccount: user.bankAccount,
    isVerified,
    canWithdraw, // ✅ Add this missing field
  };

  res.status(200).json({
    status: "success",
    data: eligibilityData,
  });
});

// Add or update bank account
exports.addBankAccount = catchAsync(async (req, res, next) => {
  const userId = req.user._id;
  const { bankName, bankCode, accountNumber, accountHolderName, branch } =
    req.body;

  // Validation
  if (!bankName || !accountNumber || !accountHolderName) {
    return next(
      new AppError(
        "Bank name, account number, and account holder name are required",
        400
      )
    );
  }

  // Validate account number format
  if (!/^[0-9]{6,20}$/.test(accountNumber)) {
    return next(new AppError("Account number must be 6-20 digits", 400));
  }

  const user = await User.findById(userId);
  if (!user) {
    return next(new AppError("User not found", 404));
  }

  // Update bank account information
  user.bankAccount = {
    bankName: bankName.trim(),
    bankCode: bankCode ? bankCode.trim().toUpperCase() : undefined,
    accountNumber: accountNumber.trim(),
    accountHolderName: accountHolderName.trim(),
    branch: branch ? branch.trim() : undefined,
    isBankAccountVerified: false, // Always set to false for new/updated accounts
    addedAt: new Date(),
  };

  await user.save();

  res.status(200).json({
    status: "success",
    message:
      "Bank account information saved successfully. Verification is pending.",
    data: {
      bankAccount: user.bankAccount,
    },
  });
});

// Create withdrawal request
exports.createWithdrawalRequest = catchAsync(async (req, res, next) => {
  const userId = req.user._id;
  const { amount } = req.body;

  if (!amount || amount <= 0) {
    return next(new AppError("Valid withdrawal amount is required", 400));
  }

  const user = await User.findById(userId);
  if (!user) {
    return next(new AppError("User not found", 404));
  }

  // Check if user can withdraw
  if (!user.canWithdraw) {
    if (!user.hasBankAccountData) {
      return res.status(400).json({
        status: "error",
        message: "Bank account information required",
        code: "BANK_ACCOUNT_REQUIRED",
      });
    }

    if (!user.bankAccount.isBankAccountVerified) {
      return res.status(400).json({
        status: "error",
        message: "Bank account verification pending",
        code: "BANK_ACCOUNT_NOT_VERIFIED",
      });
    }

    if (user.wallet.balance < amount) {
      return res.status(400).json({
        status: "error",
        message: "Insufficient wallet balance",
        code: "INSUFFICIENT_BALANCE",
      });
    }
  }

  // Check minimum withdrawal amount
  const minWithdrawalAmount = 50000; // 50,000 VND
  if (amount < minWithdrawalAmount) {
    return next(
      new AppError(
        `Minimum withdrawal amount is ${minWithdrawalAmount.toLocaleString("vi-VN")}₫`,
        400
      )
    );
  }

  // Check maximum withdrawal amount
  const maxWithdrawalAmount = 10000000; // 10,000,000 VND
  if (amount > maxWithdrawalAmount) {
    return next(
      new AppError(
        `Maximum withdrawal amount is ${maxWithdrawalAmount.toLocaleString("vi-VN")}₫`,
        400
      )
    );
  }

  // Check if user has sufficient balance
  if (user.wallet.balance < amount) {
    return next(new AppError("Insufficient wallet balance", 400));
  }

  // Generate transaction ID
  const transactionId = generateTransactionId();

  // Create withdrawal transaction
  const transaction = await Transaction.create({
    user: userId,
    type: "withdraw",
    amount: amount,
    status: "pending",
    transactionId: transactionId,
    message: `Withdrawal request to ${user.bankAccount.bankName} - ${user.bankAccount.accountNumber}`,
    balanceBefore: user.wallet.balance,
    balanceAfter: user.wallet.balance, // Will be updated when approved
  });

  // Send confirmation email
  await sendWithdrawalConfirmationEmail(user, amount, transactionId);

  res.status(201).json({
    status: "success",
    message:
      "Withdrawal request created successfully. Please check your email for confirmation.",
    data: {
      transaction,
      estimatedProcessingTime: "7 business days",
    },
  });
});

// Get user's withdrawal history
exports.getWithdrawalHistory = catchAsync(async (req, res, next) => {
  const userId = req.user._id;
  const { page = 1, limit = 10, status } = req.query;

  const query = {
    user: userId,
    type: "withdraw",
  };

  if (status && status !== "all") {
    query.status = status;
  }

  const skip = (parseInt(page) - 1) * parseInt(limit);

  const withdrawals = await Transaction.find(query)
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(parseInt(limit));

  const total = await Transaction.countDocuments(query);

  res.status(200).json({
    status: "success",
    data: {
      withdrawals,
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(total / parseInt(limit)),
        totalItems: total,
        hasNext: skip + withdrawals.length < total,
        hasPrev: parseInt(page) > 1,
      },
    },
  });
});

// Admin: Get all pending withdrawals
exports.getPendingWithdrawals = catchAsync(async (req, res, next) => {
  const { page = 1, limit = 10 } = req.query;

  const skip = (parseInt(page) - 1) * parseInt(limit);

  const withdrawals = await Transaction.find({
    type: "withdraw",
    status: "pending",
  })
    .populate("user", "name email bankAccount")
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(parseInt(limit));

  const total = await Transaction.countDocuments({
    type: "withdraw",
    status: "pending",
  });

  res.status(200).json({
    status: "success",
    data: {
      withdrawals,
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(total / parseInt(limit)),
        totalItems: total,
        hasNext: skip + withdrawals.length < total,
        hasPrev: parseInt(page) > 1,
      },
    },
  });
});

// Admin: Approve withdrawal
exports.approveWithdrawal = catchAsync(async (req, res, next) => {
  const { transactionId } = req.params;
  const adminId = req.user._id;

  const transaction =
    await Transaction.findById(transactionId).populate("user");

  if (!transaction) {
    return next(new AppError("Transaction not found", 404));
  }

  if (transaction.type !== "withdraw") {
    return next(new AppError("Transaction is not a withdrawal", 400));
  }

  if (transaction.status !== "pending") {
    return next(new AppError("Transaction has already been processed", 400));
  }

  const user = transaction.user;

  // Check if user still has sufficient balance
  if (user.wallet.balance < transaction.amount) {
    return next(new AppError("User has insufficient balance", 400));
  }

  // Update user's wallet balance
  user.wallet.balance -= transaction.amount;
  await user.save();

  // Update transaction status
  transaction.status = "success";
  transaction.balanceAfter = user.wallet.balance;
  transaction.approvedBy = adminId;
  transaction.approvedAt = new Date();
  await transaction.save();

  // Send success email
  await sendWithdrawalSuccessEmail(
    user,
    transaction.amount,
    transaction.transactionId
  );

  res.status(200).json({
    status: "success",
    message: "Withdrawal approved successfully",
    data: {
      transaction,
    },
  });
});

// Admin: Reject withdrawal
exports.rejectWithdrawal = catchAsync(async (req, res, next) => {
  const { transactionId } = req.params;
  const { reason } = req.body;
  const adminId = req.user._id;

  if (!reason || reason.trim().length === 0) {
    return next(new AppError("Rejection reason is required", 400));
  }

  const transaction =
    await Transaction.findById(transactionId).populate("user");

  if (!transaction) {
    return next(new AppError("Transaction not found", 404));
  }

  if (transaction.type !== "withdraw") {
    return next(new AppError("Transaction is not a withdrawal", 400));
  }

  if (transaction.status !== "pending") {
    return next(new AppError("Transaction has already been processed", 400));
  }

  // Update transaction status
  transaction.status = "failed";
  transaction.rejectedBy = adminId;
  transaction.rejectedAt = new Date();
  transaction.rejectionReason = reason.trim();
  await transaction.save();

  // Send rejection email
  const user = transaction.user;
  const rejectionEmailTemplate = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background-color: #ffebee; padding: 20px; text-align: center; border-radius: 8px; }
        .content { padding: 20px 0; }
        .highlight { background-color: #ffebee; padding: 15px; border-radius: 8px; margin: 15px 0; }
        .footer { background-color: #f8f9fa; padding: 15px; text-align: center; border-radius: 8px; margin-top: 20px; }
        .amount { font-size: 24px; font-weight: bold; color: #f44336; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h2 style="color: #f44336; margin: 0;">❌ Yêu Cầu Rút Tiền Bị Từ Chối</h2>
        </div>
        
        <div class="content">
          <p>Xin chào <strong>${user.name}</strong>,</p>
          
          <p>Rất tiếc, yêu cầu rút tiền của bạn đã bị từ chối.</p>
          
          <div class="highlight">
            <p><strong>Mã giao dịch:</strong> ${transaction.transactionId}</p>
            <p><strong>Số tiền:</strong> <span class="amount">${transaction.amount.toLocaleString("vi-VN")}₫</span></p>
            <p><strong>Lý do từ chối:</strong> ${reason}</p>
            <p><strong>Thời gian xử lý:</strong> ${new Date().toLocaleString("vi-VN")}</p>
          </div>
          
          <p>Số dư ví của bạn vẫn được giữ nguyên. Bạn có thể tạo yêu cầu rút tiền mới sau khi khắc phục các vấn đề được nêu.</p>
          
          <p>Nếu bạn có thắc mắc về quyết định này, vui lòng liên hệ bộ phận hỗ trợ khách hàng.</p>
        </div>
        
        <div class="footer">
          <p style="margin: 0; color: #666;">
            Email này được gửi tự động. Vui lòng không trả lời email này.<br>
            Để được hỗ trợ, vui lòng liên hệ: support@yourapp.com
          </p>
        </div>
      </div>
    </body>
    </html>
  `;

  await transporter.sendMail({
    from: process.env.AUTH_EMAIL,
    to: user.email,
    subject: "Yêu cầu rút tiền bị từ chối",
    html: rejectionEmailTemplate,
  });

  res.status(200).json({
    status: "success",
    message: "Withdrawal rejected successfully",
    data: {
      transaction,
    },
  });
});

// Admin: Verify bank account
exports.verifyBankAccount = catchAsync(async (req, res, next) => {
  const { userId } = req.params;
  const adminId = req.user._id;

  const user = await User.findById(userId);
  if (!user) {
    return next(new AppError("User not found", 404));
  }

  if (!user.bankAccount || !user.hasBankAccountData) {
    return next(new AppError("User has no bank account information", 400));
  }

  if (user.bankAccount.isBankAccountVerified) {
    return next(new AppError("Bank account is already verified", 400));
  }

  // Verify bank account
  user.bankAccount.isBankAccountVerified = true;
  user.bankAccount.verifiedAt = new Date();
  user.bankAccount.verifiedBy = adminId;
  await user.save();

  // Send verification confirmation email
  await sendBankVerificationEmail(user);

  res.status(200).json({
    status: "success",
    message: "Bank account verified successfully",
    data: {
      user: {
        _id: user._id,
        name: user.name,
        email: user.email,
        bankAccount: user.bankAccount,
      },
    },
  });
});

// ✅ FIXED: Get all unverified bank accounts for admin
exports.getUnverifiedBankAccounts = catchAsync(async (req, res, next) => {
  const { page = 1, limit = 10 } = req.query;
  const skip = (parseInt(page) - 1) * parseInt(limit);

  const users = await User.find({
    "bankAccount.isBankAccountVerified": false,
    bankAccount: { $exists: true, $ne: null }, // ✅ Check if bankAccount exists instead
  })
    .select("name email bankAccount")
    .skip(skip)
    .limit(parseInt(limit))
    .sort({ createdAt: -1 });

  const total = await User.countDocuments({
    "bankAccount.isBankAccountVerified": false,
    bankAccount: { $exists: true, $ne: null }, // ✅ Same fix here
  });

  res.status(200).json({
    status: "success",
    data: {
      users,
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(total / parseInt(limit)),
        totalItems: total,
        hasNext: skip + users.length < total,
        hasPrev: parseInt(page) > 1,
      },
    },
  });
});
