const express = require('express');
const path = require('path');
const mongoose = require('mongoose');
require('dotenv').config();

const timetableRoutes = require('./routes/timetableroutes');
const { hydrate } = require('./tracker/hydrate');

const app = express();
app.use(express.json());

// Serve static frontend files (public directory and root fallback)
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.static(path.join(__dirname)));

// Mount API routes (supports both /api/timetable and /api)
app.use('/api/timetable', timetableRoutes);
app.use('/api', timetableRoutes);

const PORT = process.env.PORT || 3000;
const MONGO_URI = process.env.MONGO_URI;

async function startServer() {
    try {
        console.log('[Server] Connecting to MongoDB...');
        await mongoose.connect(MONGO_URI);
        console.log('[Server] Connected to MongoDB.');

        // Hydrate RAM registry from MongoDB
        await hydrate();

        app.listen(PORT, () => {
            console.log(`[Server] Timetable Studio running at http://localhost:${PORT}`);
        });
    } catch (err) {
        console.error('[Server] Failed to start server:', err);
        process.exit(1);
    }
}

startServer();