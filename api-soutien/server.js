const express = require('express');
const cors = require('cors');
const { Pool } = require('pg');

const app = express();
const PORT = 3004;

// PostgreSQL — container prospection_postgres
const pool = new Pool({
    host: '127.0.0.1',
    port: 5432,
    database: 'mybotia_crm',
    user: 'prospection',
    password: 'prospection'
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
