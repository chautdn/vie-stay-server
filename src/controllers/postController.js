const Post = require("../models/Post");
const User = require("../models/User");
const Transaction = require("../models/Transaction");
const multer = require("multer");
const cloudinary = require("../config/cloudinary");

const storage = multer.memoryStorage();
const upload = multer({
  storage,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB per file
  },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith("image/")) {
      cb(null, true);
    } else {
      cb(new Error("Only image files are allowed"), false);
    }
  },
});

const uploadToCloudinary = (buffer, filename) => {
  return new Promise((resolve, reject) => {
    cloudinary.uploader
      .upload_stream(
        {
          folder: "rental-posts",
          public_id: `${Date.now()}-${filename}`,
          resource_type: "image",
          transformation: [
            { width: 1200, height: 800, crop: "limit" },
            { quality: "auto:good" },
          ],
        },
        (error, result) => {
          if (error) {
            reject(error);
          } else {
            resolve(result);
          }
        }
      )
      .end(buffer);
  });
};

// Create a new post
const createPost = async (req, res) => {
  try {
    const userId = req.user._id;
    let postData;

    // Handle both JSON and multipart requests
    if (req.is('multipart/form-data')) {
      // Multipart form data (with images)
      const {
        title,
        description,
        propertyType,
        area,
        capacity,
        hasPrivateBathroom,
        furnishingLevel,
        rent,
        deposit,
        electricityCost,
        waterCost,
        internetCost,
        street,
        ward,
        district,
        amenities,
        contactName,
        contactPhone,
        contactEmail,
        allowNegotiation,
        preferredTenantGender,
        availableFrom,
        roomId,
        accommodationId,
      } = req.body;

      // Parse amenities if it's a string
      let parsedAmenities = [];
      if (amenities) {
        try {
          parsedAmenities = typeof amenities === 'string' ? JSON.parse(amenities) : amenities;
        } catch (e) {
          parsedAmenities = Array.isArray(amenities) ? amenities : [amenities];
        }
      }

      postData = {
        userId,
        roomId: roomId || undefined,
        accommodationId: accommodationId || undefined,
        title,
        description,
        propertyType,
        area: area ? Number(area) : undefined,
        capacity: Number(capacity),
        hasPrivateBathroom: hasPrivateBathroom === 'true',
        furnishingLevel,
        rent: Number(rent),
        deposit: deposit ? Number(deposit) : 0,
        electricityCost: electricityCost ? Number(electricityCost) : undefined,
        waterCost: waterCost ? Number(waterCost) : undefined,
        internetCost: internetCost ? Number(internetCost) : undefined,
        address: {
          street,
          ward,
          district,
        },
        amenities: parsedAmenities,
        contactName,
        contactPhone,
        contactEmail,
        allowNegotiation: allowNegotiation !== 'false',
        preferredTenantGender: preferredTenantGender || 'any',
        availableFrom: availableFrom || new Date(),
        status: 'pending',
      };
    } else {
      // JSON request
      postData = {
        userId,
        ...req.body,
        address: {
          street: req.body.street,
          ward: req.body.ward,
          district: req.body.district,
        },
        status: 'pending',
      };
      
      // Remove individual address fields from top level
      delete postData.street;
      delete postData.ward;
      delete postData.district;
    }

    // Upload images if provided
    let imageUrls = [];
    if (req.files && req.files.length > 0) {
      try {
        const uploadPromises = req.files.map((file, index) => {
          const filename = `post-${userId}-${Date.now()}-${index}`;
          return uploadToCloudinary(file.buffer, filename);
        });
        
        const uploadResults = await Promise.all(uploadPromises);
        imageUrls = uploadResults.map(result => result.secure_url);
        postData.images = imageUrls;
      } catch (uploadError) {
        return res.status(500).json({
          message: "Error uploading images",
          error: uploadError.message,
        });
      }
    }

    const post = await Post.create(postData);
    await post.populate('userId', 'name profileImage');

    res.status(201).json({
      message: "Post created successfully",
      post,
    });
  } catch (error) {
    res.status(500).json({
      message: "Server error",
      error: error.message,
    });
  }
};

