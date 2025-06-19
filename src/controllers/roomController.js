const Room = require('../models/Room');

// Lấy tất cả phòng
exports.getAllRooms = async (req, res) => {
  try {
    const rooms = await Room.find();
    res.json(rooms);
  } catch (err) {
    console.error("❌ Lỗi khi truy vấn Room.find():", err);
    res.status(500).json({ error: 'Lỗi server', message: err.message });
  }
};

// Lấy chi tiết phòng theo ID
exports.getRoomById = async (req, res) => {
  try {
    const room = await Room.findById(req.params.id);
    if (!room) return res.status(404).json({ message: 'Không tìm thấy phòng' });
    res.json(room);
  } catch (err) {
    res.status(400).json({ error: 'ID không hợp lệ' });
  }
};

