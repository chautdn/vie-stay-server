const tenancyAgreementService = require("../services/tenancyAgreementService");
const Room = require("../models/Room");
const User = require("../models/User");
const TenancyAgreement = require("../models/TenancyAgreement");
const AgreementConfirmation = require("../models/AgreementConfirmation");

class TenancyAgreementController {
  // Lấy danh sách hợp đồng cho chủ nhà
  async getLandlordAgreements(req, res) {
    try {
      const landlordId = req.user.id; // Từ protect middleware
      console.log(`🔍 Getting agreements for landlord: ${landlordId}`);

      // Lấy agreements từ TenancyAgreement model
      const agreements = await TenancyAgreement.find({ landlordId })
        .populate("tenantId", "name email phoneNumber profileImage")
        .populate("roomId", "roomNumber name type size baseRent")
        .populate("accommodationId", "name address type")
        .sort({ createdAt: -1 });

      // Nếu không có trong TenancyAgreement, lấy từ AgreementConfirmation (đã ký)
      const confirmations = await AgreementConfirmation.find({
        landlordId,
        signatureStatus: "completed",
        paymentStatus: "completed",
      })
        .populate("tenantId", "name email phoneNumber profileImage")
        .populate("roomId", "roomNumber name type size baseRent")
        .populate({
          path: "roomId",
          populate: {
            path: "accommodationId",
            select: "name address type",
          },
        })
        .sort({ signedAt: -1 });

      // Combine và format data
      const allAgreements = [
        ...agreements.map((agreement) => ({
          _id: agreement._id,
          type: "tenancy_agreement",
          tenant: agreement.tenantId,
          room: agreement.roomId,
          accommodation: agreement.accommodationId,
          startDate: agreement.startDate,
          endDate: agreement.endDate,
          monthlyRent: agreement.monthlyRent,
          deposit: agreement.deposit,
          status: agreement.status,
          signedAt: agreement.createdAt,
          documentId: agreement.documentId,
          signedContractPath: agreement.signedContractPath,
          createdAt: agreement.createdAt,
        })),
        ...confirmations.map((confirmation) => ({
          _id: confirmation._id,
          type: "agreement_confirmation",
          tenant: confirmation.tenantId,
          room: confirmation.roomId,
          accommodation: confirmation.roomId.accommodationId,
          startDate: confirmation.agreementTerms.startDate,
          endDate:
            confirmation.agreementTerms.endDate ||
            new Date(
              confirmation.agreementTerms.startDate.getTime() +
                365 * 24 * 60 * 60 * 1000
            ),
          monthlyRent: confirmation.agreementTerms.monthlyRent,
          deposit: confirmation.agreementTerms.deposit,
          status: "active",
          signedAt: confirmation.signedAt,
          documentId: confirmation.documentId,
          signedContractPath: confirmation.signedContractPath,
          createdAt: confirmation.createdAt,
        })),
      ];

      // Sort by signedAt desc
      allAgreements.sort((a, b) => new Date(b.signedAt) - new Date(a.signedAt));

      console.log(`✅ Found ${allAgreements.length} agreements for landlord`);

      res.status(200).json({
        status: "success",
        results: allAgreements.length,
        data: {
          agreements: allAgreements,
        },
      });
    } catch (error) {
      console.error("Error getting landlord agreements:", error);
      res.status(500).json({
        status: "error",
        message: "Failed to get agreements",
        error: error.message,
      });
    }
  }

