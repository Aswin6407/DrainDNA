const express = require('express');
const router = express.Router();
const Report = require('../models/Report');

// GET /api/reports - Retrieve public reports
router.get('/', async (req, res) => {
  try {
    // const reports = await Report.find().sort({ createdAt: -1 });
    // return res.json(reports);
    res.status(501).json({
      message: 'MongoDB Atlas integration pending: Public reports query endpoint ready.'
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// POST /api/reports - Submit a citizen drainage issue report
router.post('/', async (req, res) => {
  try {
    // const newReport = new Report(req.body);
    // const savedReport = await newReport.save();
    // return res.status(201).json(savedReport);
    res.status(501).json({
      message: 'MongoDB Atlas integration pending: Public report submission endpoint ready.'
    });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

module.exports = router;
