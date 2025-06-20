const TenantService = require("../services/tenantService");
const catchAsync = require("../utils/catchAsync");

exports.getTenantByRoomId = catchAsync(async (req, res, next) => {
  const { roomId } = req.params;
  const tenant = await TenantService.getTenantByRoomId(roomId);

  if (!tenant) {
    return res.status(404).json({
      status: "fail",
      message: "Tenant not found for the specified room ID",
    });
  }

  res.status(200).json({
    status: "success",
    data: {
      tenant,
    },
  });
});