  // Lấy chi tiết hợp đồng
  async getAgreementDetails(req, res) {
    try {
      const { agreementId } = req.params;
      const userId = req.user.id;
      const userRole = req.user.role[0]; // Lấy role đầu tiên

      console.log(
        `🔍 Getting agreement details: ${agreementId} for user: ${userId} (${userRole})`
      );

      // Query condition dựa trên role
      const queryCondition =
        userRole === "landlord" ? { landlordId: userId } : { tenantId: userId };

      // Tìm trong TenancyAgreement trước
      let agreement = await TenancyAgreement.findOne({
        _id: agreementId,
        ...queryCondition,
      })
        .populate(
          "tenantId",
          "name email phoneNumber profileImage nationalId address"
        )
        .populate(
          "landlordId",
          "name email phoneNumber profileImage nationalId address"
        )
        .populate(
          "roomId",
          "roomNumber name type size baseRent amenities images"
        )
        .populate("accommodationId", "name address type description amenities");

      if (!agreement) {
        // Tìm trong AgreementConfirmation
        const confirmation = await AgreementConfirmation.findOne({
          _id: agreementId,
          ...queryCondition,
          signatureStatus: "completed",
        })
          .populate(
            "tenantId",
            "name email phoneNumber profileImage nationalId address"
          )
          .populate(
            "landlordId",
            "name email phoneNumber profileImage nationalId address"
          )
          .populate(
            "roomId",
            "roomNumber name type size baseRent amenities images"
          )
          .populate({
            path: "roomId",
            populate: {
              path: "accommodationId",
              select: "name address type description amenities",
            },
          });

        if (confirmation) {
          agreement = {
            _id: confirmation._id,
            type: "agreement_confirmation",
            tenant: confirmation.tenantId,
            landlord: confirmation.landlordId,
            room: confirmation.roomId,
            accommodation: confirmation.roomId.accommodationId,
            startDate: confirmation.agreementTerms.startDate,
            endDate:
              confirmation.agreementTerms.endDate ||
              new Date(
                confirmation.agreementTerms.startDate.getTime() +
                  365 * 24 * 60 * 60 * 1000
              ),
            monthlyRent: confirmation.agreementTerms.monthlyRent,
            deposit: confirmation.agreementTerms.deposit,
            utilityRates: confirmation.agreementTerms.utilityRates,
            additionalFees: confirmation.agreementTerms.additionalFees,
            notes: confirmation.agreementTerms.notes,
            status: "active",
            signedAt: confirmation.signedAt,
            documentId: confirmation.documentId,
            signedContractPath: confirmation.signedContractPath,
            createdAt: confirmation.createdAt,
          };
        }
      }

      if (!agreement) {
        return res.status(404).json({
          status: "fail",
          message: "Agreement not found",
        });
      }

      // Lấy thông tin payment
      const Payment = require("../models/Payment");
      const payment = await Payment.findOne({
        agreementConfirmationId: agreement._id,
        status: "completed",
      });

      console.log(`✅ Found agreement details for: ${agreementId}`);

      res.status(200).json({
        status: "success",
        data: {
          agreement: {
            ...agreement,
            payment:
              payment != null
                ? {
                    amount: payment.amount,
                    paidAt: payment.paidAt,
                    transactionId: payment.transactionId,
                    paymentMethod: payment.paymentMethod,
                  }
                : null,
          },
        },
      });
    } catch (error) {
      console.error("Error getting agreement details:", error);
      res.status(500).json({
        status: "error",
        message: "Failed to get agreement details",
        error: error.message,
      });
    }
  }

