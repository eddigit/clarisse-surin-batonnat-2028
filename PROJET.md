# Batonnat 2028 — Site de campagne Clarisse Surin

## Contexte

Site de campagne pour **Maitre Clarisse Surin**, candidate au **Batonnat de Paris 2028**.
Projet gere par Coach Digital Paris / MaBoiteIA pour le compte de la campagne.

### Contacts
- **Clarisse Surin** : clarisse.surin@cls-avocat.com — candidate
- **Nicole** : chargee de communication de la campagne
- **Gilles Korzec** : responsable digital (Coach Digital Paris)

---

## URLs

| Quoi | URL |
|------|-----|
| **Production** | https://batonnat2028.com |
| **Vercel** | https://clarisse-surin-batonnat-2028.vercel.app |
| **Vercel Dashboard** | https://vercel.com/gilles-korzec-projects/clarisse-surin-batonnat-2028 |
| **GitHub** | https://github.com/eddigit/clarisse-surin-batonnat-2028 |
| **API Soutiens** | https://api-batonnat.mybotia.com |
| **Clone local VPS** | ~/clarisse-surin-batonnat-2028/ |

---

## Pages

| Fichier | Role | Statut |
|---------|------|--------|
| `index.html` | **Landing page** — nom + photo + CTA "Rejoindre le mouvement" | EN LIGNE |
| `run-for-justice.html` | **Formulaire engagement** — identite, profession, contact, engagement | EN LIGNE |
| `soutiens.html` | **Mur de soutiens** — affichage anonymise des soutiens recus | EN LIGNE (mock data a remplacer) |
| `campagne.html` | **Site complet** (sauvegarde) — a reactiver quand la campagne sera validee | EN ATTENTE |

---

## Architecture technique

```
clarisse-surin-batonnat-2028/
├── index.html              # Landing page (Vercel static)
├── run-for-justice.html    # Formulaire engagement (Vercel static)
├── soutiens.html           # Mur de soutiens (Vercel static)
├── campagne.html           # Site complet backup (Vercel static)
├── api-soutien/            # API backend (sur le VPS)
│   ├── server.js           # Express, port 3004
│   ├── package.json
│   ├── init.sql            # Schema table (reference)
│   └── node_modules/
├── api-batonnat2028.conf   # Config Apache (copie dans /etc/apache2/sites-available/)
└── PROJET.md               # Ce fichier
```

