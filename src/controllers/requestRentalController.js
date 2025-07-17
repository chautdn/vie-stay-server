const rentalRequestService = require("../services/rentalRequestService");
const agreementConfirmationService = require("../services/agreementConfirmationService");
const RentalRequest = require("../models/RentalRequest");

// Create new rental request
exports.createRentalRequest = async (req, res) => {
  try {
    console.log("📥 Controller: Received rental request:", req.body);
    console.log("👤 User from auth:", req.user?.name, req.user?._id);

    if (!req.user || !req.user._id) {
      return res.status(401).json({
        success: false,
        error: "User authentication required",
      });
    }

    const tenantId = req.user._id;
    const requestData = {
      ...req.body,
      tenantId: tenantId,
    };

    console.log("🔄 Processing request with tenant ID:", tenantId);

    const request = await rentalRequestService.createRentalRequest(requestData);

    const populatedRequest = await RentalRequest.findById(request._id)
      .populate("tenantId", "name email phone phoneNumber")
      .populate("landlordId", "name email phone phoneNumber")
      .populate("roomId", "name baseRent size capacity")
      .populate("accommodationId", "name address");

    console.log("✅ Request created and populated successfully");

    res.status(201).json({
      success: true,
      message: "Rental request created successfully",
      data: populatedRequest,
    });
  } catch (error) {
    console.error("❌ Error creating rental request:", error);
    res.status(400).json({
      success: false,
      error: error.message || "Failed to create rental request",
    });
  }
};

// Get rental request details
exports.getRentalRequestDetails = async (req, res) => {
  try {
    const { requestId } = req.params;

    if (!requestId) {
      return res.status(400).json({
        success: false,
        error: "Request ID is required",
      });
    }

    const request =
      await rentalRequestService.getRentalRequestDetails(requestId);

    res.status(200).json({
      success: true,
      data: request,
    });
  } catch (error) {
    console.error("❌ Error getting rental request details:", error);
    res.status(404).json({
      success: false,
      error: error.message || "Rental request not found",
    });
  }
};

// Get requests by landlord
exports.getRequestsByLandlord = async (req, res) => {
  try {
    const landlordId = req.user._id;
    const { status, page = 1, limit = 10 } = req.query;

    const result = await rentalRequestService.getRequestsByLandlord(
      landlordId,
      status,
      parseInt(page),
      parseInt(limit)
    );

    res.status(200).json({
      success: true,
      data: result.requests,
      requestsCount: result.requests.length,
      pagination: result.pagination,
    });
  } catch (error) {
    console.error("❌ Error getting requests by landlord:", error);
    res.status(400).json({
      success: false,
      error: error.message || "Failed to get requests",
    });
  }
};

// Get requests by accommodation
exports.getRequestsByAccommodation = async (req, res) => {
  try {
    const { accommodationId } = req.params;
    const { status, page = 1, limit = 10 } = req.query;

    if (!accommodationId) {
      return res.status(400).json({
        success: false,
        error: "Accommodation ID is required",
      });
    }

    const result = await rentalRequestService.getRequestsByAccommodation(
      accommodationId,
      status,
      parseInt(page),
      parseInt(limit)
    );

    res.status(200).json({
      success: true,
      data: result.requests,
      pagination: result.pagination,
    });
  } catch (error) {
    console.error("❌ Error getting requests by accommodation:", error);
    res.status(400).json({
      success: false,
      error: error.message || "Failed to get requests",
    });
  }
};

exports.getMyRentalRequests = async (req, res) => {
  try {
    const tenantId = req.user._id;
    //don't need pagination for this endpoint
    const { status } = req.query;
    const result = await rentalRequestService.getRequestsByTenant(
      tenantId,
      status
    );
    res.status(200).json({
      success: true,
      data: result.requests,
    });
  } catch (error) {
    console.error("❌ Error getting my rental requests:", error);
    res.status(400).json({
      success: false,
      error: error.message || "Failed to get my rental requests",
    });
  }
};

// Get requests by tenant
exports.getRequestsByTenant = async (req, res) => {
  try {
    const tenantId = req.params.tenantId || req.user._id;
    const { status, page = 1, limit = 10 } = req.query;

    // Check if user can access this tenant's requests
    if (
      req.params.tenantId &&
      req.user._id.toString() !== tenantId &&
      req.user.role !== "admin"
    ) {
      return res.status(403).json({
        success: false,
        error: "Unauthorized: You can only view your own requests",
      });
    }

    const result = await rentalRequestService.getRequestsByTenant(
      tenantId,
      status,
      parseInt(page),
      parseInt(limit)
    );

    res.status(200).json({
      success: true,
      data: result.requests,
      pagination: result.pagination,
    });
  } catch (error) {
    console.error("❌ Error getting requests by tenant:", error);
    res.status(400).json({
      success: false,
      error: error.message || "Failed to get requests",
    });
  }
};

