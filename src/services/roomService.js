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
};
