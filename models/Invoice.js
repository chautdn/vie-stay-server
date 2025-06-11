const mongoose = require('mongoose');

const invoiceSchema = new mongoose.Schema({
  tenantId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'Tenant ID is required']
  },
  roomId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Room',
    required: [true, 'Room ID is required']
  },
  accommodationId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Accommodation',
    required: [true, 'Accommodation ID is required']
  },
  landlordId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'Landlord ID is required']
  },
  tenancyId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'TenancyAgreement',
    required: [true, 'Tenancy ID is required']
  },
  invoiceNumber: {
    type: String,
    required: [true, 'Invoice number is required'],
    unique: true,
    trim: true,
    uppercase: true
  },
  type: {
    type: String,
    required: [true, 'Invoice type is required'],
    enum: {
      values: ['rent', 'utilities', 'additional_fees', 'deposit', 'mixed'],
      message: 'Invoice type must be rent, utilities, additional_fees, deposit, or mixed'
    }
  },
  period: {
    startDate: {
      type: Date,
      required: [true, 'Period start date is required']
    },
    endDate: {
      type: Date,
      required: [true, 'Period end date is required'],
      validate: {
        validator: function(value) {
          return value > this.period.startDate;
        },
        message: 'Period end date must be after start date'
      }
    },
    month: {
      type: Number,
      required: [true, 'Month is required'],
      min: [1, 'Month must be between 1 and 12'],
      max: [12, 'Month must be between 1 and 12']
    },
    year: {
      type: Number,
      required: [true, 'Year is required'],
      min: [2020, 'Year must be 2020 or later']
    }
  },
  lineItems: [{
    description: {
      type: String,
      required: [true, 'Line item description is required'],
      trim: true,
      maxlength: [200, 'Description cannot exceed 200 characters']
    },
    quantity: {
      type: Number,
      required: [true, 'Quantity is required'],
      min: [0, 'Quantity cannot be negative']
    },
    unitPrice: {
      type: Number,
      required: [true, 'Unit price is required'],
      min: [0, 'Unit price cannot be negative']
    },
    amount: {
      type: Number,
      required: [true, 'Line item amount is required'],
      min: [0, 'Amount cannot be negative']
    },
    type: {
      type: String,
      required: [true, 'Line item type is required'],
      enum: {
        values: ['rent', 'water', 'electricity', 'internet', 'sanitation', 'parking', 'security', 'maintenance', 'cleaning', 'deposit', 'other'],
        message: 'Please select a valid line item type'
      }
    },
    taxable: {
      type: Boolean,
      default: false
    }
  }],
  subtotal: {
    type: Number,
    required: [true, 'Subtotal is required'],
    min: [0, 'Subtotal cannot be negative']
  },
  taxAmount: {
    type: Number,
    min: [0, 'Tax amount cannot be negative'],
    default: 0
  },
  taxRate: {
    type: Number,
    min: [0, 'Tax rate cannot be negative'],
    max: [100, 'Tax rate cannot exceed 100%'],
    default: 0
  },
  totalAmount: {
    type: Number,
    required: [true, 'Total amount is required'],
    min: [0, 'Total amount cannot be negative']
  },
  currency: {
    type: String,
    required: [true, 'Currency is required'],
    enum: {
      values: ['VND'],
      message: 'Currency must be VND'
    },
    default: 'VND'
  },
  dueDate: {
    type: Date,
    required: [true, 'Due date is required'],
    validate: {
      validator: function(value) {
        return value >= new Date().setHours(0, 0, 0, 0);
      },
      message: 'Due date cannot be in the past'
    }
  },
  status: {
    type: String,
    required: [true, 'Invoice status is required'],
    enum: {
      values: ['draft', 'sent', 'paid', 'overdue', 'cancelled', 'partial'],
      message: 'Status must be draft, sent, paid, overdue, cancelled, or partial'
    },
    default: 'draft'
  },
  paidAmount: {
    type: Number,
    min: [0, 'Paid amount cannot be negative'],
    default: 0
  },
  paidAt: {
    type: Date
  },
  paymentMethod: {
    type: String,
    enum: {
      values: ['cash', 'bank_transfer', 'credit_card', 'e_wallet', 'check', 'other'],
      message: 'Please select a valid payment method'
    }
  },
  paymentReference: {
    type: String,
    trim: true,
    maxlength: [100, 'Payment reference cannot exceed 100 characters']
  },
  notes: {
    type: String,
    trim: true,
    maxlength: [1000, 'Notes cannot exceed 1000 characters']
  },
  isRecurring: {
    type: Boolean,
    default: false
  },
  parentInvoiceId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Invoice'
  },
  recurringPattern: {
    frequency: {
      type: String,
      enum: {
        values: ['monthly', 'quarterly', 'annually'],
        message: 'Frequency must be monthly, quarterly, or annually'
      }
    },
    nextDueDate: Date,
    endDate: Date
  },
  attachments: [{
    fileName: {
      type: String,
      required: [true, 'File name is required'],
      trim: true
    },
    fileUrl: {
      type: String,
      required: [true, 'File URL is required'],
      match: [/^https?:\/\/.+$/, 'Please provide a valid file URL']
    },
    fileType: {
      type: String,
      enum: {
        values: ['pdf', 'image', 'document'],
        message: 'File type must be pdf, image, or document'
      }
    },
    uploadedAt: {
      type: Date,
      default: Date.now
    }
  }],
  sentAt: {
    type: Date
  },
  remindersSent: {
    type: Number,
    min: [0, 'Reminders sent cannot be negative'],
    default: 0
  },
  lastReminderSent: {
    type: Date
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Indexes
invoiceSchema.index({ tenantId: 1 });
invoiceSchema.index({ roomId: 1 });
invoiceSchema.index({ landlordId: 1 });
invoiceSchema.index({ tenancyId: 1 });
invoiceSchema.index({ invoiceNumber: 1 }, { unique: true });
invoiceSchema.index({ type: 1 });
invoiceSchema.index({ totalAmount: 1 });
invoiceSchema.index({ dueDate: 1 });
invoiceSchema.index({ status: 1 });
invoiceSchema.index({ paidAt: 1 });
invoiceSchema.index({ isRecurring: 1 });

// Compound indexes
invoiceSchema.index({ landlordId: 1, status: 1 });
invoiceSchema.index({ tenantId: 1, status: 1 });
invoiceSchema.index({ status: 1, dueDate: 1 });
invoiceSchema.index({ 'period.year': 1, 'period.month': 1 });

// Virtual for remaining amount
invoiceSchema.virtual('remainingAmount').get(function() {
  return Math.max(0, this.totalAmount - this.paidAmount);
});

// Virtual for payment percentage
invoiceSchema.virtual('paymentPercentage').get(function() {
  if (this.totalAmount === 0) return 0;
  return Math.round((this.paidAmount / this.totalAmount) * 100);
});

// Virtual for days overdue
invoiceSchema.virtual('daysOverdue').get(function() {
  if (this.status !== 'overdue') return 0;
  const today = new Date();
  const dueDate = new Date(this.dueDate);
  return Math.floor((today - dueDate) / (1000 * 60 * 60 * 24));
});

// Virtual for tenant details
invoiceSchema.virtual('tenant', {
  ref: 'User',
  localField: 'tenantId',
  foreignField: '_id',
  justOne: true
});

// Virtual for landlord details
invoiceSchema.virtual('landlord', {
  ref: 'User',
  localField: 'landlordId',
  foreignField: '_id',
  justOne: true
});

// Virtual for room details
invoiceSchema.virtual('room', {
  ref: 'Room',
  localField: 'roomId',
  foreignField: '_id',
  justOne: true
});

// Virtual for tenancy details
invoiceSchema.virtual('tenancy', {
  ref: 'TenancyAgreement',
  localField: 'tenancyId',
  foreignField: '_id',
  justOne: true
});

// Pre-save middleware to generate invoice number
invoiceSchema.pre('save', async function(next) {
  if (this.isNew && !this.invoiceNumber) {
    const year = new Date().getFullYear();
    const month = String(new Date().getMonth() + 1).padStart(2, '0');
    
    // Find the latest invoice for this month
    const latestInvoice = await this.constructor.findOne({
      invoiceNumber: new RegExp(`^INV-${year}${month}`)
    }).sort({ invoiceNumber: -1 });
    
    let sequence = 1;
    if (latestInvoice) {
      const lastSequence = parseInt(latestInvoice.invoiceNumber.split('-')[2]);
      sequence = lastSequence + 1;
    }
    
    this.invoiceNumber = `INV-${year}${month}-${String(sequence).padStart(4, '0')}`;
  }
  
  // Calculate totals
  this.subtotal = this.lineItems.reduce((sum, item) => sum + item.amount, 0);
  this.taxAmount = this.subtotal * (this.taxRate / 100);
  this.totalAmount = this.subtotal + this.taxAmount;
  
  // Update status based on payment
  if (this.paidAmount >= this.totalAmount && this.status !== 'cancelled') {
    this.status = 'paid';
    if (!this.paidAt) this.paidAt = new Date();
  } else if (this.paidAmount > 0 && this.paidAmount < this.totalAmount) {
    this.status = 'partial';
  } else if (this.status === 'sent' && new Date() > this.dueDate) {
    this.status = 'overdue';
  }
  
  next();
});

// Instance method to mark as sent
invoiceSchema.methods.markAsSent = function() {
  this.status = 'sent';
  this.sentAt = new Date();
  return this.save();
};

// Instance method to record payment
invoiceSchema.methods.recordPayment = function(amount, paymentMethod, reference) {
  this.paidAmount += amount;
  this.paymentMethod = paymentMethod;
  this.paymentReference = reference;
  
  if (this.paidAmount >= this.totalAmount) {
    this.status = 'paid';
    this.paidAt = new Date();
  } else {
    this.status = 'partial';
  }
  
  return this.save();
};

// Instance method to cancel invoice
invoiceSchema.methods.cancel = function(reason) {
  this.status = 'cancelled';
  this.notes = this.notes ? `${this.notes}\nCancelled: ${reason}` : `Cancelled: ${reason}`;
  return this.save();
};

// Instance method to send reminder
invoiceSchema.methods.sendReminder = function() {
  this.remindersSent += 1;
  this.lastReminderSent = new Date();
  return this.save({ validateBeforeSave: false });
};

// Instance method to create next recurring invoice
invoiceSchema.methods.createNextRecurring = async function() {
  if (!this.isRecurring || !this.recurringPattern) {
    throw new Error('Invoice is not set up for recurring');
  }
  
  const nextMonth = this.period.month === 12 ? 1 : this.period.month + 1;
  const nextYear = this.period.month === 12 ? this.period.year + 1 : this.period.year;
  
  const nextStartDate = new Date(nextYear, nextMonth - 1, 1);
  const nextEndDate = new Date(nextYear, nextMonth, 0);
  
  const nextInvoice = new this.constructor({
    tenantId: this.tenantId,
    roomId: this.roomId,
    accommodationId: this.accommodationId,
    landlordId: this.landlordId,
    tenancyId: this.tenancyId,
    type: this.type,
    period: {
      startDate: nextStartDate,
      endDate: nextEndDate,
      month: nextMonth,
      year: nextYear
    },
    lineItems: this.lineItems,
    taxRate: this.taxRate,
    currency: this.currency,
    dueDate: new Date(nextStartDate.getTime() + (15 * 24 * 60 * 60 * 1000)), // 15 days from start
    isRecurring: true,
    parentInvoiceId: this._id,
    notes: this.notes
  });
  
  return nextInvoice.save();
};

// Static method to find overdue invoices
invoiceSchema.statics.findOverdue = function() {
  return this.find({
    status: { $in: ['sent', 'partial'] },
    dueDate: { $lt: new Date() }
  });
};

// Static method to find invoices by period
invoiceSchema.statics.findByPeriod = function(year, month) {
  return this.find({
    'period.year': year,
    'period.month': month
  });
};

// Static method to find pending invoices for tenant
invoiceSchema.statics.findPendingForTenant = function(tenantId) {
  return this.find({
    tenantId,
    status: { $in: ['sent', 'overdue', 'partial'] }
  }).sort({ dueDate: 1 });
};

// Static method to find invoices for landlord
invoiceSchema.statics.findForLandlord = function(landlordId, status = null) {
  const query = { landlordId };
  if (status) query.status = status;
  return this.find(query).sort({ createdAt: -1 });
};

// Static method to calculate revenue for period
invoiceSchema.statics.calculateRevenue = function(landlordId, startDate, endDate) {
  return this.aggregate([
    {
      $match: {
        landlordId: new mongoose.Types.ObjectId(landlordId),
        status: 'paid',
        paidAt: {
          $gte: startDate,
          $lte: endDate
        }
      }
    },
    {
      $group: {
        _id: null,
        totalRevenue: { $sum: '$totalAmount' },
        invoiceCount: { $sum: 1 }
      }
    }
  ]);
};

module.exports = mongoose.model('Invoice', invoiceSchema);