// Get requests by room
exports.getRequestsByRoom = async (req, res) => {
  try {
    const { roomId } = req.params;
    const { status, page = 1, limit = 10 } = req.query;

    if (!roomId) {
      return res.status(400).json({
        success: false,
        error: "Room ID is required",
      });
    }

    const result = await rentalRequestService.getRequestsByRoom(
      roomId,
      status,
      parseInt(page),
      parseInt(limit)
    );

    res.status(200).json({
      success: true,
      data: result.requests,
      pagination: result.pagination,
    });
  } catch (error) {
    console.error("❌ Error getting requests by room:", error);
    res.status(400).json({
      success: false,
      error: error.message || "Failed to get requests",
    });
  }
};

// ✅ SỬA: Accept rental request - tạo confirmation và gửi email
exports.acceptRentalRequest = async (req, res) => {
  try {
    const { requestId } = req.params;
    const { responseMessage, agreementTerms } = req.body;

    console.log("🏠 Landlord accepting request:", requestId);
    console.log("Response message:", responseMessage);
    console.log("Agreement terms:", agreementTerms);

    if (!responseMessage || responseMessage.trim() === "") {
      return res.status(400).json({
        success: false,
        error: "Response message is required when accepting a request",
      });
    }

    // ✅ SỬA: Lấy thông tin từ rental request và room để tạo default agreement terms
    const request = await RentalRequest.findById(requestId)
      .populate("tenantId", "name email")
      .populate({
        path: "roomId",
        populate: {
          path: "accommodationId",
          populate: {
            path: "ownerId",
          },
        },
      });

    if (!request) {
      return res.status(404).json({
        success: false,
        error: "Rental request not found",
      });
    }

    if (request.status !== "pending") {
      return res.status(400).json({
        success: false,
        error: "Request has already been processed",
      });
    }

    // ✅ THÊM: Tạo default agreement terms từ room data nếu không được cung cấp
    let finalAgreementTerms = agreementTerms;

    if (!finalAgreementTerms) {
      const room = request.roomId;

      // Tính toán deposit mặc định (thường = 1 tháng rent)
      const defaultDeposit = room.baseRent || room.monthlyRent || 0;

      finalAgreementTerms = {
        startDate:
          request.proposedStartDate ||
          new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 ngày từ bây giờ
        monthlyRent: room.baseRent || room.monthlyRent || 0,
        deposit: defaultDeposit,
        notes: `Agreement for ${room.name || `Room ${room.roomNumber}`} at ${room.accommodationId?.name || "this property"}`,
        utilityRates: room.utilityRates || {},
        additionalFees: room.additionalFees || [],
      };

      console.log("✅ Created default agreement terms:", finalAgreementTerms);
    }

    // Validate final agreement terms
    const requiredTerms = ["startDate", "monthlyRent", "deposit"];
    for (const term of requiredTerms) {
      if (!finalAgreementTerms[term] && finalAgreementTerms[term] !== 0) {
        return res.status(400).json({
          success: false,
          error: `${term} is required in agreement terms. Please provide agreement terms or ensure room has complete pricing information.`,
        });
      }
    }

    // Validate startDate is not in the past
    const startDate = new Date(finalAgreementTerms.startDate);
    if (startDate < new Date().setHours(0, 0, 0, 0)) {
      return res.status(400).json({
        success: false,
        error: "Start date cannot be in the past",
      });
    }

    // Accept the rental request
    const acceptData = {
      responseMessage: responseMessage.trim(),
    };

    const updatedRequest = await rentalRequestService.acceptRentalRequest(
      requestId,
      acceptData
    );

    console.log("✅ Request status updated to accepted");

    // ✅ THÊM: Tạo agreement confirmation và gửi email
    try {
      const confirmation =
        await agreementConfirmationService.createConfirmationFromAcceptedRequest(
          requestId,
          finalAgreementTerms
        );

      console.log("✅ Agreement confirmation created and email sent");

      // Update rental request với confirmation ID
      updatedRequest.agreementConfirmationId = confirmation._id;
      updatedRequest.acceptedAt = new Date();
      await updatedRequest.save();

      res.status(200).json({
        success: true,
        message:
          "Rental request accepted successfully and confirmation email sent to tenant",
        data: {
          request: updatedRequest,
          confirmation: {
            id: confirmation._id,
            token: confirmation.confirmationToken,
            expiresAt: confirmation.expiresAt,
          },
          agreementTerms: finalAgreementTerms,
        },
      });
    } catch (confirmationError) {
      console.error("❌ Error creating confirmation:", confirmationError);

      // Revert request status if confirmation fails
      await rentalRequestService.updateRequestStatus(requestId, "pending");

      res.status(500).json({
        success: false,
        error: `Request accepted but failed to send confirmation email: ${confirmationError.message}. Please try again.`,
      });
    }
  } catch (error) {
    console.error("❌ Error accepting rental request:", error);
    res.status(400).json({
      success: false,
      error: error.message || "Failed to accept rental request",
    });
  }
};

