const agreementConfirmationService = require("../services/agreementConfirmationService");
const { createVNPayPaymentUrl } = require("../services/paymentService");

// Lấy confirmation details theo token (public route)
exports.getConfirmationByToken = async (req, res) => {
  try {
    const { token } = req.params;
    const confirmation =
      await agreementConfirmationService.getConfirmationByToken(token);

    if (!confirmation) {
      return res.status(404).json({
        success: false,
        message: "Confirmation not found or expired",
      });
    }

    res.status(200).json({
      success: true,
      message: "Confirmation details retrieved successfully",
      data: confirmation,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message || "Failed to get confirmation details",
    });
  }
};

exports.confirmAgreement = async (req, res) => {
  try {
    const { token } = req.params;
    const tenantId = req.user.id;

    const confirmation = await agreementConfirmationService.confirmAgreement(
      token,
      tenantId
    );

    res.status(200).json({
      success: true,
      message: "Agreement confirmed successfully",
      data: {
        _id: confirmation._id,
        id: confirmation._id,
        status: confirmation.status,
        confirmedAt: confirmation.confirmedAt,
      },
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message || "Failed to confirm agreement",
    });
  }
};

exports.rejectAgreement = async (req, res) => {
  try {
    const { token } = req.params;
    const { reason } = req.body;
    const tenantId = req.user.id;

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
    console.error("Error rejecting agreement:", error);
    res.status(500).json({
      success: false,
      message: "Error rejecting agreement",
      error: error.message,
    });
  }
};

