const express = require('express');
const db = require('../db');
const { requireAuth } = require('./auth');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

const router = express.Router();

// File upload setup
const { CloudinaryStorage } = require('multer-storage-cloudinary');
const cloudinary = require('cloudinary').v2;
cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET
});
const storage = new CloudinaryStorage({
    cloudinary: cloudinary,
    params: {
        folder: 'as_creates',
    },
});
const upload = multer({ storage });

// --- SETTINGS.JSON MANAGER ---
const getSettings = () => {
    return new Promise((resolve) => {
        db.all('SELECT key, value FROM settings', (err, rows) => {
            if (err || !rows) return resolve({});
            const settings = {};
            rows.forEach(row => {
                settings[row.key] = JSON.parse(row.value);
            });
            resolve(settings);
        });
    });
};

const saveSettings = async (newSettings) => {
    const current = await getSettings();
    const updated = deepMerge(current, newSettings);

    for (const key of Object.keys(updated)) {
        const value = JSON.stringify(updated[key]);
        db.get('SELECT id FROM settings WHERE key = ?', [key], (err, row) => {
            if (row) {
                db.run('UPDATE settings SET value = ? WHERE key = ?', [value, key]);
            } else {
                db.run('INSERT INTO settings (key, value) VALUES (?, ?)', [key, value]);
            }
        });
    }
    return updated;
};

function deepMerge(target, source) {
    const output = { ...target };
    for (const key in source) {
        if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key])) {
            output[key] = deepMerge(output[key] || {}, source[key]);
        } else {
            output[key] = source[key];
        }
    }
    return output;
}

// GET /api/settings - Public
router.get('/settings', async (req, res) => {
    res.json(await getSettings());
});

// GET /api/site-images - Public (media settings for hydration)
router.get('/site-images', async (req, res) => {
    const settings = await getSettings();
    const media = settings.media || {};

    // Support the old hydration format index.html expects:
    // { agency_image: {url}, how_we_work_image: {url}, ... }
    const response = {
        agency_image: { url: (media.our_agency || {}).image },
        how_we_work_image: {
            url: (media.how_we_work || {}).image,
            images: (media.how_we_work || {}).images || [] // Support new carousel array
        },
        about_story_image: { url: (media.our_journey || {}).image },
        services_methodology_image: { url: (media.methodology || {}).image }
    };
    res.json(response);
});

// GET /api/socials - Public (visible social platforms)
router.get('/socials', async (req, res) => {
    const s = await getSettings();
    const socials = (s.socials || []).filter(x => x.visible !== false);
    res.json(socials);
});

// POST settings (Protected)
router.post('/admin/settings/general', requireAuth, async (req, res) => {
    await saveSettings({ general: req.body });
    res.json({ success: true });
});
router.post('/admin/settings/promo', requireAuth, async (req, res) => {
    await saveSettings({ promo: req.body });
    res.json({ success: true });
});
router.post('/admin/settings/socials', requireAuth, async (req, res) => {
    await saveSettings({ socials: req.body.socials });
    res.json({ success: true });
});
router.post('/admin/settings/contact', requireAuth, async (req, res) => {
    await saveSettings({ contact: req.body });
    res.json({ success: true });
});

router.post('/admin/settings/contact-form', requireAuth, async (req, res) => {
    await saveSettings({ contactFormConfig: req.body });
    res.json({ success: true });
});

// GET /api/promotion - Public
router.get('/promotion', async (req, res) => {
    const settings = await getSettings();
    const promo = settings.promo || {};
    const popup = (settings.promo && settings.promo.popup) || {};
    const isActive = !!promo.enabled;
    const response = {
        is_active: isActive,
        text: promo.text || '',
        link_text: promo.btnText || "Today's Exclusive Pricing",
        link_url: promo.btnUrl || '#',
        speed: typeof promo.speed === 'number' ? promo.speed : 15,
        floating_image_active: 0,
        floating_image_url: null,
        floating_image_url_mobile: null,
        popup: {
            enabled: !!popup.enabled,
            desktop_image: popup.desktop_image || null,
            mobile_image: popup.mobile_image || null,
            link_url: popup.link_url || '#'
        }
    };
    res.json(response);
});

