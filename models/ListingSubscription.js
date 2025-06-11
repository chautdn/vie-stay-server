const mongoose = require('mongoose');

const listingSubscriptionSchema = new mongoose.Schema({
  landlordId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'Landlord ID is required']
  },
  accommodationId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Accommodation',
    required: [true, 'Accommodation ID is required']
  },
  planId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'ListingPlan',
    required: [true, 'Plan ID is required']
  },
  startDate: {
    type: Date,
    required: [true, 'Start date is required'],
    default: Date.now
  },
  endDate: {
    type: Date,
    required: [true, 'End date is required']
  },
  price: {
    type: Number,
    required: [true, 'Price is required'],
    min: [0, 'Price cannot be negative']
  },
  currency: {
    type: String,
    enum: {
      values: ['VND'],
      message: 'Currency must be VND'
    },
    default: 'VND'
  },
  status: {
    type: String,
    required: [true, 'Status is required'],
    enum: {
      values: ['active', 'expired', 'cancelled', 'pending_payment'],
      message: 'Status must be active, expired, cancelled, or pending_payment'
    },
    default: 'pending_payment'
  },
  paymentStatus: {
    type: String,
    required: [true, 'Payment status is required'],
    enum: {
      values: ['paid', 'pending', 'failed', 'refunded'],
      message: 'Payment status must be paid, pending, failed, or refunded'
    },
    default: 'pending'
  },
  paymentMethod: {
    type: String,
    enum: {
      values: ['bank_transfer', 'credit_card', 'e_wallet', 'cash'],
      message: 'Payment method must be bank_transfer, credit_card, e_wallet, or cash'
    }
  },
  paymentReference: {
    type: String,
    trim: true,
    maxlength: [100, 'Payment reference cannot exceed 100 characters']
  },
  paidAt: {
    type: Date
  },
  autoRenew: {
    type: Boolean,
    default: false
  },
  renewalAttempts: {
    type: Number,
    min: [0, 'Renewal attempts cannot be negative'],
    default: 0
  },
  lastRenewalAttempt: {
    type: Date
  },
  cancellationReason: {
    type: String,
    trim: true,
    maxlength: [500, 'Cancellation reason cannot exceed 500 characters']
  },
  cancelledAt: {
    type: Date
  },
  cancelledBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  refundAmount: {
    type: Number,
    min: [0, 'Refund amount cannot be negative'],
    default: 0
  },
  refundedAt: {
    type: Date
  },
  notes: {
    type: String,
    trim: true,
    maxlength: [1000, 'Notes cannot exceed 1000 characters']
  },
  promotionCode: {
    type: String,
    trim: true,
    uppercase: true
  },
  discountAmount: {
    type: Number,
    min: [0, 'Discount amount cannot be negative'],
    default: 0
  },
  originalPrice: {
    type: Number,
    min: [0, 'Original price cannot be negative']
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Indexes
listingSubscriptionSchema.index({ landlordId: 1 });
listingSubscriptionSchema.index({ accommodationId: 1 });
listingSubscriptionSchema.index({ planId: 1 });
listingSubscriptionSchema.index({ startDate: 1 });
listingSubscriptionSchema.index({ endDate: 1 });
listingSubscriptionSchema.index({ status: 1 });
listingSubscriptionSchema.index({ paymentStatus: 1 });

// Compound indexes
listingSubscriptionSchema.index({ landlordId: 1, status: 1 });
listingSubscriptionSchema.index({ accommodationId: 1, status: 1 });
listingSubscriptionSchema.index({ status: 1, endDate: 1 });

// Virtual for landlord details
listingSubscriptionSchema.virtual('landlord', {
  ref: 'User',
  localField: 'landlordId',
  foreignField: '_id',
  justOne: true
});

// Virtual for accommodation details
listingSubscriptionSchema.virtual('accommodation', {
  ref: 'Accommodation',
  localField: 'accommodationId',
  foreignField: '_id',
  justOne: true
});

// Virtual for plan details
listingSubscriptionSchema.virtual('plan', {
  ref: 'ListingPlan',
  localField: 'planId',
  foreignField: '_id',
  justOne: true
});

// Virtual for remaining days
listingSubscriptionSchema.virtual('remainingDays').get(function() {
  if (this.status !== 'active') return 0;
  const today = new Date();
  const endDate = new Date(this.endDate);
  const timeDiff = endDate - today;
  return Math.max(0, Math.ceil(timeDiff / (1000 * 60 * 60 * 24)));
});

// Virtual for is expired
listingSubscriptionSchema.virtual('isExpired').get(function() {
  return new Date() > this.endDate;
});

// Virtual for is expiring soon (within 7 days)
listingSubscriptionSchema.virtual('isExpiringSoon').get(function() {
  if (this.status !== 'active') return false;
  return this.remainingDays <= 7 && this.remainingDays > 0;
});

// Virtual for duration in days
listingSubscriptionSchema.virtual('durationDays').get(function() {
  const timeDiff = this.endDate - this.startDate;
  return Math.ceil(timeDiff / (1000 * 60 * 60 * 24));
});

// Virtual for formatted price
listingSubscriptionSchema.virtual('formattedPrice').get(function() {
  return new Intl.NumberFormat('vi-VN', {
    style: 'currency',
    currency: 'VND'
  }).format(this.price);
});

// Pre-save middleware to set end date and handle status
listingSubscriptionSchema.pre('save', async function(next) {
  // Set end date if not provided
  if (this.isNew && !this.endDate) {
    const ListingPlan = mongoose.model('ListingPlan');
    const plan = await ListingPlan.findById(this.planId);
    if (plan) {
      this.endDate = new Date(this.startDate.getTime() + (plan.duration * 24 * 60 * 60 * 1000));
    }
  }
  
  // Update status based on dates and payment
  if (this.paymentStatus === 'paid' && this.status === 'pending_payment') {
    this.status = 'active';
    this.paidAt = this.paidAt || new Date();
  }
  
  // Check if expired
  if (this.status === 'active' && new Date() > this.endDate) {
    this.status = 'expired';
  }
  
  next();
});

// Post-save middleware to update accommodation featured status
listingSubscriptionSchema.post('save', async function(doc) {
  const Accommodation = mongoose.model('Accommodation');
  const ListingPlan = mongoose.model('ListingPlan');
  
  if (doc.status === 'active') {
    const plan = await ListingPlan.findById(doc.planId);
    if (plan && plan.isFeatured) {
      await Accommodation.findByIdAndUpdate(doc.accommodationId, {
        isFeatured: true,
        featuredUntil: doc.endDate
      });
    }
  } else if (doc.status === 'expired' || doc.status === 'cancelled') {
    await Accommodation.findByIdAndUpdate(doc.accommodationId, {
      isFeatured: false,
      featuredUntil: null
    });
  }
});

// Instance method to activate subscription
listingSubscriptionSchema.methods.activate = function() {
  this.status = 'active';
  this.paymentStatus = 'paid';
  this.paidAt = new Date();
  return this.save();
};

// Instance method to cancel subscription
listingSubscriptionSchema.methods.cancel = function(reason, cancelledBy = null) {
  this.status = 'cancelled';
  this.cancellationReason = reason;
  this.cancelledAt = new Date();
  this.cancelledBy = cancelledBy;
  return this.save();
};

// Instance method to process refund
listingSubscriptionSchema.methods.processRefund = function(amount) {
  this.refundAmount = amount;
  this.refundedAt = new Date();
  this.paymentStatus = 'refunded';
  return this.save();
};

// Instance method to attempt renewal
listingSubscriptionSchema.methods.attemptRenewal = async function() {
  if (!this.autoRenew) {
    throw new Error('Auto-renewal is not enabled for this subscription');
  }
  
  this.renewalAttempts += 1;
  this.lastRenewalAttempt = new Date();
  
  // Create new subscription for renewal
  const ListingPlan = mongoose.model('ListingPlan');
  const plan = await ListingPlan.findById(this.planId);
  
  if (!plan || !plan.isActive) {
    throw new Error('Plan is no longer available for renewal');
  }
  
  const newSubscription = new this.constructor({
    landlordId: this.landlordId,
    accommodationId: this.accommodationId,
    planId: this.planId,
    startDate: this.endDate,
    price: plan.price,
    autoRenew: this.autoRenew,
    paymentMethod: this.paymentMethod
  });
  
  await this.save();
  return newSubscription.save();
};

// Instance method to extend subscription
listingSubscriptionSchema.methods.extend = function(additionalDays) {
  const newEndDate = new Date(this.endDate);
  newEndDate.setDate(newEndDate.getDate() + additionalDays);
  this.endDate = newEndDate;
  
  if (this.status === 'expired') {
    this.status = 'active';
  }
  
  return this.save();
};

// Static method to find active subscriptions
listingSubscriptionSchema.statics.findActive = function() {
  return this.find({ 
    status: 'active',
    endDate: { $gt: new Date() }
  });
};

// Static method to find expiring subscriptions
listingSubscriptionSchema.statics.findExpiring = function(days = 7) {
  const futureDate = new Date();
  futureDate.setDate(futureDate.getDate() + days);
  
  return this.find({
    status: 'active',
    endDate: {
      $gte: new Date(),
      $lte: futureDate
    }
  });
};

// Static method to find expired subscriptions
listingSubscriptionSchema.statics.findExpired = function() {
  return this.find({
    status: { $in: ['active', 'expired'] },
    endDate: { $lt: new Date() }
  });
};

// Static method to find subscriptions by landlord
listingSubscriptionSchema.statics.findByLandlord = function(landlordId, status = null) {
  const query = { landlordId };
  if (status) query.status = status;
  return this.find(query).sort({ createdAt: -1 });
};

// Static method to find subscriptions by accommodation
listingSubscriptionSchema.statics.findByAccommodation = function(accommodationId) {
  return this.find({ accommodationId }).sort({ createdAt: -1 });
};

// Static method to update expired subscriptions
listingSubscriptionSchema.statics.updateExpiredSubscriptions = async function() {
  const expiredSubscriptions = await this.find({
    status: 'active',
    endDate: { $lt: new Date() }
  });
  
  const bulkOps = expiredSubscriptions.map(sub => ({
    updateOne: {
      filter: { _id: sub._id },
      update: { status: 'expired' }
    }
  }));
  
  if (bulkOps.length > 0) {
    await this.bulkWrite(bulkOps);
    
    // Update accommodation featured status
    const Accommodation = mongoose.model('Accommodation');
    const accommodationIds = expiredSubscriptions.map(sub => sub.accommodationId);
    await Accommodation.updateMany(
      { _id: { $in: accommodationIds } },
      { 
        isFeatured: false,
        featuredUntil: null 
      }
    );
  }
  
  return expiredSubscriptions.length;
};

// Static method to calculate revenue for period
listingSubscriptionSchema.statics.calculateRevenue = function(startDate, endDate) {
  return this.aggregate([
    {
      $match: {
        paymentStatus: 'paid',
        paidAt: {
          $gte: startDate,
          $lte: endDate
        }
      }
    },
    {
      $group: {
        _id: null,
        totalRevenue: { $sum: '$price' },
        subscriptionCount: { $sum: 1 },
        averagePrice: { $avg: '$price' }
      }
    }
  ]);
};

// Static method to get subscription statistics
listingSubscriptionSchema.statics.getStatistics = function() {
  return this.aggregate([
    {
      $group: {
        _id: '$status',
        count: { $sum: 1 },
        totalRevenue: { $sum: '$price' }
      }
    },
    {
      $group: {
        _id: null,
        statusBreakdown: {
          $push: {
            status: '$_id',
            count: '$count',
            revenue: '$totalRevenue'
          }
        },
        totalSubscriptions: { $sum: '$count' },
        totalRevenue: { $sum: '$totalRevenue' }
      }
    }
  ]);
};

// Static method to find subscriptions needing renewal
listingSubscriptionSchema.statics.findNeedingRenewal = function() {
  const futureDate = new Date();
  futureDate.setDate(futureDate.getDate() + 3); // 3 days before expiry
  
  return this.find({
    status: 'active',
    autoRenew: true,
    endDate: {
      $gte: new Date(),
      $lte: futureDate
    },
    renewalAttempts: { $lt: 3 } // Max 3 renewal attempts
  });
};

module.exports = mongoose.model('ListingSubscription', listingSubscriptionSchema);