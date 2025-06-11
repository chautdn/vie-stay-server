const mongoose = require('mongoose');

const messageSchema = new mongoose.Schema({
  conversationId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Conversation',
    required: [true, 'Conversation ID is required']
  },
  senderId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'Sender ID is required']
  },
  receiverId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'Receiver ID is required']
  },
  content: {
    type: String,
    required: [true, 'Message content is required'],
    trim: true,
    maxlength: [5000, 'Message content cannot exceed 5000 characters']
  },
  messageType: {
    type: String,
    required: [true, 'Message type is required'],
    enum: {
      values: ['text', 'image', 'file', 'system'],
      message: 'Message type must be text, image, file, or system'
    },
    default: 'text'
  },
  attachments: [{
    fileName: {
      type: String,
      required: [true, 'File name is required'],
      trim: true,
      maxlength: [255, 'File name cannot exceed 255 characters']
    },
    fileUrl: {
      type: String,
      required: [true, 'File URL is required'],
      match: [/^https?:\/\/.+$/, 'Please provide a valid file URL']
    },
    fileType: {
      type: String,
      required: [true, 'File type is required'],
      enum: {
        values: ['image', 'document', 'video', 'audio'],
        message: 'File type must be image, document, video, or audio'
      }
    },
    fileSize: {
      type: Number,
      min: [0, 'File size cannot be negative'],
      max: [50 * 1024 * 1024, 'File size cannot exceed 50MB'] // 50MB limit
    },
    mimeType: {
      type: String,
      trim: true
    },
    uploadedAt: {
      type: Date,
      default: Date.now
    }
  }],
  isRead: {
    type: Boolean,
    default: false
  },
  readAt: {
    type: Date
  },
  isDelivered: {
    type: Boolean,
    default: false
  },
  deliveredAt: {
    type: Date
  },
  isDeleted: {
    type: Boolean,
    default: false
  },
  deletedAt: {
    type: Date
  },
  deletedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  editHistory: [{
    previousContent: {
      type: String,
      required: true
    },
    editedAt: {
      type: Date,
      default: Date.now
    },
    reason: {
      type: String,
      maxlength: [200, 'Edit reason cannot exceed 200 characters']
    }
  }],
  isEdited: {
    type: Boolean,
    default: false
  },
  lastEditedAt: {
    type: Date
  },
  reactions: [{
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    emoji: {
      type: String,
      required: true,
      enum: {
        values: ['👍', '👎', '❤️', '😂', '😮', '😢', '😡'],
        message: 'Please select a valid emoji reaction'
      }
    },
    createdAt: {
      type: Date,
      default: Date.now
    }
  }],
  metadata: {
    isSystemMessage: {
      type: Boolean,
      default: false
    },
    systemMessageType: {
      type: String,
      enum: {
        values: [
          'rental_request_sent', 'rental_request_accepted', 'rental_request_rejected',
          'tenancy_started', 'tenancy_ended', 'payment_reminder', 'maintenance_request'
        ]
      }
    },
    relatedEntityId: {
      type: mongoose.Schema.Types.ObjectId
    },
    relatedEntityType: {
      type: String,
      enum: {
        values: ['rental_request', 'tenancy_agreement', 'invoice', 'maintenance_request']
      }
    },
    priority: {
      type: String,
      enum: {
        values: ['low', 'normal', 'high', 'urgent'],
        message: 'Priority must be low, normal, high, or urgent'
      },
      default: 'normal'
    }
  },
  reportCount: {
    type: Number,
    min: [0, 'Report count cannot be negative'],
    default: 0
  },
  isReported: {
    type: Boolean,
    default: false
  },
  reportedBy: [{
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    reason: {
      type: String,
      enum: {
        values: ['spam', 'harassment', 'inappropriate', 'fraud', 'other'],
        message: 'Please select a valid report reason'
      }
    },
    reportedAt: {
      type: Date,
      default: Date.now
    }
  }]
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Indexes
messageSchema.index({ conversationId: 1 });
messageSchema.index({ senderId: 1 });
messageSchema.index({ receiverId: 1 });
messageSchema.index({ isRead: 1 });
messageSchema.index({ createdAt: 1 });
messageSchema.index({ isDeleted: 1 });

