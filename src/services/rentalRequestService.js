const RentalRequest = require("../models/RentalRequest");
const mongoose = require("mongoose");
const Room = require("../models/Room");
const Accommodation = require("../models/Accommodation");
const User = require("../models/User");

const createRentalRequest = async (data) => {
  try {
    console.log("🔍 Service: Creating rental request with data:", data);

    // Validate room exists and is available
    const room = await Room.findById(data.roomId).populate("accommodationId");
    if (!room) {
      throw new Error("Room not found");
    }
    if (!room.isAvailable) {
      throw new Error("Room is not available for rental");
    }

    console.log("🏠 Room found:", room._id, "- Available:", room.isAvailable);

    // Validate guest count
    if (data.guestCount > room.capacity) {
      throw new Error(
        `Guest count cannot exceed room capacity of ${room.capacity}`
      );
    }

    // Get accommodation if not provided
    let accommodationId = data.accommodationId;
    if (!accommodationId && room.accommodationId) {
      accommodationId = room.accommodationId._id || room.accommodationId;
    }

    // Get landlord from accommodation
    const accommodation = await Accommodation.findById(accommodationId);
    if (!accommodation) {
      throw new Error("Accommodation not found");
    }

    const landlordId = data.landlordId || accommodation.ownerId;
    if (!landlordId) {
      throw new Error("Landlord information not found");
    }

    console.log("👤 Landlord ID:", landlordId);

    // Validate proposed start date
    const proposedStartDate = new Date(data.proposedStartDate);
    if (proposedStartDate < new Date().setHours(0, 0, 0, 0)) {
      throw new Error("Proposed start date cannot be in the past");
    }

    // Create rental request - simplified data (no proposedRent)
    const requestData = {
      tenantId: data.tenantId,
      roomId: data.roomId,
      accommodationId: accommodationId,
      landlordId: landlordId,
      message: data.message || "",
      proposedStartDate: proposedStartDate,
      guestCount: parseInt(data.guestCount) || 1,
      status: "pending",
    };

    console.log("📝 Creating request with data:", requestData);

    const createdRequest = await RentalRequest.create(requestData);
    console.log("✅ Request created successfully:", createdRequest._id);

    return createdRequest;
  } catch (error) {
    console.error("❌ Service error:", error.message);
    throw error;
  }
};

const getRentalRequestDetails = async (requestId) => {
  try {
    const request = await RentalRequest.findById(requestId)
      .populate({
        path: "tenantId",
        select: "name phoneNumber email profileImage",
      })
      .populate({
        path: "landlordId",
        select: "name phoneNumber email profileImage",
      })
      .populate({
        path: "roomId",
        select:
          "name type baseRent size capacity deposit hasPrivateBathroom furnishingLevel amenities images",
      })
      .populate({
        path: "accommodationId",
        select: "name type address amenities contactInfo",
      })
      .lean();

    if (!request) {
      throw new Error("Rental request not found");
    }

    return request;
  } catch (error) {
    throw new Error(`Failed to get rental request details: ${error.message}`);
  }
};

const getRequestsByLandlord = async (
  landlordId,
  status,
  page = 1,
  limit = 10
) => {
  try {
    console.log(`🔍 Getting requests for landlord: ${landlordId}`);

    let query = { landlordId };

    if (status && status !== "all") {
      query.status = status;
    }

    const skip = (page - 1) * limit;

    // ✅ SỬA: Thêm populate agreementConfirmationId
    const requests = await RentalRequest.find(query)
      .populate("tenantId", "name email phoneNumber profileImage")
      .populate("roomId", "roomNumber name baseRent size capacity")
      .populate("accommodationId", "name address")
      .populate({
        path: "agreementConfirmationId",
        select: "status paymentStatus confirmedAt paidAt createdAt expiresAt",
      }) // ✅ THÊM populate agreementConfirmationId
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    const total = await RentalRequest.countDocuments(query);

    console.log(`✅ Found ${requests.length} requests for landlord`);

    return {
      requests,
      pagination: {
        current: page,
        pages: Math.ceil(total / limit),
        total,
        limit,
      },
    };
  } catch (error) {
    console.error("❌ Error getting requests by landlord:", error);
    throw error;
  }
};

