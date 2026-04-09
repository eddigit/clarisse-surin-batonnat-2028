require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = 3004;

// Gmail API OAuth2
const GMAIL_OAUTH = {
    clientId: process.env.GMAIL_CLIENT_ID,
    clientSecret: process.env.GMAIL_CLIENT_SECRET,
    refreshToken: process.env.GMAIL_REFRESH_TOKEN,
    sender: process.env.GMAIL_SENDER || 'coachdigitalparis@gmail.com'
};

let cachedToken = null;
let tokenExpiry = 0;

async function getAccessToken() {
    if (cachedToken && Date.now() < tokenExpiry) return cachedToken;
    const params = new URLSearchParams({
        client_id: GMAIL_OAUTH.clientId,
        client_secret: GMAIL_OAUTH.clientSecret,
        refresh_token: GMAIL_OAUTH.refreshToken,
        grant_type: 'refresh_token'
    });
    const res = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: params.toString()
    });
    const data = await res.json();
    if (!data.access_token) throw new Error('OAuth token refresh failed');
    cachedToken = data.access_token;
    tokenExpiry = Date.now() + (data.expires_in - 60) * 1000;
    return cachedToken;
}

async function sendGmail(to, subject, htmlBody) {
    const token = await getAccessToken();

    // Build MIME message
    const boundary = 'boundary_' + Date.now();
    const mime = [
        `From: "Campagne Batonnat 2028" <${GMAIL_OAUTH.sender}>`,
        `To: ${Array.isArray(to) ? to.join(', ') : to}`,
        `Subject: =?UTF-8?B?${Buffer.from(subject).toString('base64')}?=`,
        'MIME-Version: 1.0',
        `Content-Type: text/html; charset=UTF-8`,
        'Content-Transfer-Encoding: base64',
        '',
        Buffer.from(htmlBody).toString('base64')
    ].join('\r\n');

    // Base64url encode
    const raw = Buffer.from(mime)
        .toString('base64')
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=+$/, '');

    const res = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages/send', {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({ raw })
    });

    if (!res.ok) {
        const err = await res.text();
        throw new Error(`Gmail API error ${res.status}: ${err}`);
    }
    return await res.json();
}

const NOTIFY_EMAILS = [
    'clarisse.surin@cls-avocat.com',
    'gilleskorzec@gmail.com'
];

// PostgreSQL — container prospection_postgres
const pool = new Pool({
    host: '127.0.0.1',
    port: 5432,
    database: 'mybotia_crm',
    user: 'prospection',
    password: process.env.PG_PASSWORD
});

// CORS
app.use(cors({
    origin: [
        'https://clarisse-surin-batonnat-2028.vercel.app',
        'https://batonnat2028.com',
        'https://www.batonnat2028.com',
        'http://localhost:3000'
    ],
    methods: ['GET', 'POST']
}));

// CORS for uploaded photos
app.use('/uploads', (req, res, next) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    next();
});
app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: true }));

// Serve uploaded photos
const UPLOADS_DIR = path.join(__dirname, 'uploads');
if (!fs.existsSync(UPLOADS_DIR)) fs.mkdirSync(UPLOADS_DIR);
app.use('/uploads', express.static(UPLOADS_DIR));