// Compound indexes
messageSchema.index({ conversationId: 1, createdAt: 1 });
messageSchema.index({ conversationId: 1, isDeleted: 1, createdAt: 1 });
messageSchema.index({ receiverId: 1, isRead: 1 });

// Virtual for sender details
messageSchema.virtual('sender', {
  ref: 'User',
  localField: 'senderId',
  foreignField: '_id',
  justOne: true
});

// Virtual for receiver details
messageSchema.virtual('receiver', {
  ref: 'User',
  localField: 'receiverId',
  foreignField: '_id',
  justOne: true
});

// Virtual for conversation details
messageSchema.virtual('conversation', {
  ref: 'Conversation',
  localField: 'conversationId',
  foreignField: '_id',
  justOne: true
});

// Virtual for message age
messageSchema.virtual('ageInMinutes').get(function() {
  return Math.floor((new Date() - this.createdAt) / (1000 * 60));
});

// Virtual for can edit (within 15 minutes and not read)
messageSchema.virtual('canEdit').get(function() {
  const editWindow = 15 * 60 * 1000; // 15 minutes
  const timeSinceCreation = new Date() - this.createdAt;
  return !this.isRead && timeSinceCreation < editWindow && !this.isDeleted;
});

// Pre-save middleware to update conversation
messageSchema.pre('save', async function(next) {
  if (this.isNew && !this.metadata.isSystemMessage) {
    // Update conversation with last message info
    const Conversation = mongoose.model('Conversation');
    await Conversation.findByIdAndUpdate(this.conversationId, {
      lastMessage: this.content.length > 500 ? this.content.substring(0, 497) + '...' : this.content,
      lastMessageAt: this.createdAt,
      lastMessageBy: this.senderId,
      $inc: {
        [`unreadCounts.${this.receiverId}`]: 1
      }
    });
  }
  next();
});

// Instance method to mark as read
messageSchema.methods.markAsRead = async function() {
  if (!this.isRead) {
    this.isRead = true;
    this.readAt = new Date();
    
    // Update conversation unread count
    const Conversation = mongoose.model('Conversation');
    await Conversation.findByIdAndUpdate(this.conversationId, {
      $inc: {
        [`unreadCounts.${this.receiverId}`]: -1
      }
    });
    
    return this.save({ validateBeforeSave: false });
  }
  return this;
};

// Instance method to mark as delivered
messageSchema.methods.markAsDelivered = function() {
  if (!this.isDelivered) {
    this.isDelivered = true;
    this.deliveredAt = new Date();
    return this.save({ validateBeforeSave: false });
  }
  return Promise.resolve(this);
};

// Instance method to edit message
messageSchema.methods.editMessage = function(newContent, reason = null) {
  if (!this.canEdit) {
    throw new Error('Message can no longer be edited');
  }
  
  // Store edit history
  this.editHistory.push({
    previousContent: this.content,
    reason: reason
  });
  
  this.content = newContent;
  this.isEdited = true;
  this.lastEditedAt = new Date();
  
  return this.save();
};

// Instance method to delete message
messageSchema.methods.deleteMessage = function(userId) {
  this.isDeleted = true;
  this.deletedAt = new Date();
  this.deletedBy = userId;
  this.content = 'This message has been deleted';
  return this.save();
};

// Instance method to add reaction
messageSchema.methods.addReaction = function(userId, emoji) {
  // Remove existing reaction from this user
  this.reactions = this.reactions.filter(
    reaction => reaction.userId.toString() !== userId.toString()
  );
  
  // Add new reaction
  this.reactions.push({ userId, emoji });
  
  return this.save({ validateBeforeSave: false });
};

// Instance method to remove reaction
messageSchema.methods.removeReaction = function(userId) {
  this.reactions = this.reactions.filter(
    reaction => reaction.userId.toString() !== userId.toString()
  );
  
  return this.save({ validateBeforeSave: false });
};

