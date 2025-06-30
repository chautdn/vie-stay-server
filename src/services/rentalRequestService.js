const RentalRequest = require("../models/RentalRequest");

// 1. Tạo yêu cầu mới
const createRentalRequest = async (data) => {
  return await RentalRequest.create(data);
};

const getRentalRequestDetails = async (requestId) => {
  const request = await RentalRequest.findById(requestId)
    .populate({
      path: "tenantId",
      select:
        "name phoneNumber email profileImage tenantProfile.occupation tenantProfile.monthlyIncome tenantProfile.previousRentalExperience",
    })
    .populate({
      path: "roomId",
      select:
        "roomNumber name type baseRent size capacity hasPrivateBathroom furnishingLevel amenities images",
      // ✅ THÊM: Populate nested accommodationId trong roomId
      populate: {
        path: "accommodationId",
        select:
          "name type address.fullAddress amenities contactInfo.phone contactInfo.email",
      },
    })
    .populate({
      path: "accommodationId",
      select:
        "name type address.fullAddress amenities contactInfo.phone contactInfo.email",
    })
    .select(
      "message proposedStartDate proposedEndDate proposedRent guestCount status " +
        "responseMessage respondedAt priority createdAt ageInDays responseTimeHours " +
        "viewedByLandlord viewedAt"
    )
    .lean();

  if (!request) {
    throw new Error("Rental request not found");
  }

  // Tính toán ageInDays và responseTimeHours
  const currentDate = new Date();
  const createdAt = new Date(request.createdAt);
  request.ageInDays = Math.floor(
    (currentDate - createdAt) / (1000 * 60 * 60 * 24)
  );
  request.responseTimeHours = request.respondedAt
    ? Math.floor((new Date(request.respondedAt) - createdAt) / (1000 * 60 * 60))
    : null;

  return request;
};
// 2. Lấy tất cả yêu cầu của chủ nhà
const getRequestsByLandlord = async (landlordId) => {
  const requests = await RentalRequest.find({ landlordId })
    .populate({
      path: "tenantId",
      select: "name phoneNumber email profileImage ", // Lấy trực tiếp các trường từ tenantProfile
    })
    .select(
      "message proposedStartDate proposedEndDate proposedRent guestCount  " +
        "status priority createdAt updatedAt roomId accommodationId " +
        "ageInDays responseTimeHours "
    )
    .lean(); // Chuyển sang plain JavaScript object để tối ưu hiệu suất

  if (!requests || requests.length === 0) {
    throw new Error("No rental requests found for this accommodation");
  }
  0;
  // Tính toán lại ageInDays và responseTimeHours nếu cần (đảm bảo dữ liệu chính xác)
  const currentDate = new Date();
  requests.forEach((request) => {
    const createdAt = new Date(request.createdAt);
    request.ageInDays = Math.floor(
      (currentDate - createdAt) / (1000 * 60 * 60 * 24)
    );

    if (request.respondedAt) {
      const respondedAt = new Date(request.respondedAt);
      request.responseTimeHours = Math.floor(
        (respondedAt - createdAt) / (1000 * 60 * 60)
      );
    }
  });

  return requests;
};

// 3. Lấy tất cả yêu cầu của một người thuê
const getRequestsByTenant = async (tenantId) => {
  return await RentalRequest.find({ tenantId }).populate(
    "roomId accommodationId"
  );
};

const getRequestsByAccommodation = async (accommodationId) => {
  // Truy vấn với select để lấy các trường cần thiết
  const requests = await RentalRequest.find({ accommodationId })
    .populate({
      path: "tenantId",
      select: "name phoneNumber email profileImage ", // Lấy trực tiếp các trường từ tenantProfile
    })
    .select(
      "message proposedStartDate proposedEndDate proposedRent guestCount  " +
        "status priority createdAt updatedAt roomId accommodationId " +
        "ageInDays responseTimeHours "
    )
    .lean(); // Chuyển sang plain JavaScript object để tối ưu hiệu suất

  if (!requests || requests.length === 0) {
    throw new Error("No rental requests found for this accommodation");
  }
  0;
  // Tính toán lại ageInDays và responseTimeHours nếu cần (đảm bảo dữ liệu chính xác)
  const currentDate = new Date();
  requests.forEach((request) => {
    const createdAt = new Date(request.createdAt);
    request.ageInDays = Math.floor(
      (currentDate - createdAt) / (1000 * 60 * 60 * 24)
    );

    if (request.respondedAt) {
      const respondedAt = new Date(request.respondedAt);
      request.responseTimeHours = Math.floor(
        (respondedAt - createdAt) / (1000 * 60 * 60)
      );
    }
  });

  return requests;
};
// 4. Lấy tất cả yêu cầu theo phòng
const getRequestsByRoom = async (roomId) => {
  const requests = await RentalRequest.find({ roomId })
    .populate({
      path: "tenantId",
      select: "name phoneNumber email profileImage ", // Lấy trực tiếp các trường từ tenantProfile
    })
    .select(
      "message proposedStartDate proposedEndDate proposedRent guestCount  " +
        "status priority createdAt updatedAt roomId accommodationId " +
        "ageInDays responseTimeHours "
    )
    .lean(); // Chuyển sang plain JavaScript object để tối ưu hiệu suất

  if (!requests || requests.length === 0) {
    throw new Error("No rental requests found for this accommodation");
  }
  0;
  // Tính toán lại ageInDays và responseTimeHours nếu cần (đảm bảo dữ liệu chính xác)
  const currentDate = new Date();
  requests.forEach((request) => {
    const createdAt = new Date(request.createdAt);
    request.ageInDays = Math.floor(
      (currentDate - createdAt) / (1000 * 60 * 60 * 24)
    );

    if (request.respondedAt) {
      const respondedAt = new Date(request.respondedAt);
      request.responseTimeHours = Math.floor(
        (respondedAt - createdAt) / (1000 * 60 * 60)
      );
    }
  });

  return requests;
};

// 5. Cập nhật trạng thái yêu cầu
const updateRequestStatus = async (
  requestId,
  status,
  responseMessage = null
) => {
  return await RentalRequest.findByIdAndUpdate(
    requestId,
    { status, responseMessage, respondedAt: new Date() },
    { new: true }
  );
};

// 6. Xoá yêu cầu thuê (khi bị hủy)
const deleteRentalRequest = async (requestId) => {
  return await RentalRequest.findByIdAndDelete(requestId);
};

// 7. Đánh dấu yêu cầu đã xem
const markAsViewed = async (requestId) => {
  return await RentalRequest.findByIdAndUpdate(
    requestId,
    { viewedByLandlord: true, viewedAt: new Date() },
    { new: true }
  );
};

const acceptRentalRequest = async (requestId) => {
  return await RentalRequest.findByIdAndUpdate(
    requestId,
    { status: "accepted", respondedAt: new Date() },
    { new: true }
  );
};
const rejectRentalRequest = async (requestId, responseMessage) => {
  return await RentalRequest.findByIdAndUpdate(
    requestId,
    { status: "rejected", responseMessage, respondedAt: new Date() },
    { new: true }
  );
};

module.exports = {
  createRentalRequest,
  getRentalRequestDetails,
  getRequestsByLandlord,
  getRequestsByAccommodation,
  getRequestsByTenant,
  getRequestsByRoom,
  updateRequestStatus,
  deleteRentalRequest,
  markAsViewed,
  acceptRentalRequest,
  rejectRentalRequest,
};
