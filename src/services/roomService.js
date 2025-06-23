// roomService.js
const Room = require("../models/Room");
const RentalRequest = require("../models/RentalRequest");
const Accommodation = require("../models/Accommodation");
const TenancyAgreement = require("../models/TenancyAgreement");

const getAllRooms = async () => {
  try {
    const rooms = await Room.find().populate({
      path: "accommodationId",
      populate: {
        path: "ownerId",
        select: "name email",
      },
    });
    return rooms;
  } catch (error) {
    throw new Error("Error fetching rooms: " + error.message);
  }
};

const getRoomById = async (roomId) => {
  try {
    const room = await Room.findById(roomId)
      .populate({
        path: "accommodationId",
        populate: {
          path: "ownerId",
          select: "name email phoneNumber",
        },
      })
      .populate({
        path: "currentTenant",
        select: "name email phoneNumber",
      });

    if (!room) {
      throw new Error("Room not found");
    }

    const tenancyAgreements = await TenancyAgreement.find({ roomId: roomId })
      .populate({
        path: "tenantId",
        select: "name email phoneNumber",
      })
      .sort({ createdAt: -1 });

    const roomObject = room.toObject();
    const roomDetails = {
      ...roomObject,
      tenancyHistory: tenancyAgreements || [],
      currentTenants:
        tenancyAgreements.filter(
          (agreement) => agreement && agreement.status === "active"
        ) || [],
    };

    return roomDetails;
  } catch (error) {
    throw new Error("Error fetching room: " + error.message);
  }
};

const getAllRoomsByAccommodateId = async (accommodationId, userId) => {
  try {
    const accommodation = await Accommodation.findById(accommodationId);

    if (!accommodation) {
      throw new Error("Accommodation not found");
    }

    if (accommodation.ownerId.toString() !== userId.toString()) {
      throw new Error(
        "Access denied: You can only view rooms in your own properties"
      );
    }

    const rooms = await Room.find({ accommodationId: accommodationId })
      .populate({
        path: "accommodationId",
        select: "name ownerId",
        populate: {
          path: "ownerId",
          select: "name email",
        },
      })
      .populate({
        path: "currentTenant",
        select: "name email",
      })
      .sort({ roomNumber: 1 });

    return rooms;
  } catch (error) {
    throw new Error(
      "Error fetching rooms by accommodation ID: " + error.message
    );
  }
};

const createRoom = async (roomData, userId, accommodationId) => {
  try {
    // ✅ SỬA: Sửa lỗi typo và sử dụng accommodationId parameter
    const accommodation = await Accommodation.findOne({
      _id: accommodationId, // ✅ SỬA: từ "ccommodationId: params.accommodationId"
      ownerId: userId,
    });

    if (!accommodation) {
      throw new Error("Accommodation not found or you don't have permission");
    }

    const roomToCreate = {
      ...roomData,
      accommodationId: accommodationId, // ✅ THÊM: Đảm bảo accommodationId được set
      isAvailable:
        roomData.isAvailable !== undefined ? roomData.isAvailable : true,
      averageRating: roomData.averageRating || 0,
      totalRatings: roomData.totalRatings || 0,
      viewCount: roomData.viewCount || 0,
      favoriteCount: roomData.favoriteCount || 0,
    };

    const room = new Room(roomToCreate);
    await room.save();

    // ✅ SỬA: Sử dụng accommodationId parameter thay vì roomData.accommodationId
    await Accommodation.findByIdAndUpdate(accommodationId, {
      $inc: { totalRooms: 1, availableRooms: 1 },
    });

    return room.populate({
      path: "accommodationId",
      populate: {
        path: "ownerId",
        select: "name email",
      },
    });
  } catch (error) {
    throw new Error("Error creating room: " + error.message);
  }
};

