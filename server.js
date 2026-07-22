const express = require('express');
const cookieParser = require('cookie-parser');
const path = require('path');
const fs = require('fs');
require('dotenv').config();
const db = require('./db');

process.on('uncaughtException', (err) => {
    console.error('Uncaught Exception:', err.stack);
});
process.on('unhandledRejection', (reason) => {
    console.error('Unhandled Rejection:', reason);
});

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));
app.use(cookieParser());

// Live status & Maintenance mode middleware
app.use((req, res, next) => {
    db.get("SELECT value FROM settings WHERE key = 'general'", (err, row) => {
        try {
            let settings = {};
            if (row && row.value) {
                settings = JSON.parse(row.value);
            } else if (fs.existsSync(path.join(__dirname, 'settings.json'))) {
                // Fallback to local file for migration purposes
                const localSettings = JSON.parse(fs.readFileSync(path.join(__dirname, 'settings.json'), 'utf8'));
                settings = localSettings.general || {};
            }

            const maintenance = settings.maintenance;
            const isDeployed = settings.isDeployed !== false;

            const isAdmin = req.path.startsWith('/admin') || req.path.startsWith('/api/admin');
            const isApi = req.path.startsWith('/api');
            const isStatic = req.path.match(/\.(css|js|png|jpg|jpeg|gif|svg|mp4|webm|webp|ico)$/i) || req.path.startsWith('/Video/') || req.path.startsWith('/uploads/');

            if (!isAdmin && !isApi && !isStatic && req.method === 'GET') {
                if (!isDeployed) {
                    return res.sendFile(path.join(__dirname, 'public', 'coming-soon.html'));
                }
                if (maintenance) {
                    return res.sendFile(path.join(__dirname, 'public', 'maintenance.html'));
                }
            }
            next();
        } catch (e) {
            console.error('Maintenance check error:', e.message);
            next();
        }
    });
});

// Serve static files (Frontend & Admin UI) with 1-year caching for assets, but NO CACHE for HTML
app.use(express.static(path.join(__dirname, 'public'), {
    maxAge: '1y',
    etag: true,
    setHeaders: (res, filePath) => {
        if (filePath.endsWith('.html')) {
            res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
        }
    }
}));

// Routes
const { router: authRoutes } = require('./routes/auth');
const apiRoutes = require('./routes/api');

app.use('/api/admin', authRoutes);
app.use('/api', apiRoutes);

// Favicon route
app.get(['/favicon.ico', '/favicon.png'], (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'favicon.png'));
});

// Admin Dashboard Route
app.get('/admin', (req, res) => {
    res.redirect('/admin/login.html');
});

// Fallback for frontend SPA routing if needed
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Global error handling middleware (catches JSON parse errors, etc.)
// Must be defined AFTER all routes
app.use((err, req, res, next) => {
    if (err.type === 'entity.parse.failed') {
        return res.status(400).json({ error: 'Invalid JSON in request body' });
    }
    console.error('Unhandled error:', err.message);
    res.status(500).json({ error: 'Internal server error' });
});

// Start Server
if (require.main === module) {
    app.listen(PORT, () => {
        console.log(`Server is running on http://localhost:${PORT}`);
        console.log(`Admin panel: http://localhost:${PORT}/admin/login.html`);
    });
}
module.exports = app;
