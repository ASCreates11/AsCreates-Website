const path = require('path');
const bcrypt = require('bcryptjs');
const fs = require('fs');

let db;

if (process.env.TURSO_DATABASE_URL) {
    const { createClient } = require('@libsql/client');
    const client = createClient({
        url: process.env.TURSO_DATABASE_URL,
        authToken: process.env.TURSO_AUTH_TOKEN
    });

    db = {
        get(sql, params, callback) {
            if (typeof params === 'function') {
                callback = params;
                params = [];
            }
            params = Array.isArray(params) ? params : (params !== undefined ? [params] : []);
            client.execute({ sql, args: params })
                .then(res => {
                    const row = res.rows && res.rows.length > 0 ? res.rows[0] : undefined;
                    if (callback) callback(null, row);
                })
                .catch(err => {
                    console.error('Turso DB Error:', err);
                    if (callback) callback(err);
                });
        },
        all(sql, params, callback) {
            if (typeof params === 'function') {
                callback = params;
                params = [];
            }
            params = Array.isArray(params) ? params : (params !== undefined ? [params] : []);
            client.execute({ sql, args: params })
                .then(res => {
                    if (callback) callback(null, res.rows || []);
                })
                .catch(err => {
                    console.error('Turso DB Error:', err);
                    if (callback) callback(err, []);
                });
        },
        run(sql, params, callback) {
            if (typeof params === 'function') {
                callback = params;
                params = [];
            }
            params = Array.isArray(params) ? params : (params !== undefined ? [params] : []);
            client.execute({ sql, args: params })
                .then(res => {
                    if (callback) callback.call({ lastID: Number(res.lastInsertRowid || 0), changes: res.rowsAffected || 0 }, null);
                })
                .catch(err => {
                    if (!err.message || !err.message.includes('duplicate column name')) {
                        console.error('Turso DB Error:', err.message || err);
                    }
                    if (callback) callback.call({ lastID: 0, changes: 0 }, err);
                });
        },
        prepare(sql) {
            return {
                run(params, callback) {
                    params = Array.isArray(params) ? params : (params !== undefined ? [params] : []);
                    client.execute({ sql, args: params })
                        .then(res => { if (callback) callback(null); })
                        .catch(err => { if (callback) callback(err); });
                },
                finalize(callback) {
                    if (callback) callback(null);
                }
            };
        },
        serialize(fn) {
            if (fn) fn();
        },
        on(event, fn) {}
    };
} else {
    const sqlite3 = require('sqlite3').verbose();
    const dbPath = path.join(__dirname, 'database.sqlite');
    db = new sqlite3.Database(dbPath);
    db.on('error', (err) => {
        console.error('Database error:', err.message || err);
    });
}

