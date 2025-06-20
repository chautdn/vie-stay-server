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
      console.log(
        "💳 Creating deposit payment record for confirmationId:",
        confirmationId
      );

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
      console.log("✅ Payment record created:", transactionId);
      return { payment, transactionId };
    } catch (error) {
      console.error("❌ Error creating deposit payment record:", error);
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
      console.log(
        "💳 Creating VNPay payment URL for transactionId:",
        transactionId
      );

      if (!transactionId) {
        throw new Error("Transaction ID is required");
      }

      const vnpUrl =
        process.env.VNPAY_URL ||
        "https://sandbox.vnpayment.vn/paymentv2/vpcpay.html";
      const vnpTmnCode = process.env.VNPAY_TMN_CODE || "GH3E5VUH";
      const vnpHashSecret =
        process.env.VNPAY_SECRET || "TGHRDW9977MIGV71O2383I2E4R9DMRS4";
      const vnpReturnUrl = `${process.env.CLIENT_URL || "http://localhost:3000"}/payment/vnpay/return`;

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
        vnp_ReturnUrl: vnpReturnUrl,
        vnp_IpAddr: ipAddr || "127.0.0.1",
        vnp_CreateDate: createDate,
      };

      console.log("VNPay params before sort:", vnpParams);

      // ✅ SỬA: Sử dụng this.sortObject
      vnpParams = this.sortObject(vnpParams);

      const signData = qs.stringify(vnpParams, { encode: false });
      const hmac = crypto.createHmac("sha512", vnpHashSecret);
      const signed = hmac.update(Buffer.from(signData, "utf-8")).digest("hex");

      console.log("Sign data:", signData);
      console.log("Generated hash:", signed);

      vnpParams["vnp_SecureHash"] = signed;

      const paymentUrl = `${vnpUrl}?${qs.stringify(vnpParams, { encode: false })}`;
      console.log("✅ VNPay URL created successfully");

      return {
        paymentMethod: "vnpay",
        paymentUrl,
        amount,
        txnRef: transactionId,
        orderInfo,
      };
    } catch (error) {
      console.error("❌ Error creating VNPay URL:", error);
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
      console.log("💳 Creating deposit payment in service...");
      console.log("ConfirmationId:", confirmationId);
      console.log("TenantId:", tenantId);
      console.log("Amount:", amount);
      console.log("Payment method:", paymentMethod);

      if (paymentMethod === "vnpay") {
        // ✅ SỬA: Tạo payment record trước
        const { payment, transactionId } =
          await this.createDepositPaymentRecord(confirmationId, paymentMethod);

        console.log(
          "✅ Payment record created with transactionId:",
          transactionId
        );

        // ✅ SỬA: Tạo VNPay URL với transactionId
        const vnpayResult = await this.createVNPayPaymentUrl({
          amount,
          orderInfo: `Deposit payment for confirmation ${confirmationId}`,
          confirmationId,
          transactionId, // ✅ Pass transactionId
          ipAddr,
        });

        console.log("✅ VNPay payment result:", vnpayResult);

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
      console.error("❌ Error in createDepositPayment service:", error);
      throw error;
    }
  }

  async handleVNPayReturn(vnpParams) {
    try {
      console.log("Received vnp_Params:", JSON.stringify(vnpParams, null, 2));
      const secureHash = vnpParams["vnp_SecureHash"];
      delete vnpParams["vnp_SecureHash"];
      delete vnpParams["vnp_SecureHashType"];

      vnpParams = this.sortObject(vnpParams);
      const signData = qs.stringify(vnpParams, { encode: false });
      const vnpHashSecret =
        process.env.VNPAY_SECRET_KEY || "TGHRDW9977MIGV71O2383I2E4R9DMRS4";
      const hmac = crypto.createHmac("sha512", vnpHashSecret);
      const signed = hmac.update(Buffer.from(signData, "utf-8")).digest("hex");

      console.log("Sign data:", signData);
      console.log("Generated signature:", signed);
      console.log("Received secureHash:", secureHash);

      if (secureHash !== signed) {
        return {
          success: false,
          redirectUrl: `${process.env.CLIENT_URL || "http://localhost:3000"}/payment/failure?code=97`,
        };
      }

      const transactionId = vnpParams["vnp_TxnRef"];
      const responseCode = vnpParams["vnp_ResponseCode"];
      const payment = await Payment.findOne({ transactionId });

      if (!payment) {
        return {
          success: false,
          redirectUrl: `${process.env.CLIENT_URL || "http://localhost:3000"}/payment/failure?code=transaction_not_found`,
        };
      }

      if (responseCode === "00") {
        await payment.markAsPaid();
        payment.gatewayResponse = vnpParams;
        await payment.save();

        const tenancyAgreement = await this.createTenancyAgreementAfterPayment(
          payment._id
        );

        return {
          success: true,
          payment,
          redirectUrl: `${process.env.CLIENT_URL || "http://localhost:3000"}/payment/success`,
        };
      } else {
        await payment.markAsFailed(`VNPay error code: ${responseCode}`);
        payment.gatewayResponse = vnpParams;
        await payment.save();

        return {
          success: false,
          payment,
          redirectUrl: `${process.env.CLIENT_URL || "http://localhost:3000"}/payment/failure?code=${responseCode}`,
        };
      }
    } catch (error) {
      console.error("Error handling VNPay return:", error);
      return {
        success: false,
        redirectUrl: `${process.env.CLIENT_URL || "http://localhost:3000"}/payment/failure?code=server_error`,
      };
    }
  }

  async createTenancyAgreementAfterPayment(paymentId) {
    try {
      const payment = await Payment.findById(paymentId);
      const confirmation = await AgreementConfirmation.findById(
        payment.agreementConfirmationId
      )
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

      const agreementData = {
        tenantId: confirmation.tenantId._id,
        roomId: confirmation.roomId._id,
        accommodationId: confirmation.roomId.accommodationId._id,
        landlordId: confirmation.roomId.accommodationId.ownerId._id,
        startDate: confirmation.agreementTerms.startDate,
        endDate: confirmation.agreementTerms.endDate,
        monthlyRent: confirmation.agreementTerms.monthlyRent,
        deposit: confirmation.agreementTerms.deposit,
        status: "active",
        notes: confirmation.agreementTerms.notes,
        utilityRates:
          confirmation.agreementTerms.utilityRates ||
          confirmation.roomId.utilityRates,
        additionalFees:
          confirmation.agreementTerms.additionalFees ||
          confirmation.roomId.additionalFees,
      };

      console.log(
        "Creating TenancyAgreement with data:",
        JSON.stringify(agreementData, null, 2)
      );

      const tenancyAgreement = new TenancyAgreement(agreementData);
      await tenancyAgreement.save();

      confirmation.tenancyAgreementId = tenancyAgreement._id;
      confirmation.paymentId = payment._id;
      await confirmation.save();

      const emailService = require("./emailService");
      await emailService.sendPaymentSuccessEmail(confirmation.tenantId.email, {
        tenantName: confirmation.tenantId.name,
        amount: payment.amount,
        transactionId: payment.transactionId,
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

      return tenancyAgreement;
    } catch (error) {
      console.error("Error creating tenancy agreement after payment:", error);
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
      console.error("Error getting payments by tenant:", error);
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
      console.error("Error getting payment details:", error);
      throw error;
    }
  }
}

module.exports = new PaymentService();
