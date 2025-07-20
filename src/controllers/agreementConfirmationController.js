const agreementConfirmationService = require("../services/agreementConfirmationService");
const paymentService = require("../services/paymentService");

// ================================
// PUBLIC CONTROLLERS (không cần login)
// ================================

// ✅ Lấy confirmation details từ token (tenant click email)
exports.getConfirmationByToken = async (req, res) => {
  try {
    const { token } = req.params;
    console.log("🔍 Getting confirmation by token:", token);

    const confirmation =
      await agreementConfirmationService.getConfirmationByToken(token);

    res.status(200).json({
      success: true,
      message: "Confirmation details retrieved successfully",
      data: confirmation,
    });
  } catch (error) {
    console.error("❌ Error getting confirmation by token:", error);
    res.status(404).json({
      success: false,
      message: error.message || "Confirmation not found or expired",
    });
  }
};

// ✅ VNPay payment return (webhook) - SỬA HOÀN TOÀN
exports.handlePaymentReturn = async (req, res) => {
  try {
    console.log("💰 === VNPAY RETURN RECEIVED ===");
    console.log("💰 Query params:", req.query);
    console.log("💰 Method:", req.method);
    console.log("💰 URL:", req.url);

    // Extract key params
    const {
      vnp_TxnRef,
      vnp_ResponseCode,
      vnp_TransactionStatus,
      vnp_Amount,
      vnp_BankCode,
      vnp_PayDate,
      vnp_SecureHash,
    } = req.query;

    console.log("🔍 Key params:");
    console.log("- Transaction Ref:", vnp_TxnRef);
    console.log("- Response Code:", vnp_ResponseCode);
    console.log("- Transaction Status:", vnp_TransactionStatus);
    console.log("- Amount:", vnp_Amount);

    if (!vnp_TxnRef) {
      console.error("❌ Missing vnp_TxnRef");
      return res.redirect(
        `${process.env.CLIENT_URL || "http://localhost:3000"}/payment/failed?error=missing_txn_ref`
      );
    }

    // Process payment return
    const result = await paymentService.handleVNPayReturn(req.query);
    console.log("💰 Payment processing result:", result);

    if (result.success) {
      console.log("✅ Payment successful, updating confirmation...");

      // Update confirmation payment status
      if (result.payment && result.payment.agreementConfirmationId) {
        try {
          console.log("📝 Updating confirmation payment status...");

          const AgreementConfirmation = require("../models/AgreementConfirmation");
          const updatedConfirmation =
            await AgreementConfirmation.findByIdAndUpdate(
              result.payment.agreementConfirmationId,
              {
                paymentStatus: "completed",
                paidAt: new Date(),
                paymentId: result.payment._id,
              },
              { new: true }
            );

          console.log("✅ Confirmation payment status updated successfully");
          console.log("Updated confirmation:", updatedConfirmation?._id);
        } catch (updateError) {
          console.error("❌ Failed to update confirmation:", updateError);
        }
      }

      // Redirect to success page with params
      const params = new URLSearchParams({
        transactionId: result.payment.transactionId,
        amount: result.payment.amount,
        confirmationId: result.payment.agreementConfirmationId || "",
        status: "success",
      });

      const redirectUrl = `${process.env.CLIENT_URL || "http://localhost:3000"}/payment/success?${params.toString()}`;
      console.log("🔗 Redirecting to:", redirectUrl);

      res.redirect(redirectUrl);
    } else {
      console.log("❌ Payment failed:", result.error);

      const errorParam = encodeURIComponent(result.error || "payment_failed");
      res.redirect(
        `${process.env.CLIENT_URL || "http://localhost:3000"}/payment/failed?error=${errorParam}`
      );
    }
  } catch (error) {
    console.error("❌ === PAYMENT RETURN ERROR ===");
    console.error("Error:", error);
    console.error("Stack:", error.stack);

    res.redirect(
      `${process.env.CLIENT_URL || "http://localhost:3000"}/payment/failed?error=server_error`
    );
  }
};

// ================================
// TENANT CONFIRMATION ACTIONS (cần login)
// ================================

// ✅ Xác nhận đồng ý hợp đồng (tenant only)
exports.confirmAgreement = async (req, res) => {
  try {
    const { token } = req.params;
    const tenantId = req.user._id;

    console.log("✅ Tenant confirming agreement:", tenantId);

    const confirmation = await agreementConfirmationService.confirmAgreement(
      token,
      tenantId
    );

    res.status(200).json({
      success: true,
      message:
        "Agreement confirmed successfully. You can now proceed with deposit payment.",
      data: confirmation,
    });
  } catch (error) {
    console.error("❌ Error confirming agreement:", error);
    res.status(400).json({
      success: false,
      message: error.message || "Failed to confirm agreement",
    });
  }
};

