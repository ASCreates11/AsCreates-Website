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
function seedDefaultTestimonialsIfNeeded(cb) {
    const defaults = [
        ['Marcus Vance', 'VP of Product, Apex Digital', 'AS Creates transformed our digital footprint. Their technical execution and design sensitivity are unmatched in the agency space.', 5, 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80', 1, 1],
        ['Elena Rostova', 'Founder, Lumina Health', 'The level of strategic insight they brought to our web application architecture saved us months of development cycles. Truly world-class.', 5, 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&auto=format&fit=crop&q=80', 1, 2],
        ['David Chen', 'Managing Director, Horizon Media', 'Working with their CTO and design team was a seamless experience. They deliver enterprise-grade quality with remarkable agility.', 5, 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150&auto=format&fit=crop&q=80', 1, 3]
    ];
    const stmt = db.prepare(`INSERT INTO testimonials (author_name, author_role, quote, rating, author_image, published, display_order) VALUES (?, ?, ?, ?, ?, ?, ?)`);
    defaults.forEach(d => stmt.run(d));
    stmt.finalize(() => {
        if (cb) cb();
    });
}

// GET /api/testimonials (Public - only published)
router.get('/testimonials', (req, res) => {
    db.all('SELECT id, author_name as name, author_role as role, quote, rating, author_image as avatar, display_order FROM testimonials WHERE published = 1 ORDER BY display_order ASC, id DESC', (err, rows) => {
        if (err) return res.status(500).json({ error: 'DB Error' });
        if (!rows || rows.length === 0) {
            seedDefaultTestimonialsIfNeeded(() => {
                db.all('SELECT id, author_name as name, author_role as role, quote, rating, author_image as avatar, display_order FROM testimonials WHERE published = 1 ORDER BY display_order ASC, id DESC', (err2, rows2) => {
                    res.json(rows2 || []);
                });
            });
        } else {
            res.json(rows);
        }
    });
});

// GET /api/admin/testimonials (Admin - all)
router.get('/admin/testimonials', requireAuth, (req, res) => {
    db.all('SELECT id, author_name as name, author_role as role, quote, rating, author_image as avatar, published, display_order FROM testimonials ORDER BY display_order ASC, id DESC', (err, rows) => {
        if (err) return res.status(500).json({ error: 'DB Error' });
        if (!rows || rows.length === 0) {
            seedDefaultTestimonialsIfNeeded(() => {
                db.all('SELECT id, author_name as name, author_role as role, quote, rating, author_image as avatar, published, display_order FROM testimonials ORDER BY display_order ASC, id DESC', (err2, rows2) => {
                    res.json(rows2 || []);
                });
            });
        } else {
            res.json(rows);
        }
    });
});
// POST /api/admin/testimonials
router.post('/admin/testimonials', requireAuth, (req, res) => {
    const name = (req.body.name || req.body.author_name || '').trim();
    const role = (req.body.role || req.body.author_role || '').trim();
    const quote = (req.body.quote || '').trim();
    const rating = parseInt(req.body.rating) || 5;
    const avatar = (req.body.avatar || req.body.author_image || '').trim();
    const published = req.body.published !== false && req.body.published !== 0 ? 1 : 0;
    const display_order = parseInt(req.body.display_order) || 0;

    if (!name || !quote) {
        return res.status(400).json({ error: 'Name and quote are required' });
    }

    db.run(`INSERT INTO testimonials (author_name, name, author_role, role, quote, rating, author_image, avatar, published, display_order)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [name, name, role, role, quote, rating, avatar, avatar, published, display_order],
        function (err) {
            if (err) {
                db.run(`INSERT INTO testimonials (author_name, author_role, quote, rating, author_image, published, display_order)
                        VALUES (?, ?, ?, ?, ?, ?, ?)`,
                    [name, role, quote, rating, avatar, published, display_order],
                    function (err2) {
                        if (err2) {
                            console.error('Error inserting testimonial:', err2);
                            return res.status(500).json({ error: 'DB Error', details: err2.message });
                        }
                        res.json({ success: true, id: this.lastID });
                    });
            } else {
                res.json({ success: true, id: this.lastID });
            }
        });
});

// PUT /api/admin/testimonials/:id
router.put('/admin/testimonials/:id', requireAuth, (req, res) => {
    const name = (req.body.name || req.body.author_name || '').trim();
    const role = (req.body.role || req.body.author_role || '').trim();
    const quote = (req.body.quote || '').trim();
    const rating = parseInt(req.body.rating) || 5;
    const avatar = (req.body.avatar || req.body.author_image || '').trim();
    const published = req.body.published !== false && req.body.published !== 0 ? 1 : 0;
    const display_order = parseInt(req.body.display_order) || 0;

    if (!name || !quote) {
        return res.status(400).json({ error: 'Name and quote are required' });
    }

    db.run(`UPDATE testimonials SET author_name=?, name=?, author_role=?, role=?, quote=?, rating=?, author_image=?, avatar=?, published=?, display_order=? WHERE id=?`,
        [name, name, role, role, quote, rating, avatar, avatar, published, display_order, req.params.id],
        function (err) {
            if (err) {
                db.run(`UPDATE testimonials SET author_name=?, author_role=?, quote=?, rating=?, author_image=?, published=?, display_order=? WHERE id=?`,
                    [name, role, quote, rating, avatar, published, display_order, req.params.id],
                    function (err2) {
                        if (err2) {
                            console.error('Error updating testimonial:', err2);
                            return res.status(500).json({ error: 'DB Error', details: err2.message });
                        }
                        res.json({ success: true });
                    });
            } else {
                res.json({ success: true });
            }
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
    db.all('SELECT * FROM team ORDER BY is_founder DESC, display_order ASC, id ASC', (err, rows) => {
        if (err) return res.status(500).json({ error: 'DB Error' });
        const hasFounders = rows && rows.some(r => r.is_founder === 1 || r.is_founder === true || String(r.is_founder) === '1');
        if (!hasFounders) {
            const defaults = [
                ['Js Sriyanka Sargam Rout', 'Founder & CEO', 'Passionate about turning ideas into impactful creations.', 'Images/riya.jpeg', 'Images/riya.jpeg', 'Shaping the Future', 'Purpose-Driven Vision', "Hi, I'm JS Sriyanka Sargam Rout, the CEO & Founder of AS Creates. I started AS Creates with a vision to bring creativity, innovation, and meaningful solutions together.", 1, 1, 1],
                ['Asish Nayak', 'CTO', 'Passionate about leveraging technology to build innovative and impactful solutions.', 'Images/Asish.jpeg', 'Images/Asish.jpeg', 'Architecting Scale', 'Transforming Ideas into Reality', "Hi, I'm Asish Nayak, the CTO of AS Creates. I lead the technological vision of the company, focusing on innovation, efficiency, and scalable solutions.", 2, 1, 1]
            ];
            const stmt = db.prepare(`INSERT INTO team (name, role, bio, image_url, photo, pov_pre_heading, pov_title, pov_text, display_order, visible, is_founder) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`);
            defaults.forEach(d => stmt.run(d));
            stmt.finalize(() => {
                db.all('SELECT * FROM team ORDER BY is_founder DESC, display_order ASC, id ASC', (err2, rows2) => {
                    res.json(rows2 || rows);
                });
            });
        } else {
            res.json(rows);
        }
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

// --- MEDIA LIBRARY ROUTES ---
// GET /api/admin/media (Admin - list uploaded media)
router.get('/admin/media', requireAuth, async (req, res) => {
    try {
        const mediaList = [];
        const seenUrls = new Set();

        const uploadsDir = path.join(__dirname, '../public/uploads');
        if (fs.existsSync(uploadsDir)) {
            const files = fs.readdirSync(uploadsDir);
            files.forEach(file => {
                const filePath = path.join(uploadsDir, file);
                try {
                    const stat = fs.statSync(filePath);
                    if (stat.isFile()) {
                        const url = `/uploads/${file}`;
                        seenUrls.add(url);
                        mediaList.push({
                            id: file,
                            name: file,
                            url: url,
                            size: stat.size,
                            created_at: stat.mtime
                        });
                    }
                } catch (_) {}
            });
        }

        if (process.env.CLOUDINARY_CLOUD_NAME && process.env.CLOUDINARY_API_KEY && process.env.CLOUDINARY_API_SECRET) {
            try {
                const cRes = await cloudinary.api.resources({
                    type: 'upload',
                    prefix: 'as_creates',
                    max_results: 100
                });
                if (cRes && cRes.resources) {
                    cRes.resources.forEach(r => {
                        if (!seenUrls.has(r.secure_url)) {
                            seenUrls.add(r.secure_url);
                            mediaList.push({
                                id: r.public_id,
                                name: r.public_id.split('/').pop() + '.' + r.format,
                                url: r.secure_url,
                                size: r.bytes || 0,
                                created_at: r.created_at
                            });
                        }
                    });
                }
            } catch (cErr) {
                console.warn('Cloudinary list warning:', cErr.message);
            }
        }

        mediaList.sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0));
        res.json(mediaList);
    } catch (err) {
        console.error('Error fetching media library:', err);
        res.json([]);
    }
});

// DELETE /api/admin/media/*
router.delete('/admin/media/:filename(*)', requireAuth, async (req, res) => {
    try {
        const rawId = req.params.filename || req.query.filename || '';
        if (!rawId) return res.status(400).json({ error: 'Media identifier is required' });

        const filename = path.basename(rawId);
        const filePath = path.join(__dirname, '../public/uploads', filename);

        if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
        }

        if (process.env.CLOUDINARY_CLOUD_NAME && process.env.CLOUDINARY_API_KEY && process.env.CLOUDINARY_API_SECRET) {
            try {
                let publicId = rawId;
                if (rawId.includes('cloudinary.com')) {
                    const parts = rawId.split('/upload/');
                    if (parts[1]) {
                        const pathParts = parts[1].split('/');
                        pathParts.shift();
                        publicId = pathParts.join('/').replace(/\.[^/.]+$/, "");
                    }
                }
                if (publicId) {
                    await cloudinary.uploader.destroy(publicId);
                }
            } catch (cErr) {
                console.warn('Cloudinary delete warning:', cErr.message);
            }
        }

        res.json({ success: true });
    } catch (err) {
        console.error('Error deleting media file:', err);
        res.json({ success: true });
    }
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

// GET /api/admin/summary (Fast Consolidated Dashboard Payload)
router.get('/admin/summary', requireAuth, async (req, res) => {
    db.all('SELECT * FROM leads ORDER BY id DESC', async (err, leads) => {
        const leadsList = Array.isArray(leads) ? leads : [];
        const settings = await getSettings();
        
        db.get('SELECT COUNT(*) as count FROM portfolio', (err2, portRow) => {
            db.get('SELECT COUNT(*) as count FROM services', (err3, servRow) => {
                db.get('SELECT COUNT(*) as count FROM team', (err4, teamRow) => {
                    res.json({
                        leads: leadsList,
                        stats: {
                            totalLeads: leadsList.length,
                            unreadLeads: leadsList.filter(l => !l.is_read).length,
                            portfolioCount: (portRow && portRow.count) || 0,
                            servicesCount: (servRow && servRow.count) || 0,
                            teamCount: (teamRow && teamRow.count) || 0
                        },
                        settings: settings
                    });
                });
            });
        });
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
