const mongoose = require('mongoose');

const utilityReadingSchema = new mongoose.Schema({
  roomId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Room',
    required: [true, 'Room ID is required']
  },
  tenantId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'Tenant ID is required']
  },
  tenancyId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'TenancyAgreement',
    required: [true, 'Tenancy ID is required']
  },
  utilityType: {
    type: String,
    required: [true, 'Utility type is required'],
    enum: {
      values: ['water', 'electricity'],
      message: 'Utility type must be water or electricity'
    }
  },
  previousReading: {
    type: Number,
    required: [true, 'Previous reading is required'],
    min: [0, 'Previous reading cannot be negative']
  },
  currentReading: {
    type: Number,
    required: [true, 'Current reading is required'],
    min: [0, 'Current reading cannot be negative'],
    validate: {
      validator: function(value) {
        return value >= this.previousReading;
      },
      message: 'Current reading must be greater than or equal to previous reading'
    }
  },
  consumption: {
    type: Number,
    required: [true, 'Consumption is required'],
    min: [0, 'Consumption cannot be negative']
  },
  readingDate: {
    type: Date,
    required: [true, 'Reading date is required'],
    validate: {
      validator: function(value) {
        return value <= new Date();
      },
      message: 'Reading date cannot be in the future'
    }
  },
  readBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'Reader ID is required']
  },
  notes: {
    type: String,
    trim: true,
    maxlength: [500, 'Notes cannot exceed 500 characters']
  },
  images: [{
    type: String,
    match: [/^https?:\/\/.+\.(jpg|jpeg|png|gif|webp)$/i, 'Please provide valid image URLs']
  }],
  meterSerialNumber: {
    type: String,
    trim: true,
    maxlength: [50, 'Meter serial number cannot exceed 50 characters']
  },
  isEstimated: {
    type: Boolean,
    default: false
  },
  estimationReason: {
    type: String,
    trim: true,
    maxlength: [200, 'Estimation reason cannot exceed 200 characters']
  },
  verifiedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  verifiedAt: {
    type: Date
  },
  isDisputed: {
    type: Boolean,
    default: false
  },
  disputeReason: {
    type: String,
    trim: true,
    maxlength: [500, 'Dispute reason cannot exceed 500 characters']
  },
  disputedAt: {
    type: Date
  },
  resolvedAt: {
    type: Date
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Indexes
utilityReadingSchema.index({ roomId: 1 });
utilityReadingSchema.index({ tenantId: 1 });
utilityReadingSchema.index({ tenancyId: 1 });
utilityReadingSchema.index({ utilityType: 1 });
utilityReadingSchema.index({ readingDate: 1 });
utilityReadingSchema.index({ readBy: 1 });

// Compound indexes
utilityReadingSchema.index({ roomId: 1, utilityType: 1, readingDate: 1 });
utilityReadingSchema.index({ tenancyId: 1, utilityType: 1 });

// Virtual for tenant details
utilityReadingSchema.virtual('tenant', {
  ref: 'User',
  localField: 'tenantId',
  foreignField: '_id',
  justOne: true
});

// Virtual for room details
utilityReadingSchema.virtual('room', {
  ref: 'Room',
  localField: 'roomId',
  foreignField: '_id',
  justOne: true
});

// Virtual for reader details
utilityReadingSchema.virtual('reader', {
  ref: 'User',
  localField: 'readBy',
  foreignField: '_id',
  justOne: true
});

// Virtual for verifier details
utilityReadingSchema.virtual('verifier', {
  ref: 'User',
  localField: 'verifiedBy',
  foreignField: '_id',
  justOne: true
});

// Pre-save middleware to calculate consumption
utilityReadingSchema.pre('save', function(next) {
  // Auto-calculate consumption if not manually set
  if (this.isModified('currentReading') || this.isModified('previousReading')) {
    this.consumption = this.currentReading - this.previousReading;
  }
  next();
});

// Instance method to verify reading
utilityReadingSchema.methods.verify = function(verifierId) {
  this.verifiedBy = verifierId;
  this.verifiedAt = new Date();
  return this.save();
};

// Instance method to dispute reading
utilityReadingSchema.methods.dispute = function(reason) {
  this.isDisputed = true;
  this.disputeReason = reason;
  this.disputedAt = new Date();
  return this.save();
};

// Instance method to resolve dispute
utilityReadingSchema.methods.resolveDispute = function() {
  this.isDisputed = false;
  this.resolvedAt = new Date();
  return this.save();
};

// Instance method to calculate cost
utilityReadingSchema.methods.calculateCost = async function() {
  const TenancyAgreement = mongoose.model('TenancyAgreement');
  const tenancy = await TenancyAgreement.findById(this.tenancyId);
  
  if (!tenancy || !tenancy.utilityRates || !tenancy.utilityRates[this.utilityType]) {
    throw new Error('Utility rates not found for this tenancy');
  }
  
  const utilityRate = tenancy.utilityRates[this.utilityType];
  
  if (utilityRate.type === 'per_cubic_meter' || utilityRate.type === 'per_kwh') {
    return this.consumption * utilityRate.rate;
  } else if (utilityRate.type === 'fixed') {
    return utilityRate.rate;
  }
  
  return 0;
};

// Static method to find readings by room and period
utilityReadingSchema.statics.findByRoomAndPeriod = function(roomId, startDate, endDate, utilityType = null) {
  const query = {
    roomId,
    readingDate: {
      $gte: startDate,
      $lte: endDate
    }
  };
  
  if (utilityType) {
    query.utilityType = utilityType;
  }
  
  return this.find(query).sort({ readingDate: 1 });
};

// Static method to find latest reading for room and utility type
utilityReadingSchema.statics.findLatestReading = function(roomId, utilityType) {
  return this.findOne({
    roomId,
    utilityType
  }).sort({ readingDate: -1 });
};

// Static method to find readings for billing period
utilityReadingSchema.statics.findForBilling = function(tenancyId, startDate, endDate) {
  return this.find({
    tenancyId,
    readingDate: {
      $gte: startDate,
      $lte: endDate
    }
  }).sort({ utilityType: 1, readingDate: 1 });
};

// Static method to calculate consumption for period
utilityReadingSchema.statics.calculateConsumption = function(roomId, utilityType, startDate, endDate) {
  return this.aggregate([
    {
      $match: {
        roomId: new mongoose.Types.ObjectId(roomId),
        utilityType,
        readingDate: {
          $gte: startDate,
          $lte: endDate
        }
      }
    },
    {
      $group: {
        _id: null,
        totalConsumption: { $sum: '$consumption' },
        readingCount: { $sum: 1 },
        averageDaily: { $avg: '$consumption' }
      }
    }
  ]);
};

// Static method to find disputed readings
utilityReadingSchema.statics.findDisputed = function() {
  return this.find({ isDisputed: true }).sort({ disputedAt: -1 });
};

// Static method to find unverified readings
utilityReadingSchema.statics.findUnverified = function() {
  return this.find({ 
    verifiedBy: { $exists: false },
    isEstimated: false 
  }).sort({ readingDate: 1 });
};

// Static method to generate monthly report
utilityReadingSchema.statics.generateMonthlyReport = function(roomId, year, month) {
  const startDate = new Date(year, month - 1, 1);
  const endDate = new Date(year, month, 0);
  
  return this.aggregate([
    {
      $match: {
        roomId: new mongoose.Types.ObjectId(roomId),
        readingDate: {
          $gte: startDate,
          $lte: endDate
        }
      }
    },
    {
      $group: {
        _id: '$utilityType',
        totalConsumption: { $sum: '$consumption' },
        readingCount: { $sum: 1 },
        estimatedReadings: {
          $sum: { $cond: ['$isEstimated', 1, 0] }
        },
        disputedReadings: {
          $sum: { $cond: ['$isDisputed', 1, 0] }
        }
      }
    }
  ]);
};

module.exports = mongoose.model('UtilityReading', utilityReadingSchema);