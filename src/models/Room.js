const mongoose = require('mongoose');

const roomSchema = new mongoose.Schema({
  accommodationId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Accommodation',
    required: [true, 'Accommodation ID is required']
  },
  roomNumber: {
    type: String,
    required: [true, 'Room number is required'],
    trim: true,
    maxlength: [20, 'Room number cannot exceed 20 characters']
  },
  name: {
    type: String,
    required: [true, 'Room name is required'],
    trim: true,
    maxlength: [100, 'Room name cannot exceed 100 characters']
  },
  description: {
    type: String,
    trim: true,
    maxlength: [1000, 'Description cannot exceed 1000 characters']
  },
  type: {
    type: String,
    required: [true, 'Room type is required'],
    enum: {
      values: ['single', 'double', 'twin', 'triple', 'family', 'suite', 'deluxe', 'standard', 'dormitory', 'private', 'studio'],
      message: 'Please select a valid room type'
    }
  },
  size: Number,
  capacity: {
    type: Number,
    required: [true, 'Room capacity is required'],
  },
  hasPrivateBathroom: {
    type: Boolean,
    default: false
  },
  furnishingLevel: {
    type: String,
    enum: {
      values: ['unfurnished', 'semi', 'fully'],
      message: 'Furnishing level must be unfurnished, semi, or fully'
    },
    default: 'unfurnished'
  },
  images: [String],
  amenities: [{
    type: String,
    enum: {
      values: [
        'air_conditioning', 'heating', 'wifi', 'tv', 'refrigerator', 'microwave',
        'coffee_maker', 'desk', 'chair', 'wardrobe', 'safe', 'balcony',
        'window', 'blackout_curtains', 'iron', 'hairdryer', 'towels',
        'bed_linens', 'pillow', 'blanket', 'hangers', 'mirror',
        'power_outlets', 'usb_ports', 'reading_light'
      ],
      message: 'Please select valid room amenities'
    }
  }],
  baseRent: {
    type: Number,
    required: [true, 'Base rent is required'],
    min: [0, 'Base rent cannot be negative']
  },
  deposit: {
    type: Number,
    min: [0, 'Deposit cannot be negative'],
    default: 0
  },
  utilityRates: {
    water: {
      type: {
        type: String,
        enum: ['per_cubic_meter', 'fixed']
      },
      rate: {
        type: Number,
        min: [0, 'Water rate cannot be negative']
      }
    },
    electricity: {
      type: {
        type: String,
        enum: ['per_kwh', 'fixed']
      },
      rate: {
        type: Number,
        min: [0, 'Electricity rate cannot be negative']
      }
    },
    internet: {
      type: {
        type: String,
        enum: ['fixed'],
        default: 'fixed'
      },
      rate: {
        type: Number,
        min: [0, 'Internet rate cannot be negative']
      }
    },
    sanitation: {
      type: {
        type: String,
        enum: ['fixed'],
        default: 'fixed'
      },
      rate: {
        type: Number,
        min: [0, 'Sanitation rate cannot be negative']
      }
    }
  },
  additionalFees: [{
    name: {
      type: String,
      required: [true, 'Fee name is required'],
      trim: true,
      enum: ['parking', 'security', 'maintenance', 'cleaning', 'other']
    },
    amount: {
      type: Number,
      required: [true, 'Fee amount is required'],
      min: [0, 'Fee amount cannot be negative']
    },
    type: {
      type: String,
      required: [true, 'Fee type is required'],
      enum: ['monthly', 'one_time']
    },
    description: {
      type: String,
      trim: true,
      maxlength: [200, 'Fee description cannot exceed 200 characters']
    }
  }],
  isAvailable: {
    type: Boolean,
    default: true
  },
  isHidden: {
    type: Boolean,
    default: false
  },
  availableFrom: {
    type: Date,
    default: Date.now
  },
  currentTenant: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  averageRating: {
    type: Number,
    min: [0, 'Rating cannot be negative'],
    max: [5, 'Rating cannot exceed 5'],
    default: 0
  },
  totalRatings: {
    type: Number,
    min: [0, 'Total ratings cannot be negative'],
    default: 0
  },
  lastRatingUpdate: Date,
  viewCount: {
    type: Number,
    min: [0, 'View count cannot be negative'],
    default: 0
  },
  favoriteCount: {
    type: Number,
    min: [0, 'Favorite count cannot be negative'],
    default: 0
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Indexes
roomSchema.index({ accommodationId: 1 });
roomSchema.index({ type: 1 });
roomSchema.index({ capacity: 1 });
roomSchema.index({ baseRent: 1 });
roomSchema.index({ hasPrivateBathroom: 1 });
roomSchema.index({ furnishingLevel: 1 });
roomSchema.index({ isAvailable: 1 });
roomSchema.index({ availableFrom: 1 });
roomSchema.index({ currentTenant: 1 });
roomSchema.index({ averageRating: 1 });
roomSchema.index({ accommodationId: 1, isAvailable: 1 });
roomSchema.index({ baseRent: 1, isAvailable: 1 });
roomSchema.index({ type: 1, baseRent: 1 });
roomSchema.index({ accommodationId: 1, roomNumber: 1 }, { unique: true });

// Virtuals
roomSchema.virtual('totalBeds').get(function() {
  const beds = this.bedConfiguration || {};
  return (beds.singleBeds || 0) + 
         (beds.doubleBeds || 0) + 
         (beds.queenBeds || 0) + 
         (beds.kingBeds || 0) + 
         (beds.sofaBeds || 0);
});

roomSchema.virtual('accommodation', {
  ref: 'Accommodation',
  localField: 'accommodationId',
  foreignField: '_id',
  justOne: true
});

roomSchema.virtual('ratings', {
  ref: 'Rating',
  localField: '_id',
  foreignField: 'roomId'
});

roomSchema.virtual('tenancyAgreements', {
  ref: 'TenancyAgreement',
  localField: '_id',
  foreignField: 'roomId'
});

// Pre-save middleware
roomSchema.pre('save', function(next) {
  if (this.currentTenant && this.isAvailable) {
    this.isAvailable = false;
  }
  if (this.isAvailable && this.currentTenant) {
    this.currentTenant = undefined;
  }
  next();
});

// Instance methods
roomSchema.methods.calculateMonthlyCost = function() {
  let total = this.baseRent;

  if (this.utilityRates.water?.type === 'fixed') total += this.utilityRates.water.rate || 0;
  if (this.utilityRates.electricity?.type === 'fixed') total += this.utilityRates.electricity.rate || 0;
  if (this.utilityRates.internet?.rate) total += this.utilityRates.internet.rate;
  if (this.utilityRates.sanitation?.rate) total += this.utilityRates.sanitation.rate;

  this.additionalFees.forEach(fee => {
    if (fee.type === 'monthly') total += fee.amount;
  });

  return total;
};

roomSchema.methods.updateRating = async function() {
  const Rating = mongoose.model('Rating');
  const stats = await Rating.aggregate([
    { $match: { roomId: this._id, isVisible: true } },
    {
      $group: {
        _id: null,
        averageRating: { $avg: '$rating' },
        totalRatings: { $sum: 1 }
      }
    }
  ]);

  if (stats.length > 0) {
    this.averageRating = Math.round(stats[0].averageRating * 10) / 10;
    this.totalRatings = stats[0].totalRatings;
  } else {
    this.averageRating = 0;
    this.totalRatings = 0;
  }

  this.lastRatingUpdate = new Date();
  return this.save();
};

roomSchema.methods.setTenant = function(tenantId) {
  this.currentTenant = tenantId;
  this.isAvailable = false;
  return this.save();
};

roomSchema.methods.removeTenant = function() {
  this.currentTenant = undefined;
  this.isAvailable = true;
  this.availableFrom = new Date();
  return this.save();
};

roomSchema.methods.incrementViewCount = function() {
  this.viewCount += 1;
  return this.save({ validateBeforeSave: false });
};

roomSchema.methods.hideRoom = function() {
  this.isHidden = true;
  return this.save();
};

roomSchema.methods.unhideRoom = function() {
  this.isHidden = false;
  return this.save();
};

// Static methods
roomSchema.statics.findAvailable = function(filters = {}) {
  const query = {
    isAvailable: true,
    isHidden: false,
    availableFrom: { $lte: new Date() }
  };

  if (filters.minRent || filters.maxRent) {
    query.baseRent = {};
    if (filters.minRent) query.baseRent.$gte = filters.minRent;
    if (filters.maxRent) query.baseRent.$lte = filters.maxRent;
  }

  if (filters.type) query.type = filters.type;
  if (filters.capacity) query.capacity = { $gte: filters.capacity };
  if (filters.hasPrivateBathroom !== undefined) query.hasPrivateBathroom = filters.hasPrivateBathroom;
  if (filters.furnishingLevel) query.furnishingLevel = filters.furnishingLevel;
  if (filters.amenities?.length > 0) query.amenities = { $in: filters.amenities };

  return this.find(query).populate('accommodationId');
};

roomSchema.statics.findByAccommodation = function(accommodationId) {
  return this.find({ accommodationId, isHidden: false }).sort({ roomNumber: 1 });
};

module.exports = mongoose.models.Room || mongoose.model('Room', roomSchema);

