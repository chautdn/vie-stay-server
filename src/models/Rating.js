const mongoose = require('mongoose');

const ratingSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'User ID is required']
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
  tenancyId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'TenancyAgreement'
  },
  rating: {
    type: Number,
    required: [true, 'Overall rating is required'],
    min: [1, 'Rating must be at least 1'],
    max: [5, 'Rating cannot exceed 5']
  },
  ratings: {
    cleanliness: {
      type: Number,
      min: [1, 'Cleanliness rating must be at least 1'],
      max: [5, 'Cleanliness rating cannot exceed 5']
    },
    location: {
      type: Number,
      min: [1, 'Location rating must be at least 1'],
      max: [5, 'Location rating cannot exceed 5']
    },
    value: {
      type: Number,
      min: [1, 'Value rating must be at least 1'],
      max: [5, 'Value rating cannot exceed 5']
    },
    amenities: {
      type: Number,
      min: [1, 'Amenities rating must be at least 1'],
      max: [5, 'Amenities rating cannot exceed 5']
    },
    landlord: {
      type: Number,
      min: [1, 'Landlord rating must be at least 1'],
      max: [5, 'Landlord rating cannot exceed 5']
    }
  },
  feedback: {
    type: String,
    trim: true,
    maxlength: [2000, 'Feedback cannot exceed 2000 characters']
  },
  stayDuration: {
    startDate: {
      type: Date
    },
    endDate: {
      type: Date,
      validate: {
        validator: function(value) {
          if (!value || !this.stayDuration.startDate) return true;
          return value > this.stayDuration.startDate;
        },
        message: 'End date must be after start date'
      }
    }
  },
  isVerified: {
    type: Boolean,
    default: false
  },
  verificationMethod: {
    type: String,
    enum: {
      values: ['tenancy_agreement', 'invoice_history', 'manual_verification'],
      message: 'Please select a valid verification method'
    }
  },
  helpfulVotes: {
    type: Number,
    min: [0, 'Helpful votes cannot be negative'],
    default: 0
  },
  unhelpfulVotes: {
    type: Number,
    min: [0, 'Unhelpful votes cannot be negative'],
    default: 0
  },
  reportCount: {
    type: Number,
    min: [0, 'Report count cannot be negative'],
    default: 0
  },
  isVisible: {
    type: Boolean,
    default: true
  },
  canEdit: {
    type: Boolean,
    default: true
  },
  editedAt: {
    type: Date
  },
  responses: [{
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Response user ID is required']
    },
    message: {
      type: String,
      required: [true, 'Response message is required'],
      trim: true,
      maxlength: [1000, 'Response cannot exceed 1000 characters']
    },
    isLandlordResponse: {
      type: Boolean,
      default: false
    },
    createdAt: {
      type: Date,
      default: Date.now
    }
  }],
  moderationStatus: {
    type: String,
    enum: {
      values: ['pending', 'approved', 'rejected', 'flagged'],
      message: 'Moderation status must be pending, approved, rejected, or flagged'
    },
    default: 'approved'
  },
  moderatedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  moderatedAt: {
    type: Date
  },
  tags: [{
    type: String,
    enum: {
      values: [
        'excellent_value', 'great_location', 'very_clean', 'helpful_landlord',
        'poor_maintenance', 'noisy', 'overpriced', 'unresponsive_landlord',
        'would_recommend', 'would_not_recommend', 'perfect_for_students',
        'family_friendly', 'business_traveler', 'long_term_stay'
      ],
      message: 'Please select valid tags'
    }
  }]
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Indexes
ratingSchema.index({ userId: 1 });
ratingSchema.index({ roomId: 1 });
ratingSchema.index({ accommodationId: 1 });
ratingSchema.index({ tenancyId: 1 });
ratingSchema.index({ rating: 1 });
ratingSchema.index({ createdAt: 1 });
ratingSchema.index({ isVisible: 1 });
ratingSchema.index({ isVerified: 1 });
ratingSchema.index({ moderationStatus: 1 });

// Unique constraint - one rating per user per room
ratingSchema.index({ userId: 1, roomId: 1 }, { unique: true });

// Compound indexes
ratingSchema.index({ roomId: 1, isVisible: 1, createdAt: 1 });
ratingSchema.index({ accommodationId: 1, isVisible: 1 });
ratingSchema.index({ rating: 1, isVisible: 1 });

