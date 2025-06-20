const AgreementConfirmation = require("../models/AgreementConfirmation"); // ✅ ĐÚNG
const RentalRequest = require("../models/RentalRequest");
const Room = require("../models/Room");
const User = require("../models/User");
const crypto = require("crypto");
const emailService = require("./emailService");

class AgreementConfirmationService {
  // Tạo confirmation từ rental request đã accept
  async createConfirmationFromAcceptedRequest(rentalRequestId, agreementTerms) {
    try {
      console.log("=== CREATING AGREEMENT CONFIRMATION ===");
      console.log("Rental Request ID:", rentalRequestId);
      console.log("Agreement Terms:", agreementTerms);

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

      console.log("Rental request found:", rentalRequest._id);

      // Tạo confirmation token
      const confirmationToken = crypto.randomBytes(32).toString("hex");

      // Lấy utilityRates và additionalFees từ room
      const room = rentalRequest.roomId;
      const utilityRates = room.utilityRates || {};
      const additionalFees = room.additionalFees || [];

      // Chuẩn bị data cho AgreementConfirmation
      const confirmationData = {
        rentalRequestId: rentalRequestId,
        tenantId: rentalRequest.tenantId._id,
        landlordId: room.accommodationId.ownerId._id,
        roomId: room._id,
        confirmationToken,
        agreementTerms: {
          startDate: agreementTerms.startDate,
          endDate: agreementTerms.endDate,
          monthlyRent: agreementTerms.monthlyRent,
          deposit: agreementTerms.deposit,
          notes: agreementTerms.notes || "",
          utilityRates,
          additionalFees,
        },
        status: "pending",
        expiresAt: new Date(Date.now() + 48 * 60 * 60 * 1000), // 48 hours
      };

      console.log(
        "Creating AgreementConfirmation with data:",
        confirmationData
      );

      // Tạo agreement confirmation - CHỈ TẠO AgreementConfirmation
      const confirmation = new AgreementConfirmation(confirmationData);
      await confirmation.save();

      console.log(
        "✅ AgreementConfirmation created successfully:",
        confirmation._id
      );

      // Chuẩn bị data cho email
      const emailData = {
        tenantName: rentalRequest.tenantId.name,
        landlordName: room.accommodationId.ownerId.name,
        roomName: room.name || `Phòng ${room.roomNumber}`,
        accommodationName: room.accommodationId.name,
        monthlyRent: agreementTerms.monthlyRent,
        deposit: agreementTerms.deposit,
        startDate: agreementTerms.startDate,
        endDate: agreementTerms.endDate,
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

      console.log("✅ Email sent successfully");

      return confirmation;
    } catch (error) {
      console.error("Error creating agreement confirmation:", error);
      throw error;
    }
  }

  // Lấy confirmation theo token
  async getConfirmationByToken(token) {
    try {
      const confirmation = await AgreementConfirmation.findOne({
        confirmationToken: token,
        expiresAt: { $gt: new Date() },
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
        })
        .populate("rentalRequestId");

      return confirmation;
    } catch (error) {
      throw error;
    }
  }

  // Lấy confirmation theo ID
  async getConfirmationById(confirmationId) {
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
        })
        .populate("rentalRequestId");

