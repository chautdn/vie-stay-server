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
    try {
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
              console.error("Cloudinary upload error:", error);
              reject(new Error(`Cloudinary upload failed: ${error.message}`));
            } else {
              resolve(result);
            }
          }
        )
        .end(buffer);
    } catch (error) {
      console.error("Cloudinary upload stream error:", error);
      reject(new Error(`Cloudinary stream error: ${error.message}`));
    }
  });
};

// Helper function to determine post status based on plan
const getPostStatus = (selectedPlan, isPaid) => {
  // VIP posts that are paid get automatic approval
  if (selectedPlan !== 'THUONG' && isPaid) {
    return 'approved';
  }
  
  // Free posts (THUONG) require manual approval
  return 'pending';
};

// Create a new post
const createPost = async (req, res) => {
  try {
    const userId = req.user._id;
    let postData;

    console.log("Creating post for user:", userId);
    console.log("Request body:", req.body);
    console.log("Files received:", req.files ? req.files.length : 0);

    // Handle both JSON and multipart requests
    if (req.is("multipart/form-data") || req.files) {
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
          parsedAmenities =
            typeof amenities === "string" ? JSON.parse(amenities) : amenities;
        } catch (e) {
          console.warn("Failed to parse amenities:", e);
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
        hasPrivateBathroom: hasPrivateBathroom === "true",
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
        allowNegotiation: allowNegotiation !== "false",
        preferredTenantGender: preferredTenantGender || "any",
        availableFrom: availableFrom || new Date(),
        status: "pending", // Will be updated based on plan
        featuredType: "THUONG",
        isPaid: false,
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
        status: "pending", // Will be updated based on plan
        featuredType: "THUONG",
        isPaid: false,
      };

      // Remove individual address fields from top level
      delete postData.street;
      delete postData.ward;
      delete postData.district;
    }

    // Upload images if provided
    let imageUrls = [];
    if (req.files && req.files.length > 0) {
      console.log("Starting image upload process...");

      try {
        // Check if cloudinary is properly configured
        if (!cloudinary || !cloudinary.uploader) {
          throw new Error("Cloudinary is not properly configured");
        }

        const uploadPromises = req.files.map(async (file, index) => {
          console.log(`Uploading image ${index + 1}/${req.files.length}`);
          const filename = `post-${userId}-${Date.now()}-${index}`;

          try {
            const result = await uploadToCloudinary(file.buffer, filename);
            console.log(
              `Image ${index + 1} uploaded successfully:`,
              result.secure_url
            );
            return result;
          } catch (uploadError) {
            console.error(`Failed to upload image ${index + 1}:`, uploadError);
            throw uploadError;
          }
        });

        const uploadResults = await Promise.all(uploadPromises);
        imageUrls = uploadResults.map((result) => result.secure_url);
        postData.images = imageUrls;

        console.log("All images uploaded successfully:", imageUrls);
      } catch (uploadError) {
        console.error("Image upload error:", uploadError);
        return res.status(500).json({
          message: "Error uploading images",
          error: uploadError.message,
          details: "Please check your Cloudinary configuration and try again",
        });
      }
    } else {
      console.log("No images to upload");
    }

    // Set status for free posts (manual approval required)
    postData.status = getPostStatus('THUONG', false);

    console.log("Creating post with data:", postData);

    const post = await Post.create(postData);
    await post.populate("userId", "name profileImage");

    console.log("Post created successfully:", post._id);

    res.status(201).json({
      message: post.status === 'approved' 
        ? "Post created and approved automatically" 
        : "Post created successfully and is pending approval",
      post,
      requiresApproval: post.status === 'pending'
    });
  } catch (error) {
    console.error("Error creating post:", error);
    res.status(500).json({
      message: "Server error",
      error: error.message,
      stack: process.env.NODE_ENV === "development" ? error.stack : undefined,
    });
  }
};