// Instance method to report message
messageSchema.methods.reportMessage = function(userId, reason) {
  // Check if user already reported this message
  const alreadyReported = this.reportedBy.some(
    report => report.userId.toString() === userId.toString()
  );
  
  if (!alreadyReported) {
    this.reportedBy.push({ userId, reason });
    this.reportCount += 1;
    
    if (this.reportCount >= 3) {
      this.isReported = true;
    }
  }
  
  return this.save();
};

// Static method to find messages in conversation
messageSchema.statics.findByConversation = function(conversationId, page = 1, limit = 50) {
  const skip = (page - 1) * limit;
  
  return this.find({
    conversationId,
    isDeleted: false
  })
  .sort({ createdAt: -1 })
  .skip(skip)
  .limit(limit)
  .populate('senderId', 'firstName lastName profileImage')
  .populate('receiverId', 'firstName lastName profileImage');
};

// Static method to find unread messages for user
messageSchema.statics.findUnreadForUser = function(userId) {
  return this.find({
    receiverId: userId,
    isRead: false,
    isDeleted: false
  }).sort({ createdAt: -1 });
};

// Static method to mark all messages as read in conversation
messageSchema.statics.markAllAsReadInConversation = async function(conversationId, userId) {
  const result = await this.updateMany({
    conversationId,
    receiverId: userId,
    isRead: false,
    isDeleted: false
  }, {
    $set: {
      isRead: true,
      readAt: new Date()
    }
  });
  
  // Update conversation unread count
  if (result.modifiedCount > 0) {
    const Conversation = mongoose.model('Conversation');
    await Conversation.findByIdAndUpdate(conversationId, {
      $set: {
        [`unreadCounts.${userId}`]: 0
      }
    });
  }
  
  return result;
};

// Static method to find reported messages
messageSchema.statics.findReported = function() {
  return this.find({
    $or: [
      { isReported: true },
      { reportCount: { $gte: 3 } }
    ]
  }).sort({ reportCount: -1, createdAt: -1 });
};

// Static method to find messages with attachments
messageSchema.statics.findWithAttachments = function(conversationId = null) {
  const query = {
    attachments: { $exists: true, $not: { $size: 0 } },
    isDeleted: false
  };
  
  if (conversationId) {
    query.conversationId = conversationId;
  }
  
  return this.find(query).sort({ createdAt: -1 });
};

// Static method to create system message
messageSchema.statics.createSystemMessage = function(conversationId, senderId, receiverId, content, systemMessageType, relatedEntityId = null, relatedEntityType = null) {
  return this.create({
    conversationId,
    senderId,
    receiverId,
    content,
    messageType: 'system',
    metadata: {
      isSystemMessage: true,
      systemMessageType,
      relatedEntityId,
      relatedEntityType
    }
  });
};

// Static method to get message statistics for conversation
messageSchema.statics.getConversationStats = function(conversationId) {
  return this.aggregate([
    {
      $match: {
        conversationId: new mongoose.Types.ObjectId(conversationId),
        isDeleted: false
      }
    },
    {
      $group: {
        _id: null,
        totalMessages: { $sum: 1 },
        unreadMessages: {
          $sum: { $cond: ['$isRead', 0, 1] }
        },
        messagesWithAttachments: {
          $sum: {
            $cond: [
              { $gt: [{ $size: { $ifNull: ['$attachments', []] } }, 0] },
              1,
              0
            ]
          }
        },
        averageMessageLength: { $avg: { $strLenCP: '$content' } }
      }
    }
  ]);
};

// Static method to search messages
messageSchema.statics.searchMessages = function(query, userId = null) {
  const searchQuery = {
    content: { $regex: query, $options: 'i' },
    isDeleted: false,
    messageType: { $ne: 'system' }
  };
  
  if (userId) {
    searchQuery.$or = [
      { senderId: userId },
      { receiverId: userId }
    ];
  }
  
  return this.find(searchQuery)
    .sort({ createdAt: -1 })
    .populate('conversationId', 'participants')
    .populate('senderId', 'firstName lastName profileImage')
    .populate('receiverId', 'firstName lastName profileImage');
};

module.exports = mongoose.model('Message', messageSchema);