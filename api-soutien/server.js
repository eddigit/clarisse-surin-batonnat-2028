const express = require('express');
const cors = require('cors');
const { Pool } = require('pg');
const nodemailer = require('nodemailer');

const app = express();
const PORT = 3004;

// Email — Migadu SMTP (collaborateur.pro)
const transporter = nodemailer.createTransport({
    host: 'smtp.migadu.com',
    port: 465,
    secure: true,
    auth: {
        user: 'support@collaborateur.pro',
        pass: process.env.SUPPORT_EMAIL_PASSWORD || 'Support2026!MaBoiteIA'
    }
});

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
    password: '2GpCpZdRvMlI7AWiP2I6OBNoLwtyrlEs'
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
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// POST /api/soutien — nouveau soutien
app.post('/api/soutien', async (req, res) => {
    try {
        const {
            prenom, nom, email, telephone, barreau, statut,
            specialite, message,
            participation_campagne, soutien_candidat, souhaite_partager_theme,
            source
        } = req.body;

        if (!prenom || !nom || !email) {
            return res.status(400).json({ error: 'Prenom, nom et email requis' });
        }

        const result = await pool.query(
            `INSERT INTO soutiens_batonnat
             (prenom, nom, email, telephone, barreau, statut, specialite, message,
              participation_campagne, soutien_candidat, souhaite_partager_theme, source)
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
             RETURNING id`,
            [
                prenom, nom, email,
                telephone || null, barreau || null, statut || null,
                specialite || null, message || null,
                participation_campagne || '', soutien_candidat || '',
                souhaite_partager_theme || '', source || 'website'
            ]
        );

        // Get total count
        const countResult = await pool.query('SELECT COUNT(*) FROM soutiens_batonnat');
        const total = parseInt(countResult.rows[0].count);

        // Notification email (non-bloquant)
        const statutLabel = { avocat: 'Avocat(e)', non_avocat: 'Non-avocat(e)', autre: 'Autre' };
        const engagements = [];
        if (participation_campagne === 'oui') engagements.push('Participer a la campagne');
        if (soutien_candidat === 'oui') engagements.push('Soutient Clarisse Surin');
        if (souhaite_partager_theme === 'oui') engagements.push('Souhaite proposer un theme');

        transporter.sendMail({
            from: '"Batonnat 2028" <coachdigitalparis@gmail.com>',
            to: NOTIFY_EMAILS.join(', '),
            subject: `Nouveau soutien #${result.rows[0].id} — ${prenom} ${nom} (${statutLabel[statut] || statut || 'N/A'})`,
            html: `
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
            `
        }).catch(err => console.error('Email notification error:', err.message));

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
                    participation_campagne, soutien_candidat, created_at
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