// Initialize DB schema & performance pragmas
db.serialize(() => {
    // Enable WAL Mode & Fast Pragmas
    db.run("PRAGMA journal_mode = WAL;");
    db.run("PRAGMA synchronous = NORMAL;");
    db.run("PRAGMA temp_store = MEMORY;");
    db.run("PRAGMA cache_size = -64000;");

    // 0. Settings table
    db.run(`CREATE TABLE IF NOT EXISTS settings (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        key TEXT UNIQUE NOT NULL,
        value TEXT NOT NULL
    )`);
    // 1. Users table (for admin auth)
    db.run(`CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        email TEXT UNIQUE,
        password TEXT,
        name TEXT
    )`);

    // 2. Portfolio table
    db.run(`CREATE TABLE IF NOT EXISTS portfolio (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        title TEXT NOT NULL,
        description TEXT NOT NULL,
        image_url TEXT NOT NULL,
        category TEXT NOT NULL,
        project_link TEXT,
        col_span INTEGER DEFAULT 6,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        full_description TEXT,
        video_url TEXT,
        gallery_urls TEXT,
        gallery_type TEXT DEFAULT '16:9',
        is_featured INTEGER DEFAULT 0,
        published INTEGER DEFAULT 1,
        year INTEGER DEFAULT NULL
    )`);

    // Migration: add updated_at to portfolio if missing
    db.run(`ALTER TABLE portfolio ADD COLUMN updated_at DATETIME`, (err) => {
        if (!err) {
            db.run(`UPDATE portfolio SET updated_at = created_at WHERE updated_at IS NULL`);
        }
    });

    // 3. Services table
    db.run(`CREATE TABLE IF NOT EXISTS services (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        title TEXT,
        description TEXT,
        icon_svg TEXT,
        features TEXT DEFAULT '[]',
        is_active INTEGER DEFAULT 1,
        display_order INTEGER DEFAULT 0,
        name TEXT,
        category TEXT,
        icon TEXT,
        sort_order INTEGER DEFAULT 0,
        published INTEGER DEFAULT 1,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);
    db.run(`ALTER TABLE services ADD COLUMN title TEXT`, (err) => {
        if (!err) {
            db.run(`UPDATE services SET title = name WHERE title IS NULL AND name IS NOT NULL`);
        }
    });
    db.run(`ALTER TABLE services ADD COLUMN icon_svg TEXT`, (err) => {
        if (!err) {
            db.run(`UPDATE services SET icon_svg = icon WHERE icon_svg IS NULL AND icon IS NOT NULL`);
        }
    });
    db.run(`ALTER TABLE services ADD COLUMN features TEXT DEFAULT '[]'`, (err) => { });
    db.run(`ALTER TABLE services ADD COLUMN is_active INTEGER DEFAULT 1`, (err) => {
        if (!err) {
            db.run(`UPDATE services SET is_active = published WHERE is_active IS NULL AND published IS NOT NULL`);
        }
    });
    db.run(`ALTER TABLE services ADD COLUMN display_order INTEGER DEFAULT 0`, (err) => {
        if (!err) {
            db.run(`UPDATE services SET display_order = sort_order WHERE display_order IS NULL AND sort_order IS NOT NULL`);
        }
    });

    // Seed default services if empty
    db.get('SELECT COUNT(*) as count FROM services', (err, row) => {
        if (!err && row && row.count === 0) {
            const defaults = [
                {
                    title: 'UI/UX Design',
                    description: 'We craft immersive digital experiences that prioritize user behavior and aesthetic excellence. From wireframing to high-fidelity prototyping, our design process is rooted in empathy and data-driven insights.',
                    icon_svg: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" style="width: 44px; height: 44px;"><path d="M12 22C17.5228 22 22 17.5228 22 12C22 6.47715 17.5228 2 12 2C6.47715 2 2 6.47715 2 12C2 17.5228 6.47715 22 12 22Z" /><path d="M12 16C14.2091 16 16 14.2091 16 12C16 9.79086 14.2091 8 12 8C9.79086 8 8 9.79086 8 12C8 14.2091 9.79086 16 12 16Z" /></svg>`,
                    features: JSON.stringify(["User Research & Personas", "Interaction Design", "Design Systems Scaling"]),
                    is_active: 1,
                    display_order: 1
                },
                {
                    title: 'Web Development',
                    description: 'Engineering robust, scalable, and high-performance web applications. Our technical stack is curated for enterprise demands, ensuring security, speed, and seamless integration with your existing infrastructure.',
                    icon_svg: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" style="width: 44px; height: 44px;"><polyline points="16 18 22 12 16 6" /><polyline points="8 6 2 12 8 18" /></svg>`,
                    features: JSON.stringify(["Full-stack Applications", "E-commerce Solutions", "API & Microservices"]),
                    is_active: 1,
                    display_order: 2
                },
                {
                    title: 'SEO/SEM',
                    description: 'Performance marketing that delivers measurable ROI. We optimize your digital presence to dominate search engine results through technical SEO, content strategy, and aggressive PPC campaigns.',
                    icon_svg: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" style="width: 44px; height: 44px;"><line x1="18" y1="20" x2="18" y2="10" /><line x1="12" y1="20" x2="12" y2="4" /><line x1="6" y1="20" x2="6" y2="14" /></svg>`,
                    features: JSON.stringify(["Technical SEO Audits", "Keyword Research & Mapping", "Paid Search Management"]),
                    is_active: 1,
                    display_order: 3
                },
                {
                    title: 'Digital Marketing',
                    description: 'Building cohesive brand narratives across the digital ecosystem. Our holistic marketing strategies focus on lead generation, customer retention, and multi-channel brand authority.',
                    icon_svg: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" style="width: 44px; height: 44px;"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" /><path d="M13.73 21a2 2 0 0 1-3.46 0" /></svg>`,
                    features: JSON.stringify(["Social Media Strategy", "Content Lifecycle Management", "Email Automation"]),
                    is_active: 1,
                    display_order: 4
                }
            ];

            const stmt = db.prepare(`INSERT INTO services (title, description, icon_svg, features, is_active, display_order) VALUES (?, ?, ?, ?, ?, ?)`);
            defaults.forEach(d => {
                stmt.run([d.title, d.description, d.icon_svg, d.features, d.is_active, d.display_order]);
            });
            stmt.finalize();
            console.log('Seeded default services');
        }
    });


    // 4. Testimonials table
    db.run(`CREATE TABLE IF NOT EXISTS testimonials (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        author_name TEXT NOT NULL,
        author_role TEXT,
        quote TEXT,
        rating INTEGER DEFAULT 5,
        author_image TEXT,
        published INTEGER DEFAULT 1,
        display_order INTEGER DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);
    db.run(`ALTER TABLE testimonials ADD COLUMN rating INTEGER DEFAULT 5`, (err) => { });
    db.run(`ALTER TABLE testimonials ADD COLUMN published INTEGER DEFAULT 1`, (err) => { });
    db.run(`ALTER TABLE testimonials ADD COLUMN display_order INTEGER DEFAULT 0`, (err) => { });
    db.run(`ALTER TABLE testimonials ADD COLUMN name TEXT`, (err) => { });
    db.run(`ALTER TABLE testimonials ADD COLUMN role TEXT`, (err) => { });
    db.run(`ALTER TABLE testimonials ADD COLUMN avatar TEXT`, (err) => { });
    db.run(`ALTER TABLE testimonials ADD COLUMN author_name TEXT`, (err) => { });
    db.run(`ALTER TABLE testimonials ADD COLUMN author_role TEXT`, (err) => { });
    db.run(`ALTER TABLE testimonials ADD COLUMN author_image TEXT`, (err) => { });
    db.run(`UPDATE testimonials SET author_name = name WHERE (author_name IS NULL OR author_name = '') AND name IS NOT NULL`, (err) => { });
    db.run(`UPDATE testimonials SET name = author_name WHERE (name IS NULL OR name = '') AND author_name IS NOT NULL`, (err) => { });
    db.run(`UPDATE testimonials SET author_role = role WHERE (author_role IS NULL OR author_role = '') AND role IS NOT NULL`, (err) => { });
    db.run(`UPDATE testimonials SET role = author_role WHERE (role IS NULL OR role = '') AND author_role IS NOT NULL`, (err) => { });
    db.run(`UPDATE testimonials SET author_image = avatar WHERE (author_image IS NULL OR author_image = '') AND avatar IS NOT NULL`, (err) => { });
    db.run(`UPDATE testimonials SET avatar = author_image WHERE (avatar IS NULL OR avatar = '') AND author_image IS NOT NULL`, (err) => { });

    // Seed default testimonials if empty
    db.get('SELECT COUNT(*) as count FROM testimonials', (err, row) => {
        if (!err && row && row.count === 0) {
            const defaults = [
                {
                    author_name: 'Marcus Vance',
                    author_role: 'VP of Product, Apex Digital',
                    quote: 'AS Creates transformed our digital footprint. Their technical execution and design sensitivity are unmatched in the agency space.',
                    rating: 5,
                    author_image: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80',
                    published: 1,
                    display_order: 1
                },
                {
                    author_name: 'Elena Rostova',
                    author_role: 'Founder, Lumina Health',
                    quote: 'The level of strategic insight they brought to our web application architecture saved us months of development cycles. Truly world-class.',
                    rating: 5,
                    author_image: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&auto=format&fit=crop&q=80',
                    published: 1,
                    display_order: 2
                },
                {
                    author_name: 'David Chen',
                    author_role: 'Managing Director, Horizon Media',
                    quote: 'Working with their CTO and design team was a seamless experience. They deliver enterprise-grade quality with remarkable agility.',
                    rating: 5,
                    author_image: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150&auto=format&fit=crop&q=80',
                    published: 1,
                    display_order: 3
                }
            ];

            const stmt = db.prepare(`INSERT INTO testimonials (author_name, author_role, quote, rating, author_image, published, display_order) VALUES (?, ?, ?, ?, ?, ?, ?)`);
            defaults.forEach(d => {
                stmt.run([d.author_name, d.author_role, d.quote, d.rating, d.author_image, d.published, d.display_order]);
            });
            stmt.finalize();
            console.log('Seeded default testimonials in testimonials table');
        }
    });

    // 5. Team table
    db.run(`CREATE TABLE IF NOT EXISTS team (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        role TEXT,
        bio TEXT,
        image_url TEXT,
        pov_pre_heading TEXT,
        pov_title TEXT,
        pov_text TEXT,
        display_order INTEGER DEFAULT 0,
        photo TEXT,
        visible INTEGER DEFAULT 1,
        is_founder INTEGER DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);
    db.run(`ALTER TABLE team ADD COLUMN image_url TEXT`, (err) => {
        if (!err) {
            db.run(`UPDATE team SET image_url = photo WHERE image_url IS NULL AND photo IS NOT NULL`);
        }
    });
    db.run(`ALTER TABLE team ADD COLUMN pov_pre_heading TEXT`, (err) => { });
    db.run(`ALTER TABLE team ADD COLUMN pov_title TEXT`, (err) => { });
    db.run(`ALTER TABLE team ADD COLUMN pov_text TEXT`, (err) => { });
    db.run(`ALTER TABLE team ADD COLUMN display_order INTEGER DEFAULT 0`, (err) => { });
    db.run(`ALTER TABLE team ADD COLUMN is_founder INTEGER DEFAULT 0`, (err) => { });

    // Seed default founders if missing or empty
    function seedFoundersIfNeeded(cb) {
        db.get('SELECT COUNT(*) as count FROM team WHERE is_founder = 1', (err, row) => {
            if (!err && (!row || row.count === 0)) {
                const defaults = [
                    {
                        name: 'Js Sriyanka Sargam Rout',
                        role: 'Founder & CEO',
                        bio: 'Passionate about turning ideas into impactful creations.',
                        image_url: 'Images/riya.jpeg',
                        photo: 'Images/riya.jpeg',
                        pov_pre_heading: 'Shaping the Future',
                        pov_title: 'Purpose-Driven Vision',
                        pov_text: "Hi, I'm JS Sriyanka Sargam Rout, the CEO & Founder of AS Creates. I started AS Creates with a vision to bring creativity, innovation, and meaningful solutions together. I believe in building ideas that create value, inspire growth, and leave a lasting impact. Through dedication, passion, and a commitment to excellence, I continue to lead AS Creates toward creating work that reflects quality, trust, and purpose.",
                        display_order: 1,
                        visible: 1,
                        is_founder: 1
                    },
                    {
                        name: 'Asish Nayak',
                        role: 'CTO',
                        bio: 'Passionate about leveraging technology to build innovative and impactful solutions.',
                        image_url: 'Images/Asish.jpeg',
                        photo: 'Images/Asish.jpeg',
                        pov_pre_heading: 'Architecting Scale',
                        pov_title: 'Transforming Ideas into Reality',
                        pov_text: "Hi, I'm Asish Nayak, the CTO of AS Creates. I lead the technological vision of the company, focusing on innovation, efficiency, and scalable solutions. I believe technology is a powerful tool for transforming ideas into reality and creating meaningful impact. Through strategic thinking, continuous learning, and a commitment to excellence, I work to ensure AS Creates stays at the forefront of innovation and delivers solutions that drive growth and success.",
                        display_order: 2,
                        visible: 1,
                        is_founder: 1
                    }
                ];

                const stmt = db.prepare(`INSERT INTO team (name, role, bio, image_url, photo, pov_pre_heading, pov_title, pov_text, display_order, visible, is_founder) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`);
                defaults.forEach(d => {
                    stmt.run([d.name, d.role, d.bio, d.image_url, d.photo, d.pov_pre_heading, d.pov_title, d.pov_text, d.display_order, d.visible, d.is_founder]);
                });
                stmt.finalize();
                console.log('Seeded default founders in team table');
                if (cb) cb();
            } else {
                if (cb) cb();
            }
        });
    }

    seedFoundersIfNeeded();

    // 6. Leads table
    db.run(`CREATE TABLE IF NOT EXISTS leads (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        email TEXT,
        mobile TEXT,
        service TEXT,
        message TEXT,
        is_read INTEGER DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);
    db.run(`ALTER TABLE leads ADD COLUMN is_read INTEGER DEFAULT 0`, (err) => {
        // ignore error if column already exists
    });
    db.run(`ALTER TABLE leads ADD COLUMN custom_requirement TEXT`, (err) => {
        // ignore error if column already exists
    });

    // Performance Indexes for instant leads & admin queries
    db.run(`CREATE INDEX IF NOT EXISTS idx_leads_is_read ON leads(is_read)`);
    db.run(`CREATE INDEX IF NOT EXISTS idx_leads_created_at ON leads(id DESC)`);
    db.run(`CREATE INDEX IF NOT EXISTS idx_team_founder ON team(is_founder)`);
    db.run(`CREATE INDEX IF NOT EXISTS idx_portfolio_published ON portfolio(published)`);
    db.run(`CREATE INDEX IF NOT EXISTS idx_services_active ON services(is_active)`);

    // 7. Home Services table
    db.run(`CREATE TABLE IF NOT EXISTS home_services (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        title TEXT NOT NULL,
        description TEXT,
        icon_svg TEXT,
        is_featured INTEGER DEFAULT 0,
        is_active INTEGER DEFAULT 1,
        display_order INTEGER DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);

    // Seed default home services if empty
    db.get('SELECT COUNT(*) as count FROM home_services', (err, row) => {
        if (!err && row && row.count === 0) {
            const defaults = [
                {
                    title: 'SEO/SEM',
                    description: 'Strategic visibility optimization for enterprise clients seeking dominant market presence.',
                    icon_svg: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 3v18h18" /><path d="M18.7 8l-5.1 5.2-2.8-2.7-5.3 5.3" /></svg>`,
                    is_featured: 0,
                    is_active: 1,
                    display_order: 1
                },
                {
                    title: 'Marketing',
                    description: 'Data-driven marketing architectures designed to scale brand reach and user conversion.',
                    icon_svg: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 5L6 9H2v6h4l5 4V5z" /><path d="M23 9c-.6-1.5-2.1-2.5-3.8-2.5" /><path d="M19 12c0 1-.4 2-1 2.8" /><path d="M21.5 7.5C23 9 24 11 24 13s-1 4-2.5 5.5" /></svg>`,
                    is_featured: 0,
                    is_active: 1,
                    display_order: 2
                },
                {
                    title: 'Viral Campaign',
                    description: 'High-impact creative explosions that capture cultural moments and drive massive engagement.',
                    icon_svg: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" /></svg>`,
                    is_featured: 1,
                    is_active: 1,
                    display_order: 3
                },
                {
                    title: 'Others',
                    description: 'Custom digital engineering tailored to unique business challenges and technical requirements.',
                    icon_svg: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="7" height="7" rx="1" /><rect x="14" y="3" width="7" height="7" rx="1" /><rect x="14" y="14" width="7" height="7" rx="1" /><rect x="3" y="14" width="7" height="7" rx="1" /></svg>`,
                    is_featured: 0,
                    is_active: 1,
                    display_order: 4
                }
            ];

            const stmt = db.prepare(`INSERT INTO home_services (title, description, icon_svg, is_featured, is_active, display_order) VALUES (?, ?, ?, ?, ?, ?)`);
            defaults.forEach(d => {
                stmt.run([d.title, d.description, d.icon_svg, d.is_featured, d.is_active, d.display_order]);
            });
            stmt.finalize();
            console.log('Seeded default home services');
        }
    });

    // Create default admin user if no users exist
    db.get('SELECT COUNT(*) as count FROM users', (err, row) => {
        if (!err && row && row.count === 0) {
            const defaultEmail = 'admin@ascreates.com';
            const defaultPassword = 'password';
            const salt = bcrypt.genSaltSync(10);
            const hash = bcrypt.hashSync(defaultPassword, salt);
            db.run('INSERT INTO users (email, password, name) VALUES (?, ?, ?)', [defaultEmail, hash, 'Administrator']);
            console.log('Default admin created: admin@ascreates.com / password');
        }
    });
});

module.exports = db;
