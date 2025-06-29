const roomService = require("../services/roomService");
const tenantService = require("../services/rentalRequestService");
const catchAsync = require("../utils/catchAsync");
const Room = require("../models/Room");

const getAllRooms = async (req, res) => {
  try {
    // ✅ SỬA: Populate accommodation để lấy thông tin địa chỉ và owner
    const rooms = await Room.find()
      .populate({
        path: "accommodationId",
        select: "name description address images amenities",
        populate: {
          path: "ownerId",
          select: "name email phoneNumber profileImage",
        },
      })
      .populate({
        path: "currentTenant",
        select: "name email phoneNumber",
      })
      .sort({ createdAt: -1 });

    // ✅ THÊM: Format lại data để frontend dễ sử dụng
    const formattedRooms = rooms.map((room) => {
      const roomObj = room.toObject();

      return {
        ...roomObj,
        // ✅ THÊM: Format accommodation info
        accommodation: roomObj.accommodationId
          ? {
              _id: roomObj.accommodationId._id,
              name: roomObj.accommodationId.name,
              description: roomObj.accommodationId.description,
              address: roomObj.accommodationId.address,
              images: roomObj.accommodationId.images,
              amenities: roomObj.accommodationId.amenities,
              owner: roomObj.accommodationId.ownerId
                ? {
                    _id: roomObj.accommodationId.ownerId._id,
                    name: roomObj.accommodationId.ownerId.name,
                    email: roomObj.accommodationId.ownerId.email,
                    phoneNumber: roomObj.accommodationId.ownerId.phoneNumber,
                    profileImage: roomObj.accommodationId.ownerId.profileImage,
                  }
                : null,
            }
          : null,

        // ✅ THÊM: Format address để frontend dễ hiển thị
        fullAddress:
          roomObj.accommodationId?.address?.fullAddress ||
          "Địa chỉ đang cập nhật",
        district: roomObj.accommodationId?.address?.district || "",
        ward: roomObj.accommodationId?.address?.ward || "",
        city: roomObj.accommodationId?.address?.city || "Đà Nẵng",

        // ✅ THÊM: Format owner info ở level cao cho Item component
        user: roomObj.accommodationId?.ownerId
          ? {
              _id: roomObj.accommodationId.ownerId._id,
              name: roomObj.accommodationId.ownerId.name,
              email: roomObj.accommodationId.ownerId.email,
              phone: roomObj.accommodationId.ownerId.phoneNumber,
              avatar: roomObj.accommodationId.ownerId.profileImage,
            }
          : {
              name: "Chủ trọ",
              phone: "Đang cập nhật",
            },
      };
    });

    console.log(
      `✅ Retrieved ${formattedRooms.length} rooms with full details`
    );

    res.json({
      status: "success",
      results: formattedRooms.length,
      data: {
        rooms: formattedRooms,
      },
    });
  } catch (err) {
    console.error("❌ Lỗi khi truy vấn getAllRooms:", err);
    res.status(500).json({
      status: "error",
      error: "Lỗi server",
      message: err.message,
    });
  }
};

// ✅ SỬA: Cải thiện getRoomById để lấy thông tin đầy đủ
const getRoomById = async (req, res) => {
  try {
    const room = await Room.findById(req.params.roomId)
      .populate({
        path: "accommodationId",
        populate: {
          path: "ownerId",
          select: "name email phoneNumber profileImage",
        },
      })
      .populate({
        path: "currentTenant",
        select: "name email phoneNumber",
      });

    if (!room) {
      return res.status(404).json({
        status: "error",
        message: "Không tìm thấy phòng",
      });
    }

    // ✅ THÊM: Format data tương tự getAllRooms
    const roomObj = room.toObject();
    const formattedRoom = {
      ...roomObj,
      accommodation: roomObj.accommodationId
        ? {
            _id: roomObj.accommodationId._id,
            name: roomObj.accommodationId.name,
            description: roomObj.accommodationId.description,
            address: roomObj.accommodationId.address,
            images: roomObj.accommodationId.images,
            amenities: roomObj.accommodationId.amenities,
            owner: roomObj.accommodationId.ownerId,
          }
        : null,

      fullAddress:
        roomObj.accommodationId?.address?.fullAddress ||
        "Địa chỉ đang cập nhật",
      district: roomObj.accommodationId?.address?.district || "",
      ward: roomObj.accommodationId?.address?.ward || "",
      city: roomObj.accommodationId?.address?.city || "Đà Nẵng",

      user: roomObj.accommodationId?.ownerId
        ? {
            _id: roomObj.accommodationId.ownerId._id,
            name: roomObj.accommodationId.ownerId.name,
            email: roomObj.accommodationId.ownerId.email,
            phone: roomObj.accommodationId.ownerId.phoneNumber,
            avatar: roomObj.accommodationId.ownerId.profileImage,
          }
        : null,
    };

    res.json({
      status: "success",
      data: {
        room: formattedRoom,
      },
    });
  } catch (err) {
    console.error("❌ Lỗi khi truy vấn getRoomById:", err);
    res.status(400).json({
      status: "error",
      error: "ID không hợp lệ",
      message: err.message,
    });
  }
};

const getAllRoomsByAccommodateId = catchAsync(async (req, res) => {
  const { accommodationId } = req.params;

  if (!req.user || !req.user._id) {
    return res.status(401).json({
      status: "error",
      message: "User not authenticated",
    });
  }

  const userId = req.user._id;
  const rooms = await roomService.getAllRoomsByAccommodateId(
    accommodationId,
    userId
  );

  res.status(200).json({
    status: "success",
    data: {
      rooms,
    },
  });
});

