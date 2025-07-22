const agreementConfirmationService = require("../services/agreementConfirmationService");
const paymentService = require("../services/paymentService");
const AgreementConfirmation = require("../models/AgreementConfirmation"); // ✅ THÊM import này

// ================================
// PUBLIC CONTROLLERS (không cần login)
// ================================

// ✅ Lấy confirmation details từ token (tenant click email)
exports.getConfirmationByToken = async (req, res) => {
  try {
    const { token } = req.params;

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

// ✅ Test email function (SỬA)
exports.testContractCompletedEmail = async (req, res) => {
  try {
    const { confirmationId } = req.params;

    const confirmation = await AgreementConfirmation.findById(
      confirmationId
    ).populate([
      { path: "tenantId", select: "name email phoneNumber" },
      { path: "landlordId", select: "name email phoneNumber" },
      { path: "roomId", select: "roomNumber" },
      {
        path: "roomId",
        populate: { path: "accommodationId", select: "name" },
      },
    ]);

    if (!confirmation) {
      return res.status(404).json({
        status: "error",
        message: "Confirmation not found",
      });
    }

    const emailService = require("../services/emailService");

    const emailData = {
      to: confirmation.tenantId.email,
      cc: [confirmation.landlordId.email],
      subject: "🎉 Hợp đồng thuê nhà đã hoàn thành",
      template: "contractCompleted",
      context: {
        tenantName: confirmation.tenantId.name,
        landlordName: confirmation.landlordId.name,
        roomName: confirmation.roomId.roomNumber,
        accommodationName: confirmation.roomId.accommodationId?.name || "N/A",
        startDate: confirmation.agreementTerms.startDate,
        endDate: confirmation.agreementTerms.endDate,
        monthlyRent: confirmation.agreementTerms.monthlyRent,
        deposit: confirmation.agreementTerms.deposit,
        tenantContact: {
          email: confirmation.tenantId.email,
          phone: confirmation.tenantId.phoneNumber,
        },
        landlordContact: {
          email: confirmation.landlordId.email,
          phone: confirmation.landlordId.phoneNumber,
        },
      },
    };

    console.log("📧 Testing email send to:", {
      to: emailData.to,
      cc: emailData.cc,
      subject: emailData.subject,
    });

    await emailService.sendEmail(emailData);

    res.status(200).json({
      status: "success",
      message: "Test email sent successfully",
      data: {
        sentTo: emailData.to,
        ccTo: emailData.cc,
        subject: emailData.subject,
      },
    });
  } catch (error) {
    console.error("❌ Error sending test email:", error);
    res.status(500).json({
      status: "error",
      message: "Failed to send test email: " + error.message,
    });
  }
};

// ✅ VNPay payment return (webhook)
exports.handlePaymentReturn = async (req, res) => {
  try {
    const { vnp_TxnRef, vnp_ResponseCode, vnp_TransactionStatus, vnp_Amount } =
      req.query;

    if (!vnp_TxnRef) {
      return res.redirect(
        `${process.env.CLIENT_URL || "http://localhost:3000"}/payment/failed?error=missing_txn_ref`
      );
    }

    const result = await paymentService.handleVNPayReturn(req.query);

    if (result.success) {
      if (result.payment && result.payment.agreementConfirmationId) {
        try {
          await AgreementConfirmation.findByIdAndUpdate(
            result.payment.agreementConfirmationId,
            {
              paymentStatus: "completed",
              paidAt: new Date(),
              paymentId: result.payment._id,
            },
            { new: true }
          );
        } catch (updateError) {
          console.error("❌ Failed to update confirmation:", updateError);
        }
      }

      const params = new URLSearchParams({
        transactionId: result.payment.transactionId,
        amount: result.payment.amount,
        confirmationId: result.payment.agreementConfirmationId || "",
        status: "success",
      });

      const redirectUrl = `${process.env.CLIENT_URL || "http://localhost:3000"}/payment/success?${params.toString()}`;
      res.redirect(redirectUrl);
    } else {
      const errorParam = encodeURIComponent(result.error || "payment_failed");
      res.redirect(
        `${process.env.CLIENT_URL || "http://localhost:3000"}/payment/failed?error=${errorParam}`
      );
    }
  } catch (error) {
    console.error("❌ === PAYMENT RETURN ERROR ===", error);
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

// ✅ Tạo thanh toán tiền cọc (tenant only)
exports.createDepositPayment = async (req, res) => {
  try {
    const { confirmationId } = req.params;
    const { paymentMethod = "vnpay" } = req.body;
    const tenantId = req.user._id;

    const confirmation =
      await agreementConfirmationService.getConfirmationById(confirmationId);

    if (!confirmation) {
      return res.status(404).json({
        success: false,
        message: "Confirmation not found",
      });
    }

    if (confirmation.tenantId._id.toString() !== tenantId.toString()) {
      return res.status(403).json({
        success: false,
        message: "You can only create payments for your own confirmations",
      });
    }

    if (confirmation.status !== "confirmed") {
      return res.status(400).json({
        success: false,
        message: "You must confirm the agreement before making payment",
      });
    }

    if (confirmation.paymentStatus === "completed") {
      return res.status(400).json({
        success: false,
        message: "Payment has already been completed for this confirmation",
      });
    }

    const paymentResult = await paymentService.createDepositPayment({
      confirmationId,
      tenantId,
      paymentMethod,
      amount: confirmation.agreementTerms.deposit,
      ipAddr: req.ip,
    });

    res.status(201).json({
      success: true,
      message: "Deposit payment created successfully",
      data: paymentResult,
    });
  } catch (error) {
    console.error("❌ Error creating deposit payment:", error);
    res.status(400).json({
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