// ✅ Từ chối hợp đồng (tenant only)
exports.rejectAgreement = async (req, res) => {
  try {
    const { token } = req.params;
    const { reason } = req.body;
    const tenantId = req.user._id;

    if (!reason || reason.trim() === "") {
      return res.status(400).json({
        success: false,
        message: "Rejection reason is required",
      });
    }

    console.log("❌ Tenant rejecting agreement:", tenantId);

    const confirmation = await agreementConfirmationService.rejectAgreement(
      token,
      tenantId,
      reason
    );

    res.status(200).json({
      success: true,
      message: "Agreement rejected successfully",
      data: confirmation,
    });
  } catch (error) {
    console.error("❌ Error rejecting agreement:", error);
    res.status(400).json({
      success: false,
      message: error.message || "Failed to reject agreement",
    });
  }
};

// ================================
// TENANT PAYMENT ACTIONS
// ================================

// ✅ SỬA: Tạo thanh toán tiền cọc (tenant only)
exports.createDepositPayment = async (req, res) => {
  try {
    const { confirmationId } = req.params;
    const { paymentMethod = "vnpay" } = req.body;
    const tenantId = req.user._id;

    console.log("💳 === PAYMENT REQUEST DEBUG ===");
    console.log("confirmationId:", confirmationId);
    console.log("paymentMethod:", paymentMethod);
    console.log("tenantId:", tenantId);
    console.log("req.user:", req.user);
    console.log("req.body:", req.body);

    // Kiểm tra confirmation thuộc về tenant này và đã confirmed
    const confirmation =
      await agreementConfirmationService.getConfirmationById(confirmationId);

    console.log("📄 Found confirmation:", confirmation);

    if (!confirmation) {
      console.log("❌ Confirmation not found");
      return res.status(404).json({
        success: false,
        message: "Confirmation not found",
      });
    }

    console.log("🔍 Confirmation details:");
    console.log("- Confirmation ID:", confirmation._id);
    console.log("- Tenant ID from confirmation:", confirmation.tenantId._id);
    console.log("- Current user ID:", tenantId);
    console.log("- Status:", confirmation.status);
    console.log("- Payment Status:", confirmation.paymentStatus);

    if (confirmation.tenantId._id.toString() !== tenantId.toString()) {
      console.log("❌ Tenant ID mismatch");
      return res.status(403).json({
        success: false,
        message: "You can only create payments for your own confirmations",
      });
    }

    if (confirmation.status !== "confirmed") {
      console.log("❌ Agreement not confirmed, status:", confirmation.status);
      return res.status(400).json({
        success: false,
        message: "You must confirm the agreement before making payment",
      });
    }

    
    if (paymentMethod === "vnpay") {
      
      const paymentService = require("../services/paymentService");

      const vnpayPayment = await paymentService.createDepositPayment({
        confirmationId,
        tenantId,
        paymentMethod,
        amount: confirmation.agreementTerms?.deposit || 0,
        ipAddr:
          req.headers["x-forwarded-for"]?.split(",")[0] ||
          req.connection.remoteAddress ||
          "127.0.0.1",
      });


      return res.status(200).json({
        success: true,
        message: "VNPay payment URL created successfully",
        data: vnpayPayment,
      });
    }

    
    const paymentResult = {
      paymentMethod,
      amount: confirmation.agreementTerms.deposit,
      ipAddr: req.ip,
    };

    console.log("✅ Payment result:", paymentResult);

    res.status(201).json({
      success: true,
      message: "Deposit payment created successfully",
      data: paymentResult,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message || "Failed to create payment",
    });
  }
};

exports.handlePaymentReturn = async (req, res) => {
  try {
    const vnp_Params = req.query;

    if (!vnp_Params.vnp_TxnRef) {
      return res.redirect(
        `${process.env.FRONTEND_URL}/payment/error?message=Missing transaction reference`
      );
    }

    const result = await paymentService.handleVNPayReturn(vnp_Params);

    if (result.success) {
     
      res.redirect(
        `${process.env.FRONTEND_URL}/payment/success?transactionId=${result.payment.transactionId}`
      );
    } else {
      res.redirect(
        `${process.env.FRONTEND_URL}/payment/failure?transactionId=${result.payment.transactionId}&error=${result.payment.failureReason}`
      );
    }
  } catch (error) {
    console.error("Error handling payment return:", error);
    res.redirect(
      `${process.env.FRONTEND_URL}/payment/error?message=Payment processing failed`
    );
  }
};

// Lấy payment history của tenant
exports.getTenantPayments = async (req, res) => {
  try {
    const tenantId = req.user.id;
    const { status, paymentType, page = 1, limit = 10 } = req.query;

    // Build filter
    let filter = { tenantId };
    if (status) filter.status = status;
    if (paymentType) filter.paymentType = paymentType;

    const payments = await paymentService.getPaymentsByTenant(
      tenantId,
      filter,
      { page: parseInt(page), limit: parseInt(limit) }
    );

    res.status(200).json({
      success: true,
      message: "Payments retrieved successfully",
      data: payments,
    });
  } catch (error) {
    console.error("Error getting tenant payments:", error);
    res.status(500).json({
      success: false,
      message: error.message || "Failed to create deposit payment",
    });
  }
};