// Create post with plan selection (new endpoint for integrated flow)
const createPostWithPlan = async (req, res) => {
  try {
    const userId = req.user._id;
    const {
      postData,
      selectedPlan,
      duration = 7,
      autoRenew = false,
      autoRenewDuration = 7
    } = req.body;

    console.log("Creating post with plan for user:", userId);
    console.log("Selected plan:", selectedPlan);

    // Validate required fields
    if (!postData || !selectedPlan) {
      return res.status(400).json({
        message: "Post data and plan selection are required"
      });
    }

    // Determine if this will be a paid post
    const willBePaid = selectedPlan !== 'THUONG';
    
    // If it's a VIP plan, check wallet balance first
    if (willBePaid) {
      const cost = calculateCost(selectedPlan, duration);
      const user = await User.findById(userId);
      
      if (user.wallet.balance < cost) {
        return res.status(400).json({
          message: "Insufficient wallet balance",
          required: cost,
          available: user.wallet.balance,
        });
      }
    }

    // Prepare post creation data with automatic approval for VIP posts
    const createData = {
      userId,
      ...postData,
      address: {
        street: postData.street,
        ward: postData.ward,
        district: postData.district,
      },
      status: getPostStatus(selectedPlan, willBePaid), // Auto-approve VIP posts
      featuredType: "THUONG", // Start as regular, will upgrade if needed
      isPaid: false,
    };

    // Remove individual address fields
    delete createData.street;
    delete createData.ward;
    delete createData.district;

    console.log("Creating post with data:", createData);

    // Create the post
    const post = await Post.create(createData);
    await post.populate("userId", "name profileImage");

    // If VIP plan selected, upgrade immediately
    if (willBePaid) {
      const cost = calculateCost(selectedPlan, duration);
      const user = await User.findById(userId);

      // Deduct from wallet
      user.wallet.balance -= cost;
      await user.save();

      // Create transaction record
      const transaction = await Transaction.create({
        user: userId,
        type: "payment",
        amount: cost,
        status: "success",
        provider: "wallet",
        message: `Create ${selectedPlan} post for ${duration} days`,
      });

      // Upgrade post (this will set isPaid to true and update status to approved)
      await post.upgradeFeatured(selectedPlan, duration);

      // Set auto-renewal if requested
      if (autoRenew) {
        post.autoRenew = true;
        post.autoRenewDuration = autoRenewDuration;
        await post.save();
      }

      console.log("VIP post created and auto-approved:", post._id);

      return res.status(201).json({
        message: "VIP post created and approved automatically",
        post,
        cost,
        newBalance: user.wallet.balance,
        transactionId: transaction._id,
        autoApproved: true,
      });
    } else {
      console.log("Free post created, pending approval:", post._id);

      return res.status(201).json({
        message: "Free post created successfully and is pending approval",
        post,
        cost: 0,
        requiresApproval: true,
      });
    }
  } catch (error) {
    console.error("Error creating post with plan:", error);
    res.status(500).json({
      message: "Server error",
      error: error.message,
      stack: process.env.NODE_ENV === "development" ? error.stack : undefined,
    });
  }
};

// Helper function to calculate cost
const calculateCost = (plan, days) => {
  const FEATURED_TYPES = {
    VIP_NOI_BAT: { 
      dailyPrice: 50000, 
      weeklyPrice: 315000, 
      monthlyPrice: 1500000, 
    },
    VIP_1: { 
      dailyPrice: 30000, 
      weeklyPrice: 190000, 
      monthlyPrice: 1200000, 
    },
    VIP_2: { 
      dailyPrice: 20000, 
      weeklyPrice: 133000, 
      monthlyPrice: 900000, 
    },
    VIP_3: { 
      dailyPrice: 10000, 
      weeklyPrice: 63000, 
      monthlyPrice: 800000, 
    },
    THUONG: { 
      dailyPrice: 0, 
      weeklyPrice: 0, 
      monthlyPrice: 0, 
    }
  };

  const pricing = FEATURED_TYPES[plan];
  if (!pricing || plan === 'THUONG') return 0;
  
  if (days >= 30) {
    return Math.ceil(days / 30) * pricing.monthlyPrice;
  } else if (days >= 7) {
    return Math.ceil(days / 7) * pricing.weeklyPrice;
  } else {
    return days * pricing.dailyPrice;
  }
};

// Get all posts (with filters) - Updated to handle auto-approved posts
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
      status: "approved", // Only show approved posts (both manual and auto-approved)
      isAvailable: true,
    };

    // Apply filters
    if (district) query["address.district"] = district;
    if (propertyType) query.propertyType = propertyType;
    if (hasPrivateBathroom !== undefined)
      query.hasPrivateBathroom = hasPrivateBathroom === "true";
    if (furnishingLevel) query.furnishingLevel = furnishingLevel;
    if (preferredTenantGender && preferredTenantGender !== "any")
      query.preferredTenantGender = { $in: [preferredTenantGender, "any"] };

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
    if (featured === "true") {
      query.featuredType = { $ne: "THUONG" };
      query.isPaid = true;
      query.featuredEndDate = { $gt: new Date() };
    } else if (featured === "false") {
      query.featuredType = "THUONG";
    }

    const skip = (Number(page) - 1) * Number(limit);

    const posts = await Post.find(query)
      .populate("userId", "name profileImage phoneNumber")
      .populate("roomId", "name roomNumber")
      .populate("accommodationId", "name type")
      .sort({
        featuredType: 1, // Featured posts first
        createdAt: -1, // Newest first
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

// Upgrade post to featured - Updated with auto-approval
const upgradeToFeatured = async (req, res) => {
  try {
    const { postId } = req.params;
    const {
      featuredType,
      duration,
      autoRenew = false,
      autoRenewDuration = 7,
    } = req.body;
    const userId = req.user._id;

    const post = await Post.findById(postId);
    if (!post) {
      return res.status(404).json({ message: "Post not found" });
    }

    // Check ownership
    if (post.userId.toString() !== userId.toString()) {
      return res
        .status(403)
        .json({ message: "Not authorized to upgrade this post" });
    }

    // Calculate cost
    const cost = calculateCost(featuredType, duration);

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
      user: userId,
      type: "payment",
      amount: cost,
      status: "success",
      provider: "wallet",
      message: `Upgrade post to ${featuredType} for ${duration} days`,
    });

    // Store previous status for message
    const wasApproved = post.status === 'approved';

    // Upgrade post (this will auto-approve if it was pending)
    await post.upgradeFeatured(featuredType, duration);

    // Set auto-renewal if requested
    if (autoRenew) {
      post.autoRenew = true;
      post.autoRenewDuration = autoRenewDuration;
      await post.save();
    }

    const message = wasApproved 
      ? "Post upgraded to featured successfully"
      : "Post upgraded to featured and approved automatically";

    res.status(200).json({
      message,
      cost,
      newBalance: user.wallet.balance,
      featuredUntil: post.featuredEndDate,
      transactionId: transaction._id,
      autoApproved: !wasApproved,
    });
  } catch (error) {
    res.status(500).json({
      message: "Server error",
      error: error.message,
    });
  }
};

