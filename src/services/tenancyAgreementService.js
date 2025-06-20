const AgreementConfirmation = require("../models/TenancyAgreement");
const TenancyAgreement = require("../models/TenancyAgreement");
const RentalRequest = require("../models/RentalRequest");
const crypto = require("crypto");
const emailService = require("./emailService");

class AgreementConfirmationService {
  async createConfirmationFromAcceptedRequest(rentalRequestId, agreementTerms) {
    try {
      console.log("Creating confirmation with terms:", agreementTerms);

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

      // Lấy utilityRates và additionalFees từ room
      const room = rentalRequest.roomId;
      const utilityRates = room.utilityRates || {};
      const additionalFees = room.additionalFees || [];

      // Tạo confirmation data
      const confirmationData = {
        rentalRequestId: rentalRequestId,
        tenantId: rentalRequest.tenantId._id,
        landlordId: room.accommodationId.ownerId._id,
        roomId: room._id,
        confirmationToken,
        agreementTerms: {
          ...agreementTerms,
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

      // Tạo confirmation - CHỈ TẠO AgreementConfirmation thôi
      const confirmation = new AgreementConfirmation(confirmationData);
      await confirmation.save();

      console.log(
        "AgreementConfirmation created successfully:",
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

      console.log("Email sent successfully");

      return confirmation;
    } catch (error) {
      console.error("Error creating agreement confirmation:", error);
      throw error;
    }
  }

  async getTenantByRoom(roomId) {
    try {
      const agreement = await TenancyAgreement.findOne({
        roomId: roomId,
        status: "active",
      })
        .populate("tenantId", "name email phoneNumber profileImage")
        .select(
          "tenantId startDate endDate monthlyRent totalMonthlyCost status"
        );

      if (!agreement) {
        return null;
      }

      return agreement;
    } catch (error) {
      console.error("Error fetching tenant by room:", error);
      throw error;
    }
  }
}

module.exports = new AgreementConfirmationService();