const updateRoom = async (roomId, updateData, userId) => {
  try {
    const existingRoom =
      await Room.findById(roomId).populate("accommodationId");

    if (!existingRoom) {
      throw new Error("Room not found");
    }

    if (existingRoom.accommodationId.ownerId.toString() !== userId.toString()) {
      throw new Error("Access denied: You can only modify your own properties");
    }

    const allowedUpdates = [
      "name",
      "description",
      "type",
      "size",
      "capacity",
      "baseRent",
      "deposit",
      "amenities",
      "images",
      "utilityRates",
      "additionalFees",
    ];
    const updates = Object.keys(updateData);
    const isValidOperation = updates.every((update) =>
      allowedUpdates.includes(update)
    );

    if (!isValidOperation) {
      throw new Error("Invalid updates");
    }

    const updatedRoom = await Room.findByIdAndUpdate(roomId, updateData, {
      new: true,
      runValidators: true,
    }).populate({
      path: "accommodationId",
      populate: {
        path: "ownerId",
        select: "name email",
      },
    });

    return updatedRoom;
  } catch (error) {
    throw new Error("Error updating room: " + error.message);
  }
};

const deactivateRoom = async (roomId, userId) => {
  try {
    const room = await Room.findById(roomId).populate("accommodationId");
    if (!room) {
      throw new Error("Room not found");
    }

    if (room.accommodationId.ownerId.toString() !== userId.toString()) {
      throw new Error("Access denied: You can only modify your own properties");
    }

    if (room.currentTenant) {
      throw new Error("Cannot deactivate room with active tenant");
    }

    const deactivatedRoom = await Room.findByIdAndUpdate(
      roomId,
      {
        isAvailable: false,
        availableFrom: null,
      },
      { new: true }
    );

    await Accommodation.findByIdAndUpdate(room.accommodationId._id, {
      $inc: { availableRooms: -1 },
    });

    return deactivatedRoom;
  } catch (error) {
    throw new Error("Error deactivating room: " + error.message);
  }
};

const reactivateRoom = async (roomId, userId) => {
  try {
    const room = await Room.findById(roomId).populate("accommodationId");
    if (!room) {
      throw new Error("Room not found");
    }

    if (room.accommodationId.ownerId.toString() !== userId.toString()) {
      throw new Error("Access denied: You can only modify your own properties");
    }

    const reactivatedRoom = await Room.findByIdAndUpdate(
      roomId,
      {
        isAvailable: true,
        availableFrom: new Date(),
        currentTenant: null,
      },
      { new: true }
    );

    await Accommodation.findByIdAndUpdate(room.accommodationId._id, {
      $inc: { availableRooms: 1 },
    });

    return reactivatedRoom;
  } catch (error) {
    throw new Error("Error reactivating room: " + error.message);
  }
};

const deleteRoom = async (roomId, userId) => {
  try {
    const room = await Room.findById(roomId).populate("accommodationId");
    if (!room) {
      throw new Error("Room not found");
    }

    if (room.accommodationId.ownerId.toString() !== userId.toString()) {
      throw new Error("Access denied: You can only modify your own properties");
    }

    if (room.currentTenant) {
      throw new Error("Cannot delete room with active tenant");
    }

    const activeRequests = await RentalRequest.find({
      roomId: roomId,
      status: "pending",
    });

    if (activeRequests.length > 0) {
      throw new Error("Cannot delete room with pending rental requests");
    }

    await Room.findByIdAndDelete(roomId);

    const updateData = { $inc: { totalRooms: -1 } };
    if (room.isAvailable) {
      updateData.$inc.availableRooms = -1;
    }

    await Accommodation.findByIdAndUpdate(room.accommodationId._id, updateData);

    return { message: "Room deleted successfully" };
  } catch (error) {
    throw new Error("Error deleting room: " + error.message);
  }
};

