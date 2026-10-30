const mongoose = require('mongoose');

const inspectionSchema = new mongoose.Schema(
  {
    inspectionId: {
      type: String,
      required: [true, 'Inspection ID is required'],
      unique: true,
      uppercase: true,
      trim: true
    },
    drain: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Drain',
      required: [true, 'Referenced Drain document is required']
    },
    drainId: {
      type: String,
      required: [true, 'Drain ID is required'],
      uppercase: true,
      trim: true
    },
    inspectionDate: {
      type: Date,
      default: Date.now
    },
    dateDisplay: {
      type: String,
      default: () => {
        const now = new Date();
        return `Today, ${now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
      }
    },
    level: {
      type: Number,
      required: [true, 'Recorded drain level is required'],
      min: [0, 'Level must be at least 0%'],
      max: [100, 'Level cannot exceed 100%']
    },
    status: {
      type: String,
      enum: ['High', 'Watch', 'Normal'],
      required: true
    },
    inspector: {
      type: String,
      default: 'Admin Officer (AO)'
    },
    notes: {
      type: String,
      default: ''
    },
    cartridgeDD_C01: {
      type: String,
      default: 'Sediment & debris retention: Normal'
    },
    cartridgeDD_C02: {
      type: String,
      default: 'Hydraulic exposure indicator: Normal'
    },
    images: [
      {
        originalName: { type: String, default: '' },
        filename: { type: String, default: '' },
        url: { type: String, default: '' },
        size: { type: Number, default: 0 },
        uploadedAt: { type: Date, default: Date.now }
      }
    ]
  },
  {
    timestamps: true
  }
);

// Index for high-performance drain history queries
inspectionSchema.index({ drainId: 1, createdAt: -1 });
inspectionSchema.index({ drain: 1, createdAt: -1 });

module.exports = mongoose.model('Inspection', inspectionSchema);
