const RoommateRoom = require("../models/roommateRoom");

// [GET] /api/roommates - Lấy tất cả phòng ở ghép
exports.getAllRoommateRooms = async (req, res) => {
  try {
    const rooms = await RoommateRoom.find().sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      count: rooms.length,
      data: rooms,
    });
  } catch (err) {
    console.error("Error fetching roommate rooms:", err);
    res.status(500).json({
      success: false,
      message: "Lỗi server khi lấy danh sách phòng ở ghép.",
    });
  }
};

// [GET] /api/roommates/:id - Lấy chi tiết phòng theo ID
exports.getRoommateRoomById = async (req, res) => {
  try {
    const { id } = req.params;
    const room = await RoommateRoom.findById(id);

    if (!room) {
      return res.status(404).json({
        success: false,
        message: "Không tìm thấy phòng ở ghép.",
      });
    }

    res.status(200).json({
      success: true,
      data: room,
    });
  } catch (err) {
    console.error("Error fetching roommate room by ID:", err);
    res.status(500).json({
      success: false,
      message: "Lỗi server khi lấy thông tin phòng ở ghép.",
    });
  }
};

// [POST] /api/roommates - Tạo phòng mới
exports.createRoommateRoom = async (req, res) => {
  try {
    const {
      roomNumber,
      name,
      description,
      type,
      size,
      capacity,
      maxRoommates,
      hasPrivateBathroom,
      furnishingLevel,
      images,
      amenities,
      isAvailable,
      availableFrom,
      baseRent,
      deposit,
      utilityRates,
      additionalFees,
      address,
      contactInfo,
      averageRating,
      totalRatings,
      viewCount,
      favoriteCount,
    } = req.body;

    const newRoom = new RoommateRoom({
      roomNumber,
      name,
      description,
      type,
      size,
      capacity,
      maxRoommates,
      hasPrivateBathroom,
      furnishingLevel,
      images,
      amenities,
      isAvailable,
      availableFrom,
      baseRent,
      deposit,
      utilityRates,
      additionalFees,
      address,
      contactInfo,
      averageRating,
      totalRatings,
      viewCount,
      favoriteCount,
    });

    await newRoom.save();

    res.status(201).json({
      success: true,
      message: "Đăng tin phòng ở ghép thành công.",
      data: newRoom,
    });
  } catch (err) {
    console.error("Error creating roommate room:", err);

    if (err.name === "ValidationError") {
      const errors = Object.values(err.errors).map((e) => e.message);
      return res.status(400).json({
        success: false,
        message: "Dữ liệu không hợp lệ.",
        errors,
      });
    }

    res.status(500).json({
      success: false,
      message: "Lỗi server khi đăng tin phòng ở ghép.",
    });
  }
};
