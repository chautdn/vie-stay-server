// src/controllers/roomOccupancyController.js
const RoomOccupancy = require("../models/RoomOccupancy");
const Room = require("../models/Room");
const User = require("../models/User");
const mongoose = require("mongoose");

// Get all tenants in a room
exports.getRoomTenants = async (req, res) => {
  try {
    const { roomId } = req.params;
    
    // Verify room ownership
    const room = await Room.findById(roomId).populate("accommodationId");
    if (!room) {
      return res.status(404).json({
        success: false,
        message: "Room not found"
      });
    }

    if (room.accommodationId.ownerId.toString() !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: "Not authorized to view tenants for this room"
      });
    }
    
    const tenants = await RoomOccupancy.find({
      roomId,
      status: "active"
    })
    .populate("tenantId", "name email phoneNumber profileImage")
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
    const { roomId } = req.params;
    
    // If roomId is provided, get history for that specific room
    let query = {};
    if (roomId) {
      // Verify room ownership
      const room = await Room.findById(roomId).populate("accommodationId");
      if (!room) {
        return res.status(404).json({
          success: false,
          message: "Room not found"
        });
      }

      if (room.accommodationId.ownerId.toString() !== req.user.id) {
        return res.status(403).json({
          success: false,
          message: "Not authorized to view history for this room"
        });
      }
      
      query.roomId = roomId;
    } else {
      // Get history for the requesting tenant
      query.tenantId = req.user.id;
    }
    
    const history = await RoomOccupancy.find(query)
      .populate("roomId", "roomNumber name")
      .populate("tenantId", "name email phoneNumber")
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

// Add tenant to room (simplified without tenancy agreement)
exports.addTenantToRoom = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();
  
  try {
    const { roomId } = req.params;
    const { 
      tenantEmail, 
      tenantId, 
      isRepresentative = false,
      monthlyRent,
      moveInDate
    } = req.body;
    
    // Verify room exists and user is landlord
    const room = await Room.findById(roomId).populate("accommodationId");
    if (!room) {
      return res.status(404).json({
        success: false,
        message: "Room not found"
      });
    }

    if (room.accommodationId.ownerId.toString() !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: "Not authorized to manage this room"
      });
    }

    // Find tenant by ID or email
    let tenant;
    if (tenantId) {
      tenant = await User.findById(tenantId);
    } else if (tenantEmail) {
      tenant = await User.findOne({ email: tenantEmail });
    }

    if (!tenant) {
      return res.status(404).json({
        success: false,
        message: "Tenant not found"
      });
    }

    // Validate tenant role
    if (!tenant.role || !['tenant', 'co-tenant'].includes(tenant.role)) {
      return res.status(400).json({
        success: false,
        message: "User is not registered as a tenant"
      });
    }

    // Check if tenant already in room
    const existingOccupancy = await RoomOccupancy.findOne({
      roomId,
      tenantId: tenant._id,
      status: "active"
    });

    if (existingOccupancy) {
      return res.status(400).json({
        success: false,
        message: "Tenant already in this room"
      });
    }

    // Check room capacity
    const currentTenants = await RoomOccupancy.countDocuments({
      roomId,
      status: "active"
    });

    if (currentTenants >= room.capacity) {
      return res.status(400).json({
        success: false,
        message: "Room is at full capacity"
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
      tenantId: tenant._id,
      isRepresentative,
      moveInDate: moveInDate ? new Date(moveInDate) : new Date(),
      monthlyRent: monthlyRent || room.baseRent, // Store rent at time of move-in
      status: "active"
    });

    await occupancy.save({ session });

    // Update room currentTenant array
    if (!room.currentTenant.includes(tenant._id)) {
      room.currentTenant.push(tenant._id);
      await room.save({ session });
    }

    await session.commitTransaction();

    const populatedOccupancy = await RoomOccupancy.findById(occupancy._id)
      .populate("tenantId", "name email phoneNumber")
      .populate("roomId", "roomNumber name");

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
    const { terminationReason, moveOutDate } = req.body;
    
    // Verify room ownership
    const room = await Room.findById(roomId).populate("accommodationId");
    if (!room) {
      return res.status(404).json({
        success: false,
        message: "Room not found"
      });
    }

    if (room.accommodationId.ownerId.toString() !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: "Not authorized to manage this room"
      });
    }
    
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
    occupancy.moveOutDate = moveOutDate ? new Date(moveOutDate) : new Date();
    occupancy.terminationReason = terminationReason;
    occupancy.terminatedBy = req.user.id;
    await occupancy.save({ session });

    // Remove from room's currentTenant array
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
    
    // Verify room ownership
    const room = await Room.findById(roomId).populate("accommodationId");
    if (!room) {
      return res.status(404).json({
        success: false,
        message: "Room not found"
      });
    }

    if (room.accommodationId.ownerId.toString() !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: "Not authorized to manage this room"
      });
    }
    
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

