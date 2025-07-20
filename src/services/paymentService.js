const Payment = require("../models/Payment");
const AgreementConfirmation = require("../models/AgreementConfirmation");
const TenancyAgreement = require("../models/TenancyAgreement");
const Room = require("../models/Room");
const crypto = require("crypto");
const qs = require("qs");
const moment = require("moment");

class PaymentService {
  sortObject(obj) {
    let sorted = {};
    let str = [];
    let key;
    for (key in obj) {
      if (obj.hasOwnProperty(key)) {
        str.push(encodeURIComponent(key));
      }
    }
    str.sort();
    for (key = 0; key < str.length; key++) {
      sorted[str[key]] = encodeURIComponent(obj[str[key]]).replace(/%20/g, "+");
    }
    return sorted;
  }

  // ✅ SỬA: Method tạo deposit payment
  async createDepositPaymentRecord(confirmationId, paymentMethod) {
    try {
      const confirmation = await AgreementConfirmation.findById(confirmationId)
        .populate("tenantId")
        .populate({
          path: "roomId",
          populate: {
            path: "accommodationId",
            populate: {
              path: "ownerId",
            },
          },
        });

      if (!confirmation || confirmation.status !== "confirmed") {
        throw new Error("Agreement confirmation not found or not confirmed");
      }

      const transactionId = `VIE${Date.now()}${Math.random().toString(36).substr(2, 6).toUpperCase()}`;

      const payment = new Payment({
        agreementConfirmationId: confirmationId,
        tenantId: confirmation.tenantId._id,
        landlordId: confirmation.roomId.accommodationId.ownerId._id,
        roomId: confirmation.roomId._id,
        amount: confirmation.agreementTerms.deposit,
        paymentType: "deposit",
        paymentMethod: paymentMethod,
        transactionId: transactionId,
        status: "pending",
      });

      await payment.save();

      return { payment, transactionId };
    } catch (error) {
      throw error;
    }
  }

  // ✅ SỬA: Method tạo VNPay URL
  async createVNPayPaymentUrl({
    amount,
    orderInfo,
    confirmationId,
    transactionId,
    ipAddr,
  }) {
    try {
      if (!transactionId) {
        throw new Error("Transaction ID is required");
      }

      const vnpUrl =
        process.env.VNPAY_URL ||
        "https://sandbox.vnpayment.vn/paymentv2/vpcpay.html";
      const vnpTmnCode = process.env.VNPAY_TMN_CODE || "GH3E5VUH";
      const vnpHashSecret =
        process.env.VNPAY_SECRET || "TGHRDW9977MIGV71O2383I2E4R9DMRS4";

      // ✅ SỬA: Return URL phải point về backend API endpoint
      const vnpReturnUrl = `${process.env.BACKEND_URL || "http://localhost:8080"}/api/agreement-confirmations/payment/vnpay/return`;

      const createDate = new Date()
        .toISOString()
        .replace(/[^0-9]/g, "")
        .slice(0, 14);

      let vnpParams = {
        vnp_Version: "2.1.0",
        vnp_Command: "pay",
        vnp_TmnCode: vnpTmnCode,
        vnp_Amount: amount * 100,
        vnp_CurrCode: "VND",
        vnp_TxnRef: transactionId,
        vnp_OrderInfo:
          orderInfo || `Thanh toan tien coc cho ma GD:${transactionId}`,
        vnp_OrderType: "billpayment",
        vnp_Locale: "vn",
        vnp_ReturnUrl: vnpReturnUrl, // ✅ SỬA: Backend URL
        vnp_IpAddr: ipAddr || "127.0.0.1",
        vnp_CreateDate: createDate,
      };
      vnpParams = this.sortObject(vnpParams);

      const signData = qs.stringify(vnpParams, { encode: false });
      const hmac = crypto.createHmac("sha512", vnpHashSecret);
      const signed = hmac.update(Buffer.from(signData, "utf-8")).digest("hex");
      vnpParams["vnp_SecureHash"] = signed;

      const paymentUrl = `${vnpUrl}?${qs.stringify(vnpParams, { encode: false })}`;

      return {
        paymentMethod: "vnpay",
        paymentUrl,
        amount,
        txnRef: transactionId,
        orderInfo,
      };
    } catch (error) {
      throw new Error(`Failed to create VNPay payment URL: ${error.message}`);
    }
  }

