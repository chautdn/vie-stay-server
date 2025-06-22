const roomService = require("../services/roomService");
const tenantService = require("../services/rentalRequestService");
const catchAsync = require("../utils/catchAsync");
const Room = require("../models/Room");

const getAllRooms = async (req, res) => {
  try {
    const rooms = await Room.find();
    res.json(rooms);
  } catch (err) {
    console.error("❌ Lỗi khi truy vấn Room.find():", err);
    res.status(500).json({ error: "Lỗi server", message: err.message });
  }
};

// Lấy chi tiết phòng theo ID
const getRoomById = async (req, res) => {
  try {
    const room = await Room.findById(req.params.roomId);
    if (!room) return res.status(404).json({ message: "Không tìm thấy phòng" });
    res.json(room);
  } catch (err) {
    res.status(400).json({ error: "ID không hợp lệ" });
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
  const rooms = await roomService.searchRooms(filters);

  res.status(200).json({
    status: "success",
    results: rooms.length,
    data: {
      rooms,
    },
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