// --- PORTFOLIO ---
// GET /api/portfolio (Public - only published)
router.get('/portfolio', (req, res) => {
    db.all('SELECT id, title, category, description, image_url, project_link, col_span, video_url, is_featured, year, gallery_type, gallery_urls FROM portfolio WHERE published=1 ORDER BY is_featured DESC, updated_at DESC, id DESC', (err, rows) => {
        if (err) return res.status(500).json({ error: 'DB Error' });
        res.json(rows);
    });
});
// GET /api/portfolio/categories (Public)
router.get('/portfolio/categories', (req, res) => {
    db.all('SELECT DISTINCT category FROM portfolio WHERE published=1', (err, rows) => {
        if (err) return res.status(500).json({ error: 'DB Error' });
        res.json(rows ? rows.map(r => r.category).filter(Boolean) : []);
    });
});
// GET /api/admin/portfolio/categories (Admin)
router.get('/admin/portfolio/categories', requireAuth, (req, res) => {
    db.all('SELECT DISTINCT category FROM portfolio', (err, rows) => {
        if (err) return res.status(500).json({ error: 'DB Error' });
        res.json(rows ? rows.map(r => r.category).filter(Boolean) : []);
    });
});
// GET /api/portfolio/:id (Public - single project)
router.get('/portfolio/:id', (req, res) => {
    db.get('SELECT * FROM portfolio WHERE id=? AND published=1', [req.params.id], (err, row) => {
        if (err) return res.status(500).json({ error: 'DB Error' });
        if (!row) return res.status(404).json({ error: 'Not found' });
        res.json(row);
    });
});
// GET /api/admin/portfolio (Admin - all)
router.get('/admin/portfolio', requireAuth, (req, res) => {
    db.all('SELECT * FROM portfolio ORDER BY is_featured DESC, updated_at DESC, id DESC', (err, rows) => {
        if (err) return res.status(500).json({ error: 'DB Error' });
        res.json(rows);
    });
});
// POST /api/admin/portfolio
router.post('/admin/portfolio', requireAuth, (req, res) => {
    const { title, category, description, full_description, project_link, image_url, is_featured, published, gallery_type, gallery_urls, video_url, year } = req.body;
    db.run(`INSERT INTO portfolio (title, category, description, full_description, project_link, image_url, is_featured, published, gallery_type, gallery_urls, video_url, year, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)`,
        [title, category, description, full_description || '', project_link || '', image_url || '', is_featured ? 1 : 0, published ? 1 : 0, gallery_type || '16:9', gallery_urls || '', video_url || '', year || null],
        function (err) {
            if (err) return res.status(500).json({ error: 'DB Error' });
            res.json({ success: true, id: this.lastID });
        });
});
// PUT /api/admin/portfolio/:id
router.put('/admin/portfolio/:id', requireAuth, (req, res) => {
    const { title, category, description, full_description, project_link, image_url, is_featured, published, gallery_type, gallery_urls, video_url, year } = req.body;
    db.run(`UPDATE portfolio SET title=?, category=?, description=?, full_description=?, project_link=?, image_url=?, is_featured=?, published=?, gallery_type=?, gallery_urls=?, video_url=?, year=?, updated_at=CURRENT_TIMESTAMP WHERE id=?`,
        [title, category, description, full_description || '', project_link || '', image_url || '', is_featured ? 1 : 0, published ? 1 : 0, gallery_type || '16:9', gallery_urls || '', video_url || '', year || null, req.params.id],
        function (err) {
            if (err) return res.status(500).json({ error: 'DB Error' });
            res.json({ success: true });
        });
});
// DELETE /api/admin/portfolio/:id
router.delete('/admin/portfolio/:id', requireAuth, (req, res) => {
    db.run('DELETE FROM portfolio WHERE id=?', [req.params.id], function (err) {
        if (err) return res.status(500).json({ error: 'DB Error' });
        res.json({ success: true });
    });
});