// Text search on feedback
ratingSchema.index({ feedback: 'text' });

// Virtual for user details
ratingSchema.virtual('user', {
  ref: 'User',
  localField: 'userId',
  foreignField: '_id',
  justOne: true
});

// Virtual for room details
ratingSchema.virtual('room', {
  ref: 'Room',
  localField: 'roomId',
  foreignField: '_id',
  justOne: true
});

// Virtual for accommodation details
ratingSchema.virtual('accommodation', {
  ref: 'Accommodation',
  localField: 'accommodationId',
  foreignField: '_id',
  justOne: true
});

// Virtual for tenancy details
ratingSchema.virtual('tenancy', {
  ref: 'TenancyAgreement',
  localField: 'tenancyId',
  foreignField: '_id',
  justOne: true
});

// Virtual for helpfulness ratio
ratingSchema.virtual('helpfulnessRatio').get(function() {
  const totalVotes = this.helpfulVotes + this.unhelpfulVotes;
  if (totalVotes === 0) return 0;
  return Math.round((this.helpfulVotes / totalVotes) * 100);
});

// Virtual for stay duration in days
ratingSchema.virtual('stayDurationDays').get(function() {
  if (!this.stayDuration.startDate || !this.stayDuration.endDate) return null;
  const timeDiff = this.stayDuration.endDate - this.stayDuration.startDate;
  return Math.ceil(timeDiff / (1000 * 60 * 60 * 24));
});

// Virtual for average detailed rating
ratingSchema.virtual('averageDetailedRating').get(function() {
  const ratings = this.ratings;
  if (!ratings) return this.rating;
  
  const validRatings = Object.values(ratings).filter(r => r != null);
  if (validRatings.length === 0) return this.rating;
  
  const sum = validRatings.reduce((acc, rating) => acc + rating, 0);
  return Math.round((sum / validRatings.length) * 10) / 10;
});

// Pre-save middleware to verify tenancy
ratingSchema.pre('save', async function(next) {
  if (this.isNew && this.tenancyId) {
    const TenancyAgreement = mongoose.model('TenancyAgreement');
    const tenancy = await TenancyAgreement.findOne({
      _id: this.tenancyId,
      tenantId: this.userId,
      roomId: this.roomId
    });
    
    if (tenancy) {
      this.isVerified = true;
      this.verificationMethod = 'tenancy_agreement';
      
      // Set stay duration from tenancy
      this.stayDuration = {
        startDate: tenancy.startDate,
        endDate: tenancy.endDate || new Date()
      };
    }
  }
  
  // Calculate overall rating from detailed ratings if not provided
  if (this.ratings && Object.keys(this.ratings).length > 0 && !this.isModified('rating')) {
    const validRatings = Object.values(this.ratings).filter(r => r != null);
    if (validRatings.length > 0) {
      const sum = validRatings.reduce((acc, rating) => acc + rating, 0);
      this.rating = Math.round((sum / validRatings.length) * 10) / 10;
    }
  }
  
  next();
});

// Post-save middleware to update room rating
ratingSchema.post('save', async function(doc) {
  if (doc.isVisible && doc.moderationStatus === 'approved') {
    const Room = mongoose.model('Room');
    const room = await Room.findById(doc.roomId);
    if (room) {
      await room.updateRating();
    }
  }
});

// Post-remove middleware to update room rating
ratingSchema.post('remove', async function(doc) {
  const Room = mongoose.model('Room');
  const room = await Room.findById(doc.roomId);
  if (room) {
    await room.updateRating();
  }
});

// Instance method to mark as helpful
ratingSchema.methods.markHelpful = function() {
  this.helpfulVotes += 1;
  return this.save({ validateBeforeSave: false });
};

// Instance method to mark as unhelpful
ratingSchema.methods.markUnhelpful = function() {
  this.unhelpfulVotes += 1;
  return this.save({ validateBeforeSave: false });
};

// Instance method to report rating
ratingSchema.methods.report = function() {
  this.reportCount += 1;
  if (this.reportCount >= 3) {
    this.moderationStatus = 'flagged';
  }
  return this.save();
};

// Instance method to hide rating
ratingSchema.methods.hide = function() {
  this.isVisible = false;
  this.canEdit = false;
  return this.save();
};

