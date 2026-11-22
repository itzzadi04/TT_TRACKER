const express = require('express');
const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');
require('dotenv').config();

const timetableRoutes = require('./routes/timetableroutes');
const { hydrate } = require('./tracker/hydrate');
const { productionWarnings, runShutdown } = require('./config/runtime');

const app = express();
app.disable('x-powered-by');
app.set('trust proxy', 1); // behind the host's proxy: correct client IPs and protocol
app.use((req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    next();
});
app.use(express.json({ limit: '10mb' }));

// Health check for the host and for uptime pingers. 200 only when MongoDB is connected.
app.get('/api/health', (req, res) => {
    const connected = mongoose.connection.readyState === 1;
    res.set('Cache-Control', 'no-store');
    res.status(connected ? 200 : 503).json({
        status: connected ? 'ok' : 'degraded',
        service: 'TT_TRACKER',
        database: connected ? 'connected' : 'disconnected',
        uptimeSeconds: Math.round(process.uptime()),
        timestamp: new Date().toISOString()
    });
});

// Serve static React production build. Built files carry a content hash, so they can be
// cached for a long time; index.html must always be re-checked so new deploys show up.
const distPath = path.join(__dirname, 'frontend/dist');
const indexPath = path.join(distPath, 'index.html');
app.use(express.static(distPath, {
    setHeaders(res, filePath) {
        if (filePath.endsWith('.html')) {
            res.setHeader('Cache-Control', 'no-cache');
        } else if (filePath.includes(`${path.sep}assets${path.sep}`)) {
            res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
        }
    }
}));

// Mount API routes (supports both /api/timetable and /api)
app.use('/api/timetable', timetableRoutes);
app.use('/api', timetableRoutes);

// Unknown API paths answer with JSON, like every other API response
app.use('/api', (req, res) => {
    res.status(404).json({ success: false, error: `Endpoint not found: ${req.method} ${req.originalUrl}` });
});

// SPA fallback: Route all non-API GET requests to React index.html
app.use((req, res, next) => {
    if (req.method === 'GET' && !req.path.startsWith('/api')) {
        if (!fs.existsSync(indexPath)) {
            return res.status(503).type('text/plain').send('The frontend has not been built. Run "npm run build" and restart the server.');
        }
        return res.sendFile(indexPath);
    }
    next();
});

// Malformed JSON, oversized bodies and unexpected errors answer with JSON, never a stack trace
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
    const status = err.status || err.statusCode || 500;
    if (status >= 500) console.error('[Server] Unhandled error:', err);
    res.status(status).json({
        success: false,
        error: status >= 500 ? 'Internal server error' : err.message
    });
});

const PORT = process.env.PORT || 3000;
const MONGO_URI = process.env.MONGO_URI;

let server = null;

async function startServer() {
    if (!MONGO_URI) {
        console.error('[Server] MONGO_URI is not set. Set it in .env (local) or in the host environment settings.');
        process.exit(1);
    }
    productionWarnings().forEach(w => console.warn(`[Server] WARNING: ${w}`));

    try {
        console.log('[Server] Connecting to MongoDB...');
        await mongoose.connect(MONGO_URI, { serverSelectionTimeoutMS: 15000 });
        console.log('[Server] Connected to MongoDB.');

        // Hydrate RAM registry from MongoDB
        await hydrate();

        server = app.listen(PORT, () => {
            console.log(`[Server] Timetable Studio running on port ${PORT}`);
        });
        installShutdownHandlers();
    } catch (err) {
        console.error('[Server] Failed to start server:', err);
        process.exit(1);
    }
}

// Hosts stop a service with SIGTERM on every deploy and when a free instance goes to sleep.
// Week changes (cancel / reschedule / extra class) live only in memory until the weekly
// rollover, so save them to MongoDB before exiting or they would be lost.
function installShutdownHandlers() {
    let stopping = false;
    const stop = async signal => {
        if (stopping) return;
        stopping = true;
        console.log(`[Shutdown] ${signal} received.`);
        setTimeout(() => process.exit(1), 25000).unref(); // stay inside the host's 30 s grace period
        const result = await runShutdown({
            closeServer: () => new Promise(resolve => {
                server.close(resolve);
                if (server.closeIdleConnections) server.closeIdleConnections();
            }),
            flushPending: () => timetableRoutes.flushPendingChanges(),
            disconnectDb: () => mongoose.disconnect()
        });
        process.exit(result.errors.length ? 1 : 0);
    };
    process.once('SIGTERM', () => stop('SIGTERM'));
    process.once('SIGINT', () => stop('SIGINT'));
    process.on('unhandledRejection', err => console.error('[Server] Unhandled promise rejection:', err));
}

if (require.main === module) {
    startServer();
}

module.exports = { app, startServer };