// Get rooms where user is a tenant (for tenant dashboard)
exports.getMyRooms = async (req, res) => {
  try {
    const occupancies = await RoomOccupancy.find({
      tenantId: req.user.id,
      status: "active"
    })
    .populate("roomId", "roomNumber name baseRent")
    .populate({
      path: "roomId",
      populate: {
        path: "accommodationId",
        select: "name address"
      }
    });

    res.status(200).json({
      success: true,
      data: occupancies
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// Modified roomOccupancyController.js - Handle missing occupancy records

// Get all tenants in a room with fallback to room.currentTenant
exports.getRoomTenants = async (req, res) => {
  try {
    const { roomId } = req.params;
    
    // Verify room ownership
    const room = await Room.findById(roomId).populate("accommodationId");
    if (!room) {
      return res.status(404).json({
        success: false,
        message: "Room not found"
      });
    }

    if (room.accommodationId.ownerId.toString() !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: "Not authorized to view tenants for this room"
      });
    }
    
    // First try to get tenants from RoomOccupancy
    const occupancyTenants = await RoomOccupancy.find({
      roomId,
      status: "active"
    })
    .populate("tenantId", "name email phoneNumber profileImage")
    .sort({ moveInDate: 1 });

    // If we have occupancy records, return them
    if (occupancyTenants.length > 0) {
      return res.status(200).json({
        success: true,
        data: occupancyTenants,
        source: 'occupancy'
      });
    }

    // Fallback: If no occupancy records but room has currentTenant
    if (room.currentTenant && room.currentTenant.length > 0) {
      console.log(`🔄 Room ${roomId} has ${room.currentTenant.length} currentTenant but no occupancy records`);
      
      // Fetch tenant details and create temporary occupancy objects
      const User = require("../models/User");
      const tenantDetails = await User.find({
        _id: { $in: room.currentTenant }
      }).select("name email phoneNumber profileImage");

      const fallbackTenants = tenantDetails.map((user, index) => ({
        _id: `temp_${user._id}_${Date.now()}`, // Temporary ID
        roomId: roomId,
        tenantId: user,
        isRepresentative: index === 0, // Make first tenant representative
        moveInDate: new Date(),
        status: "active",
        monthlyRent: room.baseRent,
        isFallback: true // Flag to indicate this is fallback data
      }));

      return res.status(200).json({
        success: true,
        data: fallbackTenants,
        source: 'fallback',
        message: "Using fallback data from room.currentTenant. Consider creating proper occupancy records."
      });
    }

    // No tenants found
    res.status(200).json({
      success: true,
      data: [],
      source: 'empty'
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// Add utility function to create occupancy records for existing tenants
exports.createOccupancyForExistingTenants = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();
  
  try {
    const { roomId } = req.params;
    
    // Verify room ownership
    const room = await Room.findById(roomId).populate("accommodationId");
    if (!room) {
      return res.status(404).json({
        success: false,
        message: "Room not found"
      });
    }

    if (room.accommodationId.ownerId.toString() !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: "Not authorized to manage this room"
      });
    }

    if (!room.currentTenant || room.currentTenant.length === 0) {
      return res.status(400).json({
        success: false,
        message: "No current tenants in room"
      });
    }

    const created = [];
    const skipped = [];

    for (let i = 0; i < room.currentTenant.length; i++) {
      const tenantId = room.currentTenant[i];
      
      // Check if occupancy record already exists
      const existingOccupancy = await RoomOccupancy.findOne({
        roomId,
        tenantId,
        status: "active"
      });

      if (existingOccupancy) {
        skipped.push(tenantId);
        continue;
      }

      // Create new occupancy record
      const occupancy = new RoomOccupancy({
        roomId,
        tenantId,
        isRepresentative: i === 0, // First tenant becomes representative
        moveInDate: new Date(),
        monthlyRent: room.baseRent,
        status: "active"
      });

      await occupancy.save({ session });
      created.push(tenantId);
    }

    await session.commitTransaction();

    res.status(200).json({
      success: true,
      message: `Created ${created.length} occupancy records, skipped ${skipped.length} existing records`,
      data: {
        created: created.length,
        skipped: skipped.length,
        total: room.currentTenant.length
      }
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