const searchRooms = async (filters) => {
  try {
    const query = {};

    if (filters.accommodationId) {
      query.accommodationId = filters.accommodationId;
    }

    if (filters.type) {
      query.type = filters.type;
    }

    if (filters.minRent || filters.maxRent) {
      query.baseRent = {};
      if (filters.minRent) query.baseRent.$gte = parseInt(filters.minRent);
      if (filters.maxRent) query.baseRent.$lte = parseInt(filters.maxRent);
    }

    if (filters.capacity) {
      query.capacity = { $gte: parseInt(filters.capacity) };
    }

    if (filters.hasPrivateBathroom !== undefined) {
      query.hasPrivateBathroom = filters.hasPrivateBathroom === "true";
    }

    if (filters.furnishingLevel) {
      query.furnishingLevel = filters.furnishingLevel;
    }

    if (filters.amenities && filters.amenities.length > 0) {
      query.amenities = { $in: filters.amenities };
    }

    if (filters.isAvailable !== undefined) {
      query.isAvailable = filters.isAvailable === "true";
    }

    const rooms = await Room.find(query)
      .populate({
        path: "accommodationId",
        populate: {
          path: "ownerId",
          select: "name email",
        },
      })
      .populate({
        path: "currentTenant",
        select: "name email phoneNumber",
      })
      .sort({ createdAt: -1 });

    return rooms;
  } catch (error) {
    throw new Error("Error searching rooms: " + error.message);
  }
};

const getAllCurrentTenantsInRoom = async (roomId) => {
  try {
    const room = await Room.findById(roomId)
      .populate({ path: "currentTenant", select: "name email phoneNumber" })
      .populate({ path: "accommodationId", select: "name" });

    if (!room) {
      throw new Error("Room not found");
    }

    if (!room.currentTenant) {
      return [];
    }

    return room.currentTenant;
  } catch (error) {
    throw new Error("Error fetching current tenants in room: " + error.message);
  }
};

// Enhanced roomService.js - getAvailableRooms function with debugging

const getAvailableRooms = async (filters = {}) => {
  try {
    console.log("🔍 getAvailableRooms called with filters:", filters);
    
    // Base query - only require isAvailable: true
    const query = {
      isAvailable: true,
    };

    // ❌ POTENTIAL ISSUE: This line might be filtering out rooms
    // availableFrom: { $lte: new Date() }, 
    
    // 🔧 BETTER: Only add availableFrom filter if the field exists and has a valid date
    // Many rooms might not have availableFrom set properly
    // Comment out or modify this condition:
    
    // Only add availableFrom filter if we want to be strict about availability date
    // if (filters.strictAvailability !== false) {
    //   query.availableFrom = { $lte: new Date() };
    // }

    console.log("📋 Base query:", query);

    // Apply additional filters only if they exist
    if (filters.type && filters.type !== '') {
      query.type = filters.type;
      console.log("🏷️ Added type filter:", filters.type);
    }

    if (filters.minRent || filters.maxRent) {
      query.baseRent = {};
      if (filters.minRent && filters.minRent !== '') {
        query.baseRent.$gte = parseInt(filters.minRent);
        console.log("💰 Added minRent filter:", filters.minRent);
      }
      if (filters.maxRent && filters.maxRent !== '') {
        query.baseRent.$lte = parseInt(filters.maxRent);
        console.log("💰 Added maxRent filter:", filters.maxRent);
      }
    }

    if (filters.capacity && filters.capacity !== '') {
      query.capacity = { $gte: parseInt(filters.capacity) };
      console.log("👥 Added capacity filter:", filters.capacity);
    }

    if (filters.hasPrivateBathroom !== undefined && filters.hasPrivateBathroom !== '') {
      query.hasPrivateBathroom = filters.hasPrivateBathroom === "true";
      console.log("🚿 Added bathroom filter:", filters.hasPrivateBathroom);
    }

    if (filters.furnishingLevel && filters.furnishingLevel !== '') {
      query.furnishingLevel = filters.furnishingLevel;
      console.log("🛋️ Added furnishing filter:", filters.furnishingLevel);
    }

    if (filters.amenities && filters.amenities.length > 0) {
      const amenitiesArray = Array.isArray(filters.amenities) 
        ? filters.amenities 
        : filters.amenities.split(',');
      query.amenities = { $in: amenitiesArray };
      console.log("✨ Added amenities filter:", amenitiesArray);
    }

    console.log("🔍 Final query:", JSON.stringify(query, null, 2));

    // First, let's check total rooms without filters
    const totalRoomsCount = await Room.countDocuments({});
    const availableRoomsCount = await Room.countDocuments({ isAvailable: true });
    
    console.log("📊 Database stats:");
    console.log("- Total rooms in DB:", totalRoomsCount);
    console.log("- Available rooms in DB:", availableRoomsCount);

    // Execute the main query
    const rooms = await Room.find(query)
      .populate({
        path: "accommodationId",
        match: { 
          approvalStatus: "approved", 
          isActive: true 
        }, // Only approved and active accommodations
        populate: {
          path: "ownerId",
          select: "name email",
        },
      })
      .sort({ createdAt: -1 });

    console.log("🏠 Rooms found after query:", rooms.length);

    // ❌ POTENTIAL ISSUE: This filter removes rooms with null accommodationId
    // But the populate match might set accommodationId to null for non-matching accommodations
    const availableRooms = rooms.filter(room => room.accommodationId !== null);
    
    console.log("🏠 Rooms after accommodation filter:", availableRooms.length);
    
    // Let's also check what rooms were filtered out
    const filteredOutRooms = rooms.filter(room => room.accommodationId === null);
    if (filteredOutRooms.length > 0) {
      console.log("⚠️ Rooms filtered out due to accommodation issues:", filteredOutRooms.length);
      console.log("⚠️ Sample filtered room:", filteredOutRooms[0]);
    }

    // Debug: Let's see a sample room structure
    if (availableRooms.length > 0) {
      console.log("📋 Sample available room:", {
        id: availableRooms[0]._id,
        name: availableRooms[0].name,
        isAvailable: availableRooms[0].isAvailable,
        accommodationId: availableRooms[0].accommodationId ? 'populated' : 'null',
        accommodationName: availableRooms[0].accommodationId?.name,
      });
    }

    return availableRooms;
  } catch (error) {
    console.error("❌ Error in getAvailableRooms:", error);
    throw new Error("Error fetching available rooms: " + error.message);
  }
};

