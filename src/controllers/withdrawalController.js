const WithdrawalRequest = require("../models/WithdrawalRequest");
const Payment = require("../models/Payment");
const AgreementConfirmation = require("../models/AgreementConfirmation");
const vnpayWithdrawalService = require("../services/vnpayWithdrawalService");
const catchAsync = require("../utils/catchAsync");
const AppError = require("../utils/appError"); // ✅ THÊM import

class WithdrawalController {
  // ✅ Tenant tạo yêu cầu rút tiền
  createWithdrawalRequest = catchAsync(async (req, res, next) => {
    const { confirmationId } = req.params;
    const { amount, requestType, reason, vnpayInfo } = req.body;
    const tenantId = req.user.id;

    // Validate input
    if (!amount || !requestType || !reason || !vnpayInfo) {
      return next(new AppError("Vui lòng điền đầy đủ thông tin", 400));
    }

    // Validate confirmation và payment
    const confirmation = await AgreementConfirmation.findById(confirmationId)
      .populate("roomId")
      .populate("landlordId");

    if (!confirmation) {
      return next(
        new AppError("Không tìm thấy thông tin xác nhận agreement", 404)
      );
    }

    if (confirmation.tenantId.toString() !== tenantId) {
      return next(
        new AppError("Bạn không có quyền tạo yêu cầu rút tiền này", 403)
      );
    }

    if (confirmation.status !== "confirmed") {
      return next(new AppError("Agreement chưa được xác nhận", 400));
    }

    const payment = await Payment.findOne({
      agreementConfirmationId: confirmationId,
      status: "completed",
    });

    if (!payment) {
      return next(new AppError("Không tìm thấy thanh toán đã hoàn thành", 400));
    }

    // Check existing pending request
    const existingRequest = await WithdrawalRequest.findOne({
      tenantId,
      agreementConfirmationId: confirmationId,
      status: { $in: ["pending", "approved", "processing"] },
    });

    if (existingRequest) {
      return next(new AppError("Bạn đã có yêu cầu rút tiền đang xử lý", 400));
    }

    // Validate amount
    if (amount <= 0) {
      return next(new AppError("Số tiền phải lớn hơn 0", 400));
    }

    if (amount > payment.amount) {
      return next(
        new AppError(
          "Số tiền yêu cầu không được vượt quá số tiền đã thanh toán",
          400
        )
      );
    }

    // Create withdrawal request
    const withdrawalRequest = new WithdrawalRequest({
      tenantId,
      landlordId: confirmation.landlordId._id,
      agreementConfirmationId: confirmationId,
      paymentId: payment._id,
      roomId: confirmation.roomId._id,
      amount,
      requestType,
      reason,
      vnpayInfo,
      status: "pending",
    });

    await withdrawalRequest.save();

    // Populate data để trả về
    await withdrawalRequest.populate([
      { path: "tenantId", select: "name email phoneNumber" },
      { path: "landlordId", select: "name email phoneNumber" },
      { path: "roomId", select: "name" },
    ]);

    res.status(201).json({
      success: true,
      message: "Tạo yêu cầu rút tiền thành công",
      data: withdrawalRequest,
    });
  });

  // ✅ Tenant xem lịch sử withdrawal
  getTenantWithdrawals = catchAsync(async (req, res) => {
    const tenantId = req.user.id;
    const { page = 1, limit = 10 } = req.query;

    const requests = await WithdrawalRequest.find({ tenantId })
      .populate("roomId", "name")
      .populate("landlordId", "name email phoneNumber")
      .populate("agreementConfirmationId", "agreementTerms")
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await WithdrawalRequest.countDocuments({ tenantId });

    res.status(200).json({
      success: true,
      data: requests,
      pagination: {
        page: Number(page),
        limit: Number(limit),
        total,
        pages: Math.ceil(total / limit),
      },
    });
  });

  // ✅ Tenant hủy withdrawal (chỉ khi pending)
  cancelWithdrawal = catchAsync(async (req, res, next) => {
    const { requestId } = req.params;
    const tenantId = req.user.id;

    const request = await WithdrawalRequest.findOne({
      _id: requestId,
      tenantId,
      status: "pending",
    });

    if (!request) {
      return next(
        new AppError("Không tìm thấy yêu cầu rút tiền hoặc không thể hủy", 404)
      );
    }

    request.status = "cancelled";
    await request.save();

    res.status(200).json({
      success: true,
      message: "Hủy yêu cầu rút tiền thành công",
      data: request,
    });
  });