  // ✅ SỬA: Main method để tạo deposit payment
  async createDepositPayment({
    confirmationId,
    tenantId,
    paymentMethod,
    amount,
    ipAddr,
  }) {
    try {
      if (paymentMethod === "vnpay") {
        // ✅ SỬA: Tạo payment record trước
        const { payment, transactionId } =
          await this.createDepositPaymentRecord(confirmationId, paymentMethod);

        // ✅ SỬA: Tạo VNPay URL với transactionId
        const vnpayResult = await this.createVNPayPaymentUrl({
          amount,
          orderInfo: `Deposit payment for confirmation ${confirmationId}`,
          confirmationId,
          transactionId, // ✅ Pass transactionId
          ipAddr,
        });

        return {
          paymentMethod: "vnpay",
          paymentUrl: vnpayResult.paymentUrl,
          amount,
          transactionId: payment.transactionId,
          txnRef: vnpayResult.txnRef,
        };
      }

      return {
        paymentMethod,
        amount,
        status: "pending",
      };
    } catch (error) {
      throw error;
    }
  }

  async handleVNPayReturn(vnpParams) {
    try {
      const secureHash = vnpParams["vnp_SecureHash"];
      delete vnpParams["vnp_SecureHash"];
      delete vnpParams["vnp_SecureHashType"];

      vnpParams = this.sortObject(vnpParams);
      const signData = qs.stringify(vnpParams, { encode: false });

      // ✅ SỬA: Sử dụng đúng env variable name
      const vnpHashSecret =
        process.env.VNPAY_SECRET || "TGHRDW9977MIGV71O2383I2E4R9DMRS4";
      const hmac = crypto.createHmac("sha512", vnpHashSecret);
      const signed = hmac.update(Buffer.from(signData, "utf-8")).digest("hex");

      if (secureHash !== signed) {
        console.log("❌ Invalid signature");
        return {
          success: false,
          redirectUrl: `${process.env.CLIENT_URL || "http://localhost:3000"}/payment/failure?code=97`,
        };
      }

      const transactionId = vnpParams["vnp_TxnRef"];
      const responseCode = vnpParams["vnp_ResponseCode"];

      const payment = await Payment.findOne({ transactionId });

      if (!payment) {
        console.log("❌ Payment not found for transactionId:", transactionId);
        return {
          success: false,
          redirectUrl: `${process.env.CLIENT_URL || "http://localhost:3000"}/payment/failure?code=transaction_not_found`,
        };
      }

      if (responseCode === "00") {
        payment.status = "completed";
        payment.paidAt = new Date();
        payment.externalTransactionId = vnpParams["vnp_TransactionNo"];
        payment.gatewayResponse = vnpParams;
        await payment.save();

        // ✅ Create tenancy agreement AND add tenant to room
        const result = await this.createTenancyAgreementAfterPayment(
          payment._id
        );

        console.log("✅ Tenancy agreement created and tenant added to room");
        console.log("Room update result:", result.roomUpdate);

        return {
          success: true,
          payment,
          tenancyAgreement: result.tenancyAgreement,
          roomUpdate: result.roomUpdate,
          redirectUrl: `${process.env.CLIENT_URL || "http://localhost:3000"}/payment/success?transactionId=${transactionId}&amount=${payment.amount}&confirmationId=${payment.agreementConfirmationId}`,
        };
      } else {
        payment.status = "failed";
        payment.failedAt = new Date();
        payment.failureReason = `VNPay error code: ${responseCode}`;
        payment.gatewayResponse = vnpParams;
        await payment.save();

        return {
          success: false,
          payment,
          redirectUrl: `${process.env.CLIENT_URL || "http://localhost:3000"}/payment/failure?code=${responseCode}`,
        };
      }
    } catch (error) {
      return {
        success: false,
        redirectUrl: `${process.env.CLIENT_URL || "http://localhost:3000"}/payment/failure?code=server_error`,
      };
    }
  }

