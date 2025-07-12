const express = require("express");
const {
  createPost,
  getPosts,
  getFeaturedPosts,
  getPostById,
  getUserPosts,
  updatePost,
  deletePost,
  upgradeToFeatured,
  extendFeatured,
  toggleAutoRenewal,
  incrementContactCount,
} = require("../controllers/postController");
const { protect } = require("../controllers/authenticateController");

const router = express.Router();

// Public routes
router.get("/", getPosts); // Get all posts with filters
router.get("/featured", getFeaturedPosts); // Get featured posts only
router.get("/:postId", getPostById); // Get single post by ID
router.post("/:postId/contact", incrementContactCount); // Increment contact count

// Protected routes (require authentication)
router.use(protect); // All routes below require authentication

// User post management
router.post("/", createPost); // Create new post
router.get("/user/my-posts", getUserPosts); // Get current user's posts
router.put("/:postId", updatePost); // Update post
router.delete("/:postId", deletePost); // Delete post

// Featured listing management
router.post("/:postId/upgrade", upgradeToFeatured); // Upgrade to featured
router.post("/:postId/extend", extendFeatured); // Extend featured duration
router.patch("/:postId/auto-renewal", toggleAutoRenewal); // Toggle auto-renewal

module.exports = router;