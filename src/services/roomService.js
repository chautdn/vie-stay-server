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

    if (
      room.currentTenant &&
      Array.isArray(room.currentTenant) &&
      room.currentTenant.length > 0
    ) {
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

    if (
      room.currentTenant &&
      Array.isArray(room.currentTenant) &&
      room.currentTenant.length > 0
    ) {
      throw new Error("Cannot deactivate room with active tenant");
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
    let accommodationQuery = {};

    console.log("🔍 Search filters received:", filters);

    // ✅ XÓA: Bỏ filter theo accommodationId
    // if (filters.accommodationId) {
    //   query.accommodationId = filters.accommodationId;
    // }

    // Room type filter
    if (filters.type) {
      query.type = filters.type;
    }

    // Price range filter
    if (filters.minRent || filters.maxRent) {
      query.baseRent = {};
      if (filters.minRent) query.baseRent.$gte = parseInt(filters.minRent);
      if (filters.maxRent) query.baseRent.$lte = parseInt(filters.maxRent);
    }

    // Size range filter
    if (filters.minSize || filters.maxSize) {
      query.size = {};
      if (filters.minSize) query.size.$gte = parseInt(filters.minSize);
      if (filters.maxSize) query.size.$lte = parseInt(filters.maxSize);
    }

    // Features/amenities filter
    if (filters.features) {
      const featureMapping = {
        thang_may: "elevator",
        wifi: "wifi",
        may_giat: "washing_machine",
        dieu_hoa: "air_conditioning",
        ban_cong: "balcony",
        noi_that_day_du: "fully_furnished",
        cho_phep_nuoi_thu_cung: "pet_friendly",
        cho_phep_nau_an: "cooking_allowed",
        bao_dien_nuoc: "utilities_included",
        bao_an_toan: "security",
        cho_de_xe: "parking",
        camera_an_ninh: "security_camera",
      };

      const mappedAmenity = featureMapping[filters.features];
      if (mappedAmenity) {
        query.amenities = { $in: [mappedAmenity] };
      }
    }

    // Capacity filter
    if (filters.capacity) {
      query.capacity = { $gte: parseInt(filters.capacity) };
    }

    // Private bathroom filter
    if (filters.hasPrivateBathroom !== undefined) {
      query.hasPrivateBathroom = filters.hasPrivateBathroom === "true";
    }

    // ✅ XÓA: Bỏ furnishingLevel filter
    // if (filters.furnishingLevel) {
    //   query.furnishingLevel = filters.furnishingLevel;
    // }

    // Amenities array filter
    if (
      filters.amenities &&
      Array.isArray(filters.amenities) &&
      filters.amenities.length > 0
    ) {
      query.amenities = { $in: filters.amenities };
    }

    // Availability filter
    if (filters.isAvailable !== undefined) {
      query.isAvailable =
        filters.isAvailable === true || filters.isAvailable === "true";
    }

    // District filter (via accommodation)
    if (filters.district) {
      accommodationQuery["address.district"] = filters.district;
    }

    // Province/city filter (via accommodation)
    if (filters.province) {
      accommodationQuery["address.city"] = filters.province;
    }

    console.log("🎯 Room query:", query);
    console.log("🏠 Accommodation query:", accommodationQuery);

    let rooms;

    // ✅ SỬA: Simplified query logic
    if (Object.keys(accommodationQuery).length > 0) {
      // Need aggregation for location filters
      rooms = await Room.aggregate([
        { $match: query },
        {
          $lookup: {
            from: "accommodations",
            localField: "accommodationId",
            foreignField: "_id",
            as: "accommodation",
          },
        },
        {
          $match: {
            "accommodation.0": { $exists: true },
          },
        },
        {
          $match: Object.keys(accommodationQuery).reduce((acc, key) => {
            acc[`accommodation.0.${key}`] = accommodationQuery[key];
            return acc;
          }, {}),
        },
        {
          $lookup: {
            from: "users",
            localField: "accommodation.ownerId",
            foreignField: "_id",
            as: "ownerInfo",
          },
        },
        {
          $lookup: {
            from: "users",
            localField: "currentTenant",
            foreignField: "_id",
            as: "currentTenantInfo",
          },
        },
        {
          $project: {
            _id: 1,
            roomNumber: 1,
            name: 1,
            description: 1,
            type: 1,
            size: 1,
            capacity: 1,
            hasPrivateBathroom: 1,
            // ✅ XÓA: Bỏ furnishingLevel
            images: 1,
            amenities: 1,
            baseRent: 1,
            deposit: 1,
            utilityRates: 1,
            additionalFees: 1,
            isAvailable: 1,
            availableFrom: 1,
            averageRating: 1,
            totalRatings: 1,
            viewCount: 1,
            favoriteCount: 1,
            createdAt: 1,
            updatedAt: 1,
            accommodationId: {
              _id: { $arrayElemAt: ["$accommodation._id", 0] },
              name: { $arrayElemAt: ["$accommodation.name", 0] },
              description: { $arrayElemAt: ["$accommodation.description", 0] },
              address: { $arrayElemAt: ["$accommodation.address", 0] },
              images: { $arrayElemAt: ["$accommodation.images", 0] },
              amenities: { $arrayElemAt: ["$accommodation.amenities", 0] },
              ownerId: {
                _id: { $arrayElemAt: ["$ownerInfo._id", 0] },
                name: { $arrayElemAt: ["$ownerInfo.name", 0] },
                email: { $arrayElemAt: ["$ownerInfo.email", 0] },
                phoneNumber: { $arrayElemAt: ["$ownerInfo.phoneNumber", 0] },
              },
            },
            currentTenant: {
              $map: {
                input: "$currentTenantInfo",
                as: "tenant",
                in: {
                  _id: "$$tenant._id",
                  name: "$$tenant.name",
                  email: "$$tenant.email",
                  phoneNumber: "$$tenant.phoneNumber",
                },
              },
            },
          },
        },
        { $sort: { createdAt: -1 } },
      ]);
    } else {
      // Simple query without location filters
      rooms = await Room.find(query)
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
        })
        .sort({ createdAt: -1 });
    }

    console.log(`✅ Found ${rooms.length} rooms matching criteria`);
    return rooms;
  } catch (error) {
    console.error("❌ Search rooms error:", error);
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

const get10NewPosts = async () => {
  try {
    const rooms = await Room.find().sort({ createdAt: -1 }).limit(10);
    return rooms;
  } catch (error) {
    throw new Error("Error fetching new posts: " + error.message);
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
  get10NewPosts,
};