  // ✅ THÊM: Method để xử lý sau khi payment thành công
  async createTenancyAgreementAfterPayment(paymentId) {
    try {
      // 1. Get payment details
      const payment = await Payment.findById(paymentId).populate({
        path: "agreementConfirmationId",
        populate: [
          { path: "tenantId", select: "name email phoneNumber" },
          { path: "landlordId", select: "name email phoneNumber" },
          { path: "roomId", populate: { path: "accommodationId" } },
        ],
      });

      if (!payment || !payment.agreementConfirmationId) {
        throw new Error("Payment or confirmation not found");
      }

      const confirmation = payment.agreementConfirmationId;

      // 2. Update confirmation payment status
      await AgreementConfirmation.findByIdAndUpdate(confirmation._id, {
        paymentStatus: "completed",
        paidAt: new Date(),
        paymentId: payment._id,
      });

      // 3. Add tenant to room
      await Room.findByIdAndUpdate(confirmation.roomId._id, {
        currentTenant: confirmation.tenantId._id,
        isAvailable: false,
        $push: {
          tenantHistory: {
            tenantId: confirmation.tenantId._id,
            startDate: confirmation.agreementTerms.startDate,
            status: "active",
          },
        },
      });

      // 4. Create tenancy agreement
      const tenancyAgreement = new TenancyAgreement({
        tenantId: confirmation.tenantId._id,
        roomId: confirmation.roomId._id,
        accommodationId: confirmation.roomId.accommodationId._id,
        landlordId: confirmation.landlordId._id,
        startDate: confirmation.agreementTerms.startDate,
        endDate: confirmation.agreementTerms.endDate,
        monthlyRent: confirmation.agreementTerms.monthlyRent,
        deposit: confirmation.agreementTerms.deposit,
        notes: confirmation.agreementTerms.notes,
        utilityRates: confirmation.agreementTerms.utilityRates,
        additionalFees: confirmation.agreementTerms.additionalFees,
        status: "active",
        paymentId: payment._id,
      });

      const savedTenancyAgreement = await tenancyAgreement.save();

      // 5. Send success email (optional)
      try {
        await this.sendPaymentSuccessEmail(confirmation, payment);
      } catch (emailError) {
        console.error("⚠️ Failed to send success email:", emailError);
        // Don't fail the whole process for email error
      }

      return {
        tenancyAgreement: savedTenancyAgreement,
        roomUpdate: true,
        confirmationUpdate: true,
      };
    } catch (error) {
      throw error;
    }
  }

  // ✅ THÊM: Send success email
  async sendPaymentSuccessEmail(confirmation, payment) {
    try {
      const emailService = require("./emailService");

      const emailData = {
        to: confirmation.tenantId.email,
        subject: "🎉 Payment Successful - Welcome to Your New Home!",
        template: "paymentSuccess",
        context: {
          tenantName: confirmation.tenantId.name,
          propertyName: confirmation.roomId.accommodationId.name,
          roomName: confirmation.roomId.name,
          amount: payment.amount,
          transactionId: payment.transactionId,
          landlordName: confirmation.landlordId.name,
          landlordEmail: confirmation.landlordId.email,
          landlordPhone: confirmation.landlordId.phoneNumber,
          startDate: confirmation.agreementTerms.startDate,
          monthlyRent: confirmation.agreementTerms.monthlyRent,
        },
      };

      await emailService.sendEmail(emailData);
    } catch (error) {
      throw error;
    }
  }

  async getPaymentsByTenant(tenantId) {
    try {
      const payments = await Payment.find({ tenantId })
        .populate({
          path: "agreementConfirmationId",
          populate: {
            path: "roomId",
            populate: {
              path: "accommodationId",
            },
          },
        })
        .sort({ createdAt: -1 });

      return payments;
    } catch (error) {
      throw error;
    }
  }

  async getPaymentDetails(paymentId) {
    try {
      const payment = await Payment.findById(paymentId)
        .populate("tenantId")
        .populate({
          path: "agreementConfirmationId",
          populate: {
            path: "roomId",
            populate: {
              path: "accommodationId",
            },
          },
        });

      return payment;
    } catch (error) {
      throw error;
    }
  }