const createRoom = catchAsync(async (req, res) => {
  // ✅ SỬA: Lấy accommodationId từ URL params
  const accommodationId = req.params.accommodationId;
  const roomData = req.body;

  if (!req.user || !req.user._id) {
    return res.status(401).json({
      status: "error",
      message: "User not authenticated",
    });
  }

  const userId = req.user._id;

  // ✅ SỬA: Pass accommodationId as third parameter
  const room = await roomService.createRoom(roomData, userId, accommodationId);

  res.status(201).json({
    status: "success",
    data: {
      room,
    },
  });
});

const updateRoom = catchAsync(async (req, res) => {
  const { roomId } = req.params;
  const updateData = req.body;

  if (!req.user || !req.user._id) {
    return res.status(401).json({
      status: "error",
      message: "User not authenticated",
    });
  }

  const userId = req.user._id;
  const room = await roomService.updateRoom(roomId, updateData, userId);

  res.status(200).json({
    status: "success",
    data: {
      room,
    },
  });
});

const deactivateRoom = catchAsync(async (req, res) => {
  const { roomId } = req.params;

  if (!req.user || !req.user._id) {
    return res.status(401).json({
      status: "error",
      message: "User not authenticated",
    });
  }

  const userId = req.user._id;
  const room = await roomService.deactivateRoom(roomId, userId);

  res.status(200).json({
    status: "success",
    message: "Room deactivated successfully",
    data: {
      room,
    },
  });
});

const reactivateRoom = catchAsync(async (req, res) => {
  const { roomId } = req.params;

  if (!req.user || !req.user._id) {
    return res.status(401).json({
      status: "error",
      message: "User not authenticated",
    });
  }

  const userId = req.user._id;
  const room = await roomService.reactivateRoom(roomId, userId);

  res.status(200).json({
    status: "success",
    message: "Room reactivated successfully",
    data: {
      room,
    },
  });
});

const deleteRoom = catchAsync(async (req, res) => {
  const { roomId } = req.params;

  if (!req.user || !req.user._id) {
    return res.status(401).json({
      status: "error",
      message: "User not authenticated",
    });
  }

  const userId = req.user._id;
  const result = await roomService.deleteRoom(roomId, userId);

  res.status(200).json({
    status: "success",
    message: result.message,
  });
});

const searchRooms = catchAsync(async (req, res) => {
  const filters = req.query;

  console.log("🔍 Search request received:", filters);

  const cleanedFilters = {};

  // Copy string filters
  if (filters.type) cleanedFilters.type = filters.type;
  if (filters.district) cleanedFilters.district = filters.district;
  if (filters.province) cleanedFilters.province = filters.province;
  if (filters.features) cleanedFilters.features = filters.features;
  // ✅ XÓA: Bỏ furnishingLevel
  // if (filters.furnishingLevel) cleanedFilters.furnishingLevel = filters.furnishingLevel;

  // Handle boolean filters
  if (filters.isAvailable !== undefined) {
    cleanedFilters.isAvailable =
      filters.isAvailable === "true" || filters.isAvailable === true;
  }
  if (filters.hasPrivateBathroom !== undefined) {
    cleanedFilters.hasPrivateBathroom =
      filters.hasPrivateBathroom === "true" ||
      filters.hasPrivateBathroom === true;
  }

  // Handle numeric filters with validation
  if (filters.minRent && !isNaN(parseInt(filters.minRent))) {
    cleanedFilters.minRent = parseInt(filters.minRent);
  }
  if (filters.maxRent && !isNaN(parseInt(filters.maxRent))) {
    cleanedFilters.maxRent = parseInt(filters.maxRent);
  }
  if (filters.minSize && !isNaN(parseInt(filters.minSize))) {
    cleanedFilters.minSize = parseInt(filters.minSize);
  }
  if (filters.maxSize && !isNaN(parseInt(filters.maxSize))) {
    cleanedFilters.maxSize = parseInt(filters.maxSize);
  }
  if (filters.capacity && !isNaN(parseInt(filters.capacity))) {
    cleanedFilters.capacity = parseInt(filters.capacity);
  }

  // Handle array filters
  if (filters.amenities) {
    if (Array.isArray(filters.amenities)) {
      cleanedFilters.amenities = filters.amenities;
    } else if (typeof filters.amenities === "string") {
      cleanedFilters.amenities = filters.amenities.split(",");
    }
  }

  console.log("🎯 Cleaned filters:", cleanedFilters);

  const rooms = await roomService.searchRooms(cleanedFilters);

  res.status(200).json({
    status: "success",
    results: rooms.length,
    data: {
      rooms,
    },
    filters: cleanedFilters,
    message: `Found ${rooms.length} rooms matching your criteria`,
  });
});

const getAllRequestsInRoom = catchAsync(async (req, res) => {
  const { roomId } = req.params;
  const requests = await tenantService.getAllRentalRequestsByRoomId(roomId);

  res.status(200).json({
    status: "success",
    data: {
      requests,
    },
  });
});

const getCurrentTenantsInRoom = catchAsync(async (req, res) => {
  const { roomId } = req.params;
  const tenants = await roomService.getAllCurrentTenantsInRoom(roomId);

  res.status(200).json({
    status: "success",
    results: tenants.length,
    data: {
      tenants,
    },
  });
});

module.exports = {
  getAllRooms,
  getRoomById,
  getAllRoomsByAccommodateId,
  getCurrentTenantsInRoom,
  createRoom,
  updateRoom,
  deactivateRoom,
  reactivateRoom,
  deleteRoom,
  searchRooms,
  getAllRequestsInRoom,
};
