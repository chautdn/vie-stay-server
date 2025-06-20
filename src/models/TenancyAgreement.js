const mongoose = require("mongoose");

const tenancyAgreementSchema = new mongoose.Schema(
  {
    tenantId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: [true, "Tenant ID is required"],
    },
    roomId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Room",
      required: [true, "Room ID is required"],
    },
    accommodationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Accommodation",
      required: [true, "Accommodation ID is required"],
    },
    landlordId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: [true, "Landlord ID is required"],
    },
    startDate: {
      type: Date,
      required: [true, "Start date is required"],
      validate: {
        validator: function (value) {
          return value >= new Date().setHours(0, 0, 0, 0);
        },
        message: "Start date cannot be in the past",
      },
    },
    endDate: {
      type: Date,
      validate: {
        validator: function (value) {
          if (!value) return true; // Optional field
          return value > this.startDate;
        },
        message: "End date must be after start date",
      },
    },
    monthlyRent: {
      type: Number,
      required: [true, "Monthly rent is required"],
      min: [0, "Monthly rent cannot be negative"],
    },
    deposit: {
      type: Number,
      required: [true, "Deposit amount is required"],
      min: [0, "Deposit cannot be negative"],
    },
    utilityRates: {
      water: {
        type: {
          type: String,
          enum: {
            values: ["per_cubic_meter", "fixed"],
            message: "Water billing type must be per_cubic_meter or fixed",
          },
        },
        rate: {
          type: Number,
          min: [0, "Water rate cannot be negative"],
        },
      },
      electricity: {
        type: {
          type: String,
          enum: {
            values: ["per_kwh", "fixed"],
            message: "Electricity billing type must be per_kwh or fixed",
          },
        },
        rate: {
          type: Number,
          min: [0, "Electricity rate cannot be negative"],
        },
      },
      internet: {
        type: {
          type: String,
          enum: {
            values: ["fixed"],
            message: "Internet billing type must be fixed",
          },
          default: "fixed",
        },
        rate: {
          type: Number,
          min: [0, "Internet rate cannot be negative"],
        },
      },
      sanitation: {
        type: {
          type: String,
          enum: {
            values: ["fixed"],
            message: "Sanitation billing type must be fixed",
          },
          default: "fixed",
        },
        rate: {
          type: Number,
          min: [0, "Sanitation rate cannot be negative"],
        },
      },
    },
    additionalFees: [
      {
        name: {
          type: String,
          required: [true, "Fee name is required"],
          trim: true,
          enum: {
            values: ["parking", "security", "maintenance", "cleaning", "other"],
            message: "Please select a valid fee type",
          },
        },
        amount: {
          type: Number,
          required: [true, "Fee amount is required"],
          min: [0, "Fee amount cannot be negative"],
        },
        type: {
          type: String,
          required: [true, "Fee type is required"],
          enum: {
            values: ["monthly", "one_time"],
            message: "Fee type must be monthly or one_time",
          },
        },
        description: {
          type: String,
          trim: true,
          maxlength: [200, "Fee description cannot exceed 200 characters"],
        },
      },
    ],
    status: {
      type: String,
      required: [true, "Agreement status is required"],
      enum: {
        values: ["active", "ended", "terminated"],
        message: "Status must be active, ended, or terminated",
      },
      default: "active",
    },
    contractDocument: {
      type: String,
      match: [
        /^https?:\/\/.+\.(pdf|doc|docx)$/i,
        "Please provide a valid document URL",
      ],
    },
    terminationReason: {
      type: String,
      trim: true,
      maxlength: [500, "Termination reason cannot exceed 500 characters"],
    },
    terminatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    terminatedAt: {
      type: Date,
    },
    notes: {
      type: String,
      trim: true,
      maxlength: [1000, "Notes cannot exceed 1000 characters"],
    },
    renewalOptions: {
      autoRenew: {
        type: Boolean,
        default: false,
      },
      renewalPeriod: {
        type: Number, // in months
        min: [1, "Renewal period must be at least 1 month"],
      },
      renewalNotice: {
        type: Number, // days before end date
        min: [7, "Renewal notice must be at least 7 days"],
        default: 30,
      },
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// Indexes
tenancyAgreementSchema.index({ tenantId: 1 });
tenancyAgreementSchema.index({ roomId: 1 });
tenancyAgreementSchema.index({ accommodationId: 1 });
tenancyAgreementSchema.index({ landlordId: 1 });
tenancyAgreementSchema.index({ startDate: 1 });
tenancyAgreementSchema.index({ endDate: 1 });
tenancyAgreementSchema.index({ status: 1 });

// Compound indexes
tenancyAgreementSchema.index({ roomId: 1, status: 1 });
tenancyAgreementSchema.index({ tenantId: 1, status: 1 });

// // Virtual for agreement duration in months
// tenancyAgreementSchema.virtual('durationMonths').get(function() {
//   if (!this.endDate) return null;
//   const start = new Date(this.startDate);
//   const end = new Date(this.endDate);
//   return Math.ceil((end - start) / (1000 * 60 * 60 * 24 * 30.44)); // Average days per month
// });

// // Virtual for remaining days
// tenancyAgreementSchema.virtual('remainingDays').get(function() {
//   if (!this.endDate || this.status !== 'active') return null;
//   const today = new Date();
//   const end = new Date(this.endDate);
//   const timeDiff = end - today;
//   return Math.ceil(timeDiff / (1000 * 60 * 60 * 24));
// });

// // Virtual for total monthly cost
// tenancyAgreementSchema.virtual('totalMonthlyCost').get(function() {
//   let total = this.monthlyRent;

//   // Add fixed utility costs
//   if (this.utilityRates.water && this.utilityRates.water.type === 'fixed') {
//     total += this.utilityRates.water.rate;
//   }
//   if (this.utilityRates.electricity && this.utilityRates.electricity.type === 'fixed') {
//     total += this.utilityRates.electricity.rate;
//   }
//   if (this.utilityRates.internet && this.utilityRates.internet.rate) {
//     total += this.utilityRates.internet.rate;
//   }
//   if (this.utilityRates.sanitation && this.utilityRates.sanitation.rate) {
//     total += this.utilityRates.sanitation.rate;
//   }

//   // Add monthly additional fees
//   this.additionalFees.forEach(fee => {
//     if (fee.type === 'monthly') {
//       total += fee.amount;
//     }
//   });

//   return total;
// });

// // Virtual for tenant details
// tenancyAgreementSchema.virtual('tenant', {
//   ref: 'User',
//   localField: 'tenantId',
//   foreignField: '_id',
//   justOne: true
// });

// // Virtual for landlord details
// tenancyAgreementSchema.virtual('landlord', {
//   ref: 'User',
//   localField: 'landlordId',
//   foreignField: '_id',
//   justOne: true
// });

// // Virtual for room details
// tenancyAgreementSchema.virtual('room', {
//   ref: 'Room',
//   localField: 'roomId',
//   foreignField: '_id',
//   justOne: true
// });

// // Virtual for accommodation details
// tenancyAgreementSchema.virtual('accommodation', {
//   ref: 'Accommodation',
//   localField: 'accommodationId',
//   foreignField: '_id',
//   justOne: true
// });

// // Pre-save middleware to update room tenant
// tenancyAgreementSchema.pre('save', async function(next) {
//   if (this.isNew && this.status === 'active') {
//     // Set room as occupied
//     const Room = mongoose.model('Room');
//     await Room.findByIdAndUpdate(this.roomId, {
//       currentTenant: this.tenantId,
//       isAvailable: false
//     });
//   }
//   next();
// });

// // Post-save middleware to handle status changes
// tenancyAgreementSchema.post('save', async function(doc) {
//   if (doc.status === 'ended' || doc.status === 'terminated') {
//     // Free up the room
//     const Room = mongoose.model('Room');
//     await Room.findByIdAndUpdate(doc.roomId, {
//       currentTenant: null,
//       isAvailable: true,
//       availableFrom: new Date()
//     });
//   }
// });

// // Instance method to terminate agreement
// tenancyAgreementSchema.methods.terminate = function(terminatedBy, reason) {
//   this.status = 'terminated';
//   this.terminatedBy = terminatedBy;
//   this.terminatedAt = new Date();
//   this.terminationReason = reason;
//   return this.save();
// };

// // Instance method to end agreement naturally
// tenancyAgreementSchema.methods.end = function() {
//   this.status = 'ended';
//   return this.save();
// };

// // Instance method to check if agreement is near expiry
// tenancyAgreementSchema.methods.isNearExpiry = function(days = 30) {
//   if (!this.endDate || this.status !== 'active') return false;
//   const today = new Date();
//   const timeDiff = new Date(this.endDate) - today;
//   const remainingDays = Math.ceil(timeDiff / (1000 * 60 * 60 * 24));
//   return remainingDays <= days && remainingDays > 0;
// };

// // Instance method to calculate prorated rent for partial month
// tenancyAgreementSchema.methods.calculateProratedRent = function(startDate, endDate) {
//   const start = new Date(startDate);
//   const end = new Date(endDate);
//   const daysInMonth = new Date(start.getFullYear(), start.getMonth() + 1, 0).getDate();
//   const daysOccupied = Math.ceil((end - start) / (1000 * 60 * 60 * 24)) + 1;

//   return (this.monthlyRent / daysInMonth) * daysOccupied;
// };

// // Static method to find active agreements
// tenancyAgreementSchema.statics.findActive = function() {
//   return this.find({ status: 'active' });
// };

// // Static method to find expiring agreements
// tenancyAgreementSchema.statics.findExpiring = function(days = 30) {
//   const futureDate = new Date();
//   futureDate.setDate(futureDate.getDate() + days);

//   return this.find({
//     status: 'active',
//     endDate: {
//       $gte: new Date(),
//       $lte: futureDate
//     }
//   });
// };

// // Static method to find agreements by tenant
// tenancyAgreementSchema.statics.findByTenant = function(tenantId) {
//   return this.find({ tenantId }).sort({ startDate: -1 });
// };

// // Static method to find agreements by landlord
// tenancyAgreementSchema.statics.findByLandlord = function(landlordId) {
//   return this.find({ landlordId }).sort({ startDate: -1 });
// };

module.exports = mongoose.model("TenancyAgreement", tenancyAgreementSchema);