// Get all posts (with filters)
const getPosts = async (req, res) => {
  try {
    const {
      district,
      propertyType,
      minRent,
      maxRent,
      amenities,
      hasPrivateBathroom,
      furnishingLevel,
      preferredTenantGender,
      page = 1,
      limit = 20,
      featured = false,
    } = req.query;

    let query = {
      status: "approved",
      isAvailable: true,
    };

    // Apply filters
    if (district) query["address.district"] = district;
    if (propertyType) query.propertyType = propertyType;
    if (hasPrivateBathroom !== undefined) query.hasPrivateBathroom = hasPrivateBathroom === 'true';
    if (furnishingLevel) query.furnishingLevel = furnishingLevel;
    if (preferredTenantGender && preferredTenantGender !== 'any') query.preferredTenantGender = { $in: [preferredTenantGender, 'any'] };

    if (minRent || maxRent) {
      query.rent = {};
      if (minRent) query.rent.$gte = Number(minRent);
      if (maxRent) query.rent.$lte = Number(maxRent);
    }

    if (amenities) {
      const amenitiesArray = Array.isArray(amenities) ? amenities : [amenities];
      query.amenities = { $in: amenitiesArray };
    }

    // Featured filter
    if (featured === 'true') {
      query.featuredType = { $ne: "THUONG" };
      query.isPaid = true;
      query.featuredEndDate = { $gt: new Date() };
    } else if (featured === 'false') {
      query.featuredType = "THUONG";
    }

    const skip = (Number(page) - 1) * Number(limit);

    const posts = await Post.find(query)
      .populate('userId', 'name profileImage phoneNumber')
      .populate('roomId', 'name roomNumber')
      .populate('accommodationId', 'name type')
      .sort({
        featuredType: 1, // Featured posts first
        createdAt: -1,   // Newest first
      })
      .skip(skip)
      .limit(Number(limit));

    const total = await Post.countDocuments(query);

    res.status(200).json({
      posts,
      pagination: {
        currentPage: Number(page),
        totalPages: Math.ceil(total / Number(limit)),
        totalPosts: total,
        hasNext: skip + posts.length < total,
        hasPrev: Number(page) > 1,
      },
    });
  } catch (error) {
    res.status(500).json({
      message: "Server error",
      error: error.message,
    });
  }
};

// Get featured posts
const getFeaturedPosts = async (req, res) => {
  try {
    const { limit = 20 } = req.query;

    const posts = await Post.getFeatured()
      .populate('userId', 'name profileImage')
      .limit(Number(limit));

    res.status(200).json({ posts });
  } catch (error) {
    res.status(500).json({
      message: "Server error",
      error: error.message,
    });
  }
};

// Get post by ID
const getPostById = async (req, res) => {
  try {
    const { postId } = req.params;

    const post = await Post.findById(postId)
      .populate('userId', 'name profileImage phoneNumber email')
      .populate('roomId', 'name roomNumber capacity')
      .populate('accommodationId', 'name type address');

    if (!post) {
      return res.status(404).json({ message: "Post not found" });
    }

    // Increment view count
    post.viewCount += 1;
    await post.save();

    res.status(200).json({ post });
  } catch (error) {
    res.status(500).json({
      message: "Server error",
      error: error.message,
    });
  }
};

// Get user's posts
const getUserPosts = async (req, res) => {
  try {
    const userId = req.user._id;
    const { status, page = 1, limit = 10 } = req.query;

    let query = { userId };
    if (status) query.status = status;

    const skip = (Number(page) - 1) * Number(limit);

    const posts = await Post.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(Number(limit));

    const total = await Post.countDocuments(query);

    res.status(200).json({
      posts,
      pagination: {
        currentPage: Number(page),
        totalPages: Math.ceil(total / Number(limit)),
        totalPosts: total,
      },
    });
  } catch (error) {
    res.status(500).json({
      message: "Server error",
      error: error.message,
    });
  }
};

