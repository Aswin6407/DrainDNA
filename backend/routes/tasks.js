const express = require('express');
const router = express.Router();
const Task = require('../models/Task');

// GET /api/tasks - Retrieve maintenance work queue tasks
router.get('/', async (req, res) => {
  try {
    // const tasks = await Task.find().sort({ createdAt: -1 });
    // return res.json(tasks);
    res.status(501).json({
      message: 'MongoDB Atlas integration pending: Task query endpoint ready.'
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// POST /api/tasks - Add maintenance task
router.post('/', async (req, res) => {
  try {
    // const newTask = new Task(req.body);
    // const savedTask = await newTask.save();
    // return res.status(201).json(savedTask);
    res.status(501).json({
      message: 'MongoDB Atlas integration pending: Task creation endpoint ready.'
    });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

module.exports = router;
