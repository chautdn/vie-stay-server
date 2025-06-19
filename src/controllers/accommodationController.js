const Accommodation = require('../models/Accommodation');

// Hàm chuẩn hóa tiếng Việt (bỏ dấu, thường hóa)
function normalizeVietnamese(text) {
  if (!text) return '';
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'd')
    .trim();
}

/**
 * @desc    Tạo mới một nhà trọ
 * @route   POST /api/accommodations
 */
exports.createAccommodation = async (req, res) => {
  try {
    const newAccommodation = new Accommodation(req.body);
    const saved = await newAccommodation.save();
    res.status(201).json(saved);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

exports.updateAccommodation = async (req, res) => {
 try {
   // Tìm và cập nhật nhà trọ dựa trên ID từ params và dữ liệu từ body
   const updatedAccommodation = await Accommodation.findByIdAndUpdate(
     req.params.id,
     req.body,
     {
       new: true, // Trả về document sau khi đã cập nhật
       runValidators: true // Chạy lại các trình xác thực của model
     }
   );

   if (!updatedAccommodation) {
     return res.status(404).json({ error: 'Không tìm thấy nhà trọ.' });
   }

   res.status(200).json({
     status: 'success',
     data: updatedAccommodation,
     message: 'Cập nhật nhà trọ thành công!',
   });

 } catch (error) {
   res.status(400).json({ error: error.message });
 }
};
/**
 * @desc    Lấy danh sách nhà trọ theo owner, có lọc, tìm kiếm và phân trang
 * @route   GET /api/accommodations?ownerId=...&keyword=...&type=...&district=...&amenities=...&approvalStatus=...&isActive=...&page=...&limit=...
 */
exports.getAccommodations = async (req, res) => {
  try {
    const {
      ownerId,
      keyword,
      type,
      district,
      amenities,
      approvalStatus,
      isActive,
      page = 1,
      limit = 10
    } = req.query;

    if (!ownerId) {
      return res.status(400).json({ error: 'ownerId is required' });
    }

    const query = { ownerId };

    // Tìm kiếm theo tên
    if (keyword) {
      const normalized = normalizeVietnamese(keyword);
      query['address.searchKeywords'] = { $regex: normalized, $options: 'i' };
    }

    if (type) query.type = type;
    if (district) query['address.district'] = district;
    if (approvalStatus) query.approvalStatus = approvalStatus;
    if (typeof isActive !== 'undefined') {
      query.isActive = isActive === 'true';
    }

    // amenities (wifi, parking,...)
    if (amenities) {
      const a = Array.isArray(amenities) ? amenities : amenities.split(',');
      query.amenities = { $all: a };
    }

    const skip = (Number(page) - 1) * Number(limit);
    const total = await Accommodation.countDocuments(query);
    const data = await Accommodation.find(query)
      .skip(skip)
      .limit(Number(limit))
      .sort({ createdAt: -1 });

    res.status(200).json({ total, page: Number(page), limit: Number(limit), data });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

/**
 * @desc    Cập nhật trạng thái duyệt nhà trọ
 * @route   PUT /api/accommodations/:id/status
 */
exports.updateStatus = async (req, res) => {
  try {
    const { status } = req.body;

    if (!['pending', 'approved', 'rejected'].includes(status)) {
      return res.status(400).json({ error: 'Invalid status value' });
    }

    const updated = await Accommodation.findByIdAndUpdate(
      req.params.id,
      { approvalStatus: status },
      { new: true }
    );

    if (!updated) {
      return res.status(404).json({ error: 'Accommodation not found' });
    }

    res.status(200).json(updated);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
