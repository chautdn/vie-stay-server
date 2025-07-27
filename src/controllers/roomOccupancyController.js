// src/controllers/roomOccupancyController.js
const RoomOccupancy = require("../models/RoomOccupancy");
const Room = require("../models/Room");
const TenancyAgreement = require("../models/TenancyAgreement");
const User = require("../models/User");
const mongoose = require("mongoose");

// Get all tenants in a room
exports.getRoomTenants = async (req, res) => {
  try {
    const { roomId } = req.params;
    
    const tenants = await RoomOccupancy.find({
      roomId,
      status: "active"
    })
    .populate("tenantId", "name email phoneNumber profileImage")
    .populate("tenancyAgreementId", "monthlyRent startDate endDate")
    .sort({ moveInDate: 1 });

    res.status(200).json({
      success: true,
      data: tenants
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// Get tenant's room history
exports.getTenantHistory = async (req, res) => {
  try {
    const { tenantId } = req.params;
    
    const history = await RoomOccupancy.find({
      tenantId
    })
    .populate("roomId", "roomNumber name")
    .populate("tenancyAgreementId", "monthlyRent")
    .sort({ moveInDate: -1 });

    res.status(200).json({
      success: true,
      data: history
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// Add tenant to room
exports.addTenantToRoom = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();
  
  try {
    const { roomId } = req.params;
    const { tenantId, tenancyAgreementId, isRepresentative = false } = req.body;
    
    // Verify room exists and user is landlord
    const room = await Room.findById(roomId).populate("accommodationId");
    if (!room) {
      return res.status(404).json({
        success: false,
        message: "Room not found"
      });
    }

    // Verify tenancy agreement
    const tenancy = await TenancyAgreement.findById(tenancyAgreementId);
    if (!tenancy || tenancy.roomId.toString() !== roomId) {
      return res.status(400).json({
        success: false,
        message: "Invalid tenancy agreement"
      });
    }

    // Check if tenant already in room
    const existingOccupancy = await RoomOccupancy.findOne({
      roomId,
      tenantId,
      status: "active"
    });

    if (existingOccupancy) {
      return res.status(400).json({
        success: false,
        message: "Tenant already in this room"
      });
    }

    // If setting as representative, remove current representative
    if (isRepresentative) {
      await RoomOccupancy.updateMany(
        { roomId, status: "active" },
        { isRepresentative: false },
        { session }
      );
    }

    // Create occupancy record
    const occupancy = new RoomOccupancy({
      roomId,
      tenantId,
      tenancyAgreementId,
      isRepresentative,
      moveInDate: new Date()
    });

    await occupancy.save({ session });

    // Update room currentTenant array
    if (!room.currentTenant.includes(tenantId)) {
      room.currentTenant.push(tenantId);
      await room.save({ session });
    }

    await session.commitTransaction();

    const populatedOccupancy = await RoomOccupancy.findById(occupancy._id)
      .populate("tenantId", "name email phoneNumber")
      .populate("tenancyAgreementId", "monthlyRent startDate endDate");

    res.status(201).json({
      success: true,
      message: "Tenant added to room successfully",
      data: populatedOccupancy
    });

  } catch (error) {
    await session.abortTransaction();
    res.status(500).json({
      success: false,
      message: error.message
    });
  } finally {
    session.endSession();
  }
};

// Remove tenant from room
exports.removeTenantFromRoom = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();
  
  try {
    const { roomId, tenantId } = req.params;
    const { terminationReason } = req.body;
    
    // Find occupancy record
    const occupancy = await RoomOccupancy.findOne({
      roomId,
      tenantId,
      status: "active"
    });

    if (!occupancy) {
      return res.status(404).json({
        success: false,
        message: "Tenant not found in room"
      });
    }

    const wasRepresentative = occupancy.isRepresentative;

    // Update occupancy status
    occupancy.status = "moved_out";
    occupancy.moveOutDate = new Date();
    occupancy.terminationReason = terminationReason;
    occupancy.terminatedBy = req.user.id;
    await occupancy.save({ session });

    // Remove from room's currentTenant array
    const room = await Room.findById(roomId);
    room.currentTenant = room.currentTenant.filter(id => id.toString() !== tenantId);
    await room.save({ session });

    // If removed tenant was representative, assign new representative
    if (wasRepresentative) {
      const nextTenant = await RoomOccupancy.findOne({
        roomId,
        status: "active",
        tenantId: { $ne: tenantId }
      });

      if (nextTenant) {
        nextTenant.isRepresentative = true;
        await nextTenant.save({ session });
      }
    }

    await session.commitTransaction();

    res.status(200).json({
      success: true,
      message: "Tenant removed from room successfully"
    });

  } catch (error) {
    await session.abortTransaction();
    res.status(500).json({
      success: false,
      message: error.message
    });
  } finally {
    session.endSession();
  }
};

// Set tenant as representative
exports.setRepresentative = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();
  
  try {
    const { roomId, tenantId } = req.params;
    
    // Remove representative status from all tenants in room
    await RoomOccupancy.updateMany(
      { roomId, status: "active" },
      { isRepresentative: false },
      { session }
    );

    // Set new representative
    const result = await RoomOccupancy.updateOne(
      { roomId, tenantId, status: "active" },
      { isRepresentative: true },
      { session }
    );

    if (result.matchedCount === 0) {
      return res.status(404).json({
        success: false,
        message: "Tenant not found in room"
      });
    }

    await session.commitTransaction();

    res.status(200).json({
      success: true,
      message: "Representative updated successfully"
    });

  } catch (error) {
    await session.abortTransaction();
    res.status(500).json({
      success: false,
      message: error.message
    });
  } finally {
    session.endSession();
  }
};

// Get room representative
exports.getRoomRepresentative = async (req, res) => {
  try {
    const { roomId } = req.params;
    
    const representative = await RoomOccupancy.findOne({
      roomId,
      status: "active",
      isRepresentative: true
    }).populate("tenantId", "name email phoneNumber profileImage");

    if (!representative) {
      return res.status(404).json({
        success: false,
        message: "No representative found for this room"
      });
    }

    res.status(200).json({
      success: true,
      data: representative
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};