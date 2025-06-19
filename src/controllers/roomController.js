const roomService = require("../services/roomService");
const catchAsync = require("../utils/catchAsync");

const getAllRoom = catchAsync(async (req, res) => {
  const rooms = await roomService.getAllRooms();
  res.status(200).json({
    status: "success",
    results: rooms.length,
    data: { rooms },
  });
});

const getRoomById = catchAsync(async (req, res) => {
  const { roomId } = req.params;
  const room = await roomService.getRoomById(roomId);
  res.status(200).json({
    status: "success",
    data: { room },
  });
});

const getAllRoomsByAccommodateId = catchAsync(async (req, res) => {
  const { accommodationId } = req.params;
  const rooms = await roomService.getAllRoomsByAccommodateId(accommodationId);
  res.status(200).json({
    status: "success",
    data: { rooms },
  });
});

const createRoom = catchAsync(async (req, res) => {
  const { accommodationId } = req.params;
  const roomData = req.body;
  const room = await roomService.createRoom(accommodationId, roomData);
  res.status(201).json({
    status: "success",
    data: { room },
  });
});

const updateRoom = catchAsync(async (req, res) => {
  const { roomId } = req.params;
  const updateData = req.body;
  const userId = req.user._id;
  const room = await roomService.updateRoom(roomId, updateData, userId);
  res.status(200).json({
    status: "success",
    data: { room },
  });
});

const deactivateRoom = catchAsync(async (req, res) => {
  const { roomId } = req.params;
  const userId = req.user._id;
  const room = await roomService.deactivateRoom(roomId, userId);
  res.status(200).json({
    status: "success",
    message: "Room deactivated successfully",
    data: { room },
  });
});

const reactivateRoom = catchAsync(async (req, res) => {
  const { roomId } = req.params;
  const userId = req.user._id;
  const room = await roomService.reactivateRoom(roomId, userId);
  res.status(200).json({
    status: "success",
    message: "Room reactivated successfully",
    data: { room },
  });
});

const hideRoom = catchAsync(async (req, res) => {
  const { roomId } = req.params;
  const userId = req.user._id;
  const room = await roomService.hideRoom(roomId, userId);
  res.status(200).json({
    status: "success",
    message: "Room hidden successfully",
    data: { room },
  });
});

const unhideRoom = catchAsync(async (req, res) => {
  const { roomId } = req.params;
  const userId = req.user._id;
  const room = await roomService.unhideRoom(roomId, userId);
  res.status(200).json({
    status: "success",
    message: "Room unhidden successfully",
    data: { room },
  });
});

const deleteRoom = catchAsync(async (req, res) => {
  const { roomId } = req.params;
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
    data: { rooms },
  });
});

// const getAllRequestsInRoom = catchAsync(async (req, res) => {
//   const { roomId } = req.params;
//   const requests = await tenantService.getAllRentalRequestsByRoomId(roomId);
//   res.status(200).json({
//     status: "success",
//     data: { requests },
//   });
// });

// const getCurrentTenantsInRoom = catchAsync(async (req, res) => {
//   const { roomId } = req.params;
//   const tenants = await roomService.getAllCurrentTenantsInRoom(roomId);
//   res.status(200).json({
//     status: "success",
//     results: tenants.length,
//     data: { tenants },
//   });
// });

module.exports = {
  getAllRoom,
  getRoomById,
  getAllRoomsByAccommodateId, 
  createRoom,
  updateRoom,
  deactivateRoom,
  reactivateRoom,
  hideRoom,
  unhideRoom,
  deleteRoom,
  searchRooms,
  // getAllRequestsInRoom,
  // getCurrentTenantsInRoom,
};
