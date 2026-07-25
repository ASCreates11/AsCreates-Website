const express = require('express');
const cookieParser = require('cookie-parser');
const path = require('path');
const fs = require('fs');
const compression = require('compression');
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
app.use(compression());
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
            const isStatic = req.path.match(/\.(css|js|png|jpg|jpeg|gif|svg|mp4|webm|webp|ico|txt|xml)$/i) || req.path.startsWith('/Video/') || req.path.startsWith('/uploads/');

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

// Helper to serve HTML with dynamic canonical headers matching the active host domain
function sendHtmlWithDynamicCanonical(req, res, pageName) {
    const filePath = path.join(__dirname, 'public', pageName);
    if (!fs.existsSync(filePath)) {
        return res.status(404).send('Not Found');
    }
    let html = fs.readFileSync(filePath, 'utf8');
    const protocol = req.headers['x-forwarded-proto'] || req.protocol || 'https';
    const host = req.get('host');
    const baseUrl = `${protocol}://${host}`;
    
    // Replace placeholder domain with actual domain in canonical tags
    html = html.replace(/https:\/\/ascreates\.vercel\.app/g, baseUrl);
    
    // Server-side inject active promo settings to eliminate Cumulative Layout Shift (CLS)
    db.get("SELECT value FROM settings WHERE key = 'promo'", (err, row) => {
        let promo = {};
        if (!err && row && row.value) {
            try {
                promo = JSON.parse(row.value);
            } catch (e) {}
        } else {
            try {
                const localSettings = JSON.parse(fs.readFileSync(path.join(__dirname, 'settings.json'), 'utf8'));
                promo = localSettings.promo || {};
            } catch (e) {}
        }

        if (promo && promo.enabled) {
            // 1. Add 'has-promo-bar' class to body
            if (html.includes('<body')) {
                html = html.replace(/<body([^>]*)>/, (match, attrs) => {
                    if (attrs.includes('class=')) {
                        return `<body${attrs.replace(/class=["']([^"']*)["']/, 'class="$1 has-promo-bar"')}>`;
                    } else {
                        return `<body class="has-promo-bar"${attrs}>`;
                    }
                });
            }


            // 3. Pre-fill marquee content and set speed style
            if (promo.text) {
                const escapeHtml = (unsafe) => {
                    return unsafe
                        .replace(/&/g, "&amp;")
                        .replace(/</g, "&lt;")
                        .replace(/>/g, "&gt;")
                        .replace(/"/g, "&quot;")
                        .replace(/'/g, "&#039;");
                };
                const escapedText = escapeHtml(promo.text);
                const escapedLinkText = escapeHtml(promo.btnText || "Today's Exclusive Pricing");
                const escapedLinkUrl = escapeHtml(promo.btnUrl || "/contact");
                
                const innerHtml = `<span class="promo-text-node">${escapedText}</span><a href="${escapedLinkUrl}" class="promo-link-node promotion-bar-btn">${escapedLinkText}</a>`;
                let marqueeHtml = '';
                for (let i = 0; i < 20; i++) {
                    marqueeHtml += `<div class="promotion-bar-inner" ${i > 0 ? 'aria-hidden="true"' : ''}>${innerHtml}</div>`;
                }

                html = html.replace(/<div class="promotion-marquee"[^>]*>([\s\S]*?)<\/div>/, `<div class="promotion-marquee" id="promotionMarquee" style="animation-duration: ${(promo.speed || 15) * 10}s;">${marqueeHtml}</div>`);
            }
        }

        res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
        res.setHeader('X-Robots-Tag', 'index, follow');
        res.send(html);
    });
}

// Serve public HTML pages with dynamic canonical tags
app.get(['/', '/index.html'], (req, res) => sendHtmlWithDynamicCanonical(req, res, 'index.html'));
app.get('/about', (req, res) => sendHtmlWithDynamicCanonical(req, res, 'about.html'));
app.get('/services', (req, res) => sendHtmlWithDynamicCanonical(req, res, 'services.html'));
app.get('/contact', (req, res) => sendHtmlWithDynamicCanonical(req, res, 'contact.html'));
app.get('/portfolio', (req, res) => sendHtmlWithDynamicCanonical(req, res, 'portfolio.html'));
app.get('/coming-soon', (req, res) => sendHtmlWithDynamicCanonical(req, res, 'coming-soon.html'));
app.get('/maintenance', (req, res) => sendHtmlWithDynamicCanonical(req, res, 'maintenance.html'));

// Serve static files (Frontend & Admin UI) with 1-year caching for assets, but NO CACHE for HTML
app.use(express.static(path.join(__dirname, 'public'), {
    maxAge: 31536000000,
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

// Admin panel HTML routes
app.get('/admin/login', (req, res) => res.sendFile(path.join(__dirname, 'public', 'admin', 'login.html')));
app.get('/admin/dashboard', (req, res) => res.sendFile(path.join(__dirname, 'public', 'admin', 'dashboard.html')));

// Dynamic Sitemap Route
app.get('/sitemap.xml', (req, res) => {
    const protocol = req.headers['x-forwarded-proto'] || req.protocol || 'https';
    const host = req.get('host');
    const baseUrl = `${protocol}://${host}`;

    db.all('SELECT id FROM portfolio WHERE published=1', (err, rows) => {
        let xml = `<?xml version="1.0" encoding="UTF-8"?>\n`;
        xml += `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n`;
        
        // Static Pages
        const staticPages = ['', 'about', 'services', 'portfolio', 'contact'];
        staticPages.forEach(p => {
            const loc = p ? `${baseUrl}/${p}` : `${baseUrl}/`;
            xml += `  <url>\n    <loc>${loc}</loc>\n    <changefreq>monthly</changefreq>\n    <priority>${p ? '0.8' : '1.0'}</priority>\n  </url>\n`;
        });
        
        // Dynamic Case Studies
        if (!err && rows) {
            rows.forEach(item => {
                xml += `  <url>\n    <loc>${baseUrl}/portfolio?project=${item.id}</loc>\n    <changefreq>monthly</changefreq>\n    <priority>0.7</priority>\n  </url>\n`;
            });
        }
        
        xml += `</urlset>`;
        res.header('Content-Type', 'application/xml; charset=utf-8');
        res.header('X-Robots-Tag', 'index, follow');
        res.send(xml);
    });
});

// 301 Redirect legacy .html extension to clean URLs
app.get(['/about.html', '/services.html', '/contact.html', '/portfolio.html', '/coming-soon.html', '/maintenance.html', '/admin/login.html', '/admin/dashboard.html'], (req, res) => {
    const cleanPath = req.path.replace(/\.html$/, '');
    res.redirect(301, cleanPath);
});

// Admin Dashboard Route
app.get('/admin', (req, res) => {
    res.redirect('/admin/login');
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
