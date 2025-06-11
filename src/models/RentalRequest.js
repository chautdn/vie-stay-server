const mongoose = require('mongoose');

const rentalRequestSchema = new mongoose.Schema({
  tenantId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'Tenant ID is required']
  },
  roomId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Room',
    required: [true, 'Room ID is required']
  },
  accommodationId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Accommodation',
    required: [true, 'Accommodation ID is required']
  },
  landlordId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'Landlord ID is required']
  },
  message: {
    type: String,
    trim: true,
    maxlength: [1000, 'Message cannot exceed 1000 characters']
  },
  proposedStartDate: {
    type: Date,
    required: [true, 'Proposed start date is required'],
    validate: {
      validator: function(value) {
        return value >= new Date().setHours(0, 0, 0, 0);
      },
      message: 'Proposed start date cannot be in the past'
    }
  },
  proposedEndDate: {
    type: Date,
    validate: {
      validator: function(value) {
        if (!value) return true; // Optional field
        return value > this.proposedStartDate;
      },
      message: 'Proposed end date must be after start date'
    }
  },
  proposedRent: {
    type: Number,
    min: [0, 'Proposed rent cannot be negative']
  },
  guestCount: {
    type: Number,
    min: [1, 'Guest count must be at least 1'],
    default: 1
  },
  specialRequests: {
    type: String,
    trim: true,
    maxlength: [500, 'Special requests cannot exceed 500 characters']
  },
  tenantProfile: {
    occupation: {
      type: String,
      trim: true,
      maxlength: [100, 'Occupation cannot exceed 100 characters']
    },
    monthlyIncome: {
      type: Number,
      min: [0, 'Monthly income cannot be negative']
    },
    previousRentalExperience: {
      type: String,
      trim: true,
      maxlength: [500, 'Previous rental experience cannot exceed 500 characters']
    },
    references: [{
      name: {
        type: String,
        trim: true,
        maxlength: [100, 'Reference name cannot exceed 100 characters']
      },
      relationship: {
        type: String,
        trim: true,
        enum: {
          values: ['previous_landlord', 'employer', 'colleague', 'friend', 'family', 'other'],
          message: 'Please select a valid relationship type'
        }
      },
      phoneNumber: {
        type: String,
        match: [/^(\+84|0)[0-9]{9,10}$/, 'Please provide a valid Vietnamese phone number']
      },
      email: {
        type: String,
        match: [/^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/, 'Please provide a valid email']
      }
    }]
  },
  status: {
    type: String,
    required: [true, 'Request status is required'],
    enum: {
      values: ['pending', 'accepted', 'rejected', 'withdrawn'],
      message: 'Status must be pending, accepted, rejected, or withdrawn'
    },
    default: 'pending'
  },
  responseMessage: {
    type: String,
    trim: true,
    maxlength: [1000, 'Response message cannot exceed 1000 characters']
  },
  respondedAt: {
    type: Date
  },
  priority: {
    type: String,
    enum: {
      values: ['low', 'normal', 'high', 'urgent'],
      message: 'Priority must be low, normal, high, or urgent'
    },
    default: 'normal'
  },
  viewedByLandlord: {
    type: Boolean,
    default: false
  },
  viewedAt: {
    type: Date
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Indexes
rentalRequestSchema.index({ tenantId: 1 });
rentalRequestSchema.index({ roomId: 1 });
rentalRequestSchema.index({ landlordId: 1 });
rentalRequestSchema.index({ status: 1 });
rentalRequestSchema.index({ createdAt: 1 });
rentalRequestSchema.index({ priority: 1 });

// Compound indexes
rentalRequestSchema.index({ landlordId: 1, status: 1 });
rentalRequestSchema.index({ roomId: 1, status: 1 });
rentalRequestSchema.index({ status: 1, createdAt: 1 });

// Virtual for tenant details
rentalRequestSchema.virtual('tenant', {
  ref: 'User',
  localField: 'tenantId',
  foreignField: '_id',
  justOne: true
});

// Virtual for landlord details
rentalRequestSchema.virtual('landlord', {
  ref: 'User',
  localField: 'landlordId',
  foreignField: '_id',
  justOne: true
});

// Virtual for room details
rentalRequestSchema.virtual('room', {
  ref: 'Room',
  localField: 'roomId',
  foreignField: '_id',
  justOne: true
});

// Virtual for accommodation details
rentalRequestSchema.virtual('accommodation', {
  ref: 'Accommodation',
  localField: 'accommodationId',
  foreignField: '_id',
  justOne: true
});

// Virtual for request age in days
rentalRequestSchema.virtual('ageInDays').get(function() {
  const now = new Date();
  const created = new Date(this.createdAt);
  return Math.floor((now - created) / (1000 * 60 * 60 * 24));
});

// Virtual for response time in hours (if responded)
rentalRequestSchema.virtual('responseTimeHours').get(function() {
  if (!this.respondedAt) return null;
  const created = new Date(this.createdAt);
  const responded = new Date(this.respondedAt);
  return Math.floor((responded - created) / (1000 * 60 * 60));
});

// Pre-save middleware to validate room availability
rentalRequestSchema.pre('save', async function(next) {
  if (this.isNew) {
    const Room = mongoose.model('Room');
    const room = await Room.findById(this.roomId);
    
    if (!room || !room.isAvailable) {
      const error = new Error('Room is not available for rental');
      error.name = 'ValidationError';
      return next(error);
    }
    
    // Check if room capacity meets guest count
    if (this.guestCount > room.capacity) {
      const error = new Error('Guest count exceeds room capacity');
      error.name = 'ValidationError';
      return next(error);
    }
  }
  next();
});

// Instance method to accept request
rentalRequestSchema.methods.accept = function(responseMessage) {
  this.status = 'accepted';
  this.responseMessage = responseMessage;
  this.respondedAt = new Date();
  return this.save();
};

// Instance method to reject request
rentalRequestSchema.methods.reject = function(responseMessage) {
  this.status = 'rejected';
  this.responseMessage = responseMessage;
  this.respondedAt = new Date();
  return this.save();
};

// Instance method to withdraw request
rentalRequestSchema.methods.withdraw = function() {
  this.status = 'withdrawn';
  return this.save();
};

// Instance method to mark as viewed by landlord
rentalRequestSchema.methods.markAsViewed = function() {
  if (!this.viewedByLandlord) {
    this.viewedByLandlord = true;
    this.viewedAt = new Date();
    return this.save({ validateBeforeSave: false });
  }
  return Promise.resolve(this);
};

// Instance method to create tenancy agreement from accepted request
rentalRequestSchema.methods.createTenancyAgreement = async function() {
  if (this.status !== 'accepted') {
    throw new Error('Request must be accepted to create tenancy agreement');
  }
  
  const TenancyAgreement = mongoose.model('TenancyAgreement');
  const Room = mongoose.model('Room');
  
  // Get room details for agreement
  const room = await Room.findById(this.roomId);
  
  const agreementData = {
    tenantId: this.tenantId,
    roomId: this.roomId,
    accommodationId: this.accommodationId,
    landlordId: this.landlordId,
    startDate: this.proposedStartDate,
    endDate: this.proposedEndDate,
    monthlyRent: this.proposedRent || room.baseRent,
    deposit: room.deposit || room.baseRent, // Default deposit to one month rent
    utilityRates: room.utilityRates,
    additionalFees: room.additionalFees
  };
  
  return TenancyAgreement.create(agreementData);
};

// Static method to find pending requests
rentalRequestSchema.statics.findPending = function() {
  return this.find({ status: 'pending' }).sort({ createdAt: 1 });
};

// Static method to find requests by landlord
rentalRequestSchema.statics.findByLandlord = function(landlordId, status = null) {
  const query = { landlordId };
  if (status) query.status = status;
  return this.find(query).sort({ createdAt: -1 });
};

// Static method to find requests by tenant
rentalRequestSchema.statics.findByTenant = function(tenantId, status = null) {
  const query = { tenantId };
  if (status) query.status = status;
  return this.find(query).sort({ createdAt: -1 });
};

// Static method to find requests by room
rentalRequestSchema.statics.findByRoom = function(roomId, status = null) {
  const query = { roomId };
  if (status) query.status = status;
  return this.find(query).sort({ createdAt: -1 });
};

// Static method to find urgent requests
rentalRequestSchema.statics.findUrgent = function() {
  return this.find({ 
    status: 'pending', 
    priority: { $in: ['high', 'urgent'] } 
  }).sort({ priority: -1, createdAt: 1 });
};

// Static method to find old pending requests
rentalRequestSchema.statics.findOldPending = function(days = 7) {
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - days);
  
  return this.find({
    status: 'pending',
    createdAt: { $lt: cutoffDate }
  }).sort({ createdAt: 1 });
};

module.exports = mongoose.model('RentalRequest', rentalRequestSchema);