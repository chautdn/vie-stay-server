const Room = require("../models/Room");
const User = require("../models/User");
const CoTenantRequest = require("../models/CoTenantRequest");
const multer = require("multer");
const cloudinary = require("../config/cloudinary"); // Sử dụng file config có sẵn

const storage = multer.memoryStorage();
const upload = multer({
  storage,
  limits: {
    fileSize: 5 * 1024 * 1024,
  },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith("image/")) {
      cb(null, true);
    } else {
      cb(new Error("Chỉ được upload file ảnh"), false);
    }
  },
});

const uploadToCloudinary = (buffer, filename) => {
  return new Promise((resolve, reject) => {
    cloudinary.uploader
      .upload_stream(
        {
          folder: "co-tenant-requests",
          public_id: `${Date.now()}-${filename}`,
          resource_type: "image",
          transformation: [
            { width: 800, height: 600, crop: "limit" },
            { quality: "auto:good" },
          ],
        },
        (error, result) => {
          if (error) {
            reject(error);
          } else {
            resolve(result);
          }
        }
      )
      .end(buffer);
  });
};

// Tạo chuỗi ngẫu nhiên
const generateRandomString = (length) => {
  const characters =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  let result = "";
  for (let i = 0; i < length; i++) {
    result += characters.charAt(Math.floor(Math.random() * characters.length));
  }
  return result;
};