  // ✅ Landlord xem pending withdrawals
  getPendingWithdrawals = catchAsync(async (req, res) => {
    const landlordId = req.user.id;

    const requests = await WithdrawalRequest.find({
      landlordId,
      status: "pending",
    })
      .populate("tenantId", "name email phoneNumber")
      .populate("roomId", "name")
      .populate("agreementConfirmationId", "agreementTerms")
      .sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      data: requests,
    });
  });

  // ✅ Landlord approve withdrawal
  approveWithdrawal = catchAsync(async (req, res, next) => {
    const { requestId } = req.params;
    const {
      deductionAmount = 0,
      deductionReason = "",
      responseNote = "",
    } = req.body;
    const landlordId = req.user.id;
    const ipAddr = req.ip;

    const request = await WithdrawalRequest.findOne({
      _id: requestId,
      landlordId,
      status: "pending",
    });

    if (!request) {
      return next(
        new AppError(
          "Không tìm thấy yêu cầu rút tiền hoặc không ở trạng thái chờ xử lý",
          404
        )
      );
    }

    // Validate deduction amount
    if (deductionAmount < 0) {
      return next(new AppError("Số tiền trừ không thể âm", 400));
    }

    if (deductionAmount > request.amount) {
      return next(
        new AppError("Số tiền trừ không thể lớn hơn số tiền yêu cầu", 400)
      );
    }

    const finalAmount = request.amount - deductionAmount;

    if (finalAmount <= 0) {
      return next(new AppError("Số tiền cuối cùng phải lớn hơn 0", 400));
    }

    // Update landlord response
    request.status = "approved";
    request.landlordResponse.approvedAt = new Date();
    request.landlordResponse.responseNote = responseNote;
    request.landlordResponse.deductionAmount = deductionAmount;
    request.landlordResponse.deductionReason = deductionReason;

    await request.save();

    try {
      // Process VNPay withdrawal
      const vnpayResult = await vnpayWithdrawalService.createWithdrawal({
        amount: finalAmount,
        recipientBankCode: request.vnpayInfo.bankCode,
        recipientAccountNumber: request.vnpayInfo.accountNumber,
        recipientName: request.vnpayInfo.accountName,
        transactionNote: `Deposit refund: ${request.reason}`,
        requestId: requestId,
        ipAddr: ipAddr,
      });

      res.status(200).json({
        success: true,
        message: "Phê duyệt yêu cầu rút tiền thành công và đã khởi tạo VNPay",
        data: {
          request,
          vnpayResult,
        },
      });
    } catch (error) {
      // Rollback nếu VNPay failed
      request.status = "pending";
      request.landlordResponse.approvedAt = null;
      await request.save();

      return next(new AppError(`Lỗi khi xử lý VNPay: ${error.message}`, 500));
    }
  });

  // ✅ Landlord reject withdrawal
  rejectWithdrawal = catchAsync(async (req, res, next) => {
    const { requestId } = req.params;
    const { responseNote } = req.body;
    const landlordId = req.user.id;

    if (!responseNote || !responseNote.trim()) {
      return next(new AppError("Vui lòng nhập lý do từ chối", 400));
    }

    const request = await WithdrawalRequest.findOne({
      _id: requestId,
      landlordId,
      status: "pending",
    });

    if (!request) {
      return next(
        new AppError(
          "Không tìm thấy yêu cầu rút tiền hoặc không ở trạng thái chờ xử lý",
          404
        )
      );
    }

    request.status = "rejected";
    request.landlordResponse.rejectedAt = new Date();
    request.landlordResponse.responseNote = responseNote;

    await request.save();

    res.status(200).json({
      success: true,
      message: "Từ chối yêu cầu rút tiền thành công",
      data: request,
    });
  });

  // ✅ VNPay return handler (PUBLIC)
  handleVNPayReturn = catchAsync(async (req, res) => {
    const result = await vnpayWithdrawalService.handleVNPayReturn(req.query);
    res.redirect(result.redirectUrl);
  });

  // ✅ Check withdrawal status
  checkWithdrawalStatus = catchAsync(async (req, res, next) => {
    const { requestId } = req.params;
    const userId = req.user.id;

    const request = await WithdrawalRequest.findOne({
      _id: requestId,
      $or: [{ tenantId: userId }, { landlordId: userId }],
    });

    if (!request) {
      return next(new AppError("Không tìm thấy yêu cầu rút tiền", 404));
    }

    res.status(200).json({
      success: true,
      data: {
        status: request.status,
        amount: request.amount,
        deductionAmount: request.landlordResponse.deductionAmount,
        finalAmount: request.amount - request.landlordResponse.deductionAmount,
        vnpayTxnRef: request.paymentProcessing.vnpayTxnRef,
        vnpayTransactionNo: request.paymentProcessing.vnpayTransactionNo,
        processedAt: request.paymentProcessing.processedAt,
        completedAt: request.paymentProcessing.completedAt,
        failureReason: request.paymentProcessing.failureReason,
      },
    });
  });

  // ✅ Admin: Get all withdrawals
  getAllWithdrawals = catchAsync(async (req, res) => {
    const { page = 1, limit = 10, status } = req.query;
    const query = status ? { status } : {};

    const requests = await WithdrawalRequest.find(query)
      .populate("tenantId", "name email")
      .populate("landlordId", "name email")
      .populate("roomId", "name")
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await WithdrawalRequest.countDocuments(query);

    res.status(200).json({
      success: true,
      data: requests,
      pagination: {
        page: Number(page),
        limit: Number(limit),
        total,
        pages: Math.ceil(total / limit),
      },
    });
  });

  // ✅ Admin: Withdrawal stats
  getWithdrawalStats = catchAsync(async (req, res) => {
    const stats = await WithdrawalRequest.aggregate([
      {
        $group: {
          _id: "$status",
          count: { $sum: 1 },
          totalAmount: { $sum: "$amount" },
        },
      },
    ]);

    const totalRequests = await WithdrawalRequest.countDocuments();

    res.status(200).json({
      success: true,
      data: {
        totalRequests,
        statusBreakdown: stats,
      },
    });
  });
}

module.exports = new WithdrawalController();
