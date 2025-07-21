const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");


const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, "Name is required"],
      trim: true,
      maxlength: [50, "Name cannot exceed 50 characters"],
    },
    email: {
      type: String,
      required: [true, "Email is required"],
      lowercase: true,
      trim: true,
      match: [
        /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/,
        "Please provide a valid email",
      ],
    },
    password: {
      type: String,
      required: [true, "Password is required"],
      minlength: [6, "Password must be at least 6 characters"],
      select: false,
    },
    phoneNumber: {
      type: String,
      trim: true,
      // ✅ XÓA: unique: true, để tránh duplicate index
      match: [
        /^(\+84|0)[0-9]{9,10}$/,
        "Please provide a valid Vietnamese phone number",
      ],
    },
    dateOfBirth: {
      type: Date,
      validate: {
        validator: function (value) {
          if (!value) return true;
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
    bankAccount: {
      bankName: {
        type: String,
        trim: true,
        maxlength: [100, "Bank name cannot exceed 100 characters"],
        required: false,
      },
      bankCode: {
        type: String,
        trim: true,
        uppercase: true,
        maxlength: [10, "Bank code cannot exceed 10 characters"],
        required: false, 
      },
      accountNumber: {
        type: String,
        trim: true,
        required: false,
        validate: {
          validator: function(v) {
            return !v || /^[0-9]{6,20}$/.test(v);
          },
          message: "Account number must be 6-20 digits"
        }
      },
      accountHolderName: {
        type: String,
        trim: true,
        maxlength: [100, "Account holder name cannot exceed 100 characters"],
        required: false, 
      },
      branch: {
        type: String,
        trim: true,
        maxlength: [100, "Branch name cannot exceed 100 characters"],
        required: false, // Optional
      },
      isVerified: {
        type: Boolean,
        default: false,
        // Admin can verify bank account details when provided
      },
      verifiedAt: {
        type: Date,
      },
      verifiedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        // Reference to admin who verified the account
      },
      addedAt: {
        type: Date,
        // Track when bank account info was first added
      },
    },
    role: {
      type: [String],
      enum: {
        values: ["tenant", "landlord", "admin", "co-tenant"], //co-tenant là người thuê chung phòng
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
    wallet: {
      balance: {
        type: Number,
        default: 0,
        min: 0,
      },
      transactions: [
        {
          type: mongoose.Schema.Types.ObjectId,
          ref: "Transaction",
        },
      ],
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

// ✅ SỬA: Chỉ define indexes một lần ở đây
userSchema.index({ email: 1 }, { unique: true });
userSchema.index({ phoneNumber: 1 }, { unique: true, sparse: true });

// ✅ Virtual to check if user can withdraw (has complete and verified bank account)
userSchema.virtual("canWithdraw").get(function () {
  return (
    this.bankAccount &&
    this.bankAccount.bankName &&
    this.bankAccount.accountNumber &&
    this.bankAccount.accountHolderName &&
    this.bankAccount.isVerified &&
    this.wallet.balance > 0
  );
});

// ✅ Virtual to check if user has any bank account info (even incomplete)
userSchema.virtual("hasBankAccountData").get(function () {
  return (
    this.bankAccount &&
    (this.bankAccount.bankName ||
     this.bankAccount.accountNumber ||
     this.bankAccount.accountHolderName)
  );
});

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

module.exports = mongoose.models.User || mongoose.model("User", userSchema);
