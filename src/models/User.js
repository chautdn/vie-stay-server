const mongoose = require("mongoose");
const validator = require("validator");
const bcrypt = require("bcryptjs");
const { verify } = require("jsonwebtoken");

const userSchema = new mongoose.Schema(
  {
    email: {
      type: String,
      required: [true, "Email is required!"],
      unique: true,
      lowercase: true,
      validate: [validator.isEmail, "Please provide a valid email!"],
    },
    password: {
      type: String,
      required: [true, "Password is required!"],
      select: false,
    },
    passwordChangedAt: {
      type: Date,
      default: Date.now,
    },
    name: {
      type: String,
      // required: [true, "Name is required"],
      trim: true,
      maxlength: [50, "Name cannot exceed 50 characters"],
    },
    phoneNumber: {
      type: String,
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
      sparse: true,
    },
    profileImage: {
      type: String,
    },
    nationalId: {
      type: String,
      trim: true,
      maxlength: [20, "National ID cannot exceed 20 characters"],
      sparse: true,
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
      enum: {
        values: ["tenant", "landlord", "admin"],
        message: "Role must be tenant, landlord, or admin",
      },
      default: ["tenant"],
    },
    isVerified: { type: Boolean, default: false },
    resetPasswordToken: String,
    resetPasswordExpiresAt: Date,
    verificationToken: String,
    verificationTokenExpiresAt: Date,
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
userSchema.index({ phoneNumber: 1 }, { unique: true, sparse: true });


// Hashing mật khẩu trước khi lưu
userSchema.pre("save", async function (next) {
  if (!this.isModified("password")) return next();
  this.password = await bcrypt.hash(this.password, 10);
  next();
});

userSchema.methods.correctPassword = async function (
  candidatePassword,
  userPassword
) {
  return await bcrypt.compare(candidatePassword, userPassword);
};

module.exports = mongoose.model("User", userSchema);