// Reject rental request
exports.rejectRentalRequest = async (req, res) => {
  try {
    const { requestId } = req.params;
    const { responseMessage } = req.body;
    const landlordId = req.user._id;

    if (!responseMessage || responseMessage.trim() === "") {
      return res.status(400).json({
        success: false,
        error: "Response message is required when rejecting a request",
      });
    }

    const updatedRequest = await rentalRequestService.rejectRentalRequest(
      requestId,
      landlordId,
      responseMessage
    );

    res.status(200).json({
      success: true,
      message: "Rental request rejected successfully",
      data: updatedRequest,
    });
  } catch (error) {
    console.error("❌ Error rejecting rental request:", error);
    res.status(400).json({
      success: false,
      error: error.message || "Failed to reject rental request",
    });
  }
};

// Withdraw rental request (by tenant)
exports.withdrawRentalRequest = async (req, res) => {
  try {
    const { requestId } = req.params;
    const tenantId = req.user._id;

    const updatedRequest = await rentalRequestService.withdrawRentalRequest(
      requestId,
      tenantId
    );

    res.status(200).json({
      success: true,
      message: "Rental request withdrawn successfully",
      data: updatedRequest,
    });
  } catch (error) {
    console.error("❌ Error withdrawing rental request:", error);
    res.status(400).json({
      success: false,
      error: error.message || "Failed to withdraw rental request",
    });
  }
};

// Update request status (admin only)
exports.updateRequestStatus = async (req, res) => {
  try {
    const { requestId } = req.params;
    const { status, responseMessage } = req.body;

    if (req.user.role !== "admin") {
      return res.status(403).json({
        success: false,
        error: "Unauthorized: Admin access required",
      });
    }

    const updatedRequest = await rentalRequestService.updateRequestStatus(
      requestId,
      status,
      responseMessage
    );

    res.status(200).json({
      success: true,
      message: "Request status updated successfully",
      data: updatedRequest,
    });
  } catch (error) {
    console.error("❌ Error updating request status:", error);
    res.status(400).json({
      success: false,
      error: error.message || "Failed to update request status",
    });
  }
};

// Delete rental request
exports.deleteRentalRequest = async (req, res) => {
  try {
    const { requestId } = req.params;
    const userId = req.user._id;
    const userRole = req.user.role;

    const result = await rentalRequestService.deleteRentalRequest(
      requestId,
      userId,
      userRole
    );

    res.status(200).json({
      success: true,
      message: result.message,
    });
  } catch (error) {
    console.error("❌ Error deleting rental request:", error);
    res.status(400).json({
      success: false,
      error: error.message || "Failed to delete rental request",
    });
  }
};

// Mark as viewed by landlord
exports.markAsViewed = async (req, res) => {
  try {
    const { requestId } = req.params;
    const landlordId = req.user._id;

    const updatedRequest = await rentalRequestService.markAsViewed(
      requestId,
      landlordId
    );

    res.status(200).json({
      success: true,
      message: "Request marked as viewed",
      data: updatedRequest,
    });
  } catch (error) {
    console.error("❌ Error marking request as viewed:", error);
    res.status(400).json({
      success: false,
      error: error.message || "Failed to mark request as viewed",
    });
  }
};

// Get request statistics (for landlord dashboard)
exports.getRequestStats = async (req, res) => {
  try {
    const landlordId = req.user._id;
    const stats = await rentalRequestService.getRequestStats(landlordId);

    res.status(200).json({
      success: true,
      data: stats,
    });
  } catch (error) {
    console.error("❌ Error getting request stats:", error);
    res.status(400).json({
      success: false,
      error: error.message || "Failed to get request statistics",
    });
  }
};

module.exports = {
  createRentalRequest: exports.createRentalRequest,
  getRentalRequestDetails: exports.getRentalRequestDetails,
  getRequestsByLandlord: exports.getRequestsByLandlord,
  getRequestsByAccommodation: exports.getRequestsByAccommodation,
  getRequestsByTenant: exports.getRequestsByTenant,
  getRequestsByRoom: exports.getRequestsByRoom,
  acceptRentalRequest: exports.acceptRentalRequest,
  rejectRentalRequest: exports.rejectRentalRequest,
  withdrawRentalRequest: exports.withdrawRentalRequest,
  updateRequestStatus: exports.updateRequestStatus,
  deleteRentalRequest: exports.deleteRentalRequest,
  markAsViewed: exports.markAsViewed,
  getRequestStats: exports.getRequestStats,
  getMyRentalRequests: exports.getMyRentalRequests,
};
