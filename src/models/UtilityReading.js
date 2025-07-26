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
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Essential indexes
utilityReadingSchema.index({ tenancyId: 1 });
utilityReadingSchema.index({ utilityType: 1 });
utilityReadingSchema.index({ readingDate: 1 });
utilityReadingSchema.index({ tenancyId: 1, utilityType: 1, readingDate: -1 });

// Pre-save middleware to calculate consumption
utilityReadingSchema.pre('save', function(next) {
  // Auto-calculate consumption if not manually set
  if (this.isModified('currentReading') || this.isModified('previousReading')) {
    this.consumption = this.currentReading - this.previousReading;
  }
  next();
});

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

// Static method to find latest reading for tenancy and utility type
utilityReadingSchema.statics.findLatestReading = function(tenancyId, utilityType) {
  return this.findOne({
    tenancyId,
    utilityType
  }).sort({ readingDate: -1 });
};

module.exports = mongoose.model('UtilityReading', utilityReadingSchema);