const getRequestsByTenant = async (
  tenantId,
  status = null,
  page = 1,
  limit = 10
) => {
  try {
    const query = { tenantId };
    if (status) {
      query.status = status;
    }

    const skip = (page - 1) * limit;

    const requests = await RentalRequest.find(query)
      .populate({
        path: "landlordId",
        select: "name phoneNumber email profileImage",
      })
      .populate({
        path: "roomId",
        select: "name type baseRent images ",
      })
      .populate({
        path: "accommodationId",
        select: "name type address.fullAddress",
      })
      .populate({
        path: "landlordId",
        select: "name phoneNumber email profileImage",
      })

      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean();

    const total = await RentalRequest.countDocuments(query);

    return {
      requests,
      pagination: {
        currentPage: page,
        totalPages: Math.ceil(total / limit),
        totalRequests: total,
        hasNext: page < Math.ceil(total / limit),
        hasPrev: page > 1,
      },
    };
  } catch (error) {
    throw new Error(`Failed to get requests by tenant: ${error.message}`);
  }
};

// ✅ SỬA: getRequestsByAccommodation
const getRequestsByAccommodation = async (
  accommodationId,
  status,
  page = 1,
  limit = 10
) => {
  try {
    let query = { accommodationId };

    if (status && status !== "all") {
      query.status = status;
    }

    const skip = (page - 1) * limit;

    const requests = await RentalRequest.find(query)
      .populate("tenantId", "name email phoneNumber profileImage")
      .populate("roomId", "roomNumber name baseRent size capacity")
      .populate("accommodationId", "name address")
      .populate({
        path: "agreementConfirmationId",
        select: "status paymentStatus confirmedAt paidAt createdAt expiresAt",
      }) // ✅ THÊM populate
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    const total = await RentalRequest.countDocuments(query);

    return {
      requests,
      pagination: {
        current: page,
        pages: Math.ceil(total / limit),
        total,
        limit,
      },
    };
  } catch (error) {
    console.error("❌ Error getting requests by accommodation:", error);
    throw error;
  }
};

// ✅ SỬA: getRequestsByRoom
const getRequestsByRoom = async (roomId, status, page = 1, limit = 10) => {
  try {
    console.log(`🔍 Getting requests for room: ${roomId}`);

    let query = { roomId };

    if (status && status !== "all") {
      query.status = status;
    }

    const skip = (page - 1) * limit;

    const requests = await RentalRequest.find(query)
      .populate("tenantId", "name email phoneNumber profileImage")
      .populate("roomId", "roomNumber name baseRent size capacity")
      .populate("accommodationId", "name address")
      .populate({
        path: "agreementConfirmationId",
        select: "status paymentStatus confirmedAt paidAt createdAt expiresAt",
      }) // ✅ THÊM populate
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    const total = await RentalRequest.countDocuments(query);

    return {
      requests,
      pagination: {
        current: page,
        pages: Math.ceil(total / limit),
        total,
        limit,
      },
    };
  } catch (error) {
    console.error("❌ Error getting requests by room:", error);
    throw error;
  }
};

const acceptRentalRequest = async (requestId, acceptData) => {
  try {
    const request = await RentalRequest.findById(requestId);
    if (!request) {
      throw new Error("Rental request not found");
    }

    if (request.status !== "pending") {
      throw new Error("Only pending requests can be accepted");
    }

    // Update with acceptance data
    const updateData = {
      status: "accepted",
      responseMessage: acceptData.responseMessage || "",
      respondedAt: new Date(),
    };

    const updatedRequest = await RentalRequest.findByIdAndUpdate(
      requestId,
      updateData,
      { new: true }
    ).populate([
      { path: "tenantId", select: "name email phoneNumber" },
      { path: "landlordId", select: "name email phoneNumber" },
      { path: "roomId", select: "name baseRent" },
      { path: "accommodationId", select: "name address.fullAddress" },
    ]);

    return updatedRequest;
  } catch (error) {
    throw new Error(`Failed to accept rental request: ${error.message}`);
  }
};

const rejectRentalRequest = async (requestId, landlordId, responseMessage) => {
  try {
    const request = await RentalRequest.findById(requestId);
    if (!request) {
      throw new Error("Rental request not found");
    }

    if (request.status !== "pending") {
      throw new Error("Only pending requests can be rejected");
    }

    if (request.landlordId.toString() !== landlordId.toString()) {
      throw new Error("Unauthorized: You can only reject your own requests");
    }

    const updatedRequest = await RentalRequest.findByIdAndUpdate(
      requestId,
      {
        status: "rejected",
        responseMessage,
        respondedAt: new Date(),
      },
      { new: true }
    ).populate([
      { path: "tenantId", select: "name email phoneNumber" },
      { path: "roomId", select: "name baseRent" },
      { path: "accommodationId", select: "name address.fullAddress" },
    ]);

    return updatedRequest;
  } catch (error) {
    throw new Error(`Failed to reject rental request: ${error.message}`);
  }
};

