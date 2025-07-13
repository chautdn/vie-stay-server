const mongoose = require("mongoose");

// Chuẩn hoá tiếng Việt để tìm kiếm
function normalizeVietnamese(text) {
  if (!text) return "";
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "d")
    .trim();
}

const roommateRoomSchema = new mongoose.Schema(
  {
    roomNumber: {
      type: String,
      required: [true, "Số phòng là bắt buộc"],
      trim: true,
      maxlength: [20, "Tối đa 20 ký tự"],
    },
    name: {
      type: String,
      required: [true, "Tên phòng là bắt buộc"],
      trim: true,
      maxlength: [100, "Tối đa 100 ký tự"],
    },
    description: {
      type: String,
      required: [true, "Mô tả phòng là bắt buộc"],
      trim: true,
      maxlength: [1000, "Tối đa 1000 ký tự"],
    },
    type: {
      type: String,
      enum: ["shared", "dormitory"],
      default: "shared",
    },
    size: {
      type: Number,
      min: [0, "Diện tích không hợp lệ"],
    },
    capacity: {
      type: Number,
      required: true,
      min: [1, "Ít nhất 1 người"],
      max: [3, "Không quá 3 người"],
    },
    maxRoommates: {
      type: Number,
      required: true,
      min: [1, "Ít nhất 1 người"],
      max: [3, "Không quá 3 người"],
    },
    hasPrivateBathroom: {
      type: Boolean,
      default: false,
    },
    furnishingLevel: {
      type: String,
      enum: ["unfurnished", "semi", "fully"],
      default: "unfurnished",
    },
    images: {
      type: [String],
      default: [],
    },
    amenities: [
      {
        type: String,
        enum: [
          "wifi", "air_conditioning", "desk", "tv", "refrigerator", "microwave",
          "chair", "balcony", "wardrobe", "fan"
        ],
      },
    ],
    isAvailable: {
      type: Boolean,
      default: true,
    },
    availableFrom: {
      type: Date,
    },

    baseRent: {
      type: Number,
      min: [0, "Không hợp lệ"],
    },
    deposit: {
      type: Number,
      min: [0, "Không hợp lệ"],
      default: 0,
    },
    utilityRates: {
      water: {
        type: {
          type: String,
          enum: ["per_cubic_meter", "fixed"],
        },
        rate: {
          type: Number,
          min: 0,
        },
      },
      electricity: {
        type: {
          type: String,
          enum: ["per_kwh", "fixed"],
        },
        rate: {
          type: Number,
          min: 0,
        },
      },
      internet: {
        type: {
          type: String,
          enum: ["fixed"],
          default: "fixed",
        },
        rate: {
          type: Number,
          min: 0,
        },
      },
      sanitation: {
        type: {
          type: String,
          enum: ["fixed"],
          default: "fixed",
        },
        rate: {
          type: Number,
          min: 0,
        },
      },
    },
    additionalFees: [
      {
        name: {
          type: String,
          enum: ["parking", "security", "maintenance", "cleaning", "other"],
        },
        amount: {
          type: Number,
          min: 0,
        },
        type: {
          type: String,
          enum: ["monthly", "one_time"],
        },
        description: {
          type: String,
          maxlength: 200,
        },
      },
    ],

    // Địa chỉ
    address: {
      street: {
        type: String,
        trim: true,
        maxlength: [200, "Tối đa 200 ký tự"],
      },
      ward: {
        type: String,
        required: [true, "Phường/Xã là bắt buộc"],
        trim: true,
        maxlength: [100, "Tối đa 100 ký tự"],
      },
      district: {
        type: String,
        required: [true, "Quận/Huyện là bắt buộc"],
        enum: {
          values: [
            "Quận Hải Châu", "Quận Thanh Khê", "Quận Sơn Trà", "Quận Ngũ Hành Sơn",
            "Quận Liên Chiểu", "Quận Cẩm Lệ", "Huyện Hòa Vang", "Huyện Hoàng Sa",
          ],
          message: "Quận/Huyện không hợp lệ",
        },
      },
      city: {
        type: String,
        required: true,
        default: "Đà Nẵng",
        enum: ["Đà Nẵng"],
      },
      fullAddress: {
        type: String,
        required: [true, "Địa chỉ đầy đủ là bắt buộc"],
        trim: true,
      },
      fullAddressNormalized: {
        type: String,
        trim: true,
      },
    },

    // Liên hệ
    contactInfo: {
      phone: {
        type: String,
        required: [true, "Số điện thoại là bắt buộc"],
        match: [/^(\+84|0)[0-9]{9,10}$/, "SĐT không hợp lệ"],
      },
      email: {
        type: String,
        match: [/^[\w.%+-]+@[\w.-]+\.[a-zA-Z]{2,}$/, "Email không hợp lệ"],
      },
      website: {
        type: String,
        trim: true,
      },
    },

    averageRating: {
      type: Number,
      min: 0,
      max: 5,
      default: 0,
    },
    totalRatings: {
      type: Number,
      min: 0,
      default: 0,
    },
    viewCount: {
      type: Number,
      min: 0,
      default: 0,
    },
    favoriteCount: {
      type: Number,
      min: 0,
      default: 0,
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// Middleware: normalize địa chỉ để tìm kiếm
roommateRoomSchema.pre("save", function (next) {
  if (this.isModified("address.fullAddress")) {
    this.address.fullAddressNormalized = normalizeVietnamese(this.address.fullAddress);
  }
  next();
});

module.exports = mongoose.model("RoommateRoom", roommateRoomSchema);
