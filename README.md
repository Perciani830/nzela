# 🚌 BusConnect v2 — Plateforme de Réservation de Bus

## 🌐 3 espaces distincts, 3 URLs

| Espace | URL | Accès |
|--------|-----|-------|
| Public (clients) | `/` | Tout le monde |
| Agences | `/login` | Toutes les agences (identifiant + mdp) |
| Super Admin | `/admin` | Administrateur plateforme |

---

## 🚀 Démarrage rapide

```bash
# Terminal 1 — Backend
cd backend && npm install && npm start

# Terminal 2 — Frontend
cd frontend && npm install && npm run dev
```

**Site :** http://localhost:3000
**API :**  http://localhost:5000

---

## 🔑 Comptes par défaut

| Rôle | Identifiant | Mot de passe | URL |
|------|-------------|--------------|-----|
| Super Admin | `superadmin` | `Admin@2024!` | `/admin` |
| Trans David | `transdavid` | `david123` | `/login` |
| Trans Renové | `transrenove` | `renove123` | `/login` |
| Transco | `transco` | `transco123` | `/login` |

---

## 🗺️ Trajets pré-configurés

| Agence | Trajet | Prix |
|--------|--------|------|
| Trans David | Kinshasa ↔ Boma | 45 000 FC |
| Trans David | Kinshasa ↔ Matadi | 40 000 FC |
| Trans Renové | Kinshasa ↔ Boma | 45 000 FC |
| Trans Renové | Kinshasa ↔ Matadi | 40 000 FC |
| Transco | Kinshasa ↔ Boma | 40 000 FC |
| Transco | Kinshasa ↔ Matadi | 35 000 FC |

---

## ✅ Fonctionnalités

### 🌐 Site public (`/`)
- Recherche de trajets (origine/destination)
- **Réservation sans compte** avec collecte des informations essentielles :
  - Nom complet, téléphone, email (optionnel), N° CNI/Passeport
- Paiement : carte bancaire, mobile money, agence
- **Annulation libre** : passager entre sa référence + téléphone
  - Commission plateforme → jamais remboursée
  - Taux agence → retenu (configurable)
  - Reste → remboursé au client
- Billet imprimable après paiement

### 🏢 Dashboard Agence (`/login` → `/agency`)
- Statistiques en temps réel
- Gestion des trajets (prix, horaires, places, jours)
- Vue de toutes ses réservations + annulations
- Suivi des paiements avec détail commission
- Portefeuille avec historique complet
- **Programme de fidélité** configurable :
  - Type : Points / Cashback / Les deux
  - Taux personnalisables
  - Attribution manuelle de récompenses
- **Taux d'annulation** personnalisable (ou utilise le taux global)

### 👑 Dashboard Admin (`/admin` → `/dashboard`)
- Vue globale de toutes les agences
- Création d'agences (identifiant + mot de passe)
- Toutes les réservations, paiements, annulations
- Transactions portefeuilles de toutes les agences
- Vue fidélité tous voyageurs
- **Paramètres globaux** :
  - Taux de commission plateforme (%)
  - Taux d'annulation par défaut (%)

---

## 💡 Politique d'annulation

Quand un passager annule :
```
Montant payé = Commission plateforme (jamais remboursée)
             + Frais agence (taux configurable)
             + Remboursement passager
```

**Exemple** avec commission=10%, annulation agence=20% sur 5 000 FCFA :
- Commission plateforme : 500 FCFA (perdu)
- Frais agence : 1 000 FCFA (retenu)
- Remboursement : 3 500 FCFA

---

## ⭐ Programme de fidélité

Chaque agence peut activer son propre programme :
- **Points** : ex. 1 point par 1 000 FCFA dépensés
- **Cashback** : ex. 2% sur chaque voyage
- Attribution manuelle de bonus par l'agence

Les voyageurs sont identifiés par leur numéro de téléphone.

---

## 🔌 Intégrer un paiement réel

Ouvrir `backend/routes/public.js` et trouver le commentaire :
```js
// ─── 🔌 POINT D'INTÉGRATION PAIEMENT ─────
```

Remplacer les 2 lignes mock par votre API (CinetPay, PayDunya, Stripe, Orange Money...).

---

## 🗂️ Structure fichiers

```
bus-reservation/
├── backend/
│   ├── db/database.js       ← Toutes les tables SQLite
│   ├── middleware/auth.js   ← JWT
│   ├── routes/
│   │   ├── auth.js          ← Login admin & agence
│   │   ├── admin.js         ← Routes super admin
│   │   ├── agency.js        ← Routes agence (+ fidélité)
│   │   └── public.js        ← Recherche, réservation, paiement, annulation
│   └── server.js
└── frontend/src/
    ├── pages/
    │   ├── PublicSite.jsx         ← Site client (/)
    │   ├── LoginAgency.jsx        ← /login
    │   ├── LoginAdmin.jsx         ← /admin
    │   ├── AgencyDashboard.jsx    ← /agency
    │   ├── AdminDashboard.jsx     ← /dashboard
    │   └── BookingConfirmPage.jsx
    ├── api/client.js
    └── context/AuthContext.jsx
```