// Controller: Gửi yêu cầu thêm người ở chung
const requestCoTenant = async (req, res) => {
  try {
    const { roomId } = req.params;
    const { name, phoneNumber } = req.body;
    const userId = req.user._id; // Từ middleware JWT

    if (!req.file) {
      return res.status(400).json({ message: "Vui lòng upload ảnh CCCD" });
    }

    // Tìm phòng
    const room = await Room.findById(roomId);
    if (!room) return res.status(404).json({ message: "Room not found" });

    // Kiểm tra quyền
    if (!room.currentTenant.includes(userId.toString())) {
      return res
        .status(403)
        .json({ message: "Only the primary tenant can request co-tenants" });
    }

    // Kiểm tra capacity
    if (room.currentTenant.length >= room.capacity) {
      return res
        .status(400)
        .json({ message: "Room has reached maximum capacity" });
    }

    // Kiểm tra phoneNumber duy nhất
    const existingUser = await User.findOne({ phoneNumber });
    if (existingUser) {
      return res.status(400).json({ message: "Phone number already exists" });
    }

    let imageUrl;
    try {
      const filename = `cccd-${phoneNumber}-${Date.now()}`;
      const uploadResult = await uploadToCloudinary(req.file.buffer, filename);
      imageUrl = uploadResult.secure_url;
    } catch (uploadError) {
      return res.status(500).json({
        message: "Lỗi upload ảnh",
        error: uploadError.message,
      });
    }

    // Tạo email giả
    const randomString = generateRandomString(6);
    const email = `co-tenant-${phoneNumber}-${randomString}@noaccount.com`;

    // Tạo User cho người ở chung
    const coTenant = await User.create({
      name,
      email,
      password: "no-login-required", // Hash bởi middleware
      phoneNumber,
      nationalIdFrontImage: imageUrl,
      role: ["co-tenant"],
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    // Tạo yêu cầu
    await CoTenantRequest.create({
      roomId,
      primaryTenantId: userId,
      coTenantId: coTenant._id,
      name,
      phoneNumber,
      imageCCCD: imageUrl,
      status: "pending",
    });

    res.status(200).json({
      message: "Yêu cầu thêm người ở chung đã được gửi",
      imageUrl: imageUrl,
    });
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

// Controller: Lấy danh sách yêu cầu
const getCoTenantRequests = async (req, res) => {
  try {
    const requests = await CoTenantRequest.find()
      .populate("roomId")
      .populate("primaryTenantId")
      .populate("coTenantId");
    res.status(200).json(requests);
  } catch (error) {
    res.status(500).json({ message: "Server error" });
  }
};

const getCoTenantRequestsByLandlord = async (req, res) => {
  try {
    const user = req.user;
    if (!user.role.includes("landlord")) {
      return res
        .status(403)
        .json({ message: "Chỉ chủ trọ mới có thể xem yêu cầu này" });
    }

    const requests = await CoTenantRequest.find()
      .populate({
        path: "roomId",
        populate: {
          path: "accommodationId",
          select: "ownerId",
        },
      })
      .populate("primaryTenantId")
      .populate("coTenantId");

    // Lọc ra requests có room hợp lệ và thuộc về landlord hiện tại
    const landlordRequests = requests.filter((request) => {
      const room = request.roomId;
      return (
        room &&
        room.accommodationId &&
        room.accommodationId.ownerId &&
        room.accommodationId.ownerId.toString() === user._id.toString()
      );
    });

    res.status(200).json(landlordRequests);
  } catch (error) {
    res.status(500).json({ message: "Server error" });
  }
};

// Controller: Xác nhận yêu cầu
const approveCoTenantRequest = async (req, res) => {
  try {
    const { requestId } = req.params;
    const user = req.user;

    // Kiểm tra quyền chủ trọ
    if (!user.role.includes("landlord")) {
      return res
        .status(403)
        .json({ message: "Only landlords can approve requests" });
    }

    // Lấy request với populate để kiểm tra ownership
    const request = await CoTenantRequest.findById(requestId).populate({
      path: "roomId",
      populate: {
        path: "accommodationId",
        select: "ownerId",
      },
    });

    if (!request || request.status !== "pending") {
      return res.status(400).json({ message: "Invalid request" });
    }

    // Kiểm tra quyền sở hữu accommodation
    const room = request.roomId;
    if (!room) {
      return res.status(404).json({ message: "Room not found" });
    }

    if (
      !room.accommodationId ||
      !room.accommodationId.ownerId ||
      room.accommodationId.ownerId.toString() !== user._id.toString()
    ) {
      return res.status(403).json({
        message: "You can only approve requests for your own accommodations",
      });
    }

    // Kiểm tra capacity
    if (room.currentTenant.length >= room.capacity) {
      return res
        .status(400)
        .json({ message: "Room has reached maximum capacity" });
    }

    // Kiểm tra xem coTenant đã tồn tại chưa
    if (room.currentTenant.includes(request.coTenantId.toString())) {
      return res
        .status(400)
        .json({ message: "Co-tenant is already in this room" });
    }

    // Thêm coTenantId vào currentTenant
    room.currentTenant.push(request.coTenantId);
    room.isAvailable =
      room.currentTenant.length >= room.capacity ? false : true;
    room.updatedAt = new Date();
    await room.save();

    // Cập nhật trạng thái yêu cầu
    request.status = "approved";
    request.updatedAt = new Date();
    await request.save();

    res.status(200).json({
      message: "Yêu cầu được xác nhận",
      roomOccupancy: `${room.currentTenant.length}/${room.capacity}`,
    });
  } catch (error) {
    console.error("Error in approveCoTenantRequest:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

// Controller: Từ chối yêu cầu
const rejectCoTenantRequest = async (req, res) => {
  try {
    const { requestId } = req.params;
    const request = await CoTenantRequest.findById(requestId);
    if (!request || request.status !== "pending") {
      return res.status(400).json({ message: "Invalid request" });
    }

    request.status = "rejected";
    request.updatedAt = new Date();
    await request.save();

    res.status(200).json({ message: "Yêu cầu đã bị từ chối" });
  } catch (error) {
    res.status(500).json({ message: "Server error" });
  }
};

const deleteImageFromCloudinary = async (imageUrl) => {
  try {
    const urlParts = imageUrl.split("/");
    const publicIdWithExtension = urlParts[urlParts.length - 1];
    const publicId = `co-tenant-requests/${publicIdWithExtension.split(".")[0]}`;

    const result = await cloudinary.uploader.destroy(publicId);
    return result;
  } catch (error) {
    return null;
  }
};

module.exports = {
  requestCoTenant: [upload.single("imageCCCD"), requestCoTenant],
  getCoTenantRequests,
  approveCoTenantRequest,
  rejectCoTenantRequest,
  deleteImageFromCloudinary,
  getCoTenantRequestsByLandlord,
};
