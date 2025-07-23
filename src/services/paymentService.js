const Payment = require("../models/Payment");
const AgreementConfirmation = require("../models/AgreementConfirmation");
const TenancyAgreement = require("../models/TenancyAgreement");
const Room = require("../models/Room");
const crypto = require("crypto");
const qs = require("qs");
const moment = require("moment");
const axios = require("axios");
const FormData = require("form-data");
const fs = require("fs");
const path = require("path");
const {
  generateAndUploadRentalAgreement,
} = require("../../generateRentalAgreement");
const fileUtils = require("../config/fileUtils");

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

      const transactionId = `VIE${Date.now()}${Math.random()
        .toString(36)
        .substr(2, 6)
        .toUpperCase()}`;

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
      console.error("Error creating deposit payment record:", error.message);
      throw error;
    }
  }

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
        process.env.VNPAY_HASH_SECRET || "TGHRDW9977MIGV71O2383I2E4R9DMRS4";

      const vnpReturnUrl = `${process.env.BACKEND_URL || "http://localhost:8080"}/agreement-confirmations/payment/vnpay/return`;

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
      console.error("Error creating VNPay payment URL:", error.message);
      throw new Error(`Failed to create VNPay payment URL: ${error.message}`);
    }
  }

  async createDepositPayment({
    confirmationId,
    tenantId,
    paymentMethod,
    amount,
    ipAddr,
  }) {
    try {
      if (paymentMethod === "vnpay") {
        const { payment, transactionId } =
          await this.createDepositPaymentRecord(confirmationId, paymentMethod);

        const vnpayResult = await this.createVNPayPaymentUrl({
          amount,
          orderInfo: `Deposit payment for confirmation ${confirmationId}`,
          confirmationId,
          transactionId,
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
      console.error("Error creating deposit payment:", error.message);
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

      const vnpHashSecret =
        process.env.VNPAY_HASH_SECRET || "TGHRDW9977MIGV71O2383I2E4R9DMRS4";
      const hmac = crypto.createHmac("sha512", vnpHashSecret);
      const signed = hmac.update(Buffer.from(signData, "utf-8")).digest("hex");

      if (secureHash !== signed) {
        return {
          success: false,
          redirectUrl: `${process.env.CLIENT_URL || "http://localhost:3000"}/payment/failure?code=97`,
        };
      }

      const transactionId = vnpParams["vnp_TxnRef"];
      const responseCode = vnpParams["vnp_ResponseCode"];

      const payment = await Payment.findOne({ transactionId }).populate({
        path: "agreementConfirmationId",
        populate: [
          {
            path: "tenantId",
            select: "name email phoneNumber nationalId address",
          },
          {
            path: "landlordId",
            select: "name email phoneNumber nationalId address wallet",
          },
          {
            path: "roomId",
            populate: {
              path: "accommodationId",
              select: "name address",
            },
          },
        ],
      });

      if (!payment) {
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

        // ✅ Add tenant vào room + Chuyển tiền vào ví landlord
        try {
          await Room.findByIdAndUpdate(
            payment.agreementConfirmationId.roomId._id,
            {
              currentTenant: payment.agreementConfirmationId.tenantId._id,
              isAvailable: false,
              $push: {
                tenantHistory: {
                  tenantId: payment.agreementConfirmationId.tenantId._id,
                  startDate:
                    payment.agreementConfirmationId.agreementTerms.startDate,
                  status: "payment_completed",
                  paymentDate: new Date(),
                  paymentId: payment._id,
                },
              },
            },
            { new: true }
          );

          await AgreementConfirmation.findByIdAndUpdate(
            payment.agreementConfirmationId._id,
            {
              status: "payment_completed",
              paymentCompletedAt: new Date(),
              paymentId: payment._id,
            }
          );

          // ✅ THÊM: Chuyển tiền cọc vào ví chủ nhà (không gửi email)
          await this.transferDepositToLandlordWallet(payment);
        } catch (roomUpdateError) {
          console.error(
            "❌ Error updating room after payment:",
            roomUpdateError
          );
        }

        // Tạo hợp đồng ký
        let result;
        try {
          result = await this.createTenancyAgreementAfterPayment(
            payment.agreementConfirmationId,
            payment
          );
        } catch (contractError) {
          console.error("Contract signing failed:", contractError.message);
          return {
            success: true,
            payment,
            message:
              "Payment completed and tenant added to room, but contract signing failed. Please contact support.",
            redirectUrl: `${process.env.CLIENT_URL || "http://localhost:3000"}/payment/success?transactionId=${transactionId}&amount=${payment.amount}&confirmationId=${payment.agreementConfirmationId._id}&warning=contract_failed`,
          };
        }

        return {
          success: true,
          payment,
          tenancyAgreement: result.tenancyAgreement,
          roomUpdate: result.roomUpdate,
          redirectUrl: `${process.env.CLIENT_URL || "http://localhost:3000"}/payment/success?transactionId=${transactionId}&amount=${payment.amount}&confirmationId=${payment.agreementConfirmationId._id}`,
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
      console.error("VNPay return error:", error.message);
      return {
        success: false,
        redirectUrl: `${process.env.CLIENT_URL || "http://localhost:3000"}/payment/failure?code=server_error`,
      };
    }
  }

  // ✅ THÊM method chuyển tiền vào ví (không gửi email)
  async transferDepositToLandlordWallet(payment) {
    try {
      const User = require("../models/User");
      const Transaction = require("../models/Transaction");

      const landlordId = payment.agreementConfirmationId.landlordId._id;
      const depositAmount = payment.amount;

      // Tạo transaction record
      const transaction = new Transaction({
        user: landlordId,
        type: "deposit",
        amount: depositAmount,
        status: "success",
        message: `Tiền cọc từ ${payment.agreementConfirmationId.tenantId.name} - Phòng ${payment.agreementConfirmationId.roomId.roomNumber}`,
        relatedPayment: payment._id,
        transactionId: `DEPOSIT_${payment.transactionId}`,
      });

      await transaction.save();

      // Cập nhật ví chủ nhà
      const landlordUpdate = await User.findByIdAndUpdate(
        landlordId,
        {
          $inc: { "wallet.balance": depositAmount },
          $push: {
            "wallet.transactions": transaction._id,
          },
        },
        { new: true }
      );

      console.log(`✅ Transferred ${depositAmount} VND to landlord wallet:`, {
        landlordId: landlordId,
        newBalance: landlordUpdate.wallet.balance,
        transactionId: transaction._id,
      });

      // ✅ THÊM: Trigger frontend update thông qua custom event
      // (Sẽ được xử lý ở payment success page)
      global.walletUpdateEvent = {
        landlordId: landlordId.toString(),
        newBalance: landlordUpdate.wallet.balance,
        transaction: {
          id: transaction._id,
          type: transaction.type,
          amount: transaction.amount,
          status: transaction.status,
          message: transaction.message,
          createdAt: transaction.createdAt,
        },
      };

      return {
        success: true,
        transaction,
        newBalance: landlordUpdate.wallet.balance,
      };
    } catch (error) {
      console.error("❌ Error transferring deposit to landlord wallet:", error);
      throw error;
    }
  }

  async createTenancyAgreementAfterPayment(confirmation, payment) {
    try {
      // Validate required data
      if (!confirmation.tenantId?.name) {
        throw new Error(`Tenant information is missing`);
      }

      if (!confirmation.landlordId?.name) {
        throw new Error(`Landlord information is missing`);
      }

      if (!confirmation.roomId?.accommodationId) {
        throw new Error("Property information is missing");
      }

      const result = await this.sendContractForSigning(confirmation, payment);
      return result;
    } catch (error) {
      console.error("Error in createTenancyAgreementAfterPayment:", error);
      throw error;
    }
  }

  async sendContractForSigning(confirmation, payment, retries = 3) {
    let attempt = 0;

    while (attempt < retries) {
      try {
        attempt++;

        if (!confirmation.tenantId?.name || !confirmation.landlordId?.name) {
          throw new Error("Missing required tenant or landlord information");
        }

        // Generate contract data
        const agreementData = {
          contractId: confirmation._id.toString(),
          tenantName: confirmation.tenantId.name,
          tenantIdNumber: confirmation.tenantId.nationalId || "123456789",
          tenantAddress:
            confirmation.tenantId.address?.fullAddress || "Chưa cập nhật",
          tenantPhone: confirmation.tenantId.phoneNumber || "Chưa cập nhật",
          landlordName: confirmation.landlordId.name,
          landlordIdNumber: confirmation.landlordId.nationalId || "987654321",
          landlordAddress:
            confirmation.landlordId.address?.fullAddress || "Chưa cập nhật",
          landlordPhone: confirmation.landlordId.phoneNumber || "Chưa cập nhật",
          propertyAddress:
            confirmation.roomId.accommodationId?.address?.fullAddress ||
            confirmation.roomId.accommodationId?.name ||
            "Địa chỉ chưa cập nhật",
          propertyType: confirmation.roomId.type || "Phòng trọ",
          startDate: confirmation.agreementTerms.startDate,
          endDate: new Date(
            confirmation.agreementTerms.startDate.getTime() +
              365 * 24 * 60 * 60 * 1000
          ),
          monthlyRent: confirmation.agreementTerms.monthlyRent,
          deposit: confirmation.agreementTerms.deposit,
          paymentTerms: "Thanh toán vào ngày 5 hàng tháng qua chuyển khoản",
          utilityTerms: "Người thuê chịu chi phí điện, nước, internet",
        };

        // Generate and upload rental agreement
        const { pdfUrl, url } =
          await generateAndUploadRentalAgreement(agreementData);

        // Convert URL to Base64
        const base64String = await fileUtils.getBase64FromUrl(pdfUrl || url);

        const payload = {
          title: `Hợp đồng thuê nhà - ${confirmation._id}`,
          message: `Xin chào ${confirmation.tenantId.name},\n\nVui lòng ký vào hợp đồng thuê nhà. Chủ nhà đã ký sẵn.\n\nCảm ơn bạn!`,
          disableEmails: false,
          enableSigningOrder: false,
          expiryDays: 30,
          files: [
            {
              base64: `data:application/pdf;base64,${base64String}`,
              fileName: `rental-agreement-${confirmation._id}.pdf`,
            },
          ],
          signers: [
            {
              name: confirmation.tenantId.name,
              emailAddress: confirmation.tenantId.email,
              signerType: "Signer",
              signerOrder: 1,
              formFields: [
                {
                  fieldType: "Signature",
                  pageNumber: 2,
                  bounds: {
                    x: 340,
                    y: 285,
                    width: 180,
                    height: 50,
                  },
                  isRequired: true,
                  placeholder: "Please sign here",
                },
                {
                  fieldType: "DateSigned",
                  pageNumber: 2,
                  bounds: {
                    x: 420,
                    y: 350,
                    width: 100,
                    height: 15,
                  },
                  isRequired: true,
                  placeholder: "Date",
                },
              ],
            },
          ],
          metadata: {
            confirmationId: confirmation._id.toString(),
            tenantEmail: confirmation.tenantId.email,
            landlordEmail: confirmation.landlordId.email,
          },
        };

        const response = await fetch(
          "https://api.boldsign.com/v1/document/send",
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "X-API-KEY": process.env.BOLDSIGN_API_KEY,
              Accept: "application/json",
            },
            body: JSON.stringify(payload),
          }
        );

        const responseData = await response.json();

        if (!response.ok) {
          console.error("BoldSign Error:", responseData);
          throw new Error(`BoldSign API error: ${response.status}`);
        }

        // Update confirmation with document ID
        await AgreementConfirmation.findByIdAndUpdate(confirmation._id, {
          documentId: responseData.documentId,
          signatureStatus: "sent",
        });

        return {
          success: true,
          documentId: responseData.documentId,
          message: "Contract sent for signing successfully",
        };
      } catch (error) {
        if (attempt >= retries) {
          throw new Error(
            `Failed to send contract after ${retries} attempts: ${error.message}`
          );
        }
        await new Promise((resolve) => setTimeout(resolve, 2000 * attempt));
      }
    }
  }

  async handleSignatureCallback(data) {
    try {
      const { documentId, status, eventType } = data;

      const confirmation = await AgreementConfirmation.findOne({ documentId });
      if (!confirmation) {
        throw new Error(
          `Confirmation not found for document ID: ${documentId}`
        );
      }

      // Handle different event types
      if (eventType === "Completed" || status === "Completed") {
        // Download the signed document
        await this.downloadSignedDocument(documentId, confirmation);

        // Update confirmation status
        await AgreementConfirmation.findByIdAndUpdate(confirmation._id, {
          signatureStatus: "completed",
          signedAt: new Date(),
        });

        // Create tenancy agreement
        const tenancyAgreement =
          await this.createTenancyAgreementRecord(confirmation);

        // Update room status
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

        // Send success notification
        await this.sendContractCompletedEmail(confirmation);

        return {
          tenancyAgreement,
          roomUpdate: true,
          confirmationUpdate: true,
        };
      } else if (eventType === "Declined" || status === "Declined") {
        await AgreementConfirmation.findByIdAndUpdate(confirmation._id, {
          signatureStatus: "declined",
          declinedAt: new Date(),
        });

        return { message: `Contract was declined` };
      } else {
        // Update status for other events (Sent, Viewed, etc.)
        await AgreementConfirmation.findByIdAndUpdate(confirmation._id, {
          signatureStatus: status.toLowerCase(),
        });

        return { message: `Signature status updated to ${status}` };
      }
    } catch (error) {
      console.error("Error handling signature callback:", error.message);
      throw error;
    }
  }

  async downloadSignedDocument(documentId, confirmation) {
    try {
      const DOWNLOAD_URL = "https://api.boldsign.com/v1/document/download";

      const downloadResponse = await axios.get(DOWNLOAD_URL, {
        params: { documentId },
        headers: {
          "X-API-KEY": process.env.BOLDSIGN_API_KEY,
        },
        responseType: "arraybuffer",
        timeout: 30000,
      });

      const signedContractPath = path.join(
        __dirname,
        "../uploads/signed-contracts",
        `signed-rental-agreement-${documentId}.pdf`
      );

      fs.mkdirSync(path.dirname(signedContractPath), { recursive: true });
      fs.writeFileSync(signedContractPath, downloadResponse.data);

      await AgreementConfirmation.findByIdAndUpdate(confirmation._id, {
        signedContractPath: signedContractPath,
      });

      return signedContractPath;
    } catch (error) {
      console.error("Error downloading signed document:", error.message);
      throw error;
    }
  }

  async createTenancyAgreementRecord(confirmation) {
    try {
      const payment = await Payment.findOne({
        agreementConfirmationId: confirmation._id,
        status: "completed",
      });

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
        paymentId: payment?._id,
        signedContractPath: confirmation.signedContractPath,
        documentId: confirmation.documentId,
      });

      const savedTenancyAgreement = await tenancyAgreement.save();
      return savedTenancyAgreement;
    } catch (error) {
      console.error("Error creating tenancy agreement record:", error.message);
      throw error;
    }
  }

  async sendContractCompletedEmail(confirmation) {
    try {
      const emailService = require("./emailService");

      await confirmation.populate([
        { path: "tenantId", select: "name email phoneNumber" },
        { path: "landlordId", select: "name email phoneNumber" },
        { path: "roomId", select: "roomNumber" },
        {
          path: "roomId",
          populate: { path: "accommodationId", select: "name" }, // ✅ SỬA: accommodationId thay vì accommodation
        },
      ]);

      const emailData = {
        to: confirmation.tenantId.email,
        cc: [confirmation.landlordId.email], // ✅ Đảm bảo có CC
        subject: "🎉 Hợp đồng thuê nhà đã hoàn thành",
        template: "contractCompleted",
        context: {
          tenantName: confirmation.tenantId.name,
          landlordName: confirmation.landlordId.name,
          roomName: confirmation.roomId.roomNumber,
          accommodationName: confirmation.roomId.accommodationId?.name || "N/A", // ✅ SỬA
          startDate: confirmation.agreementTerms.startDate, // ✅ SỬA: thêm agreementTerms
          endDate: confirmation.agreementTerms.endDate, // ✅ SỬA: thêm agreementTerms
          monthlyRent: confirmation.agreementTerms.monthlyRent, // ✅ SỬA: thêm agreementTerms
          deposit: confirmation.agreementTerms.deposit, // ✅ SỬA: thêm agreementTerms
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

      console.log("📧 Sending contract completed email to:", {
        to: emailData.to,
        cc: emailData.cc,
      });

      await emailService.sendEmail(emailData);
      console.log("✅ Contract completed email sent successfully");
    } catch (error) {
      console.error("❌ Error sending contract completed email:", error);
      throw error;
    }
  }

  getBoldSignErrorMessage(error) {
    if (error.response?.data?.errors) {
      const errors = error.response.data.errors;
      if (Array.isArray(errors)) {
        return errors.map((err) => err.message || err).join(", ");
      } else if (typeof errors === "object") {
        return Object.values(errors).flat().join(", ");
      }
    }

    if (error.response?.data?.message) {
      return error.response.data.message;
    }

    return error.message || "Unknown BoldSign API error";
  }

  async getDocumentStatus(documentId) {
    try {
      const response = await axios.get(
        `https://api.boldsign.com/v1/document/properties`,
        {
          params: { documentId },
          headers: {
            "X-API-KEY": process.env.BOLDSIGN_API_KEY,
            "Content-Type": "application/json",
          },
          timeout: 10000,
        }
      );

      return response.data;
    } catch (error) {
      console.error("Error getting document status:", error.message);
      throw error;
    }
  }

  async resendDocument(documentId, signerEmail) {
    try {
      const response = await axios.post(
        `https://api.boldsign.com/v1/document/remind`,
        {
          documentId: documentId,
          signerEmails: [signerEmail],
          message: "Nhắc nhở ký hợp đồng thuê phòng",
        },
        {
          headers: {
            "X-API-KEY": process.env.BOLDSIGN_API_KEY,
            "Content-Type": "application/json",
          },
          timeout: 10000,
        }
      );

      return response.data;
    } catch (error) {
      console.error("Error resending document:", error.message);
      throw error;
    }
  }

  async addTenantToRoom(roomId, tenantId, agreementTerms, paymentInfo) {
    try {
      const roomUpdate = await Room.findByIdAndUpdate(
        roomId,
        {
          currentTenant: tenantId,
          isAvailable: false,
          $push: {
            tenantHistory: {
              tenantId: tenantId,
              startDate: agreementTerms.startDate,
              status: "payment_completed",
              paymentDate: new Date(),
              paymentId: paymentInfo._id,
              monthlyRent: agreementTerms.monthlyRent,
              deposit: agreementTerms.deposit,
            },
          },
        },
        { new: true }
      );

      return roomUpdate;
    } catch (error) {
      console.error("❌ Error adding tenant to room:", error);
      throw error;
    }
  }

  async removeTenantFromRoom(roomId, tenantId, reason = "contract_ended") {
    try {
      const roomUpdate = await Room.findByIdAndUpdate(
        roomId,
        {
          currentTenant: null,
          isAvailable: true,
          $push: {
            tenantHistory: {
              tenantId: tenantId,
              endDate: new Date(),
              status: reason,
            },
          },
        },
        { new: true }
      );

      return roomUpdate;
    } catch (error) {
      console.error("❌ Error removing tenant from room:", error);
      throw error;
    }
  }
}

module.exports = new PaymentService();