  // Thêm method mới để lấy agreements theo roomId
  async getRoomAgreements(req, res) {
    try {
      const { roomId } = req.params;
      const userId = req.user.id;
      const userRole = req.user.role[0];

      console.log(
        `🔍 Getting agreements for room: ${roomId} by user: ${userId} (${userRole})`
      );

      // Verify user có quyền xem room này không
      const room = await Room.findById(roomId).populate("accommodationId");
      if (!room) {
        return res.status(404).json({
          status: "fail",
          message: "Room not found",
        });
      }

      // Check permission
      if (
        userRole === "landlord" &&
        room.accommodationId.ownerId.toString() !== userId
      ) {
        return res.status(403).json({
          status: "fail",
          message: "You don't have permission to view this room's agreements",
        });
      }

      // Lấy agreements từ TenancyAgreement
      const tenancyAgreements = await TenancyAgreement.find({
        roomId: roomId,
      })
        .populate("tenantId", "name email phoneNumber profileImage")
        .populate("landlordId", "name email phoneNumber")
        .sort({ createdAt: -1 });

      // Lấy agreements từ AgreementConfirmation (đã ký và thanh toán)
      const confirmedAgreements = await AgreementConfirmation.find({
        roomId: roomId,
        signatureStatus: "completed",
        paymentStatus: "completed",
      })
        .populate("tenantId", "name email phoneNumber profileImage")
        .populate("landlordId", "name email phoneNumber")
        .sort({ signedAt: -1 });

      // Combine và format data
      const allAgreements = [
        ...tenancyAgreements.map((agreement) => ({
          _id: agreement._id,
          type: "tenancy_agreement",
          title: `Hợp đồng thuê phòng - ${agreement.tenantId.name}`,
          tenant: agreement.tenantId,
          landlord: agreement.landlordId,
          startDate: agreement.startDate,
          endDate: agreement.endDate,
          monthlyRent: agreement.monthlyRent,
          deposit: agreement.deposit,
          status: agreement.status,
          signedAt: agreement.createdAt,
          documentId: agreement.documentId,
          signedContractPath: agreement.signedContractPath,
          canDownload: true,
          fileName: `hop-dong-${agreement._id}.pdf`,
          fileSize: "PDF Document",
        })),
        ...confirmedAgreements.map((confirmation) => ({
          _id: confirmation._id,
          type: "agreement_confirmation",
          title: `Hợp đồng thuê phòng - ${confirmation.tenantId.name}`,
          tenant: confirmation.tenantId,
          landlord: confirmation.landlordId,
          startDate: confirmation.agreementTerms.startDate,
          endDate:
            confirmation.agreementTerms.endDate ||
            new Date(
              confirmation.agreementTerms.startDate.getTime() +
                365 * 24 * 60 * 60 * 1000
            ),
          monthlyRent: confirmation.agreementTerms.monthlyRent,
          deposit: confirmation.agreementTerms.deposit,
          status: "active",
          signedAt: confirmation.signedAt,
          documentId: confirmation.documentId,
          signedContractPath: confirmation.signedContractPath,
          canDownload: true,
          fileName: `hop-dong-${confirmation._id}.pdf`,
          fileSize: "PDF Document",
        })),
      ];

      // Sort by signedAt desc
      allAgreements.sort((a, b) => new Date(b.signedAt) - new Date(a.signedAt));

      console.log(
        `✅ Found ${allAgreements.length} agreements for room ${roomId}`
      );

      res.status(200).json({
        status: "success",
        results: allAgreements.length,
        data: {
          agreements: allAgreements,
        },
      });
    } catch (error) {
      console.error("Error getting room agreements:", error);
      res.status(500).json({
        status: "error",
        message: "Failed to get room agreements",
        error: error.message,
      });
    }
  }

  // Download hợp đồng đã ký
  async downloadSignedContract(req, res) {
    try {
      const { agreementId } = req.params;
      const userId = req.user.id;
      const userRole = req.user.role[0];

      console.log(
        `📄 Downloading signed contract: ${agreementId} by ${userId} (${userRole})`
      );

      // Tìm agreement và check quyền
      let documentId = null;
      let agreementFound = false;

      // Check trong TenancyAgreement
      const tenancyAgreement = await TenancyAgreement.findById(
        agreementId
      ).populate({
        path: "roomId",
        populate: {
          path: "accommodationId",
        },
      });

      if (tenancyAgreement) {
        // Check permission
        const isLandlord =
          userRole === "landlord" &&
          tenancyAgreement.roomId.accommodationId.ownerId.toString() === userId;
        const isTenant =
          userRole === "tenant" &&
          tenancyAgreement.tenantId.toString() === userId;

        if (isLandlord || isTenant) {
          documentId = tenancyAgreement.documentId;
          agreementFound = true;
        }
      }

      // Nếu không tìm thấy, check trong AgreementConfirmation
      if (!agreementFound) {
        const confirmation = await AgreementConfirmation.findById(
          agreementId
        ).populate({
          path: "roomId",
          populate: {
            path: "accommodationId",
          },
        });

        if (confirmation) {
          const isLandlord =
            userRole === "landlord" &&
            confirmation.roomId.accommodationId.ownerId.toString() === userId;
          const isTenant =
            userRole === "tenant" &&
            confirmation.tenantId.toString() === userId;

          if (isLandlord || isTenant) {
            documentId = confirmation.documentId;
            agreementFound = true;
          }
        }
      }

      if (!agreementFound || !documentId) {
        return res.status(404).json({
          status: "fail",
          message:
            "Agreement not found or you don't have permission to download",
        });
      }

      // Download từ BoldSign
      const axios = require("axios");
      const downloadResponse = await axios.get(
        "https://api.boldsign.com/v1/document/download",
        {
          params: { documentId },
          headers: {
            "X-API-KEY": process.env.BOLDSIGN_API_KEY,
          },
          responseType: "arraybuffer",
          timeout: 30000,
        }
      );

      // Set headers để download file
      res.setHeader("Content-Type", "application/pdf");
      res.setHeader(
        "Content-Disposition",
        `attachment; filename="hop-dong-${agreementId}.pdf"`
      );
      res.send(Buffer.from(downloadResponse.data));

      console.log(`✅ Contract downloaded successfully: ${agreementId}`);
    } catch (error) {
      console.error("Error downloading signed contract:", error);
      res.status(500).json({
        status: "error",
        message: "Failed to download contract",
        error: error.message,
      });
    }
  }