### Frontend (Vercel)
- Deploiement automatique via GitHub push sur `main`
- Static HTML/CSS/JS, zero framework
- Landing page : design navy+or (Lex Luminance)
- Formulaire : design vert institutionnel (#2E8B57) + rouge chaleureux (#C1483F)

### Backend (VPS MaBoiteIA)
- **Service systemd** : `batonnat2028-api.service`
- **Port** : 3004 (loopback 127.0.0.1)
- **Proxy Apache** : `api-batonnat.mybotia.com` → 127.0.0.1:3004
- **SSL** : wildcard Let's Encrypt *.mybotia.com
- **Base de donnees** : PostgreSQL dans container Docker `prospection_postgres`
  - DB : `mybotia_crm`
  - User : `prospection`
  - Table : `soutiens_batonnat`

---

## Base de donnees — Table soutiens_batonnat

```sql
CREATE TABLE soutiens_batonnat (
    id SERIAL PRIMARY KEY,
    prenom VARCHAR(100) NOT NULL,
    nom VARCHAR(100) NOT NULL,
    email VARCHAR(255) NOT NULL UNIQUE,
    telephone VARCHAR(30),
    barreau VARCHAR(50),
    statut VARCHAR(50),           -- avocat, non_avocat, autre
    specialite VARCHAR(200),
    message TEXT,
    participation_campagne VARCHAR(5),   -- 'oui' ou ''
    soutien_candidat VARCHAR(5),         -- 'oui' ou ''
    souhaite_partager_theme VARCHAR(5),  -- 'oui' ou ''
    source VARCHAR(50),                  -- 'run-for-justice', 'website', etc.
    created_at TIMESTAMP DEFAULT NOW()
);
```

---

## API Endpoints

| Methode | Route | Description |
|---------|-------|-------------|
| POST | `/api/soutien` | Enregistrer un nouveau soutien |
| GET | `/api/soutiens` | Lister tous les soutiens (anonymises) |
| GET | `/api/soutiens/count` | Nombre total de soutiens |
| GET | `/api/health` | Health check |

### POST /api/soutien — Body (JSON)
```json
{
    "nom": "Dupont",
    "prenom": "Marie",
    "email": "marie.dupont@barreau.fr",
    "statut": "avocat",
    "barreau": "Paris",
    "message": "...",
    "participation_campagne": "oui",
    "soutien_candidat": "oui",
    "souhaite_partager_theme": "",
    "source": "run-for-justice"
}
```

---

## Commandes utiles

```bash
# Status API
systemctl --user status batonnat2028-api.service

# Restart API
systemctl --user restart batonnat2028-api.service

# Logs API
journalctl --user -u batonnat2028-api.service -f

# Test API local
curl http://127.0.0.1:3004/api/health
curl https://api-batonnat.mybotia.com/api/soutiens

# Compter les soutiens en base
docker exec prospection_postgres psql -U prospection -d mybotia_crm \
    -c "SELECT COUNT(*) FROM soutiens_batonnat;"

# Voir les soutiens
docker exec prospection_postgres psql -U prospection -d mybotia_crm \
    -c "SELECT id, prenom, nom, email, statut, barreau, created_at FROM soutiens_batonnat ORDER BY created_at DESC;"

# Export CSV
docker exec prospection_postgres psql -U prospection -d mybotia_crm \
    -c "COPY soutiens_batonnat TO STDOUT WITH CSV HEADER;"
```

---

## Domaines et DNS

- `batonnat2028.com` → Vercel (frontend)
- `www.batonnat2028.com` → Vercel (frontend)
- `api-batonnat.mybotia.com` → VPS 180.149.198.23 (API, via wildcard Cloudflare)

---

## Groupes WhatsApp lies

- **"Batonnat 2028"** : `120363425376786580@g.us`
- **"Clarisse surin"** : `120363426451963719@g.us`

---

## Notifications email

Chaque nouveau soutien declenche un email automatique a :
- `clarisse.surin@cls-avocat.com`
- `gilleskorzec@gmail.com`

Envoye via **Gmail API REST** (OAuth2, compte coachdigitalparis@gmail.com).
Les tokens OAuth se rafraichissent automatiquement.

---

## Acces preview (site complet)

- **URL** : `batonnat2028.com/preview.html`
- **Mot de passe** : `RunForJustice2028`
- Charge `campagne.html` dans un iframe avec bandeau "Apercu confidentiel"
- noindex/nofollow, sessionStorage pour la session

---

## DNS (GoDaddy)

- Registrar : GoDaddy (API key en base credentials)
- `batonnat2028.com` → A record `76.76.21.21` (Vercel)
- `www.batonnat2028.com` → CNAME `70df41180343af0b.vercel-dns-017.com`
- `api-batonnat.mybotia.com` → VPS 180.149.198.23 (wildcard Cloudflare)

---

## Groupes WhatsApp lies

- **"Batonnat 2028"** : `120363425376786580@g.us`
- **"Clarisse surin"** : `120363426451963719@g.us`

---

## TODO / Prochaines etapes

- [x] ~~Connecter `soutiens.html` a l'API reelle~~ (fait 09/04)
- [x] ~~Notifications email~~ (fait 09/04, Gmail API)
- [x] ~~DNS apex batonnat2028.com~~ (fait 09/04, GoDaddy API)
- [x] ~~Preview protege par mot de passe~~ (fait 09/04)
- [ ] Reactiver le site complet (`campagne.html` → `index.html`) quand valide par l'equipe
- [ ] Export Google Sheets si demande (via API /api/soutiens ou COPY SQL)
- [ ] Ajouter champ photo au formulaire (a confirmer avec l'equipe)

---

## Historique

| Date | Action | Par |
|------|--------|-----|
| ~mars 2026 | Creation site campagne v1 (navy+or) | Lea/Gilles |
| 09/04/2026 | Landing page + formulaire Run for Justice | Jacques |
| 09/04/2026 | API soutien (PG + Gmail notifications) | Jacques |
| 09/04/2026 | soutiens.html branchee sur API live | Jacques |
| 09/04/2026 | DNS apex batonnat2028.com via GoDaddy API | Jacques |
| 09/04/2026 | Preview protege par mot de passe | Jacques |
| 09/04/2026 | Domaine batonnat2028.com connecte a Vercel | Gilles |
