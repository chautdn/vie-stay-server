const mongoose = require('mongoose');

const favoriteSchema = new mongoose.Schema({
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
  notes: {
    type: String,
    trim: true,
    maxlength: [500, 'Notes cannot exceed 500 characters']
  },
  tags: [{
    type: String,
    enum: {
      values: [
        'interested', 'maybe', 'backup_option', 'highly_interested',
        'good_price', 'great_location', 'perfect_size', 'good_amenities'
      ],
      message: 'Please select valid tags'
    }
  }],
  priority: {
    type: String,
    enum: {
      values: ['low', 'medium', 'high'],
      message: 'Priority must be low, medium, or high'
    },
    default: 'medium'
  },
  isActive: {
    type: Boolean,
    default: true
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Indexes
favoriteSchema.index({ userId: 1 });
favoriteSchema.index({ roomId: 1 });
favoriteSchema.index({ accommodationId: 1 });
favoriteSchema.index({ createdAt: 1 });
favoriteSchema.index({ priority: 1 });

// Unique constraint - one favorite per user per room
favoriteSchema.index({ userId: 1, roomId: 1 }, { unique: true });

// Virtual for user details
favoriteSchema.virtual('user', {
  ref: 'User',
  localField: 'userId',
  foreignField: '_id',
  justOne: true
});

// Virtual for room details
favoriteSchema.virtual('room', {
  ref: 'Room',
  localField: 'roomId',
  foreignField: '_id',
  justOne: true
});

// Virtual for accommodation details
favoriteSchema.virtual('accommodation', {
  ref: 'Accommodation',
  localField: 'accommodationId',
  foreignField: '_id',
  justOne: true
});

// Post-save middleware to update room favorite count
favoriteSchema.post('save', async function(doc) {
  if (doc.isActive) {
    const Room = mongoose.model('Room');
    const favoriteCount = await mongoose.model('Favorite').countDocuments({
      roomId: doc.roomId,
      isActive: true
    });
    
    await Room.findByIdAndUpdate(doc.roomId, {
      favoriteCount: favoriteCount
    });
  }
});

// Post-remove middleware to update room favorite count
favoriteSchema.post('remove', async function(doc) {
  const Room = mongoose.model('Room');
  const favoriteCount = await mongoose.model('Favorite').countDocuments({
    roomId: doc.roomId,
    isActive: true
  });
  
  await Room.findByIdAndUpdate(doc.roomId, {
    favoriteCount: favoriteCount
  });
});

// Instance method to deactivate favorite
favoriteSchema.methods.deactivate = function() {
  this.isActive = false;
  return this.save();
};

// Instance method to reactivate favorite
favoriteSchema.methods.reactivate = function() {
  this.isActive = true;
  return this.save();
};

// Instance method to update notes
favoriteSchema.methods.updateNotes = function(notes) {
  this.notes = notes;
  return this.save();
};

// Instance method to add tag
favoriteSchema.methods.addTag = function(tag) {
  if (!this.tags.includes(tag)) {
    this.tags.push(tag);
    return this.save();
  }
  return Promise.resolve(this);
};

// Instance method to remove tag
favoriteSchema.methods.removeTag = function(tag) {
  this.tags = this.tags.filter(t => t !== tag);
  return this.save();
};

// Static method to find favorites by user
favoriteSchema.statics.findByUser = function(userId, activeOnly = true) {
  const query = { userId };
  if (activeOnly) query.isActive = true;
  
  return this.find(query)
    .sort({ priority: -1, createdAt: -1 })
    .populate('roomId')
    .populate('accommodationId', 'name address averageRating');
};

// Static method to find if room is favorited by user
favoriteSchema.statics.isRoomFavorited = function(userId, roomId) {
  return this.findOne({
    userId,
    roomId,
    isActive: true
  });
};

// Static method to toggle favorite
favoriteSchema.statics.toggleFavorite = async function(userId, roomId, accommodationId) {
  const existingFavorite = await this.findOne({ userId, roomId });
  
  if (existingFavorite) {
    if (existingFavorite.isActive) {
      // Deactivate existing favorite
      existingFavorite.isActive = false;
      await existingFavorite.save();
      return { action: 'removed', favorite: existingFavorite };
    } else {
      // Reactivate existing favorite
      existingFavorite.isActive = true;
      await existingFavorite.save();
      return { action: 'added', favorite: existingFavorite };
    }
  } else {
    // Create new favorite
    const newFavorite = new this({
      userId,
      roomId,
      accommodationId
    });
    await newFavorite.save();
    return { action: 'added', favorite: newFavorite };
  }
};

// Static method to find popular rooms (most favorited)
favoriteSchema.statics.findPopularRooms = function(limit = 10, days = 30) {
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - days);
  
  return this.aggregate([
    {
      $match: {
        isActive: true,
        createdAt: { $gte: cutoffDate }
      }
    },
    {
      $group: {
        _id: '$roomId',
        favoriteCount: { $sum: 1 },
        accommodationId: { $first: '$accommodationId' }
      }
    },
    {
      $sort: { favoriteCount: -1 }
    },
    {
      $limit: limit
    },
    {
      $lookup: {
        from: 'rooms',
        localField: '_id',
        foreignField: '_id',
        as: 'room'
      }
    },
    {
      $lookup: {
        from: 'accommodations',
        localField: 'accommodationId',
        foreignField: '_id',
        as: 'accommodation'
      }
    },
    {
      $unwind: '$room'
    },
    {
      $unwind: '$accommodation'
    }
  ]);
};

// Static method to get user's favorite statistics
favoriteSchema.statics.getUserStats = function(userId) {
  return this.aggregate([
    {
      $match: {
        userId: new mongoose.Types.ObjectId(userId),
        isActive: true
      }
    },
    {
      $group: {
        _id: null,
        totalFavorites: { $sum: 1 },
        priorityBreakdown: {
          $push: '$priority'
        },
        averagePriorityLevel: {
          $avg: {
            $switch: {
              branches: [
                { case: { $eq: ['$priority', 'high'] }, then: 3 },
                { case: { $eq: ['$priority', 'medium'] }, then: 2 },
                { case: { $eq: ['$priority', 'low'] }, then: 1 }
              ],
              default: 2
            }
          }
        }
      }
    }
  ]);
};

// Static method to clean up old inactive favorites
favoriteSchema.statics.cleanupOldInactive = function(days = 90) {
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - days);
  
  return this.deleteMany({
    isActive: false,
    updatedAt: { $lt: cutoffDate }
  });
};

// Static method to find favorites by accommodation
favoriteSchema.statics.findByAccommodation = function(accommodationId) {
  return this.find({
    accommodationId,
    isActive: true
  })
  .populate('userId', 'firstName lastName profileImage')
  .populate('roomId', 'name roomNumber baseRent')
  .sort({ createdAt: -1 });
};

module.exports = mongoose.model('Favorite', favoriteSchema);