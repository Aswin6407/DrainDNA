const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const path = require('path');
const fs = require('fs');
const multer = require('multer');

const Drain = require('../models/Drain');
const Inspection = require('../models/Inspection');

// Ensure local uploads directory exists
const uploadDir = path.join(__dirname, '../../uploads/evidence');
try {
  fs.mkdirSync(uploadDir, { recursive: true });
} catch (e) {
  console.warn('Upload directory check:', e.message);
}

// Multer storage configuration for local evidence image persistence
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    cb(null, `evidence-${uniqueSuffix}${ext}`);
  }
});

const fileFilter = (req, file, cb) => {
  const allowedMime = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
  if (allowedMime.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Only JPEG, PNG, WEBP, and GIF images are permitted for evidence upload.'));
  }
};

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5 MB max per image
  fileFilter
});

// Helper for status determination
const calculateStatus = (level) => {
  if (level >= 75) return 'High';
  if (level >= 60) return 'Watch';
  return 'Normal';
};

// GET /api/inspections - Retrieve all inspections (optionally filtered by ?drainId=...)
router.get('/', async (req, res) => {
  try {
    const { drainId } = req.query;
    const filter = {};
    if (drainId) {
      filter.drainId = drainId.trim().toUpperCase();
    }
    const inspections = await Inspection.find(filter).sort({ createdAt: -1 });
    res.json(inspections);
  } catch (error) {
    console.error('Error fetching inspections:', error);
    res.status(500).json({ error: 'Failed to retrieve inspections from database.' });
  }
});

// GET /api/inspections/:id - Retrieve one inspection by inspectionId or ObjectId
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    let inspection = null;

    if (mongoose.Types.ObjectId.isValid(id)) {
      inspection = await Inspection.findById(id).populate('drain', 'id site area level status');
    }

    if (!inspection) {
      inspection = await Inspection.findOne({ inspectionId: id.trim().toUpperCase() }).populate('drain', 'id site area level status');
    }

    if (!inspection) {
      return res.status(404).json({ error: `Inspection record '${id}' not found.` });
    }

    res.json(inspection);
  } catch (error) {
    console.error('Error fetching inspection by ID:', error);
    res.status(500).json({ error: 'Failed to retrieve inspection record.' });
  }
});

// POST /api/inspections - Save new persistent inspection & update drain level/status
router.post('/', upload.array('evidenceImages', 5), async (req, res) => {
  try {
    let {
      inspectionId,
      drainId,
      level,
      inspector,
      notes,
      cartridgeDD_C01,
      cartridgeDD_C02,
      dateDisplay
    } = req.body;

    // Validate drainId
    if (!drainId || typeof drainId !== 'string' || !drainId.trim()) {
      return res.status(400).json({ error: 'Drain ID is required to link inspection record.' });
    }

    const cleanDrainId = drainId.trim().toUpperCase();

    // Verify that the referenced drain exists in MongoDB
    let targetDrain = null;
    if (mongoose.Types.ObjectId.isValid(cleanDrainId)) {
      targetDrain = await Drain.findById(cleanDrainId);
    }
    if (!targetDrain) {
      targetDrain = await Drain.findOne({ id: cleanDrainId });
    }

    if (!targetDrain) {
      return res.status(404).json({
        error: `Referenced drain '${cleanDrainId}' does not exist in the database.`
      });
    }

    // Validate recorded drain level
    const numericLevel = Number(level);
    if (!Number.isFinite(numericLevel) || numericLevel < 0 || numericLevel > 100) {
      return res.status(400).json({
        error: 'Recorded drain level must be a valid number between 0 and 100.'
      });
    }

    const derivedStatus = calculateStatus(numericLevel);

    // Format inspection timestamp
    const now = new Date();
    const formattedDate = dateDisplay || `Today, ${now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;

    // Generate unique human-readable Inspection ID if not provided
    if (inspectionId && typeof inspectionId === 'string' && inspectionId.trim()) {
      inspectionId = inspectionId.trim().toUpperCase();
    } else {
      const year = now.getFullYear();
      const randSuffix = Math.floor(1000 + Math.random() * 9000);
      inspectionId = `INS-${year}-${Date.now().toString().slice(-4)}${randSuffix}`;
      while (await Inspection.exists({ inspectionId })) {
        inspectionId = `INS-${year}-${Date.now().toString().slice(-4)}${Math.floor(1000 + Math.random() * 9000)}`;
      }
    }

    // Process attached evidence images (if uploaded via multer)
    const attachedImages = [];
    if (req.files && Array.isArray(req.files)) {
      for (const f of req.files) {
        attachedImages.push({
          originalName: f.originalname,
          filename: f.filename,
          url: `/uploads/evidence/${f.filename}`,
          size: f.size,
          uploadedAt: now
        });
      }
    } else if (req.body.imageReference) {
      // Support manual image metadata reference passed in body
      attachedImages.push({
        originalName: String(req.body.imageReference),
        filename: String(req.body.imageReference),
        url: '',
        size: 0,
        uploadedAt: now
      });
    }

    // Create the inspection record
    const inspection = new Inspection({
      inspectionId,
      drain: targetDrain._id,
      drainId: targetDrain.id,
      inspectionDate: now,
      dateDisplay: formattedDate,
      level: numericLevel,
      status: derivedStatus,
      inspector: inspector ? String(inspector).trim() : 'Admin Officer (AO)',
      notes: notes ? String(notes).trim() : '',
      cartridgeDD_C01: cartridgeDD_C01 ? String(cartridgeDD_C01).trim() : 'Sediment & debris retention: Normal',
      cartridgeDD_C02: cartridgeDD_C02 ? String(cartridgeDD_C02).trim() : 'Hydraulic exposure indicator: Normal',
      images: attachedImages
    });

    const savedInspection = await inspection.save();

    // Update parent drain record's current level, status, observation date, and image count
    targetDrain.level = numericLevel;
    targetDrain.status = derivedStatus;
    targetDrain.date = formattedDate;
    if (attachedImages.length > 0) {
      targetDrain.images = (targetDrain.images || 0) + attachedImages.length;
    }
    await targetDrain.save();

    res.status(201).json({
      message: 'Inspection record saved and drain status updated successfully.',
      inspection: savedInspection,
      updatedDrain: {
        id: targetDrain.id,
        level: targetDrain.level,
        status: targetDrain.status,
        date: targetDrain.date,
        images: targetDrain.images
      }
    });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(409).json({ error: 'An inspection with this ID already exists.' });
    }
    if (error.name === 'ValidationError') {
      const messages = Object.values(error.errors).map(e => e.message);
      return res.status(400).json({ error: messages.join(', ') });
    }
    console.error('Error creating inspection:', error);
    res.status(500).json({ error: 'Internal server error while saving inspection record.' });
  }
});

module.exports = router;
