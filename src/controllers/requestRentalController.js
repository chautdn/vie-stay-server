const rentalRequestService = require("../services/rentalRequestService");
const agreementConfirmationService = require("../services/agreementConfirmationService");

// Tạo yêu cầu thuê mới
exports.createRentalRequest = async (req, res) => {
  try {
    const request = await rentalRequestService.createRentalRequest(req.body);
    res.status(201).json(request);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};

exports.getRentalRequestDetails = async (req, res) => {
  try {
    const request = await rentalRequestService.getRentalRequestDetails(
      req.params.requestId
    );
    res.status(200).json(request);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};

// Lấy yêu cầu theo landlord
exports.getRequestsByLandlord = async (req, res) => {
  try {
    const requests = await rentalRequestService.getRequestsByLandlord(
      req.user._id
    );
    res.status(200).json(requests);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};

exports.getRequestsByAccommodation = async (req, res) => {
  try {
    const requests = await rentalRequestService.getRequestsByAccommodation(
      req.params.accommodationId
    );
    res.status(200).json(requests);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};

// Lấy yêu cầu theo tenant
exports.getRequestsByTenant = async (req, res) => {
  try {
    const requests = await rentalRequestService.getRequestsByTenant(
      req.params.tenantId
    );
    res.status(200).json(requests);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};

// Lấy yêu cầu theo room
exports.getRequestsByRoom = async (req, res) => {
  try {
    const requests = await rentalRequestService.getRequestsByRoom(
      req.params.roomId
    );
    res.status(200).json(requests);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};

// Cập nhật trạng thái yêu cầu
exports.updateRequestStatus = async (req, res) => {
  try {
    const updated = await rentalRequestService.updateRequestStatus(
      req.params.requestId,
      req.body.status,
      req.body.responseMessage
    );
    res.status(200).json(updated);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};

// Xoá yêu cầu
exports.deleteRentalRequest = async (req, res) => {
  try {
    await rentalRequestService.deleteRentalRequest(req.params.requestId);
    res.status(204).end();
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};

// THÊM METHOD NÀY
exports.acceptRentalRequest = async (req, res) => {
  try {
    const { requestId } = req.params;
    const { responseMessage, startDate, endDate, monthlyRent, deposit, notes } =
      req.body;

    // VALIDATION - đảm bảo có đủ dữ liệu
    if (!startDate || !endDate || !monthlyRent || !deposit) {
      return res.status(400).json({
        success: false,
        message:
          "Missing required fields: startDate, endDate, monthlyRent, deposit",
      });
    }

    // 1. Cập nhật status rental request
    const updatedRequest = await rentalRequestService.updateRequestStatus(
      requestId,
      "accepted",
      responseMessage
    );

    // 2. Tạo agreement confirmation và GỬI EMAIL
    const agreementTerms = {
      startDate: new Date(startDate),
      endDate: new Date(endDate),
      monthlyRent: parseFloat(monthlyRent),
      deposit: parseFloat(deposit),
      notes: notes || "",
    };

    console.log("Agreement terms:", agreementTerms); // DEBUG

    const confirmation =
      await agreementConfirmationService.createConfirmationFromAcceptedRequest(
        requestId,
        agreementTerms
      );

    res.status(200).json({
      success: true,
      message: "Rental request accepted and confirmation email sent",
      data: {
        rentalRequest: updatedRequest,
        confirmation: confirmation,
      },
    });
  } catch (error) {
    console.error("Error accepting rental request:", error);
    res.status(500).json({
      success: false,
      message: "Error accepting rental request",
      error: error.message,
    });
  }
};

exports.rejectRentalRequest = async (req, res) => {
  try {
    const updated = await rentalRequestService.rejectRentalRequest(
      req.params.requestId,
      req.body.responseMessage
    );
    res.status(200).json(updated);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};

// Đánh dấu đã xem
exports.markAsViewed = async (req, res) => {
  try {
    const updated = await rentalRequestService.markAsViewed(
      req.params.requestId
    );
    res.status(200).json(updated);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};