// POST /api/soutien — nouveau soutien
app.post('/api/soutien', async (req, res) => {
    try {
        const {
            prenom, nom, email, telephone, barreau, statut,
            specialite, message,
            participation_campagne, soutien_candidat, souhaite_partager_theme,
            source, photo
        } = req.body;

        if (!prenom || !nom || !email) {
            return res.status(400).json({ error: 'Prenom, nom et email requis' });
        }

        // Save photo to disk if provided
        let photoUrl = null;
        if (photo && photo.startsWith('data:image/')) {
            const matches = photo.match(/^data:image\/(jpeg|png|webp);base64,(.+)$/);
            if (matches) {
                const ext = matches[1] === 'jpeg' ? 'jpg' : matches[1];
                const filename = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
                const filepath = path.join(UPLOADS_DIR, filename);
                fs.writeFileSync(filepath, Buffer.from(matches[2], 'base64'));
                photoUrl = `/uploads/${filename}`;
            }
        }

        const result = await pool.query(
            `INSERT INTO soutiens_batonnat
             (prenom, nom, email, telephone, barreau, statut, specialite, message,
              participation_campagne, soutien_candidat, souhaite_partager_theme, source, photo_url)
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
             RETURNING id`,
            [
                prenom, nom, email,
                telephone || null, barreau || null, statut || null,
                specialite || null, message || null,
                participation_campagne || '', soutien_candidat || '',
                souhaite_partager_theme || '', source || 'website',
                photoUrl
            ]
        );

        // Get total count
        const countResult = await pool.query('SELECT COUNT(*) FROM soutiens_batonnat');
        const total = parseInt(countResult.rows[0].count);

        // Notification email (non-bloquant)
        const statutLabel = { avocat: 'Avocat(e)', non_avocat: 'Non-avocat(e)', autre: 'Autre' };
        const engagements = [];
        if (participation_campagne === 'oui') engagements.push('Participer a la campagne');
        if (soutien_candidat === 'oui') engagements.push('Soutien a Clarisse Surin');
        if (souhaite_partager_theme === 'oui') engagements.push('Souhaite proposer un theme');

        const emailSubject = `Nouveau soutien #${result.rows[0].id} — ${prenom} ${nom} (${statutLabel[statut] || statut || 'N/A'})`;
        const emailHtml = `
            <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:24px;background:#fafaf8;border-radius:8px;">
                <h2 style="color:#2E8B57;border-bottom:2px solid #2E8B57;padding-bottom:10px;margin-top:0;">
                    Nouveau soutien recu
                </h2>
                <table style="width:100%;border-collapse:collapse;margin-bottom:16px;">
                    <tr><td style="padding:8px 12px;font-weight:bold;color:#333;width:40%;">Prenom</td><td style="padding:8px 12px;">${prenom}</td></tr>
                    <tr style="background:#f0f0ef;"><td style="padding:8px 12px;font-weight:bold;color:#333;">Nom</td><td style="padding:8px 12px;">${nom}</td></tr>
                    <tr><td style="padding:8px 12px;font-weight:bold;color:#333;">Statut</td><td style="padding:8px 12px;">${statutLabel[statut] || statut || '—'}</td></tr>
                    <tr style="background:#f0f0ef;"><td style="padding:8px 12px;font-weight:bold;color:#333;">Barreau</td><td style="padding:8px 12px;">${barreau || '—'}</td></tr>
                    <tr><td style="padding:8px 12px;font-weight:bold;color:#333;">Email</td><td style="padding:8px 12px;"><a href="mailto:${email}">${email}</a></td></tr>
                    <tr style="background:#f0f0ef;"><td style="padding:8px 12px;font-weight:bold;color:#333;">Engagement</td><td style="padding:8px 12px;">${engagements.length ? engagements.join(', ') : '—'}</td></tr>
                    ${message ? `<tr><td style="padding:8px 12px;font-weight:bold;color:#333;">Message</td><td style="padding:8px 12px;">${message}</td></tr>` : ''}
                </table>
                <p style="color:#888;font-size:12px;margin:0;">
                    Soutien #${result.rows[0].id} — Total : ${total} soutien${total > 1 ? 's' : ''} — ${new Date().toLocaleDateString('fr-FR')} a ${new Date().toLocaleTimeString('fr-FR')}
                </p>
            </div>
        `;

        sendGmail(NOTIFY_EMAILS, emailSubject, emailHtml)
            .catch(err => console.error('Email notification error:', err.message));

        res.json({ success: true, id: result.rows[0].id, total });

    } catch (err) {
        // Duplicate email
        if (err.code === '23505') {
            return res.status(409).json({ error: 'Ce soutien a deja ete enregistre avec cette adresse email.' });
        }
        console.error('Soutien error:', err);
        res.status(500).json({ error: 'Erreur serveur' });
    }
});

// GET /api/soutiens — liste anonymisee
app.get('/api/soutiens', async (req, res) => {
    try {
        const result = await pool.query(
            `SELECT prenom, SUBSTRING(nom, 1, 1) || '.' as nom_initial,
                    statut, specialite, barreau, message,
                    participation_campagne, soutien_candidat, photo_url, created_at
             FROM soutiens_batonnat
             ORDER BY created_at DESC`
        );
        const countResult = await pool.query('SELECT COUNT(*) FROM soutiens_batonnat');
        res.json({ soutiens: result.rows, total: parseInt(countResult.rows[0].count) });
    } catch (err) {
        console.error('List error:', err);
        res.status(500).json({ error: 'Erreur serveur' });
    }
});

// GET /api/soutiens/count
app.get('/api/soutiens/count', async (req, res) => {
    try {
        const result = await pool.query('SELECT COUNT(*) FROM soutiens_batonnat');
        res.json({ total: parseInt(result.rows[0].count) });
    } catch (err) {
        res.status(500).json({ error: 'Erreur serveur' });
    }
});

// Health check
app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', service: 'batonnat2028-api' });
});

app.listen(PORT, '127.0.0.1', () => {
    console.log(`Batonnat 2028 API running on port ${PORT}`);
});
