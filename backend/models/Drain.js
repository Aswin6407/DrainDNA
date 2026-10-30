const mongoose = require('mongoose');

const drainSchema = new mongoose.Schema(
  {
    id: {
      type: String,
      required: [true, 'Drain ID is required'],
      unique: true,
      uppercase: true,
      trim: true
    },
    site: {
      type: String,
      required: [true, 'Monitoring site is required'],
      trim: true
    },
    area: {
      type: String,
      required: [true, 'Area / street is required'],
      trim: true
    },
    level: {
      type: Number,
      required: [true, 'Recorded level is required'],
      min: [0, 'Level must be at least 0%'],
      max: [100, 'Level cannot exceed 100%']
    },
    status: {
      type: String,
      enum: ['High', 'Watch', 'Normal'],
      default: 'Normal'
    },
    date: {
      type: String,
      default: () => {
        const d = new Date();
        return `Today, ${d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
      }
    },
    images: {
      type: Number,
      default: 0
    }
  },
  {
    timestamps: true
  }
);

module.exports = mongoose.model('Drain', drainSchema);
