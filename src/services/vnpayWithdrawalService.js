const crypto = require("crypto");
const qs = require("qs");
const axios = require("axios");
const moment = require("moment");

class VNPayWithdrawalService {
  constructor() {
    this.vnpUrl =
      process.env.VNPAY_WITHDRAWAL_URL ||
      "https://sandbox.vnpayment.vn/merchant_webapi/api/transaction";
    this.vnpTmnCode = process.env.VNPAY_TMN_CODE || "GH3E5VUH";
    this.vnpHashSecret =
      process.env.VNPAY_SECRET || "TGHRDW9977MIGV71O2383I2E4R9DMRS4";
    // ✅ SỬA: Đổi return URL về withdrawal route
    this.vnpReturnUrl = `${process.env.BACKEND_URL || "http://localhost:8080"}/api/withdrawals/vnpay/return`;
  }

  sortObject(obj) {
    let sorted = {};
    let str = [];
    for (let key in obj) {
      if (obj.hasOwnProperty(key)) {
        str.push(encodeURIComponent(key));
      }
    }
    str.sort();
    for (let key = 0; key < str.length; key++) {
      sorted[str[key]] = encodeURIComponent(obj[str[key]]).replace(/%20/g, "+");
    }
    return sorted;
  }

  // ✅ Tạo yêu cầu rút tiền VNPay
  async createWithdrawal({
    amount,
    recipientBankCode,
    recipientAccountNumber,
    recipientName,
    transactionNote,
    requestId,
    ipAddr,
  }) {
    try {
      const WithdrawalRequest = require("../models/WithdrawalRequest");

      // Tạo transaction ID unique
      const vnpTxnRef = `WD${Date.now()}${Math.random().toString(36).substr(2, 6).toUpperCase()}`;

      const createDate = moment().format("YYYYMMDDHHmmss");
      const expireDate = moment().add(15, "minutes").format("YYYYMMDDHHmmss");

      let vnpParams = {
        vnp_Version: "2.1.0",
        vnp_Command: "pay",
        vnp_TmnCode: this.vnpTmnCode,
        vnp_Amount: amount * 100, // VNPay tính bằng xu
        vnp_CurrCode: "VND",
        vnp_TxnRef: vnpTxnRef,
        vnp_OrderInfo:
          transactionNote || `Hoan tra tien coc cho ma GD: ${requestId}`,
        vnp_OrderType: "billpayment",
        vnp_Locale: "vn",
        vnp_ReturnUrl: this.vnpReturnUrl,
        vnp_IpAddr: ipAddr || "127.0.0.1",
        vnp_CreateDate: createDate,
        vnp_ExpireDate: expireDate,
        // Thông tin người nhận
        vnp_Bill_Mobile: "", // Có thể thêm SĐT
        vnp_Bill_Email: "", // Có thể thêm email
        vnp_Bill_FirstName: recipientName,
        vnp_Bill_LastName: "",
        vnp_Bill_Address: "",
        vnp_Bill_City: "",
        vnp_Bill_Country: "VN",
        vnp_Bill_State: "",
        // Thông tin ngân hàng
        vnp_BankCode: recipientBankCode,
        vnp_Card_Type: "02", // Tài khoản ngân hàng
      };

      // Tạo secure hash
      vnpParams = this.sortObject(vnpParams);
      const signData = qs.stringify(vnpParams, { encode: false });
      const hmac = crypto.createHmac("sha512", this.vnpHashSecret);
      const signed = hmac.update(Buffer.from(signData, "utf-8")).digest("hex");
      vnpParams["vnp_SecureHash"] = signed;

      // Tạo payment URL
      const paymentUrl = `${this.vnpUrl}?${qs.stringify(vnpParams, { encode: false })}`;

      // Cập nhật withdrawal request với VNPay transaction ID
      await WithdrawalRequest.findByIdAndUpdate(requestId, {
        "paymentProcessing.vnpayTxnRef": vnpTxnRef,
        "paymentProcessing.vnpayPaymentUrl": paymentUrl,
        "paymentProcessing.processedAt": new Date(),
        status: "processing",
      });

      return {
        success: true,
        vnpayTxnRef: vnpTxnRef,
        paymentUrl: paymentUrl,
        amount: amount,
        status: "processing",
        message: "VNPay withdrawal initiated successfully",
      };
    } catch (error) {
      throw new Error(`VNPay withdrawal creation failed: ${error.message}`);
    }
  }

