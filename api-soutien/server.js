const express = require('express');
const cors = require('cors');
const { Pool } = require('pg');
const nodemailer = require('nodemailer');

const app = express();
const PORT = 3002;

// PostgreSQL
const pool = new Pool({
    host: '127.0.0.1',
    port: 5432,
    database: 'mybotia_crm',
    user: 'gilles',
    password: 'gilles'
});

// CORS — only allow the Vercel site
app.use(cors({
    origin: [
        'https://clarisse-surin-batonnat-2028.vercel.app',
        'https://battona2028.com',
        'https://www.battona2028.com',
        'http://localhost:3000'
    ],
    methods: ['GET', 'POST']
}));
app.use(express.json());

// Email transporter (AWS SES)
const transporter = nodemailer.createTransport({
    host: 'email-smtp.eu-north-1.amazonaws.com',
    port: 587,
    secure: false,
    auth: {
        user: process.env.SES_USER,
        pass: process.env.SES_PASS
    }
});

// POST /api/soutien — new supporter
app.post('/api/soutien', async (req, res) => {
    try {
        const { prenom, nom, email, telephone, barreau, statut, specialite, message } = req.body;

        if (!prenom || !nom || !email) {
            return res.status(400).json({ error: 'Prénom, nom et email requis' });
        }

        // Store in DB
        const result = await pool.query(
            `INSERT INTO soutiens_batonnat (prenom, nom, email, telephone, barreau, statut, specialite, message, created_at)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())
             RETURNING id`,
            [prenom, nom, email, telephone || null, barreau || null, statut || null, specialite || null, message || null]
        );

        // Send notification email
        try {
            await transporter.sendMail({
                from: '"Campagne Bâtonnat 2028" <coachdigitalparis@gmail.com>',
                to: 'coachdigitalparis@gmail.com',
                subject: `🏛️ Nouveau soutien — ${prenom} ${nom} (${statut || 'N/A'})`,
                html: `
                    <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:20px;">
                        <h2 style="color:#c8a04a;border-bottom:2px solid #c8a04a;padding-bottom:10px;">Nouveau soutien reçu</h2>
                        <table style="width:100%;border-collapse:collapse;">
                            <tr><td style="padding:8px;font-weight:bold;color:#333;">Prénom</td><td style="padding:8px;">${prenom}</td></tr>
                            <tr style="background:#f8f4ec;"><td style="padding:8px;font-weight:bold;color:#333;">Nom</td><td style="padding:8px;">${nom}</td></tr>
                            <tr><td style="padding:8px;font-weight:bold;color:#333;">Email</td><td style="padding:8px;"><a href="mailto:${email}">${email}</a></td></tr>
                            <tr style="background:#f8f4ec;"><td style="padding:8px;font-weight:bold;color:#333;">Téléphone</td><td style="padding:8px;">${telephone || '—'}</td></tr>
                            <tr><td style="padding:8px;font-weight:bold;color:#333;">Barreau</td><td style="padding:8px;">${barreau || '—'}</td></tr>
                            <tr style="background:#f8f4ec;"><td style="padding:8px;font-weight:bold;color:#333;">Statut</td><td style="padding:8px;">${statut || '—'}</td></tr>
                            <tr><td style="padding:8px;font-weight:bold;color:#333;">Spécialité</td><td style="padding:8px;">${specialite || '—'}</td></tr>
                            ${message ? `<tr style="background:#f8f4ec;"><td style="padding:8px;font-weight:bold;color:#333;">Message</td><td style="padding:8px;">${message}</td></tr>` : ''}
                        </table>
                        <p style="margin-top:20px;color:#888;font-size:12px;">Soutien #${result.rows[0].id} — reçu le ${new Date().toLocaleDateString('fr-FR')} à ${new Date().toLocaleTimeString('fr-FR')}</p>
                    </div>
                `
            });
        } catch (emailErr) {
            console.error('Email error (non-blocking):', emailErr.message);
        }

        // Get total count
        const countResult = await pool.query('SELECT COUNT(*) FROM soutiens_batonnat');
        const total = parseInt(countResult.rows[0].count);

        res.json({ success: true, id: result.rows[0].id, total });

    } catch (err) {
        console.error('Soutien error:', err);
        res.status(500).json({ error: 'Erreur serveur' });
    }
});

// GET /api/soutiens — list all (public, anonymized for display)
app.get('/api/soutiens', async (req, res) => {
    try {
        const result = await pool.query(
            `SELECT prenom, SUBSTRING(nom, 1, 1) || '.' as nom_initial, statut, specialite, barreau, message, created_at
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

// GET /api/soutiens/count — just the count
app.get('/api/soutiens/count', async (req, res) => {
    try {
        const result = await pool.query('SELECT COUNT(*) FROM soutiens_batonnat');
        res.json({ total: parseInt(result.rows[0].count) });
    } catch (err) {
        res.status(500).json({ error: 'Erreur serveur' });
    }
});

app.listen(PORT, '127.0.0.1', () => {
    console.log(`Soutien API running on port ${PORT}`);
});
