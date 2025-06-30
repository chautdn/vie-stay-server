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
      console.log("=== HANDLING VNPAY RETURN ===");
      console.log("Received vnp_Params:", JSON.stringify(vnpParams, null, 2));

      const secureHash = vnpParams["vnp_SecureHash"];
      delete vnpParams["vnp_SecureHash"];
      delete vnpParams["vnp_SecureHashType"];

      vnpParams = this.sortObject(vnpParams);
      const signData = qs.stringify(vnpParams, { encode: false });
      const vnpHashSecret =
        process.env.VNPAY_SECRET || "TGHRDW9977MIGV71O2383I2E4R9DMRS4";
      const hmac = crypto.createHmac("sha512", vnpHashSecret);
      const signed = hmac.update(Buffer.from(signData, "utf-8")).digest("hex");

      console.log("Sign data:", signData);
      console.log("Generated signature:", signed);
      console.log("Received secureHash:", secureHash);

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
        console.log("✅ Payment successful, processing...");

        // ✅ Mark payment as paid
        await payment.markAsPaid();
        payment.gatewayResponse = vnpParams;
        await payment.save();

        console.log("✅ Payment marked as paid");

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
          roomUpdate: result.roomUpdate, // ✅ Include room update info
          redirectUrl: `${process.env.CLIENT_URL || "http://localhost:3000"}/payment/success?transactionId=${transactionId}`,
        };
      } else {
        console.log("❌ Payment failed with code:", responseCode);

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
      console.error("❌ Error handling VNPay return:", error);
      return {
        success: false,
        redirectUrl: `${process.env.CLIENT_URL || "http://localhost:3000"}/payment/failure?code=server_error`,
      };
    }
  }

  // ✅ SỬA: Method này để thêm tenant vào room sau payment success
  async createTenancyAgreementAfterPayment(paymentId) {
    try {
      console.log("=== CREATING TENANCY AGREEMENT AFTER PAYMENT ===");
      console.log("Payment ID:", paymentId);

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

      if (!confirmation) {
        throw new Error("Confirmation not found");
      }

      // ✅ THÊM: Cập nhật room - thêm tenant vào currentTenant
      const room = await Room.findById(confirmation.roomId._id);

      if (!room) {
        throw new Error("Room not found");
      }

      console.log("Current room tenants:", room.currentTenant);
      console.log("Adding tenant:", confirmation.tenantId._id);

      // Kiểm tra xem tenant đã có trong currentTenant chưa
      const tenantAlreadyExists = room.currentTenant.some(
        (tenantId) =>
          tenantId.toString() === confirmation.tenantId._id.toString()
      );

      if (!tenantAlreadyExists) {
        // Kiểm tra capacity trước khi thêm
        if (room.currentTenant.length >= room.capacity) {
          throw new Error("Room is at full capacity");
        }

        // Thêm tenant vào currentTenant
        room.currentTenant.push(confirmation.tenantId._id);

        // Cập nhật availability nếu phòng đã full
        if (room.currentTenant.length >= room.capacity) {
          room.isAvailable = false;
        }

        room.updatedAt = new Date();
        await room.save();

        console.log(
          `✅ Added tenant ${confirmation.tenantId._id} to room ${room._id} after payment`
        );
        console.log(
          `📊 Room occupancy: ${room.currentTenant.length}/${room.capacity}`
        );
        console.log(`🏠 Room available: ${room.isAvailable}`);
      } else {
        console.log(
          `⚠️ Tenant ${confirmation.tenantId._id} already exists in room ${room._id}`
        );
      }

      // ✅ Tạo TenancyAgreement
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

      console.log("✅ TenancyAgreement created:", tenancyAgreement._id);

      // ✅ Cập nhật confirmation với payment và agreement references
      confirmation.tenancyAgreementId = tenancyAgreement._id;
      confirmation.paymentId = payment._id;
      confirmation.paymentStatus = "completed"; // ✅ THÊM payment status
      confirmation.paidAt = new Date(); // ✅ THÊM paid timestamp
      await confirmation.save();

      console.log(
        "✅ Confirmation updated with payment and agreement references"
      );

      // ✅ Gửi email success
      const emailService = require("./emailService");
      await emailService.sendPaymentSuccessEmail(confirmation.tenantId.email, {
        tenantName: confirmation.tenantId.name,
        amount: payment.amount,
        transactionId: payment.transactionId,
        roomName:
          confirmation.roomId.name || `Phòng ${confirmation.roomId.roomNumber}`,
        accommodationName: confirmation.roomId.accommodationId.name,
        startDate: confirmation.agreementTerms.startDate,
        endDate: confirmation.agreementTerms.endDate,
        monthlyRent: confirmation.agreementTerms.monthlyRent,
        landlordContact: {
          name: confirmation.roomId.accommodationId.ownerId.name,
          email: confirmation.roomId.accommodationId.ownerId.email,
          phone:
            confirmation.roomId.accommodationId.ownerId.phoneNumber ||
            confirmation.roomId.accommodationId.contactInfo?.phone,
        },
        roomUpdate: {
          currentOccupancy: room.currentTenant.length,
          capacity: room.capacity,
          isAvailable: room.isAvailable,
          tenantAdded: !tenantAlreadyExists,
        },
      });

      console.log("✅ Success email sent");

      return {
        tenancyAgreement,
        roomUpdate: {
          roomId: room._id,
          currentOccupancy: room.currentTenant.length,
          capacity: room.capacity,
          isAvailable: room.isAvailable,
          tenantAdded: !tenantAlreadyExists,
        },
      };
    } catch (error) {
      console.error(
        "❌ Error creating tenancy agreement after payment:",
        error
      );
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
