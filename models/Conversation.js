const mongoose = require('mongoose');

const conversationSchema = new mongoose.Schema({
  participants: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'Participants are required']
  }],
  roomId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Room'
  },
  accommodationId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Accommodation'
  },
  type: {
    type: String,
    enum: {
      values: ['rental_inquiry', 'tenant_landlord', 'support', 'general'],
      message: 'Conversation type must be rental_inquiry, tenant_landlord, support, or general'
    },
    default: 'general'
  },
  subject: {
    type: String,
    trim: true,
    maxlength: [200, 'Subject cannot exceed 200 characters']
  },
  lastMessage: {
    type: String,
    trim: true,
    maxlength: [500, 'Last message preview cannot exceed 500 characters']
  },
  lastMessageAt: {
    type: Date,
    default: Date.now
  },
  lastMessageBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  unreadCounts: {
    type: Map,
    of: Number,
    default: new Map()
  },
  isActive: {
    type: Boolean,
    default: true
  },
  isArchived: {
    type: Boolean,
    default: false
  },
  archivedBy: [{
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    archivedAt: {
      type: Date,
      default: Date.now
    }
  }],
  metadata: {
    source: {
      type: String,
      enum: {
        values: ['rental_request', 'direct_message', 'system_generated'],
        message: 'Source must be rental_request, direct_message, or system_generated'
      },
      default: 'direct_message'
    },
    priority: {
      type: String,
      enum: {
        values: ['low', 'normal', 'high', 'urgent'],
        message: 'Priority must be low, normal, high, or urgent'
      },
      default: 'normal'
    },
    tags: [{
      type: String,
      enum: {
        values: [
          'payment_issue', 'maintenance_request', 'lease_renewal',
          'complaint', 'inquiry', 'emergency', 'feedback'
        ]
      }
    }]
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Indexes
conversationSchema.index({ participants: 1 });
conversationSchema.index({ roomId: 1 });
conversationSchema.index({ lastMessageAt: 1 });
conversationSchema.index({ isActive: 1 });
conversationSchema.index({ 'metadata.priority': 1 });

// Compound indexes
conversationSchema.index({ participants: 1, isActive: 1 });
conversationSchema.index({ participants: 1, lastMessageAt: -1 });

// Virtual for messages
conversationSchema.virtual('messages', {
  ref: 'Message',
  localField: '_id',
  foreignField: 'conversationId'
});

// Virtual for participant details
conversationSchema.virtual('participantDetails', {
  ref: 'User',
  localField: 'participants',
  foreignField: '_id'
});

// Virtual for room details
conversationSchema.virtual('room', {
  ref: 'Room',
  localField: 'roomId',
  foreignField: '_id',
  justOne: true
});

// Pre-save middleware to validate participants
conversationSchema.pre('save', function(next) {
  // Ensure exactly 2 participants for now (can be extended for group chats)
  if (this.participants.length !== 2) {
    const error = new Error('Conversation must have exactly 2 participants');
    error.name = 'ValidationError';
    return next(error);
  }
  
  // Initialize unread counts for new conversations
  if (this.isNew) {
    this.participants.forEach(participantId => {
      this.unreadCounts.set(participantId.toString(), 0);
    });
  }
  
  next();
});

// Instance method to add message and update conversation
conversationSchema.methods.addMessage = function(senderId, content, messageType = 'text') {
  this.lastMessage = content.length > 500 ? content.substring(0, 497) + '...' : content;
  this.lastMessageAt = new Date();
  this.lastMessageBy = senderId;
  
  // Update unread counts
  this.participants.forEach(participantId => {
    const participantIdStr = participantId.toString();
    if (participantIdStr !== senderId.toString()) {
      const currentCount = this.unreadCounts.get(participantIdStr) || 0;
      this.unreadCounts.set(participantIdStr, currentCount + 1);
    }
  });
  
  return this.save();
};

// Instance method to mark as read by user
conversationSchema.methods.markAsRead = function(userId) {
  const userIdStr = userId.toString();
  this.unreadCounts.set(userIdStr, 0);
  return this.save({ validateBeforeSave: false });
};

// Instance method to archive conversation for user
conversationSchema.methods.archiveForUser = function(userId) {
  const existingArchive = this.archivedBy.find(
    archive => archive.userId.toString() === userId.toString()
  );
  
  if (!existingArchive) {
    this.archivedBy.push({ userId });
  }
  
  return this.save();
};

// Instance method to unarchive conversation for user
conversationSchema.methods.unarchiveForUser = function(userId) {
  this.archivedBy = this.archivedBy.filter(
    archive => archive.userId.toString() !== userId.toString()
  );
  
  return this.save();
};

// Instance method to check if archived for user
conversationSchema.methods.isArchivedForUser = function(userId) {
  return this.archivedBy.some(
    archive => archive.userId.toString() === userId.toString()
  );
};

// Instance method to get unread count for user
conversationSchema.methods.getUnreadCount = function(userId) {
  return this.unreadCounts.get(userId.toString()) || 0;
};

// Instance method to get other participant
conversationSchema.methods.getOtherParticipant = function(userId) {
  return this.participants.find(
    participantId => participantId.toString() !== userId.toString()
  );
};

// Instance method to deactivate conversation
conversationSchema.methods.deactivate = function() {
  this.isActive = false;
  return this.save();
};

// Static method to find conversation between two users
conversationSchema.statics.findBetweenUsers = function(userId1, userId2) {
  return this.findOne({
    participants: { $all: [userId1, userId2] },
    isActive: true
  });
};

// Static method to find conversations for user
conversationSchema.statics.findForUser = function(userId, includeArchived = false) {
  const query = {
    participants: userId,
    isActive: true
  };
  
  if (!includeArchived) {
    query.$nor = [
      { archivedBy: { $elemMatch: { userId: userId } } }
    ];
  }
  
  return this.find(query)
    .sort({ lastMessageAt: -1 })
    .populate('participants', 'firstName lastName profileImage isActive lastLogin')
    .populate('roomId', 'name roomNumber')
    .populate('lastMessageBy', 'firstName lastName');
};

// Static method to find conversations about specific room
conversationSchema.statics.findByRoom = function(roomId) {
  return this.find({
    roomId,
    isActive: true
  }).sort({ lastMessageAt: -1 });
};

// Static method to create or get conversation between users
conversationSchema.statics.createOrGet = async function(userId1, userId2, roomId = null) {
  // Check if conversation already exists
  let conversation = await this.findBetweenUsers(userId1, userId2);
  
  if (!conversation) {
    // Create new conversation
    conversation = new this({
      participants: [userId1, userId2],
      roomId: roomId
    });
    
    // Set conversation type and subject based on context
    if (roomId) {
      conversation.type = 'rental_inquiry';
      const Room = mongoose.model('Room');
      const room = await Room.findById(roomId).populate('accommodationId', 'name');
      if (room) {
        conversation.subject = `Inquiry about ${room.accommodationId.name} - Room ${room.roomNumber}`;
      }
    }
    
    await conversation.save();
  }
  
  return conversation;
};

// Static method to find urgent conversations
conversationSchema.statics.findUrgent = function() {
  return this.find({
    'metadata.priority': { $in: ['high', 'urgent'] },
    isActive: true
  }).sort({ 'metadata.priority': -1, lastMessageAt: -1 });
};

// Static method to find conversations with unread messages
conversationSchema.statics.findWithUnreadMessages = function(userId) {
  return this.find({
    participants: userId,
    [`unreadCounts.${userId}`]: { $gt: 0 },
    isActive: true
  }).sort({ lastMessageAt: -1 });
};

// Static method to get conversation statistics for user
conversationSchema.statics.getStatsForUser = function(userId) {
  return this.aggregate([
    {
      $match: {
        participants: new mongoose.Types.ObjectId(userId),
        isActive: true
      }
    },
    {
      $group: {
        _id: null,
        totalConversations: { $sum: 1 },
        unreadConversations: {
          $sum: {
            $cond: [
              { $gt: [`$unreadCounts.${userId}`, 0] },
              1,
              0
            ]
          }
        },
        totalUnreadMessages: {
          $sum: `$unreadCounts.${userId}`
        }
      }
    }
  ]);
};

module.exports = mongoose.model('Conversation', conversationSchema);