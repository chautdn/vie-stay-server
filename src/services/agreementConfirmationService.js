const AgreementConfirmation = require("../models/AgreementConfirmation");
const RentalRequest = require("../models/RentalRequest");
const Room = require("../models/Room");
const User = require("../models/User");
const crypto = require("crypto");
const emailService = require("./emailService");

class AgreementConfirmationService {
  // ✅ Tạo confirmation từ accepted request và gửi email
  async createConfirmationFromAcceptedRequest(rentalRequestId, agreementTerms) {
    try {
      // Lấy thông tin rental request với đầy đủ populate
      const rentalRequest = await RentalRequest.findById(rentalRequestId)
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

      if (!rentalRequest || rentalRequest.status !== "accepted") {
        throw new Error("Rental request not found or not accepted");
      }

      // Tạo confirmation token
      const confirmationToken = crypto.randomBytes(32).toString("hex");

      // Lấy thông tin từ room
      const room = rentalRequest.roomId;
      const utilityRates = room.utilityRates || {};
      const additionalFees = room.additionalFees || [];

      // Tạo confirmation data
      const confirmationData = {
        rentalRequestId: rentalRequestId,
        tenantId: rentalRequest.tenantId._id,
        landlordId: room.accommodationId.ownerId._id,
        roomId: room._id,
        accommodationId: room.accommodationId._id,
        confirmationToken,
        agreementTerms: {
          ...agreementTerms,
          utilityRates,
          additionalFees,
        },
        status: "pending", // ✅ Chưa confirm
        expiresAt: new Date(Date.now() + 48 * 60 * 60 * 1000), // 48 hours
      };
      // Tạo confirmation record
      const confirmation = new AgreementConfirmation(confirmationData);
      await confirmation.save();
      const emailData = {
        tenantName: rentalRequest.tenantId.name,
        landlordName: room.accommodationId.ownerId.name,
        roomName: room.name || `Phòng ${room.roomNumber}`,
        accommodationName: room.accommodationId.name,
        monthlyRent: agreementTerms.monthlyRent,
        deposit: agreementTerms.deposit,
        startDate: agreementTerms.startDate,
        confirmationToken,
        baseUrl: process.env.FRONTEND_URL || "http://localhost:3000",
        utilityRates,
        additionalFees,
      };

      // Gửi email xác nhận
      await emailService.sendAgreementConfirmationEmail(
        rentalRequest.tenantId.email,
        emailData
      );
      return confirmation;
    } catch (error) {
      console.error("❌ Error creating agreement confirmation:", error);
      throw error;
    }
  }

  // ✅ Lấy confirmation details từ token (public - cho tenant click email)
  async getConfirmationByToken(token) {
    try {
      const confirmation = await AgreementConfirmation.findOne({
        confirmationToken: token,
        expiresAt: { $gt: new Date() }, // Chưa hết hạn
      })
        .populate("tenantId", "name email phoneNumber")
        .populate({
          path: "roomId",
          select:
            "roomNumber name type size capacity hasPrivateBathroom furnishingLevel amenities images",
          populate: {
            path: "accommodationId",
            select: "name type address amenities contactInfo images",
            populate: {
              path: "ownerId",
              select: "name email phoneNumber",
            },
          },
        });

      if (!confirmation) {
        throw new Error("Confirmation not found or expired");
      }

      return {
        _id: confirmation._id,
        status: confirmation.status,
        agreementTerms: confirmation.agreementTerms,
        tenant: confirmation.tenantId,
        landlord: confirmation.roomId.accommodationId.ownerId,
        room: confirmation.roomId,
        accommodation: confirmation.roomId.accommodationId,
        expiresAt: confirmation.expiresAt,
        createdAt: confirmation.createdAt,
      };
    } catch (error) {
      console.error("❌ Error getting confirmation by token:", error);
      throw error;
    }
  }

  // ✅ Tenant xác nhận đồng ý hợp đồng
  async confirmAgreement(token, tenantId) {
    try {
      const confirmation = await AgreementConfirmation.findOne({
        confirmationToken: token,
        tenantId: tenantId,
        status: "pending",
        expiresAt: { $gt: new Date() },
      });

      if (!confirmation) {
        throw new Error(
          "Confirmation not found, already confirmed, or expired"
        );
      }

      // Update status to confirmed
      confirmation.status = "confirmed";
      confirmation.confirmedAt = new Date();
      await confirmation.save();

      return {
        _id: confirmation._id,
        status: confirmation.status,
        confirmedAt: confirmation.confirmedAt,
        message:
          "Agreement confirmed successfully. You can now proceed with payment.",
      };
    } catch (error) {
      console.error("❌ Error confirming agreement:", error);
      throw error;
    }
  }

  // ✅ Tenant từ chối hợp đồng
  async rejectAgreement(token, tenantId, reason) {
    try {
      const confirmation = await AgreementConfirmation.findOne({
        confirmationToken: token,
        tenantId: tenantId,
        status: "pending",
        expiresAt: { $gt: new Date() },
      });

      if (!confirmation) {
        throw new Error(
          "Confirmation not found, already processed, or expired"
        );
      }

      // Update status to rejected
      confirmation.status = "rejected";
      confirmation.rejectedAt = new Date();
      confirmation.rejectionReason = reason;
      await confirmation.save();
      return {
        _id: confirmation._id,
        status: confirmation.status,
        rejectedAt: confirmation.rejectedAt,
        rejectionReason: reason,
        message: "Agreement rejected successfully.",
      };
    } catch (error) {
      console.error("❌ Error rejecting agreement:", error);
      throw error;
    }
  }

