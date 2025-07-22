const mongoose = require('mongoose');

const reportSchema = new mongoose.Schema({
  // Thông tin phản ánh
  reportType: {
    type: String,
    required: [true, 'Report type is required'],
    enum: ['scam', 'duplicate', 'cant_contact', 'fake', 'other'],
    default: 'scam'
  },
  
  message: {
    type: String,
    trim: true,
    maxlength: [1000, 'Message cannot exceed 1000 characters']
  },

  // Thông tin người phản ánh
  fullname: {
    type: String,
    required: [true, 'Full name is required'],
    trim: true,
    maxlength: [100, 'Full name cannot exceed 100 characters']
  },

  phone: {
    type: String,
    required: [true, 'Phone number is required'],
    trim: true,
    match: [/^[0-9]{10,11}$/, 'Please provide a valid phone number']
  },

  // Email để nhận phản hồi (optional)
  email: {
    type: String,
    trim: true,
    lowercase: true,
    match: [/^[^\s@]+@[^\s@]+\.[^\s@]+$/, 'Please provide a valid email'],
    sparse: true // Allow null values but ensure unique if provided
  },

  // Thông tin bài đăng bị phản ánh
  postId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Room',
    required: [true, 'Post ID is required']
  },

  postTitle: {
    type: String,
    required: [true, 'Post title is required'],
    trim: true
  },

  postOwner: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'Post owner is required']
  },

  // Trạng thái xử lý
  status: {
    type: String,
    enum: ['pending', 'reviewing', 'resolved', 'rejected'],
    default: 'pending'
  },

  // Ghi chú của admin khi xử lý
  adminNote: {
    type: String,
    trim: true,
    maxlength: [500, 'Admin note cannot exceed 500 characters']
  },

  // Admin xử lý
  handledBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },

  // Thời gian xử lý
  handledAt: {
    type: Date
  },

  // Metadata
  ipAddress: {
    type: String,
    trim: true
  },

  userAgent: {
    type: String,
    trim: true
  }

}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Indexes for performance
reportSchema.index({ postId: 1 });
reportSchema.index({ postOwner: 1 });
reportSchema.index({ status: 1 });
reportSchema.index({ createdAt: -1 });
reportSchema.index({ reportType: 1 });

// Virtual for report age
reportSchema.virtual('reportAge').get(function() {
  return Math.floor((Date.now() - this.createdAt) / (1000 * 60 * 60 * 24)); // days
});

// Method to mark as resolved
reportSchema.methods.markAsResolved = function(adminId, note) {
  this.status = 'resolved';
  this.handledBy = adminId;
  this.handledAt = new Date();
  if (note) this.adminNote = note;
  return this.save();
};

// Method to mark as rejected
reportSchema.methods.markAsRejected = function(adminId, note) {
  this.status = 'rejected';
  this.handledBy = adminId;
  this.handledAt = new Date();
  if (note) this.adminNote = note;
  return this.save();
};

// Static method to get reports by status
reportSchema.statics.getByStatus = function(status) {
  return this.find({ status })
    .populate('postId', 'title description price images')
    .populate('postOwner', 'name email phoneNumber')
    .populate('handledBy', 'name email')
    .sort({ createdAt: -1 });
};

// Static method to get reports for a specific post
reportSchema.statics.getByPost = function(postId) {
  return this.find({ postId })
    .populate('handledBy', 'name email')
    .sort({ createdAt: -1 });
};

const Report = mongoose.model('Report', reportSchema);
module.exports = Report;