// Rest of the controller methods remain the same...
// [Include all other existing methods: getUserPosts, updatePost, deletePost, etc.]

module.exports = {
  createPost: [upload.array("images", 10), createPost],
  createPostWithPlan, // New endpoint for integrated flow
  getPosts,
  getUserPosts: async (req, res) => {
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
  },
  updatePost: [upload.array("images", 10), async (req, res) => {
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
        return res
          .status(403)
          .json({ message: "Not authorized to update this post" });
      }

      // Handle image uploads if provided
      if (req.files && req.files.length > 0) {
        try {
          const uploadPromises = req.files.map((file, index) => {
            const filename = `post-${userId}-${Date.now()}-${index}`;
            return uploadToCloudinary(file.buffer, filename);
          });

          const uploadResults = await Promise.all(uploadPromises);
          const newImageUrls = uploadResults.map((result) => result.secure_url);

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
          updateData.amenities =
            typeof updateData.amenities === "string"
              ? JSON.parse(updateData.amenities)
              : updateData.amenities;
        } catch (e) {
          updateData.amenities = Array.isArray(updateData.amenities)
            ? updateData.amenities
            : [updateData.amenities];
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

      const updatedPost = await Post.findByIdAndUpdate(postId, updateData, {
        new: true,
        runValidators: true,
      }).populate("userId", "name profileImage");

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
  }],
  deletePost: async (req, res) => {
    try {
      const { postId } = req.params;
      const userId = req.user._id;

      const post = await Post.findById(postId);
      if (!post) {
        return res.status(404).json({ message: "Post not found" });
      }

      // Check ownership
      if (post.userId.toString() !== userId.toString()) {
        return res
          .status(403)
          .json({ message: "Not authorized to delete this post" });
      }

      await Post.findByIdAndDelete(postId);

      res.status(200).json({ message: "Post deleted successfully" });
    } catch (error) {
      res.status(500).json({
        message: "Server error",
        error: error.message,
      });
    }
  },
  upgradeToFeatured,
  extendFeatured: async (req, res) => {
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
        return res
          .status(403)
          .json({ message: "Not authorized to extend this post" });
      }

      if (post.featuredType === "THUONG") {
        return res.status(400).json({ message: "Cannot extend regular posts" });
      }

      // Calculate cost
      const cost = calculateCost(post.featuredType, additionalDays);

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
        user: userId,
        type: "payment",
        amount: cost,
        status: "success",
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
  },
  toggleAutoRenewal: async (req, res) => {
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
        return res
          .status(403)
          .json({ message: "Not authorized to modify this post" });
      }

      post.autoRenew = autoRenew;
      if (autoRenew) {
        post.autoRenewDuration = autoRenewDuration;
      }
      await post.save();

      res.status(200).json({
        message: `Auto-renewal ${autoRenew ? "enabled" : "disabled"}`,
        autoRenew: post.autoRenew,
        autoRenewDuration: post.autoRenewDuration,
      });
    } catch (error) {
      res.status(500).json({
        message: "Server error",
        error: error.message,
      });
    }
  },
  incrementContactCount: async (req, res) => {
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
  },
  getFeaturedPosts: async (req, res) => {
    try {
      const { limit = 20 } = req.query;

      const posts = await Post.getFeatured()
        .populate("userId", "name profileImage")
        .limit(Number(limit));

      res.status(200).json({ posts });
    } catch (error) {
      res.status(500).json({
        message: "Server error",
        error: error.message,
      });
    }
  },
  getPostById: async (req, res) => {
    try {
      const { postId } = req.params;

      const post = await Post.findById(postId)
        .populate("userId", "name profileImage phoneNumber email")
        .populate("roomId", "name roomNumber capacity")
        .populate("accommodationId", "name type address");

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
  },
};