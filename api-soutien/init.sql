-- Schema table soutiens_batonnat
-- DB: mybotia_crm (container prospection_postgres, user prospection)
-- Creee le 09/04/2026

CREATE TABLE IF NOT EXISTS soutiens_batonnat (
    id SERIAL PRIMARY KEY,
    prenom VARCHAR(100) NOT NULL,
    nom VARCHAR(100) NOT NULL,
    email VARCHAR(255) NOT NULL UNIQUE,
    telephone VARCHAR(30),
    barreau VARCHAR(50),
    statut VARCHAR(50),
    specialite VARCHAR(200),
    message TEXT,
    participation_campagne VARCHAR(5) DEFAULT '',
    soutien_candidat VARCHAR(5) DEFAULT '',
    souhaite_partager_theme VARCHAR(5) DEFAULT '',
    source VARCHAR(50) DEFAULT 'website',
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_soutiens_created ON soutiens_batonnat(created_at DESC);