// --- SERVICES ---
// GET /api/services (Public)
router.get('/services', (req, res) => {
    db.all('SELECT id, title, description, icon_svg, features, is_active, display_order FROM services WHERE is_active = 1 ORDER BY display_order ASC, id ASC', (err, rows) => {
        if (err) {
            console.error('DB Error GET /api/services:', err);
            return res.status(500).json({ error: 'DB Error', details: err.message });
        }
        res.json(rows);
    });
});
// GET /api/admin/services (Admin)
router.get('/admin/services', requireAuth, (req, res) => {
    db.all('SELECT id, title, description, icon_svg, features, is_active, display_order, created_at FROM services ORDER BY display_order ASC, id ASC', (err, rows) => {
        if (err) {
            console.error('DB Error GET /api/admin/services:', err);
            return res.status(500).json({ error: 'DB Error', details: err.message });
        }
        res.json(rows);
    });
});
// POST /api/admin/services
router.post('/admin/services', requireAuth, (req, res) => {
    const { title, description, icon_svg, features, is_active, display_order } = req.body;
    db.run(`INSERT INTO services (title, description, icon_svg, features, is_active, display_order)
            VALUES (?, ?, ?, ?, ?, ?)`,
        [title, description, icon_svg, features || '[]', is_active ? 1 : 0, display_order || 0],
        function (err) {
            if (err) return res.status(500).json({ error: 'DB Error' });
            res.json({ success: true, id: this.lastID });
        });
});
// PUT /api/admin/services/:id
router.put('/admin/services/:id', requireAuth, (req, res) => {
    const { title, description, icon_svg, features, is_active, display_order } = req.body;
    db.run(`UPDATE services SET title=?, description=?, icon_svg=?, features=?, is_active=?, display_order=? WHERE id=?`,
        [title, description, icon_svg, features || '[]', is_active ? 1 : 0, display_order || 0, req.params.id],
        function (err) {
            if (err) return res.status(500).json({ error: 'DB Error' });
            res.json({ success: true });
        });
});
// DELETE /api/admin/services/:id
router.delete('/admin/services/:id', requireAuth, (req, res) => {
    db.run('DELETE FROM services WHERE id=?', [req.params.id], function (err) {
        if (err) return res.status(500).json({ error: 'DB Error' });
        res.json({ success: true });
    });
});