  // ✅ Lấy confirmation details by ID (sau khi confirm)
  async getConfirmationById(confirmationId) {
    try {
      const confirmation = await AgreementConfirmation.findById(confirmationId)
        .populate("tenantId", "name email phoneNumber")
        .populate("landlordId", "name email phoneNumber")
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

      return confirmation;
    } catch (error) {
      throw error;
    }
  }

  // ✅ Lấy confirmations của tenant
  async getConfirmationsByTenant(tenantId) {
    try {
      const confirmations = await AgreementConfirmation.find({ tenantId })
        .populate({
          path: "roomId",
          populate: {
            path: "accommodationId",
          },
        })
        .sort({ createdAt: -1 });

      return confirmations;
    } catch (error) {
      throw error;
    }
  }

  // ✅ Resend confirmation email
  async resendConfirmationEmail(confirmationId, tenantId) {
    try {
      const confirmation = await AgreementConfirmation.findOne({
        _id: confirmationId,
        tenantId: tenantId,
        status: "pending",
      })
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
        throw new Error("Confirmation not found or not resendable");
      }

      // Chuẩn bị data cho email
      const emailData = {
        tenantName: confirmation.tenantId.name,
        landlordName: confirmation.roomId.accommodationId.ownerId.name,
        roomName:
          confirmation.roomId.name || `Phòng ${confirmation.roomId.roomNumber}`,
        accommodationName: confirmation.roomId.accommodationId.name,
        monthlyRent: confirmation.agreementTerms.monthlyRent,
        deposit: confirmation.agreementTerms.deposit,
        startDate: confirmation.agreementTerms.startDate,
        confirmationToken: confirmation.confirmationToken,
        baseUrl: process.env.FRONTEND_URL || "http://localhost:3000",
        utilityRates: confirmation.agreementTerms.utilityRates,
        additionalFees: confirmation.agreementTerms.additionalFees,
      };

      // Gửi email
      await emailService.sendAgreementConfirmationEmail(
        confirmation.tenantId.email,
        emailData
      );
      return { message: "Email resent successfully" };
    } catch (error) {
      console.error("❌ Error resending confirmation email:", error);
      throw error;
    }
  }

  // ✅ Admin stats
  async getConfirmationStats(queryParams) {
    try {
      const { startDate, status } = queryParams;

      let query = {};

      if (startDate) {
        query.createdAt = {
          $gte: new Date(startDate),
        };
      }

      if (status) {
        query.status = status;
      }

      const total = await AgreementConfirmation.countDocuments(query);
      const pending = await AgreementConfirmation.countDocuments({
        ...query,
        status: "pending",
      });
      const confirmed = await AgreementConfirmation.countDocuments({
        ...query,
        status: "confirmed",
      });
      const rejected = await AgreementConfirmation.countDocuments({
        ...query,
        status: "rejected",
      });
      const expired = await AgreementConfirmation.countDocuments({
        ...query,
        status: "pending",
        expiresAt: { $lt: new Date() },
      });

      return {
        total,
        pending,
        confirmed,
        rejected,
        expired,
        success_rate: total > 0 ? ((confirmed / total) * 100).toFixed(2) : 0,
      };
    } catch (error) {
      throw error;
    }
  }

  // ✅ Expire old confirmations
  async expireOldConfirmations() {
    try {
      const result = await AgreementConfirmation.updateMany(
        {
          status: "pending",
          expiresAt: { $lt: new Date() },
        },
        {
          status: "expired",
          expiredAt: new Date(),
        }
      );
      return {
        expired_count: result.modifiedCount,
        message: `${result.modifiedCount} confirmations expired`,
      };
    } catch (error) {
      throw error;
    }
  }

  // ✅ THÊM: Update payment status
  async updatePaymentStatus(confirmationId, paymentStatus, paymentId) {
    try {
      const updateData = {
        paymentStatus,
      };

      if (paymentStatus === "completed") {
        updateData.paidAt = new Date();
        updateData.paymentId = paymentId;
      }

      const confirmation = await AgreementConfirmation.findByIdAndUpdate(
        confirmationId,
        updateData,
        { new: true }
      ).populate("tenantId landlordId roomId");

      if (!confirmation) {
        throw new Error("Confirmation not found");
      }

      // ✅ THÊM: Nếu payment completed, thêm tenant vào room và tạo tenancy agreement
      if (paymentStatus === "completed") {
        await this.handlePaymentCompleted(confirmation);
      }

      return confirmation;
    } catch (error) {
      console.error("❌ Error updating payment status:", error);
      throw error;
    }
  }

  // ✅ THÊM: Xử lý khi payment completed
  async handlePaymentCompleted(confirmation) {
    try {

      // Chỉ cập nhật payment status
      await AgreementConfirmation.findByIdAndUpdate(confirmation._id, {
        paymentStatus: "completed",
        paidAt: new Date(),
      });
    } catch (error) {
      console.error("❌ Error in handlePaymentCompleted:", error);
      throw error;
    }
  }

  // ✅ THÊM: Gửi email khi payment completed
  async sendPaymentCompletedEmail(confirmation) {
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
          amount: confirmation.agreementTerms.deposit,
          landlordName: confirmation.landlordId.name,
          landlordEmail: confirmation.landlordId.email,
          landlordPhone: confirmation.landlordId.phoneNumber,
          startDate: confirmation.agreementTerms.startDate,
          monthlyRent: confirmation.agreementTerms.monthlyRent,
        },
      };

      await emailService.sendEmail(emailData);
    } catch (error) {
      console.error("❌ Failed to send payment completed email:", error);
    }
  }
}

module.exports = new AgreementConfirmationService();
