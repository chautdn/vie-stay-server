const paymentService = require("../services/paymentService");
const emailService = require("../services/emailService");
const AgreementConfirmation = require("../models/AgreementConfirmation");
const Room = require("../models/Room");

const createDepositPayment = async (req, res) => {
  try {
    const { confirmationId, paymentMethod } = req.body;
    const tenantId = req.user._id;
    const ipAddr =
      req.headers["x-forwarded-for"] || req.connection.remoteAddress;

    const confirmation = await AgreementConfirmation.findById(confirmationId);
    if (!confirmation) {
      return res.status(404).json({
        success: false,
        message: "Agreement confirmation not found",
      });
    }

    if (confirmation.tenantId.toString() !== tenantId.toString()) {
      return res.status(403).json({
        success: false,
        message:
          "Unauthorized: You can only create payments for your own confirmations",
      });
    }

    const payment = await paymentService.createDepositPayment({
      confirmationId,
      tenantId,
      paymentMethod,
      amount: confirmation.agreementTerms.deposit,
      ipAddr,
    });

    return res.status(200).json({
      success: true,
      message: "Payment created successfully",
      data: payment,
    });
  } catch (error) {
    console.error("Error creating deposit payment:", error);
    return res.status(400).json({
      success: false,
      message: error.message || "Failed to create deposit payment",
    });
  }
};

const handleVNPayReturn = async (req, res) => {
  try {
    const vnpParams = req.query;
    const result = await paymentService.handleVNPayReturn(vnpParams);

    if (result.success) {
      // Send payment success email to tenant
      const confirmation = await AgreementConfirmation.findById(
        result.payment.agreementConfirmationId
      )
        .populate({
          path: "tenantId",
          select: "name email",
        })
        .populate({
          path: "roomId",
          select: "name roomNumber",
          populate: {
            path: "accommodationId",
            select: "name",
            populate: {
              path: "ownerId",
              select: "name email phoneNumber",
            },
          },
        });

      await emailService.sendPaymentSuccessEmail(confirmation.tenantId.email, {
        tenantName: confirmation.tenantId.name,
        amount: result.payment.amount,
        transactionId: result.payment.transactionId,
        roomName:
          confirmation.roomId.name || `Phòng ${confirmation.roomId.roomNumber}`,
        accommodationName: confirmation.roomId.accommodationId.name,
        startDate: confirmation.agreementTerms.startDate,
        landlordContact: {
          name: confirmation.roomId.accommodationId.ownerId.name,
          email: confirmation.roomId.accommodationId.ownerId.email,
          phone: confirmation.roomId.accommodationId.ownerId.phoneNumber,
        },
      });

      return res.redirect(result.redirectUrl);
    } else {
      return res.redirect(result.redirectUrl);
    }
  } catch (error) {
    console.error("Error handling VNPay return:", error);
    return res.redirect(
      `${process.env.CLIENT_URL || "http://localhost:3000"}/payment/failure?code=server_error`
    );
  }
};

module.exports = {
  createDepositPayment,
  handleVNPayReturn,
};