// --- TESTIMONIALS ---
// GET /api/testimonials (Public - only published)
router.get('/testimonials', (req, res) => {
    db.all('SELECT id, author_name as name, author_role as role, quote, rating, author_image as avatar, display_order FROM testimonials WHERE published = 1 ORDER BY display_order ASC, id DESC', (err, rows) => {
        if (err) return res.status(500).json({ error: 'DB Error' });
        res.json(rows);
    });
});
// GET /api/admin/testimonials (Admin - all)
router.get('/admin/testimonials', requireAuth, (req, res) => {
    db.all('SELECT id, author_name as name, author_role as role, quote, rating, author_image as avatar, published, display_order FROM testimonials ORDER BY display_order ASC, id DESC', (err, rows) => {
        if (err) return res.status(500).json({ error: 'DB Error' });
        res.json(rows);
    });
});
// POST /api/admin/testimonials
router.post('/admin/testimonials', requireAuth, (req, res) => {
    const { name, role, quote, rating, avatar, published, display_order } = req.body;
    db.run(`INSERT INTO testimonials (author_name, author_role, quote, rating, author_image, published, display_order)
            VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [name, role, quote, rating || 5, avatar, published ? 1 : 0, display_order || 0],
        function (err) {
            if (err) return res.status(500).json({ error: 'DB Error' });
            res.json({ success: true, id: this.lastID });
        });
});
// PUT /api/admin/testimonials/:id
router.put('/admin/testimonials/:id', requireAuth, (req, res) => {
    const { name, role, quote, rating, avatar, published, display_order } = req.body;
    db.run(`UPDATE testimonials SET author_name=?, author_role=?, quote=?, rating=?, author_image=?, published=?, display_order=? WHERE id=?`,
        [name, role, quote, rating || 5, avatar, published ? 1 : 0, display_order || 0, req.params.id],
        function (err) {
            if (err) return res.status(500).json({ error: 'DB Error' });
            res.json({ success: true });
        });
});
// DELETE /api/admin/testimonials/:id
router.delete('/admin/testimonials/:id', requireAuth, (req, res) => {
    db.run('DELETE FROM testimonials WHERE id=?', [req.params.id], function (err) {
        if (err) return res.status(500).json({ error: 'DB Error' });
        res.json({ success: true });
    });
});

// --- TEAM ---
// GET /api/team (Public - only visible)
router.get('/team', (req, res) => {
    db.all('SELECT id, name, role, bio, image_url, pov_pre_heading, pov_title, pov_text, display_order, photo, visible, is_founder FROM team WHERE visible = 1 ORDER BY display_order ASC, id ASC', (err, rows) => {
        if (err) return res.status(500).json({ error: 'DB Error' });
        res.json(rows);
    });
});

// GET /api/admin/team (Admin)
router.get('/admin/team', requireAuth, (req, res) => {
    db.all('SELECT * FROM team ORDER BY id ASC', (err, rows) => {
        if (err) return res.status(500).json({ error: 'DB Error' });
        res.json(rows);
    });
});

// POST /api/admin/team
router.post('/admin/team', requireAuth, (req, res) => {
    const { name, role, bio, photo, visible, is_founder, pov_pre_heading, pov_title, pov_text } = req.body;
    const imageUrl = (photo || '').trim() || 'https://via.placeholder.com/400x400?text=Team+Member';
    db.run(`INSERT INTO team (name, role, bio, image_url, photo, visible, is_founder, pov_pre_heading, pov_title, pov_text)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [name, role, bio, imageUrl, photo, visible ? 1 : 0, is_founder ? 1 : 0, pov_pre_heading || '', pov_title || '', pov_text || ''],
        function (err) {
            if (err) return res.status(500).json({ error: 'DB Error' });
            res.json({ success: true, id: this.lastID });
        });
});
// PUT /api/admin/team/:id
router.put('/admin/team/:id', requireAuth, (req, res) => {
    const { name, role, bio, photo, visible, is_founder, pov_pre_heading, pov_title, pov_text } = req.body;
    const imageUrl = (photo || '').trim() || 'https://via.placeholder.com/400x400?text=Team+Member';
    db.run(`UPDATE team SET name=?, role=?, bio=?, image_url=?, photo=?, visible=?, is_founder=?, pov_pre_heading=?, pov_title=?, pov_text=? WHERE id=?`,
        [name, role, bio, imageUrl, photo, visible ? 1 : 0, is_founder ? 1 : 0, pov_pre_heading || '', pov_title || '', pov_text || '', req.params.id],
        function (err) {
            if (err) return res.status(500).json({ error: 'DB Error' });
            res.json({ success: true });
        });
});
// DELETE /api/admin/team/:id
router.delete('/admin/team/:id', requireAuth, (req, res) => {
    db.run('DELETE FROM team WHERE id=?', [req.params.id], function (err) {
        if (err) return res.status(500).json({ error: 'DB Error' });
        res.json({ success: true });
    });
});

// --- FILE UPLOAD (Admin only) ---
router.post('/admin/upload', requireAuth, upload.single('image'), (req, res) => {
    if (!req.file) {
        return res.status(400).json({ success: false, error: 'No file uploaded' });
    }
    // Return the URL for the uploaded file
    res.json({ success: true, url: req.file.path });
});

// --- CONTACT LEADS ---
// Public POST route
router.post('/contact', async (req, res) => {
    const { name, email, mobile, service, message, custom_requirement } = req.body;
    if (!name) return res.status(400).json({ error: 'Name is required' });

    const settings = await getSettings();
    const contactFormEnabled = settings.general && settings.general.contactForm !== false;
    if (!contactFormEnabled) {
        return res.status(503).json({ error: 'Contact form is temporarily disabled. Please try again later.' });
    }

    db.run(
        `INSERT INTO leads (name, email, mobile, service, message, custom_requirement) VALUES (?, ?, ?, ?, ?, ?)`,
        [name, email, mobile, service, message, custom_requirement || null],
        function (err) {
            if (err) return res.status(500).json({ error: 'DB Error' });
            res.json({ success: true, id: this.lastID });
        }
    );
});

// Admin GET route
router.get('/admin/leads', requireAuth, (req, res) => {
    db.all('SELECT * FROM leads ORDER BY id DESC', (err, rows) => {
        if (err) return res.status(500).json({ error: 'DB Error' });
        res.json(rows);
    });
});

