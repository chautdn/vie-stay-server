const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");

const userSchema = new mongoose.Schema(
  {
    email: {
      type: String,
      required: [true, "Email is required"],
      unique: true,
      lowercase: true,
      trim: true,
    },
    password: {
      type: String,
      required: [true, "Password is required"],
    },
    firstName: {
      type: String,
      required: [true, "First name is required"],
      trim: true,
      maxlength: [50, "First name cannot exceed 50 characters"],
    },
    lastName: {
      type: String,
      required: [true, "Last name is required"],
      trim: true,
      maxlength: [50, "Last name cannot exceed 50 characters"],
    },
    phoneNumber: {
      type: String,
      required: [true, "Phone number is required"],
      unique: true,
      match: [
        /^(\+84|0)[0-9]{9,10}$/,
        "Please provide a valid Vietnamese phone number",
      ],
    },
    dateOfBirth: {
      type: Date,
      validate: {
        validator: function (value) {
          if (!value) return true; // Optional field
          return value < new Date();
        },
        message: "Date of birth must be in the past",
      },
    },
    profileImage: {
      type: String,
    },
    nationalId: {
      type: String,
      trim: true,
      maxlength: [20, "National ID cannot exceed 20 characters"],
    },
    nationalIdImage: {
      type: String,
    },
    address: {
      street: { type: String, trim: true },
      ward: { type: String, trim: true },
      district: { type: String, trim: true },
      city: { type: String, trim: true },
      fullAddress: { type: String, trim: true },
    },
    emergencyContact: {
      name: { type: String, trim: true },
      relationship: { type: String, trim: true },
      phoneNumber: {
        type: String,
        match: [
          /^(\+84|0)[0-9]{9,10}$/,
          "Please provide a valid Vietnamese phone number",
        ],
      },
    },
    role: {
      type: [String],
      required: [true, "At least one role is required"],
      enum: {
        values: ["tenant", "landlord", "admin"],
        message: "Role must be tenant, landlord, or admin",
      },
      default: ["tenant"],
    },
    isVerified: {
      type: Boolean,
      default: false,
    },
    phoneVerified: {
      type: Boolean,
      default: false,
    },
    identityVerified: {
      type: Boolean,
      default: false,
    },
    lastLogin: {
      type: Date,
      default: Date.now,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// Indexes
userSchema.index({ email: 1 }, { unique: true });
userSchema.index({ phoneNumber: 1 }, { unique: true });
userSchema.index({ role: 1 });
userSchema.index({ isVerified: 1 });
userSchema.index({ lastLogin: 1 });
userSchema.index({ isActive: 1 });

// Virtual for full name
userSchema.virtual("fullName").get(function () {
  return `${this.firstName} ${this.lastName}`;
});

// Pre-save middleware to hash password
userSchema.pre("save", async function (next) {
  // Only hash the password if it has been modified (or is new)
  if (!this.isModified("password")) return next();

  try {
    // Hash the password with cost of 12
    this.password = await bcrypt.hash(this.password, 12);
    next();
  } catch (error) {
    next(error);
  }
});

// Instance method to check password
userSchema.methods.correctPassword = async function (
  candidatePassword,
  userPassword
) {
  return await bcrypt.compare(candidatePassword, userPassword);
};

// Instance method to check if user has specific role
userSchema.methods.hasRole = function (role) {
  return this.role.includes(role);
};

// Static method to find users by role
userSchema.statics.findByRole = function (role) {
  return this.find({ role: role, isActive: true });
};

// Static method to find verified users
userSchema.statics.findVerified = function () {
  return this.find({
    isVerified: true,
    phoneVerified: true,
    isActive: true,
  });
};

module.exports = mongoose.model("User", userSchema);
