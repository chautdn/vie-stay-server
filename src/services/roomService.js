const Room = require("../models/Room");
const User = require("../models/User");
const RentalRequest = require("../models/RentalRequest");
const Accommodation = require("../models/Accommodation");
const TenancyAgreement = require("../models/TenancyAgreement");

const getAllRooms = async () => {
  try {
    const rooms = await Room.find(
      { isAvailable: true } 
    ).populate({

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

// Lấy thông tin chi tiết phòng và danh sách người thuê
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

    // Lấy danh sách tất cả người đã/đang thuê phòng từ TenancyAgreement
    const tenancyAgreements = await TenancyAgreement.find({ roomId: roomId })
      .populate({
        path: "tenantId",
        select: "name email phoneNumber",
      })
      .sort({ createdAt: -1 });

    // Tạo object response với thông tin đầy đủ - Safe access
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
    console.error("Error in getRoomById:", error);
    throw new Error("Error fetching room: " + error.message);
  }
};

// Lấy danh sách phòng theo AccommodationId
const getAllRoomsByAccommodateId = async (accommodationId) => {
  try {
    const mongoose = require("mongoose");
    if (!mongoose.Types.ObjectId.isValid(accommodationId)) {
      throw new Error("Invalid accommodation ID format");
    }
    const accommodation = await Accommodation.findById(accommodationId);

    if (!accommodation) {
      throw new Error("Accommodation not found");
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
    console.error("Error in getAllRoomsByAccommodateId:", error);
    throw new Error(
      "Error fetching rooms by accommodation ID: " + error.message
    );
  }
};

const createRoom = async (roomData, userId) => {
  try {
    // Kiểm tra accommodation có tồn tại và thuộc về user không
    const accommodation = await Accommodation.findOne({
      _id: roomData.accommodationId,
      ownerId: userId,
    });

    if (!accommodation) {
      throw new Error("Accommodation not found or you don't have permission");
    }

    // Tạo room object với safe defaults
    const roomToCreate = {
      ...roomData,
      // Đảm bảo các field có giá trị mặc định nếu cần
      isAvailable:
        roomData.isAvailable !== undefined ? roomData.isAvailable : true,
      averageRating: roomData.averageRating || 0,
      totalRatings: roomData.totalRatings || 0,
      viewCount: roomData.viewCount || 0,
      favoriteCount: roomData.favoriteCount || 0,
    };

    const room = new Room(roomToCreate);
    await room.save();

    // Update totalRooms trong accommodation
    await Accommodation.findByIdAndUpdate(roomData.accommodationId, {
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
    console.error("Error in createRoom:", error);
    throw new Error("Error creating room: " + error.message);
  }
};

const hideRoom = async (roomId, userId) => {
  const room = await Room.findById(roomId).populate("accommodationId");
  if (!room) throw new Error("Room not found");


  console.log("Room owner ID:", room.accommodationId.ownerId.toString());
  console.log("User ID:", userId.toString());
  if (room.accommodationId.ownerId.toString() !== userId.toString())

    
    throw new Error("You do not have permission to hide this room");
  if (room.isAvailable === false) {
    throw new Error("Room is not available for hiding");
  }
  room.isAvailable = false;
  await room.save();

  return room
};

const unhideRoom = async (roomId, userId) => {
  const room = await Room.findById(roomId).populate("accommodationId");
  if (!room) throw new Error("Room not found");

  if (room.accommodationId.ownerId.toString() !== userId.toString())

    
    throw new Error("You do not have permission to hide this room");
  if (room.isAvailable === true) {
    throw new Error("Room is not available for unhiding");
  }
  room.isAvailable = true;
  await room.save();

  return room
};

// Room CRUD operations
const updateRoom = async (roomId, updateData, userId) => {
  try {
    // Kiểm tra quyền sở hữu
    const room = await Room.findById(roomId).populate("accommodationId");
    if (!room) {
      throw new Error("Room not found");
    }

    if (room.accommodationId.ownerId.toString() !== userId) {
      throw new Error("You do not have permission to update this room");
    }

    // Validate update data
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

    if (room.accommodationId.ownerId.toString() !== userId) {
      throw new Error("You do not have permission to deactivate this room");
    }

    // Kiểm tra có tenant đang thuê không
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

    // Update availableRooms trong accommodation
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

    if (room.accommodationId.ownerId.toString() !== userId) {
      throw new Error("You do not have permission to reactivate this room");
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

    // Update availableRooms trong accommodation
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

    if (room.accommodationId.ownerId.toString() !== userId) {
      throw new Error("You do not have permission to delete this room");
    }

    // Kiểm tra có tenant đang thuê hoặc có rental requests pending
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

    // Xóa room
    await Room.findByIdAndDelete(roomId);

    // Update totalRooms và availableRooms trong accommodation
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

// Search và filter rooms
const searchRooms = async (filters) => {
  try {
    const query = {};

    // Basic filters
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
    console.error("Error in getAllCurrentTenantsInRoom:", error);
    throw new Error("Error fetching current tenants in room: " + error.message);
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
  hideRoom,
  unhideRoom,

};
