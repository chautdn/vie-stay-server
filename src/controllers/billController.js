// src/controllers/billController.js
const Bill = require("../models/Bill");
const RoomOccupancy = require("../models/RoomOccupancy");
const Room = require("../models/Room");
const mongoose = require("mongoose");

// Helper function to generate bill number
const generateBillNumber = async () => {
  const year = new Date().getFullYear();
  const month = String(new Date().getMonth() + 1).padStart(2, "0");
  const count = await Bill.countDocuments({
    createdAt: {
      $gte: new Date(year, new Date().getMonth(), 1),
      $lt: new Date(year, new Date().getMonth() + 1, 1),
    },
  });
  return `BILL${year}${month}${String(count + 1).padStart(4, "0")}`;
};

// Helper function to calculate bill totals
const calculateBillTotals = (items) => {
  const subtotal = items.reduce((total, item) => total + item.amount, 0);
  const totalAmount = subtotal; // Add tax later if needed
  return { subtotal, totalAmount };
};

// Helper function to calculate days in period
const calculateDaysInPeriod = (fromDate, toDate) => {
  return Math.max(1, Math.ceil((new Date(toDate) - new Date(fromDate)) / (1000 * 60 * 60 * 24)));
};

// Create monthly bill for room
exports.createMonthlyBill = async (req, res) => {
  try {
    const { roomId } = req.params;
    const { billingPeriod } = req.body; // { from: Date, to: Date }
    
    // Get room and verify landlord ownership
    const room = await Room.findById(roomId).populate("accommodationId");
    if (!room) {
      return res.status(404).json({
        success: false,
        message: "Room not found"
      });
    }

    // Get active tenancy agreement
    const tenancy = await TenancyAgreement.findOne({
      roomId,
      status: "active"
    });

    if (!tenancy) {
      return res.status(404).json({
        success: false,
        message: "No active tenancy agreement found"
      });
    }

    // Get representative tenant
    const representative = await RoomOccupancy.findOne({
      roomId,
      status: "active",
      isRepresentative: true
    });

    if (!representative) {
      return res.status(404).json({
        success: false,
        message: "No representative tenant found"
      });
    }

    // Get all active tenants during billing period
    const tenantsInPeriod = await RoomOccupancy.find({
      roomId,
      status: "active"
    });

    // Check if bill already exists for this period
    const existingBill = await Bill.findOne({
      roomId,
      "billingPeriod.from": billingPeriod.from,
      "billingPeriod.to": billingPeriod.to
    });

    if (existingBill) {
      return res.status(400).json({
        success: false,
        message: "Bill already exists for this period"
      });
    }

    // Create bill items based on tenancy agreement
    const items = [];

    // Add rent
    items.push({
      name: "Monthly Rent",
      type: "rent",
      amount: tenancy.monthlyRent,
      quantity: 1,
      unitPrice: tenancy.monthlyRent,
      description: `Monthly rent for ${new Date(billingPeriod.from).toLocaleDateString()} - ${new Date(billingPeriod.to).toLocaleDateString()}`
    });

    // Add utilities if defined in tenancy agreement
    if (tenancy.utilityRates?.water?.rate) {
      items.push({
        name: "Water Service",
        type: "water",
        amount: tenancy.utilityRates.water.rate,
        quantity: 1,
        unitPrice: tenancy.utilityRates.water.rate,
        description: "Water utility service"
      });
    }

    if (tenancy.utilityRates?.electricity?.rate) {
      items.push({
        name: "Electricity Service",
        type: "electricity",
        amount: tenancy.utilityRates.electricity.rate,
        quantity: 1,
        unitPrice: tenancy.utilityRates.electricity.rate,
        description: "Electricity utility service"
      });
    }

    if (tenancy.utilityRates?.internet?.rate) {
      items.push({
        name: "Internet Service",
        type: "internet",
        amount: tenancy.utilityRates.internet.rate,
        quantity: 1,
        unitPrice: tenancy.utilityRates.internet.rate,
        description: "Internet service"
      });
    }

    if (tenancy.utilityRates?.sanitation?.rate) {
      items.push({
        name: "Sanitation Service",
        type: "sanitation",
        amount: tenancy.utilityRates.sanitation.rate,
        quantity: 1,
        unitPrice: tenancy.utilityRates.sanitation.rate,
        description: "Sanitation service"
      });
    }

    // Add additional monthly fees
    tenancy.additionalFees?.forEach(fee => {
      if (fee.type === "monthly") {
        items.push({
          name: fee.name.charAt(0).toUpperCase() + fee.name.slice(1),
          type: fee.name,
          amount: fee.amount,
          quantity: 1,
          unitPrice: fee.amount,
          description: fee.description || fee.name
        });
      }
    });

    // Set due date (default: 5 days from creation)
    const dueDate = req.body.dueDate ? new Date(req.body.dueDate) : (() => {
      const date = new Date();
      date.setDate(date.getDate() + 5);
      return date;
    })();

    // Calculate subtotal and totalAmount
    const { subtotal, totalAmount } = calculateBillTotals(items);

    // Calculate days in period properly
    const daysInPeriod = calculateDaysInPeriod(billingPeriod.from, billingPeriod.to);

    // Generate bill number
    const billNumber = await generateBillNumber();

    // Create bill with all required fields
    const bill = new Bill({
      billNumber,
      roomId,
      accommodationId: room.accommodationId._id,
      landlordId: tenancy.landlordId,
      representativeId: representative.tenantId,
      tenantsAtTimeOfBilling: tenantsInPeriod.map(occupancy => ({
        tenantId: occupancy.tenantId,
        occupancyId: occupancy._id,
        daysInPeriod
      })),
      billingPeriod,
      items,
      subtotal,
      totalAmount,
      dueDate,
      status: "draft"
    });

    await bill.save();

    const populatedBill = await Bill.findById(bill._id)
      .populate("representativeId", "name email phoneNumber")
      .populate("roomId", "roomNumber name")
      .populate("tenantsAtTimeOfBilling.tenantId", "name email");

    res.status(201).json({
      success: true,
      message: "Monthly bill created successfully",
      data: populatedBill
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// Create custom bill
exports.createCustomBill = async (req, res) => {
  try {
    const { roomId } = req.params;
    const { billingPeriod, items, notes, dueDate } = req.body;
    
    // Validate items
    if (!items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({
        success: false,
        message: "Bill items are required"
      });
    }

    // Validate each item has required fields
    for (const item of items) {
      if (!item.name || item.amount === undefined || item.amount < 0) {
        return res.status(400).json({
          success: false,
          message: "Each bill item must have a name and valid amount"
        });
      }
    }
    
    // Get room and verify landlord ownership
    const room = await Room.findById(roomId).populate("accommodationId");
    if (!room) {
      return res.status(404).json({
        success: false,
        message: "Room not found"
      });
    }

    // Get representative tenant
    const representative = await RoomOccupancy.findOne({
      roomId,
      status: "active",
      isRepresentative: true
    });

    if (!representative) {
      return res.status(404).json({
        success: false,
        message: "No representative tenant found"
      });
    }

    // Get all active tenants
    const tenantsInPeriod = await RoomOccupancy.find({
      roomId,
      status: "active"
    });

    // Set due date
    const billDueDate = dueDate ? new Date(dueDate) : (() => {
      const date = new Date();
      date.setDate(date.getDate() + 5);
      return date;
    })();

    // Calculate subtotal and totalAmount
    const { subtotal, totalAmount } = calculateBillTotals(items);

    // Calculate days in period properly
    const daysInPeriod = calculateDaysInPeriod(billingPeriod.from, billingPeriod.to);

    // Generate bill number
    const billNumber = await generateBillNumber();

    // Create custom bill with all required fields
    const bill = new Bill({
      billNumber,
      roomId,
      accommodationId: room.accommodationId._id,
      landlordId: req.user.id,
      representativeId: representative.tenantId,
      tenantsAtTimeOfBilling: tenantsInPeriod.map(occupancy => ({
        tenantId: occupancy.tenantId,
        occupancyId: occupancy._id,
        daysInPeriod
      })),
      billingPeriod,
      items,
      subtotal,
      totalAmount,
      dueDate: billDueDate,
      notes,
      status: "draft"
    });

    await bill.save();

    const populatedBill = await Bill.findById(bill._id)
      .populate("representativeId", "name email phoneNumber")
      .populate("roomId", "roomNumber name")
      .populate("tenantsAtTimeOfBilling.tenantId", "name email");

    res.status(201).json({
      success: true,
      message: "Custom bill created successfully",
      data: populatedBill
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// Get bills for a room (landlord view)
exports.getRoomBills = async (req, res) => {
  try {
    const { roomId } = req.params;
    const { status, page = 1, limit = 10 } = req.query;
    
    const query = { roomId };
    if (status) {
      query.status = status;
    }

    const bills = await Bill.find(query)
      .populate("representativeId", "name email phoneNumber")
      .populate("roomId", "roomNumber name")
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await Bill.countDocuments(query);

    res.status(200).json({
      success: true,
      data: bills,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// Get bills for tenant (only bills where they are representative)
exports.getTenantBills = async (req, res) => {
  try {
    const { status, page = 1, limit = 10 } = req.query;
    
    const query = { representativeId: req.user.id };
    if (status) {
      query.status = status;
    }

    const bills = await Bill.find(query)
      .populate("roomId", "roomNumber name")
      .populate("landlordId", "name email phoneNumber")
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await Bill.countDocuments(query);

    res.status(200).json({
      success: true,
      data: bills,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// Get bill details
exports.getBillDetails = async (req, res) => {
  try {
    const { billId } = req.params;
    
    const bill = await Bill.findById(billId)
      .populate("representativeId", "name email phoneNumber profileImage")
      .populate("roomId", "roomNumber name")
      .populate("accommodationId", "name address")
      .populate("landlordId", "name email phoneNumber")
      .populate("tenantsAtTimeOfBilling.tenantId", "name email phoneNumber");

    if (!bill) {
      return res.status(404).json({
        success: false,
        message: "Bill not found"
      });
    }

    res.status(200).json({
      success: true,
      data: bill
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// Send bill to tenant
exports.sendBill = async (req, res) => {
  try {
    const { billId } = req.params;
    
    const bill = await Bill.findById(billId);
    if (!bill) {
      return res.status(404).json({
        success: false,
        message: "Bill not found"
      });
    }

    if (bill.status !== "draft") {
      return res.status(400).json({
        success: false,
        message: "Only draft bills can be sent"
      });
    }

    bill.status = "sent";
    await bill.save();

    // TODO: Send notification/email to tenant

    res.status(200).json({
      success: true,
      message: "Bill sent successfully",
      data: bill
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// Mark bill as viewed (tenant action)
exports.markBillAsViewed = async (req, res) => {
  try {
    const { billId } = req.params;
    
    const bill = await Bill.findById(billId);
    if (!bill) {
      return res.status(404).json({
        success: false,
        message: "Bill not found"
      });
    }

    // Verify user is the representative
    if (bill.representativeId.toString() !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: "Not authorized to view this bill"
      });
    }

    if (bill.status === "sent") {
      bill.status = "viewed";
      bill.viewedAt = new Date();
      bill.viewedBy = req.user.id;
      await bill.save();
    }

    res.status(200).json({
      success: true,
      message: "Bill marked as viewed",
      data: bill
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// Update bill (landlord only, draft status only)
exports.updateBill = async (req, res) => {
  try {
    const { billId } = req.params;
    const { items, notes, dueDate } = req.body;
    
    const bill = await Bill.findById(billId);
    if (!bill) {
      return res.status(404).json({
        success: false,
        message: "Bill not found"
      });
    }

    if (bill.status !== "draft") {
      return res.status(400).json({
        success: false,
        message: "Only draft bills can be updated"
      });
    }

    // Update fields - let model handle recalculation
    if (items) bill.items = items;
    if (notes !== undefined) bill.notes = notes;
    if (dueDate) bill.dueDate = dueDate;

    await bill.save();

    res.status(200).json({
      success: true,
      message: "Bill updated successfully",
      data: bill
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// Delete bill (landlord only, draft status only)
exports.deleteBill = async (req, res) => {
  try {
    const { billId } = req.params;
    
    const bill = await Bill.findById(billId);
    if (!bill) {
      return res.status(404).json({
        success: false,
        message: "Bill not found"
      });
    }

    if (bill.status !== "draft") {
      return res.status(400).json({
        success: false,
        message: "Only draft bills can be deleted"
      });
    }

    await Bill.findByIdAndDelete(billId);

    res.status(200).json({
      success: true,
      message: "Bill deleted successfully"
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};