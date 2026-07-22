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

// Initialize DB schema
db.serialize(() => {
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
        name TEXT NOT NULL,
        category TEXT,
        description TEXT,
        icon TEXT,
        sort_order INTEGER DEFAULT 0,
        published INTEGER DEFAULT 1,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);

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
    db.run(`ALTER TABLE testimonials ADD COLUMN author_name TEXT`, (err) => {
        if (!err) {
            db.run(`UPDATE testimonials SET author_name = name WHERE author_name IS NULL AND name IS NOT NULL`);
        }
    });
    db.run(`ALTER TABLE testimonials ADD COLUMN author_role TEXT`, (err) => {
        if (!err) {
            db.run(`UPDATE testimonials SET author_role = role WHERE author_role IS NULL AND role IS NOT NULL`);
        }
    });
    db.run(`ALTER TABLE testimonials ADD COLUMN author_image TEXT`, (err) => {
        if (!err) {
            db.run(`UPDATE testimonials SET author_image = avatar WHERE author_image IS NULL AND avatar IS NOT NULL`);
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
