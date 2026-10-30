const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const Drain = require('../models/Drain');
const Inspection = require('../models/Inspection');

// Helper to determine status based on percentage level
const calculateStatus = (level) => {
  if (level >= 75) return 'High';
  if (level >= 60) return 'Watch';
  return 'Normal';
};

// GET /api/drains - Retrieve all registered drains from MongoDB
router.get('/', async (req, res) => {
  try {
    const drains = await Drain.find().sort({ createdAt: -1 });
    res.json(drains);
  } catch (error) {
    console.error('Error fetching drains:', error);
    res.status(500).json({ error: 'Failed to retrieve drains from database.' });
  }
});

// POST /api/drains - Validate and save a new drain to MongoDB
router.post('/', async (req, res) => {
  try {
    let { id, site, area, level, date, images } = req.body;

    // Field presence and type validations
    if (!site || typeof site !== 'string' || !site.trim()) {
      return res.status(400).json({ error: 'Monitoring site is required.' });
    }
    if (!area || typeof area !== 'string' || !area.trim()) {
      return res.status(400).json({ error: 'Area or street label is required.' });
    }

    const numericLevel = Number(level);
    if (!Number.isFinite(numericLevel) || numericLevel < 0 || numericLevel > 100) {
      return res.status(400).json({ error: 'Recorded level must be a valid number between 0 and 100.' });
    }

    // Process or generate unique human-readable Drain ID
    if (id && typeof id === 'string' && id.trim()) {
      id = id.trim().toUpperCase();
      // Validate pattern: alphanumeric with hyphens, 3 to 20 chars
      if (!/^[A-Z0-9-]{3,20}$/.test(id)) {
        return res.status(400).json({
          error: 'Drain ID must be 3-20 characters long and contain only letters, numbers, and hyphens.'
        });
      }
    } else {
      // Auto-generate human-readable ID based on site code, e.g. CHN-ADY-013
      const cleanSite = site.trim();
      const prefix = cleanSite.substring(0, 3).toUpperCase();
      const count = await Drain.countDocuments({ site: cleanSite });
      let seq = count + 1;
      let generatedId = `CHN-${prefix}-${String(seq).padStart(3, '0')}`;
      
      // Ensure generated ID is not conflicting
      while (await Drain.exists({ id: generatedId })) {
        seq += 1;
        generatedId = `CHN-${prefix}-${String(seq).padStart(3, '0')}`;
      }
      id = generatedId;
    }

    // Duplicate check
    const existing = await Drain.findOne({ id });
    if (existing) {
      return res.status(409).json({ error: `Drain ID '${id}' already exists. Please choose a unique ID.` });
    }

    const status = calculateStatus(numericLevel);

    if (!date) {
      const now = new Date();
      date = `Today, ${now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
    }

    const drain = new Drain({
      id,
      site: site.trim(),
      area: area.trim(),
      level: numericLevel,
      status,
      date,
      images: Number(images) || 0
    });

    const savedDrain = await drain.save();
    return res.status(201).json(savedDrain);
  } catch (error) {
    if (error.code === 11000) {
      return res.status(409).json({ error: 'A drain with this ID already exists in the database.' });
    }
    if (error.name === 'ValidationError') {
      const messages = Object.values(error.errors).map(e => e.message);
      return res.status(400).json({ error: messages.join(', ') });
    }
    console.error('Error creating drain:', error);
    res.status(500).json({ error: 'Internal server error while registering drain.' });
  }
});

// GET /api/drains/:id - Retrieve one drain by its MongoDB ID (or human-readable ID)
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    let drain = null;

    // Check if queried by valid MongoDB ObjectId
    if (mongoose.Types.ObjectId.isValid(id)) {
      drain = await Drain.findById(id);
    }

    // Fallback to human-readable Drain ID
    if (!drain) {
      drain = await Drain.findOne({ id: id.trim().toUpperCase() });
    }

    if (!drain) {
      return res.status(404).json({ error: `Drain '${id}' not found.` });
    }

    res.json(drain);
  } catch (error) {
    console.error('Error fetching drain by ID:', error);
    res.status(500).json({ error: 'Failed to retrieve drain details.' });
  }
});

// PATCH /api/drains/:id/observation - Update drain level observation in MongoDB
router.patch('/:id/observation', async (req, res) => {
  try {
    const { id } = req.params;
    const { level, note } = req.body;

    const numericLevel = Number(level);
    if (!Number.isFinite(numericLevel) || numericLevel < 0 || numericLevel > 100) {
      return res.status(400).json({ error: 'Level observation must be a number between 0 and 100.' });
    }

    const status = calculateStatus(numericLevel);
    const now = new Date();
    const date = `Today, ${now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;

    let query = { id: id.trim().toUpperCase() };
    if (mongoose.Types.ObjectId.isValid(id)) {
      query = { $or: [{ _id: id }, { id: id.trim().toUpperCase() }] };
    }

    const updated = await Drain.findOneAndUpdate(
      query,
      { level: numericLevel, status, date },
      { new: true, runValidators: true }
    );

    if (!updated) {
      return res.status(404).json({ error: `Drain '${id}' not found.` });
    }

    res.json(updated);
  } catch (error) {
    console.error('Error updating observation:', error);
    res.status(500).json({ error: 'Failed to update observation.' });
  }
});

// GET /api/drains/:id/inspections - Retrieve inspection history for a specific drain
router.get('/:id/inspections', async (req, res) => {
  try {
    const { id } = req.params;
    let drain = null;

    if (mongoose.Types.ObjectId.isValid(id)) {
      drain = await Drain.findById(id);
    }
    if (!drain) {
      drain = await Drain.findOne({ id: id.trim().toUpperCase() });
    }

    if (!drain) {
      return res.status(404).json({ error: `Drain '${id}' not found.` });
    }

    // Retrieve all inspections linked to this drain, sorted newest first
    const inspections = await Inspection.find({
      $or: [{ drain: drain._id }, { drainId: drain.id }]
    }).sort({ createdAt: -1 });

    res.json({
      drainId: drain.id,
      drainMongoId: drain._id,
      count: inspections.length,
      inspections
    });
  } catch (error) {
    console.error('Error retrieving drain inspections:', error);
    res.status(500).json({ error: 'Failed to retrieve drain inspection history.' });
  }
});

module.exports = router;