// ✅ Kiểm tra trạng thái thanh toán
exports.checkPaymentStatus = async (req, res) => {
  try {
    const { transactionId } = req.params;
    const tenantId = req.user._id;

    const payments = await paymentService.getPaymentsByTenant(tenantId);
    const payment = payments.find((p) => p.transactionId === transactionId);

    if (!payment) {
      return res.status(404).json({
        success: false,
        message: "Payment not found",
      });
    }

    res.status(200).json({
      success: true,
      message: "Payment status retrieved successfully",
      data: payment,
    });
  } catch (error) {
    console.error("❌ Error checking payment status:", error);
    res.status(400).json({
      success: false,
      message: error.message || "Failed to check payment status",
    });
  }
};

// ================================
// TENANT VIEW CONTROLLERS
// ================================

// ✅ Xem tất cả confirmations của tenant
exports.getTenantConfirmations = async (req, res) => {
  try {
    const tenantId = req.user._id;
    const confirmations =
      await agreementConfirmationService.getConfirmationsByTenant(tenantId);

    res.status(200).json({
      success: true,
      message: "Tenant confirmations retrieved successfully",
      data: confirmations,
    });
  } catch (error) {
    console.error("❌ Error getting tenant confirmations:", error);
    res.status(400).json({
      success: false,
      message: error.message || "Failed to get tenant confirmations",
    });
  }
};

// ✅ Xem lịch sử thanh toán của tenant
exports.getTenantPayments = async (req, res) => {
  try {
    const tenantId = req.user._id;
    const payments = await paymentService.getPaymentsByTenant(tenantId);

    res.status(200).json({
      success: true,
      message: "Tenant payments retrieved successfully",
      data: payments,
    });
  } catch (error) {
    console.error("❌ Error getting tenant payments:", error);
    res.status(400).json({
      success: false,
      message: error.message || "Failed to get tenant payments",
    });
  }
};

// ✅ Chi tiết 1 confirmation cụ thể
exports.getConfirmationById = async (req, res) => {
  try {
    const { confirmationId } = req.params;
    const confirmation =
      await agreementConfirmationService.getConfirmationById(confirmationId);

    if (!confirmation) {
      return res.status(404).json({
        success: false,
        message: "Confirmation not found",
      });
    }

    // Kiểm tra quyền xem
    const userId = req.user._id;
    const isTenant = confirmation.tenantId._id.toString() === userId.toString();
    const isLandlord =
      confirmation.landlordId._id.toString() === userId.toString();

    if (!isTenant && !isLandlord && !req.user.role.includes("admin")) {
      return res.status(403).json({
        success: false,
        message: "You don't have permission to view this confirmation",
      });
    }

    res.status(200).json({
      success: true,
      message: "Confirmation details retrieved successfully",
      data: confirmation,
    });
  } catch (error) {
    console.error("❌ Error getting confirmation details:", error);
    res.status(400).json({
      success: false,
      message: error.message || "Failed to get confirmation details",
    });
  }
};

// ✅ Gửi lại email xác nhận
exports.resendConfirmationEmail = async (req, res) => {
  try {
    const { confirmationId } = req.params;
    const tenantId = req.user._id;

    await agreementConfirmationService.resendConfirmationEmail(
      confirmationId,
      tenantId
    );

    res.status(200).json({
      success: true,
      message: "Confirmation email resent successfully",
    });
  } catch (error) {
    console.error("❌ Error resending confirmation email:", error);
    res.status(400).json({
      success: false,
      message: error.message || "Failed to resend confirmation email",
    });
  }
};

// ================================
// ADMIN CONTROLLERS
// ================================

// ✅ Thống kê confirmations
exports.getConfirmationStats = async (req, res) => {
  try {
    const stats = await agreementConfirmationService.getConfirmationStats(
      req.query
    );

    res.status(200).json({
      success: true,
      message: "Confirmation statistics retrieved successfully",
      data: stats,
    });
  } catch (error) {
    console.error("❌ Error getting confirmation stats:", error);
    res.status(400).json({
      success: false,
      message: error.message || "Failed to get confirmation statistics",
    });
  }
};

// ✅ Làm hết hạn confirmations cũ
exports.expireOldConfirmations = async (req, res) => {
  try {
    const result = await agreementConfirmationService.expireOldConfirmations();

    res.status(200).json({
      success: true,
      message: "Old confirmations expired successfully",
      data: result,
    });
  } catch (error) {
    console.error("❌ Error expiring old confirmations:", error);
    res.status(400).json({
      success: false,
      message: error.message || "Failed to expire old confirmations",
    });
  }
};
