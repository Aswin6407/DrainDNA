const mongoose = require('mongoose');

const taskSchema = new mongoose.Schema(
  {
    drainId: {
      type: String,
      required: true,
      uppercase: true,
      trim: true
    },
    action: {
      type: String,
      required: true,
      trim: true
    },
    priority: {
      type: String,
      enum: ['High priority', 'Medium priority', 'Low priority'],
      default: 'Medium priority'
    },
    status: {
      type: String,
      enum: [
        'Pending',
        'Assigned',
        'In Progress',
        'Completed',
        'Awaiting Verification',
        'Verified'
      ],
      default: 'Pending'
    }
  },
  {
    timestamps: true
  }
);

module.exports = mongoose.model('Task', taskSchema);