// Update post
const updatePost = async (req, res) => {
  try {
    const { postId } = req.params;
    const userId = req.user._id;
    const updateData = req.body;

    const post = await Post.findById(postId);
    if (!post) {
      return res.status(404).json({ message: "Post not found" });
    }

    // Check ownership
    if (post.userId.toString() !== userId.toString()) {
      return res.status(403).json({ message: "Not authorized to update this post" });
    }

    // Handle image uploads if provided
    if (req.files && req.files.length > 0) {
      try {
        const uploadPromises = req.files.map((file, index) => {
          const filename = `post-${userId}-${Date.now()}-${index}`;
          return uploadToCloudinary(file.buffer, filename);
        });
        
        const uploadResults = await Promise.all(uploadPromises);
        const newImageUrls = uploadResults.map(result => result.secure_url);
        
        updateData.images = [...(post.images || []), ...newImageUrls];
      } catch (uploadError) {
        return res.status(500).json({
          message: "Error uploading images",
          error: uploadError.message,
        });
      }
    }

    // Parse amenities if provided
    if (updateData.amenities) {
      try {
        updateData.amenities = typeof updateData.amenities === 'string' ? 
          JSON.parse(updateData.amenities) : updateData.amenities;
      } catch (e) {
        updateData.amenities = Array.isArray(updateData.amenities) ? 
          updateData.amenities : [updateData.amenities];
      }
    }

    // Update address if provided
    if (updateData.street || updateData.ward || updateData.district) {
      updateData.address = {
        ...post.address,
        ...(updateData.street && { street: updateData.street }),
        ...(updateData.ward && { ward: updateData.ward }),
        ...(updateData.district && { district: updateData.district }),
      };
      delete updateData.street;
      delete updateData.ward;
      delete updateData.district;
    }

    const updatedPost = await Post.findByIdAndUpdate(
      postId,
      updateData,
      { new: true, runValidators: true }
    ).populate('userId', 'name profileImage');

    res.status(200).json({
      message: "Post updated successfully",
      post: updatedPost,
    });
  } catch (error) {
    res.status(500).json({
      message: "Server error",
      error: error.message,
    });
  }
};

// Delete post
const deletePost = async (req, res) => {
  try {
    const { postId } = req.params;
    const userId = req.user._id;

    const post = await Post.findById(postId);
    if (!post) {
      return res.status(404).json({ message: "Post not found" });
    }

    // Check ownership
    if (post.userId.toString() !== userId.toString()) {
      return res.status(403).json({ message: "Not authorized to delete this post" });
    }

    await Post.findByIdAndDelete(postId);

    res.status(200).json({ message: "Post deleted successfully" });
  } catch (error) {
    res.status(500).json({
      message: "Server error",
      error: error.message,
    });
  }
};

// Upgrade post to featured
const upgradeToFeatured = async (req, res) => {
  try {
    const { postId } = req.params;
    const { featuredType, duration, autoRenew = false, autoRenewDuration = 7 } = req.body;
    const userId = req.user._id;

    const post = await Post.findById(postId);
    if (!post) {
      return res.status(404).json({ message: "Post not found" });
    }

    // Check ownership
    if (post.userId.toString() !== userId.toString()) {
      return res.status(403).json({ message: "Not authorized to upgrade this post" });
    }

    // Calculate cost
    const cost = post.calculateCost(featuredType, duration);

    // Get user's wallet balance
    const user = await User.findById(userId);
    if (user.wallet.balance < cost) {
      return res.status(400).json({
        message: "Insufficient wallet balance",
        required: cost,
        available: user.wallet.balance,
      });
    }

    // Deduct from wallet
    user.wallet.balance -= cost;
    await user.save();

    // Create transaction record
    const transaction = await Transaction.create({
      user: userId, // Changed from 'userId' to 'user'
      type: "payment", // Changed from 'featured_upgrade' to 'payment'
      amount: cost,
      status: "success", // Changed from 'completed' to 'success'
      provider: "wallet",
      message: `Upgrade post to ${featuredType} for ${duration} days`,
    });

    // Upgrade post
    await post.upgradeFeatured(featuredType, duration);
    
    // Set auto-renewal if requested
    if (autoRenew) {
      post.autoRenew = true;
      post.autoRenewDuration = autoRenewDuration;
      await post.save();
    }

    res.status(200).json({
      message: "Post upgraded to featured successfully",
      cost,
      newBalance: user.wallet.balance,
      featuredUntil: post.featuredEndDate,
      transactionId: transaction._id,
    });
  } catch (error) {
    res.status(500).json({
      message: "Server error",
      error: error.message,
    });
  }
};