// Admin DELETE route
router.delete('/admin/leads/:id', requireAuth, (req, res) => {
    db.run('DELETE FROM leads WHERE id = ?', [req.params.id], function (err) {
        if (err) return res.status(500).json({ error: 'DB Error' });
        res.json({ success: true });
    });
});

// Admin PUT mark-as-read route
router.put('/admin/leads/:id/read', requireAuth, (req, res) => {
    const isRead = req.body.is_read ? 1 : 0;
    db.run('UPDATE leads SET is_read = ? WHERE id = ?', [isRead, req.params.id], function (err) {
        if (err) return res.status(500).json({ error: 'DB Error' });
        res.json({ success: true });
    });
});
// --- HOME SERVICES ---
// GET /api/home-services (Public)
router.get('/home-services', (req, res) => {
    db.all('SELECT * FROM home_services WHERE is_active = 1 ORDER BY display_order ASC, id ASC', (err, rows) => {
        if (err) return res.status(500).json({ error: 'DB Error' });
        res.json(rows);
    });
});

// GET /api/admin/home-services (Admin)
router.get('/admin/home-services', requireAuth, (req, res) => {
    db.all('SELECT * FROM home_services ORDER BY display_order ASC, id ASC', (err, rows) => {
        if (err) return res.status(500).json({ error: 'DB Error' });
        res.json(rows);
    });
});

// POST /api/admin/home-services
router.post('/admin/home-services', requireAuth, (req, res) => {
    const { title, description, icon_svg, is_featured, is_active, display_order } = req.body;
    db.run(
        `INSERT INTO home_services (title, description, icon_svg, is_featured, is_active, display_order) VALUES (?, ?, ?, ?, ?, ?)`,
        [title, description, icon_svg, is_featured ? 1 : 0, is_active ? 1 : 0, display_order || 0],
        function (err) {
            if (err) return res.status(500).json({ error: 'DB Error' });
            res.json({ success: true, id: this.lastID });
        }
    );
});

// PUT /api/admin/home-services/:id
router.put('/admin/home-services/:id', requireAuth, (req, res) => {
    const { title, description, icon_svg, is_featured, is_active, display_order } = req.body;
    db.run(
        `UPDATE home_services SET title=?, description=?, icon_svg=?, is_featured=?, is_active=?, display_order=? WHERE id=?`,
        [title, description, icon_svg, is_featured ? 1 : 0, is_active ? 1 : 0, display_order || 0, req.params.id],
        function (err) {
            if (err) return res.status(500).json({ error: 'DB Error' });
            res.json({ success: true });
        }
    );
});

// DELETE /admin/home-services/:id
router.delete('/admin/home-services/:id', requireAuth, (req, res) => {
    db.run('DELETE FROM home_services WHERE id = ?', [req.params.id], function (err) {
        if (err) return res.status(500).json({ error: 'DB Error' });
        res.json({ success: true });
    });
});

// --- MEDIA LIBRARY (Admin only) ---
// List files in uploads folder
router.get('/admin/media', requireAuth, async (req, res) => {
    try {
        const result = await cloudinary.api.resources({ type: 'upload', prefix: 'as_creates/', max_results: 100 });
        const mediaFiles = result.resources.map(file => ({
            name: file.public_id,
            url: file.secure_url,
            size: file.bytes,
            created_at: file.created_at
        }));
        res.json(mediaFiles);
    } catch (err) {
        res.status(500).json({ error: 'Failed to read media directory' });
    }
});

// Delete media file
router.delete('/admin/media/:filename', requireAuth, async (req, res) => {
    try {
        await cloudinary.uploader.destroy(req.params.filename);
        res.json({ success: true });
    } catch(err) {
        res.status(500).json({ error: 'Failed to delete file' });
    }
});

// GET /api/admin/settings/media
router.get('/admin/settings/media', requireAuth, async (req, res) => {
    const settings = await getSettings();
    res.json(settings.media || {});
});

// POST /api/admin/settings/media
router.post('/admin/settings/media', requireAuth, async (req, res) => {
    await saveSettings({ media: req.body });
    res.json({ success: true });
});

module.exports = router;