  // Lấy danh sách hợp đồng cho tenant
  async getTenantAgreements(req, res) {
    try {
      const tenantId = req.user.id;
      console.log(`🔍 Getting agreements for tenant: ${tenantId}`);

      // Lấy từ TenancyAgreement
      const agreements = await TenancyAgreement.find({ tenantId })
        .populate("landlordId", "name email phoneNumber")
        .populate("roomId", "roomNumber name type size baseRent images")
        .populate("accommodationId", "name address type")
        .sort({ createdAt: -1 });

      // Lấy từ AgreementConfirmation (đã ký)
      const confirmations = await AgreementConfirmation.find({
        tenantId,
        signatureStatus: "completed",
        paymentStatus: "completed",
      })
        .populate("landlordId", "name email phoneNumber")
        .populate("roomId", "roomNumber name type size baseRent images")
        .populate({
          path: "roomId",
          populate: {
            path: "accommodationId",
            select: "name address type",
          },
        })
        .sort({ signedAt: -1 });

      const allAgreements = [
        ...agreements.map((agreement) => ({
          _id: agreement._id,
          type: "tenancy_agreement",
          landlord: agreement.landlordId,
          room: agreement.roomId,
          accommodation: agreement.accommodationId,
          startDate: agreement.startDate,
          endDate: agreement.endDate,
          monthlyRent: agreement.monthlyRent,
          deposit: agreement.deposit,
          status: agreement.status,
          signedAt: agreement.createdAt,
          documentId: agreement.documentId,
        })),
        ...confirmations.map((confirmation) => ({
          _id: confirmation._id,
          type: "agreement_confirmation",
          landlord: confirmation.landlordId,
          room: confirmation.roomId,
          accommodation: confirmation.roomId.accommodationId,
          startDate: confirmation.agreementTerms.startDate,
          endDate:
            confirmation.agreementTerms.endDate ||
            new Date(
              confirmation.agreementTerms.startDate.getTime() +
                365 * 24 * 60 * 60 * 1000
            ),
          monthlyRent: confirmation.agreementTerms.monthlyRent,
          deposit: confirmation.agreementTerms.deposit,
          status: "active",
          signedAt: confirmation.signedAt,
          documentId: confirmation.documentId,
        })),
      ];

      allAgreements.sort((a, b) => new Date(b.signedAt) - new Date(a.signedAt));

      console.log(`✅ Found ${allAgreements.length} agreements for tenant`);

      res.status(200).json({
        status: "success",
        results: allAgreements.length,
        data: {
          agreements: allAgreements,
        },
      });
    } catch (error) {
      console.error("Error getting tenant agreements:", error);
      res.status(500).json({
        status: "error",
        message: "Failed to get agreements",
        error: error.message,
      });
    }
  }

  // Get agreement status - có thể dùng chung cho cả landlord và tenant
  async getAgreementStatus(req, res) {
    try {
      const { agreementId } = req.params;
      const userId = req.user.id;

      // Tìm agreement mà user có quyền truy cập (hoặc là landlord hoặc là tenant)
      const agreement = await AgreementConfirmation.findOne({
        _id: agreementId,
        $or: [{ landlordId: userId }, { tenantId: userId }],
      }).select("status signatureStatus paymentStatus documentId");

      if (!agreement) {
        return res.status(404).json({
          status: "fail",
          message: "Agreement not found",
        });
      }

      res.status(200).json({
        status: "success",
        data: {
          agreementId,
          status: agreement.status,
          signatureStatus: agreement.signatureStatus,
          paymentStatus: agreement.paymentStatus,
          hasSignedDocument: !!agreement.documentId,
        },
      });
    } catch (error) {
      console.error("Error getting agreement status:", error);
      res.status(500).json({
        status: "error",
        message: "Failed to get agreement status",
        error: error.message,
      });
    }
  }
}

module.exports = new TenancyAgreementController();