  // ✅ THÊM: Verify VNPay signature method
  verifyVNPaySignature(vnpayData) {
    try {
      const crypto = require("crypto");
      const qs = require("qs");

      // Remove hash from data
      const { vnp_SecureHash, vnp_SecureHashType, ...dataToVerify } = vnpayData;

      // Sort parameters
      const sortedParams = this.sortObject(dataToVerify);
      const signData = qs.stringify(sortedParams, { encode: false });

      // Create signature
      const vnpHashSecret =
        process.env.VNPAY_HASH_SECRET || "TGHRDW9977MIGV71O2383I2E4R9DMRS4";
      const hmac = crypto.createHmac("sha512", vnpHashSecret);
      const signed = hmac.update(Buffer.from(signData, "utf-8")).digest("hex");

      return signed === vnp_SecureHash;
    } catch (error) {
      return false;
    }
  }

  // ✅ THÊM: Get VNPay error messages method
  getVNPayErrorMessage(responseCode) {
    const errorMessages = {
      "00": "Giao dịch thành công",
      "07": "Trừ tiền thành công. Giao dịch bị nghi ngờ (liên quan tới lừa đảo, giao dịch bất thường).",
      "09": "Giao dịch không thành công do: Thẻ/Tài khoản của khách hàng chưa đăng ký dịch vụ InternetBanking tại ngân hàng.",
      10: "Giao dịch không thành công do: Khách hàng xác thực thông tin thẻ/tài khoản không đúng quá 3 lần",
      11: "Giao dịch không thành công do: Đã hết hạn chờ thanh toán.",
      12: "Giao dịch không thành công do: Thẻ/Tài khoản của khách hàng bị khóa.",
      13: "Giao dịch không thành công do Quý khách nhập sai mật khẩu xác thực giao dịch (OTP).",
      24: "Giao dịch không thành công do: Khách hàng hủy giao dịch",
      51: "Giao dịch không thành công do: Tài khoản của quý khách không đủ số dư để thực hiện giao dịch.",
      65: "Giao dịch không thành công do: Tài khoản của Quý khách đã vượt quá hạn mức giao dịch trong ngày.",
      75: "Ngân hàng thanh toán đang bảo trì.",
      79: "Giao dịch không thành công do: KH nhập sai mật khẩu thanh toán quá số lần quy định.",
      99: "Các lỗi khác (lỗi còn lại, không có trong danh sách mã lỗi đã liệt kê)",
    };

    return errorMessages[responseCode] || "Lỗi không xác định";
  }

  // Tìm method createVNPayURL và sửa returnUrl
  async createVNPayURL(transactionId, amount, orderInfo) {
    try {
      const vnpUrl =
        process.env.VNPAY_URL ||
        "https://sandbox.vnpayment.vn/paymentv2/vpcpay.html";
      const secretKey =
        process.env.VNPAY_HASH_SECRET || "TGHRDW9977MIGV71O2383I2E4R9DMRS4";
      const tmnCode = process.env.VNPAY_TMN_CODE || "GH3E5VUH";

      // ✅ SỬA: Return URL phải point về backend để xử lý callback
      const returnUrl = `${
        process.env.BACKEND_URL || "http://localhost:8080"
      }/api/agreement-confirmations/payment/vnpay/return`;

      const createDate = moment().format("YYYYMMDDHHmmss");
      const ipAddr = "127.0.0.1"; // hoặc lấy từ request
      const locale = "vn";

      // Tạo các parameters
      let vnpParams = {
        vnp_Version: "2.1.0",
        vnp_Command: "pay",
        vnp_TmnCode: tmnCode,
        vnp_Amount: amount * 100, // VNPay tính bằng xu
        vnp_CurrCode: "VND",
        vnp_TxnRef: transactionId,
        vnp_OrderInfo: orderInfo,
        vnp_OrderType: "billpayment",
        vnp_Locale: locale,
        vnp_ReturnUrl: returnUrl,
        vnp_IpAddr: ipAddr,
        vnp_CreateDate: createDate,
      };

      // Sort và tạo sign data
      const sortedParams = this.sortObject(vnpParams);
      const signData = qs.stringify(sortedParams, { encode: false });

      // Tạo secure hash
      const hmac = crypto.createHmac("sha512", secretKey);
      const signed = hmac.update(Buffer.from(signData, "utf-8")).digest("hex");

      vnpParams.vnp_SecureHash = signed;

      // Tạo payment URL
      const paymentUrl = `${vnpUrl}?${qs.stringify(vnpParams, { encode: false })}`;

      return {
        paymentUrl,
        vnpParams,
      };
    } catch (error) {
      throw error;
    }
  }

