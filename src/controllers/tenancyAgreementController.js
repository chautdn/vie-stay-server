const tenancyAgreementService = require("../services/tenancyAgreementService");

// Tạo hợp đồng mới
exports.createAgreement = async (req, res) => {
  try {
    const agreement = await tenancyAgreementService.createAgreement(req.body);
    res.status(201).json(agreement);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};

// Lấy danh sách hợp đồng theo landlord
exports.getAgreementsByLandlord = async (req, res) => {
  try {
    const agreements = await tenancyAgreementService.getAgreementsByLandlord(
      req.params.landlordId
    );
    res.status(200).json(agreements);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};

// Lấy người thuê hiện tại của phòng
exports.getTenantByRoom = async (req, res) => {
  try {
    const agreement = await tenancyAgreementService.getTenantByRoom(
      req.params.roomId
    );
    if (!agreement) {
      return res.status(404).json({ message: "Không tìm thấy hợp đồng." });
    }

    const data = {
      tenant: {
        name: agreement.tenantId.name,
        email: agreement.tenantId.email,
        phoneNumber: agreement.tenantId.phoneNumber,
        profileImage: agreement.tenantId.profileImage,
      },
      contract: {
        startDate: agreement.startDate,
        endDate: agreement.endDate,
        monthlyRent: agreement.monthlyRent,
        totalMonthlyCost: agreement.totalMonthlyCost,
        status: agreement.status,
      },
    };

    res.status(200).json(data);
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

// Kết thúc hợp đồng
exports.terminateAgreement = async (req, res) => {
  try {
    const agreement = await tenancyAgreementService.terminateAgreement(
      req.params.id,
      req.body.terminatedBy,
      req.body.reason
    );
    res.status(200).json(agreement);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};

// Gia hạn hợp đồng
exports.renewAgreement = async (req, res) => {
  try {
    const agreement = await tenancyAgreementService.renewAgreement(
      req.params.id,
      req.body.newEndDate
    );
    res.status(200).json(agreement);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};

// Lấy hợp đồng theo tenant
exports.getAgreementsByTenant = async (req, res) => {
  try {
    const agreements = await tenancyAgreementService.getAgreementsByTenant(
      req.params.tenantId
    );
    res.status(200).json(agreements);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};
