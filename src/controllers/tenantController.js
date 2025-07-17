
const Room = require("../models/Room");
const catchAsync = require("../utils/catchAsync");


// Lấy người thuê hiện tại của phòng từ currentTenant
exports.getTenantByRoom = async (req, res) => {
  try {
    const { roomId } = req.params;

    // Tìm room và populate currentTenant
    const room = await Room.findById(roomId).populate({
      path: "currentTenant",
      select:
        "name email phoneNumber profileImage nationalIdImage role createdAt",
    });

    if (!room) {
      return res.status(404).json({ message: "Không tìm thấy phòng." });
    }

    if (!room.currentTenant || room.currentTenant.length === 0) {
      return res.status(404).json({ message: "Phòng này chưa có người thuê." });
    }

    // Trả về danh sách tenant với thông tin phòng
    const data = {
      room: {
        _id: room._id,
        roomNumber: room.roomNumber,
        capacity: room.capacity,
        currentTenantCount: room.currentTenant.length,
        isAvailable: room.isAvailable,
      },
      tenants: room.currentTenant.map((tenant) => ({
        _id: tenant._id,
        name: tenant.name,
        email: tenant.email,
        phoneNumber: tenant.phoneNumber,
        profileImage: tenant.profileImage,
        nationalIdImage: tenant.nationalIdImage,
        role: tenant.role,
        isPrimaryTenant: tenant.role.includes("tenant"), // Primary tenant
        isCoTenant: tenant.role.includes("co-tenant"), // Co-tenant
        joinedAt: tenant.createdAt,
      })),
    };

    res.status(200).json(data);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};

// Thêm endpoint mới để lấy chi tiết 1 tenant
exports.getTenantDetails = async (req, res) => {
  try {
    const { tenantId } = req.params;

    const tenant = await User.findById(tenantId).select(
      "name email phoneNumber profileImage nationalIdImage role createdAt address"
    );

    if (!tenant) {
      return res.status(404).json({ message: "Không tìm thấy người thuê." });
    }

    res.status(200).json({
      tenant: {
        _id: tenant._id,
        name: tenant.name,
        email: tenant.email,
        phoneNumber: tenant.phoneNumber,
        profileImage: tenant.profileImage,
        nationalIdImage: tenant.nationalIdImage,
        role: tenant.role,
        address: tenant.address,
        joinedAt: tenant.createdAt,
        isPrimaryTenant: tenant.role.includes("tenant"),
        isCoTenant: tenant.role.includes("co-tenant"),
      },
    });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};

// Lấy danh sách người đang thuê
exports.getCurrentTenants = async (req, res) => {
  try {
    const tenants = await tenancyAgreementService.getCurrentTenants();
    res.status(200).json(tenants);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};
