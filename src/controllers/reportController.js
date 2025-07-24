const Report = require('../models/Report');
const Room = require('../models/Room');
const Post = require('../models/Post');
const catchAsync = require('../utils/catchAsync');
const AppError = require('../utils/appError');
const emailService = require('../services/emailService');

// @desc    Create a new report
// @route   POST /api/reports
// @access  Public
const createReport = catchAsync(async (req, res, next) => {
  const { reportType, message, fullname, phone, email, postId } = req.body;

  // Validate required fields
  if (!reportType || !fullname || !phone || !postId) {
    return next(new AppError('Missing required fields', 400));
  }

  // Check for duplicate reports (same phone + post in last 24 hours)
  const last24Hours = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const existingReport = await Report.findOne({
    phone,
    postId,
    createdAt: { $gte: last24Hours }
  });

  if (existingReport) {
    return next(new AppError('Bạn đã gửi phản ánh về bài đăng này trong 24 giờ qua. Vui lòng chờ xử lý.', 400));
  }

  // Check if post exists (try both Post and Room models)
  let post = await Post.findById(postId).populate('userId');
  let postOwner = null;
  
  if (post) {
    // It's a Post document
    postOwner = post.userId;
  } else {
    // Try Room model for backward compatibility
    post = await Room.findById(postId).populate('accommodationId');
    if (post) {
      postOwner = post.accommodationId?.ownerId;
    }
  }
  
  if (!post) {
    return next(new AppError('Post not found', 404));
  }

  if (!postOwner) {
    return next(new AppError('Post owner not found', 404));
  }

  // Get client IP and User Agent
  const ipAddress = req.ip || req.connection.remoteAddress || req.socket.remoteAddress;
  const userAgent = req.headers['user-agent'];

  // Create report
  const report = await Report.create({
    reportType,
    message: message || '',
    fullname,
    phone,
    email: email || null,
    postId,
    postTitle: post.title || 'Untitled Post',
    postOwner,
    ipAddress,
    userAgent
  });

  // Populate the created report
  const populatedReport = await Report.findById(report._id)
    .populate('postId', 'title description price images')
    .populate('postOwner', 'name email phoneNumber');

  res.status(201).json({
    status: 'success',
    message: 'Report submitted successfully',
    data: {
      report: populatedReport
    }
  });
});

// @desc    Get all reports (Admin only)
// @route   GET /api/reports
// @access  Private/Admin
const getAllReports = catchAsync(async (req, res, next) => {
  const { status, reportType, page = 1, limit = 10 } = req.query;

  // Build filter
  const filter = {};
  if (status) filter.status = status;
  if (reportType) filter.reportType = reportType;

  // Pagination
  const skip = (page - 1) * limit;

  const reports = await Report.find(filter)
    .populate('postId', 'title description price images')
    .populate('postOwner', 'name email phoneNumber')
    .populate('handledBy', 'name email')
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(parseInt(limit));

  const total = await Report.countDocuments(filter);

  res.status(200).json({
    status: 'success',
    results: reports.length,
    pagination: {
      page: parseInt(page),
      limit: parseInt(limit),
      total,
      pages: Math.ceil(total / limit)
    },
    data: {
      reports
    }
  });
});

// @desc    Get report by ID
// @route   GET /api/reports/:id
// @access  Private/Admin
const getReportById = catchAsync(async (req, res, next) => {
  const report = await Report.findById(req.params.id)
    .populate('postId', 'title description price images accommodationId')
    .populate('postOwner', 'name email phoneNumber profileImage')
    .populate('handledBy', 'name email');

  if (!report) {
    return next(new AppError('Report not found', 404));
  }

  res.status(200).json({
    status: 'success',
    data: {
      report
    }
  });
});

// @desc    Update report status
// @route   PATCH /api/reports/:id/status
// @access  Private/Admin
const updateReportStatus = catchAsync(async (req, res, next) => {
  const { status, adminNote } = req.body;
  const adminId = req.user.id; // Assuming admin is authenticated

  if (!['pending', 'reviewing', 'resolved', 'rejected'].includes(status)) {
    return next(new AppError('Invalid status', 400));
  }

  const report = await Report.findById(req.params.id);
  if (!report) {
    return next(new AppError('Report not found', 404));
  }

  // Update report
  report.status = status;
  if (adminNote) report.adminNote = adminNote;
  
  if (status === 'resolved' || status === 'rejected') {
    report.handledBy = adminId;
    report.handledAt = new Date();
  }

  await report.save();

  // Return updated report with populated fields
  const updatedReport = await Report.findById(report._id)
    .populate('postId', 'title description price images')
    .populate('postOwner', 'name email phoneNumber')
    .populate('handledBy', 'name email');

  // 📧 Send email notification if status is resolved or rejected
  if ((status === 'resolved' || status === 'rejected') && report.email) {
    try {
      const emailData = {
        userEmail: report.email,
        userFullname: report.fullname,
        reportId: report._id,
        reportType: report.reportType,
        reportMessage: report.message,
        reportDate: report.createdAt,
        postTitle: updatedReport.postId?.title || 'Bài đăng',
        postUrl: `${process.env.CLIENT_URL}/room/${updatedReport.postId?._id}`,
        status: status,
        adminNote: adminNote
      };
      
      await emailService.sendReportResponseEmail(emailData);
      console.log(`✅ Email notification sent to: ${report.email}`);
      
    } catch (emailError) {
      console.error('❌ Error sending notification email:', emailError);
      // Don't fail the request if email fails
    }
  } else {
    console.log(`📧 Email notification skipped - No email provided for report ${report._id}`);
  }

  res.status(200).json({
    status: 'success',
    message: 'Report status updated successfully',
    data: {
      report: updatedReport
    }
  });
});

// @desc    Get reports for a specific post
// @route   GET /api/reports/post/:postId
// @access  Private/Admin
const getReportsByPost = catchAsync(async (req, res, next) => {
  const { postId } = req.params;

  const reports = await Report.getByPost(postId);

  res.status(200).json({
    status: 'success',
    results: reports.length,
    data: {
      reports
    }
  });
});

// @desc    Get report statistics
// @route   GET /api/reports/stats
// @access  Private/Admin
const getReportStats = catchAsync(async (req, res, next) => {
  const stats = await Report.aggregate([
    {
      $group: {
        _id: '$status',
        count: { $sum: 1 }
      }
    }
  ]);

  const typeStats = await Report.aggregate([
    {
      $group: {
        _id: '$reportType',
        count: { $sum: 1 }
      }
    }
  ]);

  // Get total count
  const totalCount = await Report.countDocuments();

  // Get recent reports count (last 7 days)
  const recentReports = await Report.countDocuments({
    createdAt: {
      $gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
    }
  });

  // Convert stats array to object format
  const statusStats = {};
  stats.forEach(stat => {
    statusStats[stat._id] = stat.count;
  });

  const reportTypeStats = {};
  typeStats.forEach(stat => {
    reportTypeStats[stat._id] = stat.count;
  });

  res.status(200).json({
    status: 'success',
    data: {
      totalCount,
      statusStats: {
        pending: statusStats.pending || 0,
        reviewing: statusStats.reviewing || 0,
        resolved: statusStats.resolved || 0,
        rejected: statusStats.rejected || 0
      },
      typeStats: reportTypeStats,
      recentReports
    }
  });
});

module.exports = {
  createReport,
  getAllReports,
  getReportById,
  updateReportStatus,
  getReportsByPost,
  getReportStats
};