const withdrawRentalRequest = async (requestId, tenantId) => {
  try {
    const request = await RentalRequest.findById(requestId);
    if (!request) {
      throw new Error("Rental request not found");
    }

    if (request.tenantId.toString() !== tenantId.toString()) {
      throw new Error("Unauthorized: You can only withdraw your own requests");
    }

    if (request.status !== "pending") {
      throw new Error("Only pending requests can be withdrawn");
    }

    const updatedRequest = await RentalRequest.findByIdAndUpdate(
      requestId,
      {
        status: "withdrawn",
        respondedAt: new Date(),
      },
      { new: true }
    );

    return updatedRequest;
  } catch (error) {
    throw new Error(`Failed to withdraw rental request: ${error.message}`);
  }
};

const updateRequestStatus = async (
  requestId,
  status,
  responseMessage = null
) => {
  try {
    const validStatuses = ["pending", "accepted", "rejected", "withdrawn"];
    if (!validStatuses.includes(status)) {
      throw new Error("Invalid status");
    }

    const updateData = { status };
    if (status !== "pending") {
      updateData.respondedAt = new Date();
    }
    if (responseMessage) {
      updateData.responseMessage = responseMessage;
    }

    const updatedRequest = await RentalRequest.findByIdAndUpdate(
      requestId,
      updateData,
      { new: true }
    );

    if (!updatedRequest) {
      throw new Error("Rental request not found");
    }

    return updatedRequest;
  } catch (error) {
    throw new Error(`Failed to update request status: ${error.message}`);
  }
};

const deleteRentalRequest = async (requestId, userId, userRole) => {
  try {
    const request = await RentalRequest.findById(requestId);
    if (!request) {
      throw new Error("Rental request not found");
    }

    // Check permissions
    const isTenant = request.tenantId.toString() === userId.toString();
    const isLandlord = request.landlordId.toString() === userId.toString();
    const isAdmin = userRole === "admin";

    if (!isTenant && !isLandlord && !isAdmin) {
      throw new Error("Unauthorized: You can only delete your own requests");
    }

    // Only allow deletion of pending or withdrawn requests
    if (!["pending", "withdrawn"].includes(request.status)) {
      throw new Error("Only pending or withdrawn requests can be deleted");
    }

    await RentalRequest.findByIdAndDelete(requestId);
    return { message: "Rental request deleted successfully" };
  } catch (error) {
    throw new Error(`Failed to delete rental request: ${error.message}`);
  }
};

const markAsViewed = async (requestId, landlordId) => {
  try {
    const request = await RentalRequest.findById(requestId);
    if (!request) {
      throw new Error("Rental request not found");
    }

    if (request.landlordId.toString() !== landlordId.toString()) {
      throw new Error("Unauthorized: You can only view your own requests");
    }

    if (!request.viewedByLandlord) {
      const updatedRequest = await RentalRequest.findByIdAndUpdate(
        requestId,
        {
          viewedByLandlord: true,
          viewedAt: new Date(),
        },
        { new: true }
      );
      return updatedRequest;
    }

    return request;
  } catch (error) {
    throw new Error(`Failed to mark request as viewed: ${error.message}`);
  }
};

// Simplified utility methods
const getRequestStats = async (landlordId) => {
  try {
    const stats = await RentalRequest.aggregate([
      { $match: { landlordId: new mongoose.Types.ObjectId(landlordId) } },
      {
        $group: {
          _id: "$status",
          count: { $sum: 1 },
        },
      },
    ]);

    const result = {
      total: 0,
      pending: 0,
      accepted: 0,
      rejected: 0,
      withdrawn: 0,
    };

    stats.forEach((stat) => {
      result[stat._id] = stat.count;
      result.total += stat.count;
    });

    return result;
  } catch (error) {
    throw new Error(`Failed to get request stats: ${error.message}`);
  }
};

module.exports = {
  createRentalRequest,
  getRentalRequestDetails,
  getRequestsByLandlord,
  getRequestsByTenant,
  getRequestsByAccommodation,
  getRequestsByRoom,
  acceptRentalRequest,
  rejectRentalRequest,
  withdrawRentalRequest,
  updateRequestStatus,
  deleteRentalRequest,
  markAsViewed,
  getRequestStats,
};