  // ✅ Xử lý VNPay return
  async handleVNPayReturn(vnpParams) {
    try {
      const secureHash = vnpParams["vnp_SecureHash"];
      delete vnpParams["vnp_SecureHash"];
      delete vnpParams["vnp_SecureHashType"];

      vnpParams = this.sortObject(vnpParams);
      const signData = qs.stringify(vnpParams, { encode: false });
      const hmac = crypto.createHmac("sha512", this.vnpHashSecret);
      const signed = hmac.update(Buffer.from(signData, "utf-8")).digest("hex");

      if (secureHash !== signed) {
        return {
          success: false,
          message: "Invalid signature",
          redirectUrl: `${process.env.CLIENT_URL}/withdrawal/failure?code=invalid_signature`,
        };
      }

      const vnpTxnRef = vnpParams["vnp_TxnRef"];
      const responseCode = vnpParams["vnp_ResponseCode"];
      const transactionNo = vnpParams["vnp_TransactionNo"];
      const amount = vnpParams["vnp_Amount"] / 100;

      const WithdrawalRequest = require("../models/WithdrawalRequest");

      const withdrawalRequest = await WithdrawalRequest.findOne({
        "paymentProcessing.vnpayTxnRef": vnpTxnRef,
      });

      if (!withdrawalRequest) {
        return {
          success: false,
          message: "Withdrawal request not found",
          redirectUrl: `${process.env.CLIENT_URL}/withdrawal/failure?code=request_not_found`,
        };
      }

      if (responseCode === "00") {
        // Thành công
        await WithdrawalRequest.findByIdAndUpdate(withdrawalRequest._id, {
          status: "completed",
          "paymentProcessing.vnpayTransactionNo": transactionNo,
          "paymentProcessing.vnpayResponseCode": responseCode,
          "paymentProcessing.completedAt": new Date(),
        });

        // Gửi email thông báo thành công
        await this.sendWithdrawalSuccessEmail(withdrawalRequest);

        return {
          success: true,
          message: "Withdrawal completed successfully",
          redirectUrl: `${process.env.CLIENT_URL}/withdrawal/success?requestId=${withdrawalRequest._id}&amount=${amount}`,
        };
      } else {
        // Thất bại
        await WithdrawalRequest.findByIdAndUpdate(withdrawalRequest._id, {
          status: "failed",
          "paymentProcessing.vnpayResponseCode": responseCode,
          "paymentProcessing.failureReason":
            this.getVNPayErrorMessage(responseCode),
        });

        return {
          success: false,
          message: this.getVNPayErrorMessage(responseCode),
          redirectUrl: `${process.env.CLIENT_URL}/withdrawal/failure?code=${responseCode}&requestId=${withdrawalRequest._id}`,
        };
      }
    } catch (error) {
      return {
        success: false,
        message: "Server error occurred",
        redirectUrl: `${process.env.CLIENT_URL}/withdrawal/failure?code=server_error`,
      };
    }
  }

  // ✅ Kiểm tra trạng thái giao dịch
  async checkWithdrawalStatus(vnpTxnRef) {
    try {
      const WithdrawalRequest = require("../models/WithdrawalRequest");

      const request = await WithdrawalRequest.findOne({
        "paymentProcessing.vnpayTxnRef": vnpTxnRef,
      }).populate("tenantId", "name email");

      if (!request) {
        throw new Error("Withdrawal request not found");
      }

      return {
        success: true,
        status: request.status,
        amount: request.amount,
        vnpayTxnRef: vnpTxnRef,
        vnpayTransactionNo: request.paymentProcessing.vnpayTransactionNo,
        processedAt: request.paymentProcessing.processedAt,
        completedAt: request.paymentProcessing.completedAt,
        failureReason: request.paymentProcessing.failureReason,
      };
    } catch (error) {
      throw new Error(`Status check failed: ${error.message}`);
    }
  }

  // ✅ Gửi email thông báo thành công
  async sendWithdrawalSuccessEmail(withdrawalRequest) {
    try {
      const emailService = require("./emailService");
      const populatedRequest = await withdrawalRequest.populate([
        { path: "tenantId", select: "name email" },
        { path: "roomId", populate: { path: "accommodationId" } },
      ]);

      const emailData = {
        to: populatedRequest.tenantId.email,
        subject: "✅ Withdrawal Completed Successfully via VNPay",
        template: "vnpayWithdrawalSuccess",
        context: {
          tenantName: populatedRequest.tenantId.name,
          amount: withdrawalRequest.amount,
          transactionId: withdrawalRequest.paymentProcessing.vnpayTransactionNo,
          vnpayTxnRef: withdrawalRequest.paymentProcessing.vnpayTxnRef,
          completedAt: withdrawalRequest.paymentProcessing.completedAt,
          propertyName: populatedRequest.roomId?.accommodationId?.name || "N/A",
          roomName: populatedRequest.roomId?.name || "N/A",
        },
      };

      await emailService.sendEmail(emailData);
    } catch (error) {
      console.error("Failed to send withdrawal success email:", error);
    }
  }

  // ✅ Lấy thông báo lỗi VNPay
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
}

module.exports = new VNPayWithdrawalService();
