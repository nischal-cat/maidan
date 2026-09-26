# Maidaan

Maidaan is a web application for discovering and booking futsal courts, and for
managing the courts that provide them. It has three user groups: **players** who
search for and book an available slot, **court owners** who list their courts and
manage availability, pricing and bookings, and **administrators** who review seller
applications and manage the platform.

This is a student project for the Software Engineering course (CSC364). The
detailed requirements analysis is in [`Maidan_SRS.md`](Maidan_SRS.md).

| Name | Role |
| --- | --- |
| Nischal Pokhrel | Project Manager / Backend Developer |
| Samip Khatiwada | Frontend Developer |
| Anubhab Chapagain | Tester / Documentation |

## Features

**Players**

- Register and sign in with email and password, phone OTP, or Google
- Browse courts by city and view availability before signing in
- See live slot availability, prices, photos and ratings for a court
- Book a slot, pay, and manage or cancel from booking history
- In-app notification inbox, including booking reminders

**Court owners**

- Apply to sell on Maidaan by submitting KYC documents, reviewed by an admin
- Add and edit courts, including location on a map, photos and gallery
- Generate and toggle bookable time slots, and set pricing
- Take walk-in bookings at the counter
- View bookings and revenue reports

**Administrators**

- Approve or decline seller applications, and grant or revoke staff permissions
- Manage users, courts, slots and cities
- Create walk-in bookings and review booking and revenue reports
- Sub-admin accounts can be restricted to individual sections

**Payments**

- eSewa and Khalti checkout, with the transaction verified server to server
  before a booking is confirmed, and support for deposits on multi-slot bookings

## Technology stack

| Layer | Choice |
| --- | --- |
| Frontend | React 19, TypeScript, Vite |
| Styling | Tailwind CSS 4, Radix UI, Headless UI |
| Frontend data | TanStack React Query, Axios, React Hook Form + Zod |
| Maps and charts | Leaflet + React Leaflet, Recharts |
| Icons | Lucide React, Heroicons |
| Authentication | Firebase Authentication (Google), JWT issued by the backend |
| Backend | Node.js, Express |
| Database | PostgreSQL (`pg`) |
| Payments | eSewa, Khalti |
| Linting | Oxlint |

## Project structure

```text
maidaan/
├── src/                     # Frontend (React + TypeScript)
│   ├── components/          # UI, organised by feature area
│   ├── pages/               # Route components (public, owner/, admin/)
│   ├── context/             # Auth and location providers
│   ├── hooks/  lib/  services/  utils/
│   └── types/
├── public/                  # Static images served as-is
├── maidan-backend/          # Backend (Node + Express)
│   ├── routes/              # Express routers
│   ├── controllers/         # Request handlers
│   ├── middleware/          # Auth, permissions, validation
│   ├── services/            # Payments, Firebase, notifications, slots
│   ├── migrations/          # Numbered SQL migrations, applied in order
│   ├── db/                  # schema.sql, seeds, setup and migration runners
│   ├── scripts/             # createAdmin.js
│   ├── tests/               # node:test suites
│   └── uploads/             # Runtime uploads (not in Git)
├── index.html               # Vite entry point
└── vite.config.ts
```

## Prerequisites

- Node.js 20 or newer (developed on 24.x)
- npm 10 or newer
- PostgreSQL 14 or newer, running locally
- Optional: a Firebase project, for Google sign-in

## Setup

### 1. Frontend

```bash
npm install
```

Copy the environment template and fill in your own values:

```bash
cp .env.example .env      # Windows PowerShell: Copy-Item .env.example .env
```

`.env` holds the frontend configuration. The defaults work for local development
as long as the backend runs on port 5001:

| Variable | Purpose |
| --- | --- |
| `VITE_API_URL` | Keep as `/api` so requests go to the same origin |
| `VITE_DEV_API_TARGET` | Where the dev server proxies `/api` and `/uploads` |
| `ALLOWED_HOSTS` | Extra hostnames for the dev server; leave empty for localhost |
| `VITE_FIREBASE_*` | Firebase web config, only needed for Google sign-in |

### 2. Backend

```bash
cd maidan-backend
npm install
```

```bash
Copy-Item .env.example .env
```

Fill in `DATABASE_URL` and `JWT_SECRET`, and set `PORT=5001` to match the
frontend. Generate a secret with:

```bash
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
```

`NODE_ENV=development` is the default in the template. While it is set, one-time
codes are printed to the server console, because no SMS gateway is connected yet.
Changing or removing it stops codes from being logged.

### 3. Database

Create a database, then load the schema. From a `psql` shell:

```sql
CREATE USER maidan_user WITH PASSWORD 'choose-a-password';
CREATE DATABASE maidan OWNER maidan_user;
```

Apply the migrations in order. The backend has one script per file:

```bash
psql "$DATABASE_URL" -f migrations/001_maidan_v2.sql
psql "$DATABASE_URL" -f migrations/002_payments.sql
# ... 003 through 008
```

Or apply them from the backend directory with the helper:

```bash
npm run db:migrate:file -- migrations/002_payments.sql
```

Optionally seed some slots:

```bash
npm run db:seed
```

To create the first administrator account:

```bash
node scripts/createAdmin.js
```

On the first successful start the backend also applies a small set of
idempotent schema updates, including the `notifications` table and the Nepal city
list, so the database is usable even before the later migrations are run.

## Running

Two terminals. Backend first:

```bash
cd maidan-backend
npm run dev          # or: npm start
```

```bash
npm run dev          # frontend, http://localhost:5173
```

The Vite dev server proxies `/api` and `/uploads` to the backend, so the frontend
needs no CORS setup and works unchanged on localhost.

## Tests and checks

Backend, 57 tests over 11 suites, run with the built-in Node test runner. The
database is stubbed, so no running PostgreSQL instance is needed:

```bash
cd maidan-backend
npm test
```

Frontend type check and lint:

```bash
npx tsc -b
npm run lint
```

## Production build

```bash
npm run build         # type check, then bundle to dist/
npm run preview       # serve dist/ locally to check the result
```

`dist/` is generated output and is not tracked in Git. Serve it from any static
host. The backend is deployed separately as a Node service, and needs a real
`DATABASE_URL`, a strong `JWT_SECRET`, `NODE_ENV=production` and HTTPS.

## Payment gateways

Checkout works only once gateway credentials are configured. Set
`ESEWA_SECRET_KEY` in `maidan-backend/.env` and the eSewa form and status URLs
from the provider's developer dashboard. The values in `.env.example` are
placeholders. The same applies to any Khalti keys. No real credentials belong in
this repository.

## Notes

- `maidan-backend/uploads/` holds user uploads, including KYC documents. It is
  ignored by Git and recreated automatically on start.
- Local planning notes and AI assistant configuration are ignored by Git and are
  not part of the repository.