// Instance method to approve rating
ratingSchema.methods.approve = function(moderatorId) {
  this.moderationStatus = 'approved';
  this.moderatedBy = moderatorId;
  this.moderatedAt = new Date();
  this.isVisible = true;
  return this.save();
};

// Instance method to reject rating
ratingSchema.methods.reject = function(moderatorId) {
  this.moderationStatus = 'rejected';
  this.moderatedBy = moderatorId;
  this.moderatedAt = new Date();
  this.isVisible = false;
  return this.save();
};

// Instance method to add landlord response
ratingSchema.methods.addResponse = function(userId, message, isLandlord = false) {
  this.responses.push({
    userId,
    message,
    isLandlordResponse: isLandlord
  });
  return this.save();
};

// Instance method to edit rating (within time limit)
ratingSchema.methods.editRating = function(newData) {
  if (!this.canEdit) {
    throw new Error('Rating can no longer be edited');
  }
  
  // Check if edit window has passed (e.g., 7 days)
  const editWindow = 7 * 24 * 60 * 60 * 1000; // 7 days in milliseconds
  const timeSinceCreation = new Date() - this.createdAt;
  
  if (timeSinceCreation > editWindow) {
    this.canEdit = false;
    throw new Error('Edit window has expired');
  }
  
  // Update allowed fields
  if (newData.rating) this.rating = newData.rating;
  if (newData.ratings) this.ratings = { ...this.ratings, ...newData.ratings };
  if (newData.feedback !== undefined) this.feedback = newData.feedback;
  if (newData.tags) this.tags = newData.tags;
  
  this.editedAt = new Date();
  
  return this.save();
};

// Static method to find ratings by room
ratingSchema.statics.findByRoom = function(roomId, includeHidden = false) {
  const query = { roomId };
  if (!includeHidden) {
    query.isVisible = true;
    query.moderationStatus = 'approved';
  }
  return this.find(query).sort({ createdAt: -1 });
};

// Static method to find ratings by user
ratingSchema.statics.findByUser = function(userId) {
  return this.find({ userId }).sort({ createdAt: -1 });
};

// Static method to calculate room statistics
ratingSchema.statics.calculateRoomStats = function(roomId) {
  return this.aggregate([
    {
      $match: {
        roomId: new mongoose.Types.ObjectId(roomId),
        isVisible: true,
        moderationStatus: 'approved'
      }
    },
    {
      $group: {
        _id: null,
        averageRating: { $avg: '$rating' },
        totalRatings: { $sum: 1 },
        ratingDistribution: {
          $push: '$rating'
        },
        averageDetailedRatings: {
          $push: {
            cleanliness: '$ratings.cleanliness',
            location: '$ratings.location',
            value: '$ratings.value',
            amenities: '$ratings.amenities',
            landlord: '$ratings.landlord'
          }
        }
      }
    }
  ]);
};

// Static method to find ratings needing moderation
ratingSchema.statics.findNeedingModeration = function() {
  return this.find({
    $or: [
      { moderationStatus: 'pending' },
      { moderationStatus: 'flagged' },
      { reportCount: { $gte: 3 } }
    ]
  }).sort({ reportCount: -1, createdAt: 1 });
};

// Static method to find top rated rooms
ratingSchema.statics.findTopRatedRooms = function(limit = 10) {
  return this.aggregate([
    {
      $match: {
        isVisible: true,
        moderationStatus: 'approved'
      }
    },
    {
      $group: {
        _id: '$roomId',
        averageRating: { $avg: '$rating' },
        totalRatings: { $sum: 1 }
      }
    },
    {
      $match: {
        totalRatings: { $gte: 3 } // At least 3 ratings
      }
    },
    {
      $sort: { averageRating: -1, totalRatings: -1 }
    },
    {
      $limit: limit
    }
  ]);
};

// Static method to find recent ratings
ratingSchema.statics.findRecent = function(days = 30, limit = 20) {
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - days);
  
  return this.find({
    createdAt: { $gte: cutoffDate },
    isVisible: true,
    moderationStatus: 'approved'
  })
  .sort({ createdAt: -1 })
  .limit(limit)
  .populate('userId', 'firstName lastName profileImage')
  .populate('roomId', 'name roomNumber')
  .populate('accommodationId', 'name address.district');
};

module.exports = mongoose.model('Rating', ratingSchema);