const mongoose = require('mongoose');

const listingPlanSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Plan name is required'],
    trim: true,
    maxlength: [100, 'Plan name cannot exceed 100 characters']
  },
  description: {
    type: String,
    trim: true,
    maxlength: [500, 'Description cannot exceed 500 characters']
  },
  duration: {
    type: Number,
    required: [true, 'Duration is required'],
    min: [1, 'Duration must be at least 1 day']
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
  features: {
    type: [String],
    required: [true, 'At least one feature is required'],
    validate: {
      validator: function(features) {
        return features && features.length > 0;
      },
      message: 'At least one feature is required'
    }
  },
  isFeatured: {
    type: Boolean,
    default: false
  },
  maxRooms: {
    type: Number,
    min: [1, 'Maximum rooms must be at least 1']
  },
  maxPhotos: {
    type: Number,
    min: [1, 'Maximum photos must be at least 1'],
    default: 10
  },
  priority: {
    type: Number,
    min: [1, 'Priority must be at least 1'],
    max: [10, 'Priority cannot exceed 10'],
    default: 1
  },
  isActive: {
    type: Boolean,
    default: true
  },
  isPopular: {
    type: Boolean,
    default: false
  },
  displayOrder: {
    type: Number,
    min: [1, 'Display order must be at least 1'],
    default: 1
  },
  planType: {
    type: String,
    enum: {
      values: ['basic', 'premium', 'featured', 'enterprise'],
      message: 'Plan type must be basic, premium, featured, or enterprise'
    },
    default: 'basic'
  },
  limitations: {
    maxAccommodations: {
      type: Number,
      min: [1, 'Maximum accommodations must be at least 1']
    },
    maxRoomsPerAccommodation: {
      type: Number,
      min: [1, 'Maximum rooms per accommodation must be at least 1']
    },
    allowedAmenities: [{
      type: String
    }],
    supportLevel: {
      type: String,
      enum: {
        values: ['basic', 'standard', 'premium', 'priority'],
        message: 'Support level must be basic, standard, premium, or priority'
      },
      default: 'basic'
    }
  },
  benefits: {
    topPlacement: {
      type: Boolean,
      default: false
    },
    highlighted: {
      type: Boolean,
      default: false
    },
    badge: {
      type: String,
      enum: {
        values: ['none', 'featured', 'premium', 'top_choice'],
        message: 'Badge must be none, featured, premium, or top_choice'
      },
      default: 'none'
    },
    analytics: {
      type: Boolean,
      default: false
    },
    customContact: {
      type: Boolean,
      default: false
    }
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Indexes
listingPlanSchema.index({ isActive: 1 });
listingPlanSchema.index({ price: 1 });
listingPlanSchema.index({ planType: 1 });
listingPlanSchema.index({ displayOrder: 1 });
listingPlanSchema.index({ priority: 1 });

// Virtual for subscriptions
listingPlanSchema.virtual('subscriptions', {
  ref: 'ListingSubscription',
  localField: '_id',
  foreignField: 'planId'
});

// Virtual for price per day
listingPlanSchema.virtual('pricePerDay').get(function() {
  return Math.round(this.price / this.duration);
});

// Virtual for formatted price
listingPlanSchema.virtual('formattedPrice').get(function() {
  return new Intl.NumberFormat('vi-VN', {
    style: 'currency',
    currency: 'VND'
  }).format(this.price);
});

// Static method to find active plans
listingPlanSchema.statics.findActive = function() {
  return this.find({ isActive: true }).sort({ displayOrder: 1, price: 1 });
};

// Static method to find plans by type
listingPlanSchema.statics.findByType = function(planType) {
  return this.find({ 
    planType, 
    isActive: true 
  }).sort({ price: 1 });
};

// Static method to find popular plans
listingPlanSchema.statics.findPopular = function() {
  return this.find({ 
    isPopular: true, 
    isActive: true 
  }).sort({ displayOrder: 1 });
};

// Instance method to activate plan
listingPlanSchema.methods.activate = function() {
  this.isActive = true;
  return this.save();
};

// Instance method to deactivate plan
listingPlanSchema.methods.deactivate = function() {
  this.isActive = false;
  return this.save();
};

// Instance method to mark as popular
listingPlanSchema.methods.markAsPopular = function() {
  this.isPopular = true;
  return this.save();
};

// Instance method to check if plan supports feature
listingPlanSchema.methods.supportsFeature = function(feature) {
  return this.features.includes(feature);
};

module.exports = mongoose.model('ListingPlan', listingPlanSchema);