      return confirmation;
    } catch (error) {
      console.error("Error getting confirmation by ID:", error);
      throw error;
    }
  }

  // Thêm method riêng cho payment (không populate tenant):
  async getConfirmationForPayment(confirmationId) {
    try {
      const confirmation = await AgreementConfirmation.findById(confirmationId)
        .populate({
          path: "roomId",
          populate: {
            path: "accommodationId",
            populate: {
              path: "ownerId",
            },
          },
        })
        .populate("rentalRequestId");
      // Không populate tenantId để giữ nguyên ObjectId

      return confirmation;
    } catch (error) {
      throw error;
    }
  }

  // Xác nhận agreement
  async confirmAgreement(token, tenantId) {
    try {
      const confirmation = await AgreementConfirmation.findOne({
        confirmationToken: token,
        status: "pending",
        expiresAt: { $gt: new Date() },
      });

      if (!confirmation) {
        throw new Error("Confirmation not found or expired");
      }

      if (confirmation.tenantId.toString() !== tenantId) {
        throw new Error("Unauthorized to confirm this agreement");
      }

      confirmation.status = "confirmed";
      confirmation.confirmedAt = new Date();
      await confirmation.save();

      return confirmation;
    } catch (error) {
      throw error;
    }
  }

  // Từ chối agreement
  async rejectAgreement(token, tenantId, reason) {
    try {
      const confirmation = await this.getConfirmationByToken(token);

      if (!confirmation) {
        throw new Error("Confirmation not found or expired");
      }

      if (confirmation.tenantId._id.toString() !== tenantId) {
        throw new Error("Unauthorized to reject this agreement");
      }

      // Cập nhật status
      confirmation.status = "rejected";
      confirmation.rejectedAt = new Date();
      confirmation.rejectionReason = reason;
      await confirmation.save();

      // Cập nhật lại rental request về pending để landlord có thể xử lý lại
      await RentalRequest.findByIdAndUpdate(confirmation.rentalRequestId, {
        status: "pending",
        landlordResponse: `Tenant đã từ chối hợp đồng: ${reason}`,
      });

      return confirmation;
    } catch (error) {
      console.error("Error rejecting agreement:", error);
      throw error;
    }
  }

  // Lấy confirmations của tenant
  async getConfirmationsByTenant(tenantId) {
    try {
      const confirmations = await AgreementConfirmation.find({
        tenantId: tenantId,
      })
        .populate({
          path: "roomId",
          populate: {
            path: "accommodationId",
          },
        })
        .populate("paymentId")
        .populate("tenancyAgreementId")
        .sort({ createdAt: -1 });

      return confirmations;
    } catch (error) {
      console.error("Error getting confirmations by tenant:", error);
      throw error;
    }
  }

  // Gửi lại email xác nhận
  async resendConfirmationEmail(confirmationId, tenantId) {
    try {
      const confirmation = await this.getConfirmationById(confirmationId);

      if (!confirmation) {
        throw new Error("Confirmation not found");
      }

      if (confirmation.tenantId._id.toString() !== tenantId) {
        throw new Error("Unauthorized to resend this confirmation");
      }

      if (confirmation.status !== "pending") {
        throw new Error("Can only resend pending confirmations");
      }

      if (confirmation.expiresAt < new Date()) {
        throw new Error("Confirmation has expired");
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
        endDate: confirmation.agreementTerms.endDate,
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
      console.error("Error resending confirmation email:", error);
      throw error;
    }
  }

  // Thống kê confirmations
  async getConfirmationStats(filters = {}) {
    try {
      let matchStage = {};

      if (filters.startDate && filters.endDate) {
        matchStage.createdAt = {
          $gte: filters.startDate,
          $lte: filters.endDate,
        };
      }

      const stats = await AgreementConfirmation.aggregate([
        { $match: matchStage },
        {
          $group: {
            _id: "$status",
            count: { $sum: 1 },
          },
        },
      ]);

      // Format stats
      const formattedStats = {
        pending: 0,
        confirmed: 0,
        rejected: 0,
        expired: 0,
        total: 0,
      };

      stats.forEach((stat) => {
        formattedStats[stat._id] = stat.count;
        formattedStats.total += stat.count;
      });

      return formattedStats;
    } catch (error) {
      console.error("Error getting confirmation stats:", error);
      throw error;
    }
  }

  // Kiểm tra và hết hạn các confirmation cũ
  async expireOldConfirmations() {
    try {
      const expiredConfirmations = await AgreementConfirmation.updateMany(
        {
          status: "pending",
          expiresAt: { $lt: new Date() },
        },
        {
          status: "expired",
        }
      );

      console.log(
        `Expired ${expiredConfirmations.nModified} old confirmations`
      );
      return expiredConfirmations;
    } catch (error) {
      console.error("Error expiring old confirmations:", error);
      throw error;
    }
  }
}

module.exports = new AgreementConfirmationService();