// Alternative version without strict accommodation filtering
const getAvailableRoomsLenient = async (filters = {}) => {
  try {
    console.log("🔍 getAvailableRoomsLenient called with filters:", filters);
    
    const query = {
      isAvailable: true,
      // Remove the availableFrom restriction temporarily
    };

    // Apply filters (same as above)
    if (filters.type) query.type = filters.type;
    if (filters.minRent || filters.maxRent) {
      query.baseRent = {};
      if (filters.minRent) query.baseRent.$gte = parseInt(filters.minRent);
      if (filters.maxRent) query.baseRent.$lte = parseInt(filters.maxRent);
    }
    if (filters.capacity) query.capacity = { $gte: parseInt(filters.capacity) };
    if (filters.hasPrivateBathroom !== undefined) {
      query.hasPrivateBathroom = filters.hasPrivateBathroom === "true";
    }
    if (filters.furnishingLevel) query.furnishingLevel = filters.furnishingLevel;

    console.log("🔍 Lenient query:", query);

    // Get all available rooms first, then populate
    const rooms = await Room.find(query)
      .populate({
        path: "accommodationId",
        // Remove the match condition to see all accommodations
        populate: {
          path: "ownerId",
          select: "name email",
        },
      })
      .sort({ createdAt: -1 });

    console.log("🏠 Total rooms found:", rooms.length);

    // Filter accommodation status in JavaScript instead of MongoDB
    const availableRooms = rooms.filter(room => {
      if (!room.accommodationId) {
        console.log("⚠️ Room with no accommodation:", room._id, room.name);
        return false;
      }
      
      if (room.accommodationId.approvalStatus !== "approved") {
        console.log("⚠️ Room with non-approved accommodation:", room._id, room.accommodationId.approvalStatus);
        return false;
      }
      
      if (!room.accommodationId.isActive) {
        console.log("⚠️ Room with inactive accommodation:", room._id);
        return false;
      }
      
      return true;
    });

    console.log("🏠 Final available rooms:", availableRooms.length);

    return availableRooms;
  } catch (error) {
    console.error("❌ Error in getAvailableRoomsLenient:", error);
    throw new Error("Error fetching available rooms: " + error.message);
  }
};
module.exports = {
  getAllRooms,
  getRoomById,
  getAllRoomsByAccommodateId,
  getAllCurrentTenantsInRoom,
  createRoom,
  updateRoom,
  deactivateRoom,
  reactivateRoom,
  deleteRoom,
  searchRooms,
  getAvailableRooms,
  getAvailableRoomsLenient, 
};