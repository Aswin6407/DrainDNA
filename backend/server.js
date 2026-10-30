const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const path = require('path');
const dns = require('dns');

// On some Windows / ISP environments, local DNS fails to resolve MongoDB SRV records (querySrv ECONNREFUSED).
// Setting reliable DNS servers ensures consistent SRV resolution for MongoDB Atlas.
try {
  dns.setServers(['8.8.8.8', '1.1.1.1']);
} catch (e) {
  // Graceful fallback if custom DNS servers cannot be set
}

// Ensure root .env is loaded reliably regardless of working directory
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const Drain = require('./models/Drain');
const Inspection = require('./models/Inspection');

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json());

// Serve static frontend assets
app.use(express.static(path.join(__dirname, '../frontend')));

// Serve uploaded evidence media
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

// API Route Mounts
const drainRoutes = require('./routes/drains');
const taskRoutes = require('./routes/tasks');
const reportRoutes = require('./routes/reports');
const inspectionRoutes = require('./routes/inspections');

app.use('/api/drains', drainRoutes);
app.use('/api/tasks', taskRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api/inspections', inspectionRoutes);


// Health check endpoint (reports database connection status without exposing credentials)
app.get('/api/health', (req, res) => {
  const stateMap = {
    0: 'disconnected',
    1: 'connected',
    2: 'connecting',
    3: 'disconnecting'
  };
  const currentState = stateMap[mongoose.connection.readyState] || 'unknown';

  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    database: {
      status: currentState,
      connected: mongoose.connection.readyState === 1
    }
  });
});

// Fallback to frontend index.html for client-side routing
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../frontend/index.html'));
});

// Centralized production error handling middleware
app.use((err, req, res, next) => {
  console.error('Unhandled server error:', err.message);
  if (res.headersSent) {
    return next(err);
  }
  res.status(err.status || 500).json({
    error: process.env.NODE_ENV === 'production' 
      ? 'An internal server error occurred.' 
      : err.message
  });
});


// Initial baseline municipal drain records
const initialSeedDrains = [
  { id: 'CHN-ADY-001', site: 'Adyar', area: 'Canal Road', level: 86, status: 'High', date: 'Today, 09:30', images: 1 },
  { id: 'CHN-ADY-002', site: 'Adyar', area: 'River View Street', level: 64, status: 'Watch', date: 'Today, 08:45', images: 0 },
  { id: 'CHN-VEL-001', site: 'Velachery', area: 'Main Road', level: 72, status: 'Watch', date: 'Yesterday, 16:20', images: 1 },
  { id: 'CHN-VEL-002', site: 'Velachery', area: 'Lake View Avenue', level: 91, status: 'High', date: 'Today, 07:55', images: 1 },
  { id: 'CHN-TNG-001', site: 'T. Nagar', area: 'Usman Road', level: 38, status: 'Normal', date: 'Yesterday, 14:10', images: 0 },
  { id: 'CHN-TNG-002', site: 'T. Nagar', area: 'South Street', level: 58, status: 'Watch', date: 'Yesterday, 12:30', images: 1 },
  { id: 'CHN-ANN-001', site: 'Anna Nagar', area: '2nd Avenue', level: 27, status: 'Normal', date: 'Today, 08:10', images: 0 },
  { id: 'CHN-ANN-002', site: 'Anna Nagar', area: 'West Extension', level: 47, status: 'Normal', date: 'Yesterday, 17:00', images: 0 },
  { id: 'CHN-PER-001', site: 'Perungudi', area: 'Industrial Link Road', level: 83, status: 'High', date: 'Today, 09:05', images: 1 },
  { id: 'CHN-PER-002', site: 'Perungudi', area: 'Lake Bund', level: 68, status: 'Watch', date: 'Yesterday, 15:40', images: 0 },
  { id: 'CHN-GUI-001', site: 'Guindy', area: 'Race Course Road', level: 33, status: 'Normal', date: 'Today, 08:25', images: 0 },
  { id: 'CHN-GUI-002', site: 'Guindy', area: 'Industrial Estate', level: 55, status: 'Normal', date: 'Yesterday, 13:15', images: 0 }
];

// Safe MongoDB Atlas Connection Handler
async function connectDB() {
  const uri = process.env.MONGODB_URI;

  if (!uri || uri.includes('<username>')) {
    console.warn('⚠️ [MongoDB Atlas] Missing or placeholder MONGODB_URI in .env file.');
    console.warn('   Please provide a valid connection string to connect to your Atlas cluster.');
    return;
  }

  // Setup connection event listeners for resilience
  mongoose.connection.on('connected', () => {
    console.log('✓ [MongoDB Atlas] Connected successfully.');
  });

  mongoose.connection.on('error', (err) => {
    console.error('✕ [MongoDB Atlas] Connection runtime error:', err.message);
  });

  mongoose.connection.on('disconnected', () => {
    console.warn('⚠️ [MongoDB Atlas] Disconnected from cluster.');
  });

  try {
    console.log('⏳ [MongoDB Atlas] Connecting to cluster...');
    await mongoose.connect(uri, {
      serverSelectionTimeoutMS: 8000
    });

    // Seed baseline drains if collection is empty
    const count = await Drain.countDocuments();
    if (count === 0) {
      await Drain.insertMany(initialSeedDrains);
      console.log('ℹ [MongoDB Atlas] Initialized database with 12 baseline municipal drain records.');
    } else {
      console.log(`ℹ [MongoDB Atlas] Found ${count} existing registered drains in database.`);
    }

    // Seed baseline inspections if collection is empty
    const inspectionCount = await Inspection.countDocuments();
    if (inspectionCount === 0) {
      const allDrains = await Drain.find();
      const seedInspections = allDrains.map((d, idx) => ({
        inspectionId: `INS-2026-000${idx + 1}`,
        drain: d._id,
        drainId: d.id,
        level: d.level,
        status: d.status,
        dateDisplay: d.date || 'Today, 09:30',
        inspector: 'Admin Officer (AO)',
        notes: `Initial municipal registration baseline observation for ${d.area}.`,
        cartridgeDD_C01: d.status === 'High' ? 'Sediment & debris retention: High accumulation' : 'Sediment & debris retention: Normal',
        cartridgeDD_C02: d.status === 'High' ? 'Hydraulic exposure indicator: Submerged peak' : 'Hydraulic exposure indicator: Normal flow',
        images: d.images > 0 ? [{
          originalName: `baseline-${d.id.toLowerCase()}.jpg`,
          filename: `baseline-${d.id.toLowerCase()}.jpg`,
          url: '',
          size: 154200,
          uploadedAt: new Date()
        }] : []
      }));
      if (seedInspections.length > 0) {
        await Inspection.insertMany(seedInspections);
        console.log(`ℹ [MongoDB Atlas] Initialized database with ${seedInspections.length} baseline inspection records.`);
      }
    } else {
      console.log(`ℹ [MongoDB Atlas] Found ${inspectionCount} existing inspection records in database.`);
    }

  } catch (error) {
    console.error('✕ [MongoDB Atlas] Initial connection failure:', error.message);
    console.error('   Server will continue running in offline/unconnected mode.');
  }
}

// Start Server & Initialize Database Connection
const HOST = '0.0.0.0';
app.listen(PORT, HOST, async () => {
  console.log(`✓ DrainDNA server running on http://${HOST}:${PORT}`);
  await connectDB();
});