  // ✅ THÊM: Tạo yêu cầu rút tiền VNPay
  async createWithdrawalRequest({
    tenantId,
    confirmationId,
    amount,
    requestType = "deposit_refund",
    reason,
    vnpayInfo,
  }) {
    try {
      const WithdrawalRequest = require("../models/WithdrawalRequest");

      // Validate confirmation và payment
      const confirmation = await AgreementConfirmation.findById(confirmationId)
        .populate("roomId")
        .populate("landlordId");

      if (!confirmation) {
        throw new Error("Confirmation not found");
      }

      const payment = await Payment.findOne({
        agreementConfirmationId: confirmationId,
        status: "completed",
      });

      if (!payment) {
        throw new Error("No completed payment found for this confirmation");
      }

      // Check if already has pending withdrawal
      const existingRequest = await WithdrawalRequest.findOne({
        tenantId,
        agreementConfirmationId: confirmationId,
        status: { $in: ["pending", "approved", "processing"] },
      });

      if (existingRequest) {
        throw new Error("Already has a pending withdrawal request");
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

      // Send notification to landlord
      await this.sendWithdrawalNotification(withdrawalRequest);

      return withdrawalRequest;
    } catch (error) {
      throw error;
    }
  }

  // ✅ THÊM: Landlord approve withdrawal và process VNPay
  async approveWithdrawal(
    requestId,
    landlordId,
    {
      deductionAmount = 0,
      deductionReason = "",
      responseNote = "",
      ipAddr = "127.0.0.1",
    }
  ) {
    try {
      const WithdrawalRequest = require("../models/WithdrawalRequest");
      const vnpayWithdrawalService = require("./vnpayWithdrawalService");

      const request = await WithdrawalRequest.findOne({
        _id: requestId,
        landlordId,
        status: "pending",
      });

      if (!request) {
        throw new Error("Withdrawal request not found or not pending");
      }

      const finalAmount = request.amount - deductionAmount;

      if (finalAmount <= 0) {
        throw new Error("Final amount must be greater than 0");
      }

      // Update landlord response
      request.status = "approved";
      request.landlordResponse.approvedAt = new Date();
      request.landlordResponse.responseNote = responseNote;
      request.landlordResponse.deductionAmount = deductionAmount;
      request.landlordResponse.deductionReason = deductionReason;

      await request.save();

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

      return {
        request,
        vnpayResult,
      };
    } catch (error) {
      throw error;
    }
  }

  // ✅ THÊM: Get tenant withdrawals
  async getTenantWithdrawals(tenantId) {
    try {
      const WithdrawalRequest = require("../models/WithdrawalRequest");

      const requests = await WithdrawalRequest.find({ tenantId })
        .populate("roomId")
        .populate("landlordId", "name email phoneNumber")
        .sort({ createdAt: -1 });

      return requests;
    } catch (error) {
      throw error;
    }
  }

  // ✅ THÊM: Get pending withdrawals for landlord
  async getPendingWithdrawals(landlordId) {
    try {
      const WithdrawalRequest = require("../models/WithdrawalRequest");

      const requests = await WithdrawalRequest.find({
        landlordId,
        status: "pending",
      })
        .populate("tenantId", "name email phoneNumber")
        .populate("roomId")
        .sort({ createdAt: -1 });

      return requests;
    } catch (error) {
      throw error;
    }
  }
}

module.exports = new PaymentService();
