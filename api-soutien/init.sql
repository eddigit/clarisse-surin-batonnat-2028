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
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_soutiens_created ON soutiens_batonnat(created_at DESC);
