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
exports.getAccommodationById = async (req, res) => {
  try {
    const accommodation = await Accommodation.findById(req.params.id);
    if (!accommodation) {
      return res.status(404).json({ error: 'Accommodation not found' });
    }
    // MODIFIED: Bọc dữ liệu trả về trong object { data: ... } cho đồng nhất
    res.status(200).json({ data: accommodation });
  } catch (error) {
    res.status(500).json({ error: 'Invalid ID format or server error' });
  }
};
exports.updateAccommodation = async (req, res) => {
  try {
    const accommodationId = req.params.id;
    const updatePayload = req.body;

    const totalRooms = Number(updatePayload.totalRooms);
    const availableRooms = Number(updatePayload.availableRooms);

    if (availableRooms > totalRooms) {
      return res.status(400).json({
        error: 'Validation failed: availableRooms: Số phòng trống không thể lớn hơn tổng số phòng'
      });
    }

    // 1. Lấy bản ghi hiện tại từ DB để so sánh
    const existingAccommodation = await Accommodation.findById(accommodationId);
    if (!existingAccommodation) {
      return res.status(404).json({ error: 'Không tìm thấy nhà trọ.' });
    }

    // 2. So sánh các trường quan trọng để quyết định có cần duyệt lại không
    let requiresReApproval = false;

    // Danh sách các trường quan trọng (dạng chuỗi đơn giản)
    const criticalStringFields = ['name', 'type'];
    for (const field of criticalStringFields) {
      if (existingAccommodation[field] !== updatePayload[field]) {
        requiresReApproval = true;
        break;
      }
    }

    // So sánh các trường phức tạp hơn (object, array) bằng cách chuyển thành chuỗi JSON
    if (!requiresReApproval) {
      if (JSON.stringify(existingAccommodation.address) !== JSON.stringify(updatePayload.address)) {
        requiresReApproval = true;
      }
      else if (JSON.stringify(existingAccommodation.images) !== JSON.stringify(updatePayload.images)) {
        requiresReApproval = true;
      }
      else if (JSON.stringify(existingAccommodation.documents) !== JSON.stringify(updatePayload.documents)) {
        requiresReApproval = true;
      }
    }

    // 3. Chuẩn bị dữ liệu cuối cùng để cập nhật
    const finalUpdateData = { ...updatePayload };
    let successMessage = 'Cập nhật nhà trọ thành công!';

    // Chỉ chuyển về "pending" nếu trạng thái hiện tại là "approved" và có thay đổi quan trọng
    if (requiresReApproval && existingAccommodation.approvalStatus === 'approved') {
      finalUpdateData.approvalStatus = 'pending';
      successMessage = 'Cập nhật thành công! Các thay đổi quan trọng cần được duyệt lại.';
    }

    // 4. Thực hiện cập nhật vào database
    const updatedAccommodation = await Accommodation.findByIdAndUpdate(
      accommodationId,
      finalUpdateData,
      { new: true, runValidators: true }
    );

    res.status(200).json({
      status: 'success',
      data: updatedAccommodation,
      message: successMessage, // Trả về thông báo động cho frontend
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
