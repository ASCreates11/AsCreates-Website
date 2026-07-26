const fs = require('fs');
const path = require('path');
require('dotenv').config();

// We want to generate public/sitemap.xml
const publicDir = path.join(__dirname, '..', 'public');
const sitemapPath = path.join(publicDir, 'sitemap.xml');

// Determine base URL
const baseUrl = process.env.SITE_URL || 'https://ascreates.vercel.app';

console.log('Generating sitemap at:', sitemapPath);
console.log('Base URL:', baseUrl);

// Attempt to load database configuration and query portfolio
let db;
try {
    db = require('../db');
} catch (e) {
    console.warn('Failed to load db module, generating static sitemap only:', e.message);
}

function writeSitemap(rows = []) {
    let xml = `<?xml version="1.0" encoding="UTF-8"?>\n`;
    xml += `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n`;
    
    // Static Pages
    const staticPages = ['', 'about', 'services', 'portfolio', 'contact'];
    staticPages.forEach(p => {
        const loc = p ? `${baseUrl}/${p}` : `${baseUrl}/`;
        xml += `  <url>\n    <loc>${loc}</loc>\n    <changefreq>monthly</changefreq>\n    <priority>${p ? '0.8' : '1.0'}</priority>\n  </url>\n`;
    });
    
    // Dynamic Case Studies
    if (rows && rows.length > 0) {
        rows.forEach(item => {
            xml += `  <url>\n    <loc>${baseUrl}/portfolio?project=${item.id}</loc>\n    <changefreq>monthly</changefreq>\n    <priority>0.7</priority>\n  </url>\n`;
        });
    }
    
    xml += `</urlset>`;
    
    fs.writeFileSync(sitemapPath, xml, 'utf8');
    console.log('Sitemap generated successfully with', staticPages.length + (rows ? rows.length : 0), 'URLs.');
}

if (db && typeof db.all === 'function') {
    db.all('SELECT id FROM portfolio WHERE published=1', (err, rows) => {
        if (err) {
            console.error('Failed to query portfolio from database during build:', err.message);
            writeSitemap([]); // Fallback to static sitemap
            process.exit(0);
        } else {
            writeSitemap(rows || []);
            process.exit(0);
        }
    });
} else {
    writeSitemap([]); // Fallback to static sitemap
    process.exit(0);
}