// Extend featured post
const extendFeatured = async (req, res) => {
  try {
    const { postId } = req.params;
    const { additionalDays } = req.body;
    const userId = req.user._id;

    const post = await Post.findById(postId);
    if (!post) {
      return res.status(404).json({ message: "Post not found" });
    }

    // Check ownership
    if (post.userId.toString() !== userId.toString()) {
      return res.status(403).json({ message: "Not authorized to extend this post" });
    }

    if (post.featuredType === "THUONG") {
      return res.status(400).json({ message: "Cannot extend regular posts" });
    }

    // Calculate cost
    const cost = post.calculateCost(post.featuredType, additionalDays);

    // Get user's wallet balance
    const user = await User.findById(userId);
    if (user.wallet.balance < cost) {
      return res.status(400).json({
        message: "Insufficient wallet balance",
        required: cost,
        available: user.wallet.balance,
      });
    }

    // Deduct from wallet
    user.wallet.balance -= cost;
    await user.save();

    // Create transaction record
    const transaction = await Transaction.create({
      user: userId, // Changed from 'userId' to 'user'
      type: "payment", // Changed from 'featured_extension' to 'payment'
      amount: cost,
      status: "success", // Changed from 'completed' to 'success'
      provider: "wallet",
      message: `Extend ${post.featuredType} featured post for ${additionalDays} days`,
    });

    // Extend post
    await post.extendFeatured(additionalDays);

    res.status(200).json({
      message: "Post extended successfully",
      cost,
      newBalance: user.wallet.balance,
      featuredUntil: post.featuredEndDate,
      transactionId: transaction._id,
    });
  } catch (error) {
    res.status(500).json({
      message: "Server error",
      error: error.message,
    });
  }
};

// Toggle auto-renewal
const toggleAutoRenewal = async (req, res) => {
  try {
    const { postId } = req.params;
    const { autoRenew, autoRenewDuration = 7 } = req.body;
    const userId = req.user._id;

    const post = await Post.findById(postId);
    if (!post) {
      return res.status(404).json({ message: "Post not found" });
    }

    // Check ownership
    if (post.userId.toString() !== userId.toString()) {
      return res.status(403).json({ message: "Not authorized to modify this post" });
    }

    post.autoRenew = autoRenew;
    if (autoRenew) {
      post.autoRenewDuration = autoRenewDuration;
    }
    await post.save();

    res.status(200).json({
      message: `Auto-renewal ${autoRenew ? 'enabled' : 'disabled'}`,
      autoRenew: post.autoRenew,
      autoRenewDuration: post.autoRenewDuration,
    });
  } catch (error) {
    res.status(500).json({
      message: "Server error",
      error: error.message,
    });
  }
};

// Increment contact count
const incrementContactCount = async (req, res) => {
  try {
    const { postId } = req.params;

    const post = await Post.findByIdAndUpdate(
      postId,
      { $inc: { contactCount: 1 } },
      { new: true }
    );

    if (!post) {
      return res.status(404).json({ message: "Post not found" });
    }

    res.status(200).json({ message: "Contact count incremented" });
  } catch (error) {
    res.status(500).json({
      message: "Server error",
      error: error.message,
    });
  }
};

module.exports = {
  createPost: [upload.array('images', 10), createPost],
  getPosts,
  getFeaturedPosts,
  getPostById,
  getUserPosts,
  updatePost: [upload.array('images', 10), updatePost],
  deletePost,
  upgradeToFeatured,
  extendFeatured,
  toggleAutoRenewal,
  incrementContactCount,
};