exports.getTenantConfirmations = async (req, res) => {
  try {
    const tenantId = req.user.id;

    const confirmations =
      await agreementConfirmationService.getConfirmationsByTenant(tenantId);

    res.status(200).json({
      success: true,
      message: "Tenant confirmations retrieved successfully",
      count: confirmations.length,
      data: confirmations,
    });
  } catch (error) {
    console.error("Error getting tenant confirmations:", error);
    res.status(500).json({
      success: false,
      message: "Error getting tenant confirmations",
      error: error.message,
    });
  }
};
exports.createDepositPayment = async (req, res) => {
  try {
    const { confirmationId } = req.params;
    const { paymentMethod } = req.body;
    const tenantId = req.user.id;

    const confirmation =
      await agreementConfirmationService.getConfirmationById(confirmationId);

    if (!confirmation) {
      return res.status(404).json({
        success: false,
        message: "Confirmation not found",
      });
    }

    const confirmationTenantId = confirmation.tenantId._id
      ? confirmation.tenantId._id.toString()
      : confirmation.tenantId.toString();

    console.log("Confirmation tenant ID (extracted):", confirmationTenantId);
    console.log("Request user ID:", tenantId);

    if (confirmationTenantId !== tenantId) {
      console.log("❌ User not authorized for this confirmation");
      return res.status(403).json({
        success: false,
        message: "Not authorized to create payment for this confirmation",
      });
    }

    if (confirmation.status !== "confirmed") {
      return res.status(400).json({
        success: false,
        message: "Confirmation must be confirmed before payment",
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
      amount: confirmation.agreementTerms?.deposit || 0,
      status: "created",
    };

    res.status(200).json({
      success: true,
      message: "Payment created successfully",
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
      message: "Error getting tenant payments",
      error: error.message,
    });
  }
};

// Lấy payment details
exports.getPaymentDetails = async (req, res) => {
  try {
    const { paymentId } = req.params;
    const userId = req.user.id;
    const userRole = req.user.role;

    const payment = await paymentService.getPaymentDetails(paymentId);

    if (!payment) {
      return res.status(404).json({
        success: false,
        message: "Payment not found",
      });
    }

    // Check permission: tenant can view their own payments, landlord can view payments for their properties
    if (userRole === "tenant" && payment.tenantId.toString() !== userId) {
      return res.status(403).json({
        success: false,
        message: "Unauthorized to view this payment",
      });
    }

    if (userRole === "landlord" && payment.landlordId.toString() !== userId) {
      return res.status(403).json({
        success: false,
        message: "Unauthorized to view this payment",
      });
    }

    res.status(200).json({
      success: true,
      data: payment,
    });
  } catch (error) {
    console.error("Error getting payment details:", error);
    res.status(500).json({
      success: false,
      message: "Error getting payment details",
      error: error.message,
    });
  }
};

// Check payment status (tenant only)
exports.checkPaymentStatus = async (req, res) => {
  try {
    const { transactionId } = req.params;
    const tenantId = req.user.id;

    const payment =
      await paymentService.getPaymentByTransactionId(transactionId);

    if (!payment) {
      return res.status(404).json({
        success: false,
        message: "Payment not found",
      });
    }

    if (payment.tenantId.toString() !== tenantId) {
      return res.status(403).json({
        success: false,
        message: "Unauthorized to check this payment",
      });
    }

    res.status(200).json({
      success: true,
      data: {
        transactionId: payment.transactionId,
        status: payment.status,
        amount: payment.amount,
        paymentMethod: payment.paymentMethod,
        paidAt: payment.paidAt,
        failureReason: payment.failureReason,
      },
    });
  } catch (error) {
    console.error("Error checking payment status:", error);
    res.status(500).json({
      success: false,
      message: "Error checking payment status",
      error: error.message,
    });
  }
};

// Cancel payment (tenant only) - chỉ cancel được payment pending
exports.cancelPayment = async (req, res) => {
  try {
    const { paymentId } = req.params;
    const tenantId = req.user.id;

    const payment = await paymentService.getPaymentDetails(paymentId);

    if (!payment) {
      return res.status(404).json({
        success: false,
        message: "Payment not found",
      });
    }

    if (payment.tenantId.toString() !== tenantId) {
      return res.status(403).json({
        success: false,
        message: "Unauthorized to cancel this payment",
      });
    }

    if (payment.status !== "pending") {
      return res.status(400).json({
        success: false,
        message: "Can only cancel pending payments",
      });
    }

    const cancelledPayment = await paymentService.cancelPayment(paymentId);

    res.status(200).json({
      success: true,
      message: "Payment cancelled successfully",
      data: cancelledPayment,
    });
  } catch (error) {
    console.error("Error cancelling payment:", error);
    res.status(500).json({
      success: false,
      message: "Error cancelling payment",
      error: error.message,
    });
  }
};

// Resend confirmation email (tenant only)
exports.resendConfirmationEmail = async (req, res) => {
  try {
    const { confirmationId } = req.params;
    const tenantId = req.user.id;

    const result = await agreementConfirmationService.resendConfirmationEmail(
      confirmationId,
      tenantId
    );

    res.status(200).json({
      success: true,
      message: "Confirmation email resent successfully",
      data: result,
    });
  } catch (error) {
    console.error("Error resending confirmation email:", error);
    res.status(500).json({
      success: false,
      message: "Error resending confirmation email",
      error: error.message,
    });
  }
};

// Get confirmation statistics (admin only)
exports.getConfirmationStats = async (req, res) => {
  try {
    const { startDate, endDate } = req.query;

    const stats = await agreementConfirmationService.getConfirmationStats({
      startDate: startDate ? new Date(startDate) : null,
      endDate: endDate ? new Date(endDate) : null,
    });

    res.status(200).json({
      success: true,
      data: stats,
    });
  } catch (error) {
    console.error("Error getting confirmation stats:", error);
    res.status(500).json({
      success: false,
      message: "Error getting confirmation stats",
      error: error.message,
    });
  }
};

// Expire old confirmations (cron job endpoint)
exports.expireOldConfirmations = async (req, res) => {
  try {
    const result = await agreementConfirmationService.expireOldConfirmations();

    res.status(200).json({
      success: true,
      message: "Old confirmations expired successfully",
      data: result,
    });
  } catch (error) {
    console.error("Error expiring old confirmations:", error);
    res.status(500).json({
      success: false,
      message: "Error expiring old confirmations",
      error: error.message,
    });
  }
};

// Thêm method:
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

    res.status(200).json({
      success: true,
      data: confirmation,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message || "Failed to get confirmation",
    });
  }
};
