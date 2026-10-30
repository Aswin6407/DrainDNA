const mongoose = require('mongoose');

const reportSchema = new mongoose.Schema(
  {
    referenceId: {
      type: String,
      required: true,
      unique: true,
      trim: true
    },
    category: {
      type: String,
      required: true,
      enum: [
        'Waterlogging',
        'Blockage',
        'Overflow',
        'Waste accumulation',
        'Damaged drainage structure',
        'Other'
      ]
    },
    location: {
      type: String,
      required: true,
      trim: true
    },
    description: {
      type: String,
      required: true,
      trim: true
    },
    status: {
      type: String,
      enum: ['Submitted', 'Under Review', 'Action Dispatched', 'Resolved'],
      default: 'Submitted'
    }
  },
  {
    timestamps: true
  }
);

module.exports = mongoose.model('Report', reportSchema);
