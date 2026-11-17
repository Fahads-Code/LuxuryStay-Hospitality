# Hotel Management System

A full-stack MERN hotel management system with a public booking website, a role-based staff workspace, and a self-service guest portal on top of a single Express/MongoDB API.

The project implements the requirements in [`spec.md`](./spec.md): user and role management, room inventory and status, reservations with check-in/check-out, folios and payments, housekeeping and maintenance, guest services, feedback, reporting, notifications, and hotel settings.

---

## Highlights

**Public site**
- Hotel landing page driven by hotel settings and published guest reviews
- Availability search by dates and party size
- Online reservation requests that create a `pending` booking for the front desk
- Guests sign in or create a free account before reserving a room
- Reservations are linked to the guest account and appear in the guest portal automatically
- Public post-stay feedback form

**Staff workspace**
- Role-aware dashboard with occupancy, arrivals/departures, revenue, and alerts
- Separate **Reception desk** and **Housekeeping panel** navigation, so each team only sees its own tools
- Front desk board for today's arrivals, in-house guests, and departures
- Reservation calendar/list, availability search, create/edit, confirm, check-in, check-out, cancel, no-show
- Guest profiles with preferences, VIP flags, stay history, and lifetime value
- Room inventory, room types, rates, and live status updates
- Folios with room/service charges, partial or full payments, voiding, and printable invoices
- Housekeeping queue with priorities, assignments, and room readiness automation
- Maintenance requests from staff and guests through to resolution
- Guest service requests (dining, spa, laundry, transfers, wake-up calls, and more)
- Feedback inbox with responses and publishing to the public site
- Reports for occupancy, revenue, bookings, sources, room-type performance, guests, and exports
- Dedicated **Staff admin** panel to add, edit, remove and restore receptionist and housekeeping accounts, with one-click strong-password generation
- Staff account management and hotel-wide settings (rates, tax, policies, service menu)
- In-app notifications scoped by role
- Live data sync — screens refresh themselves after any change, across tabs and devices, with no manual reload

**Guest portal**
- Current stay and upcoming reservation details
- Service requests and maintenance reports during an active stay
- Folio viewing and online payment
- Stay history, profile and preference management, and post-stay reviews

---

## Tech stack

| Layer | Technology |
| --- | --- |
| Client | React 19, Vite 7, React Router 7, Recharts, Lucide icons, Axios |
| Server | Node.js, Express 5, Mongoose 9, Zod, JWT, bcryptjs |
| Database | MongoDB (local, Atlas, or automatic in-memory fallback) |
| Live updates | Server-sent events (`/api/live`) with focus refresh and polling fallback |
| Security | Helmet, CORS allow-list, rate limiting, role authorization, hashed passwords |
| Tests | Node's built-in test runner, Supertest, mongodb-memory-server |

---

## Project structure

```
hotel/
├─ client/                  React + Vite front end
│  ├─ src/
│  │  ├─ components/        Layout, shared UI primitives
│  │  ├─ context/           Auth and toast providers
│  │  ├─ lib/               API client, live updates, formatters, image helpers
│  │  ├─ pages/             Public site, staff workspace, guest portal
│  │  ├─ App.jsx            Routes and role gates
│  │  ├─ main.jsx           App bootstrap
│  │  └─ styles.css         Global design system and all page styles
│  └─ vite.config.js        Dev server + `/api` proxy to port 5000
├─ server/                  Express REST API
│  ├─ src/
│  │  ├─ config/            Environment and Mongo connection
│  │  ├─ controllers/       Request handlers
│  │  ├─ middleware/        Auth, errors, rate limiting
│  │  ├─ models/            Mongoose schemas
│  │  ├─ routes/            API route definitions
│  │  ├─ scripts/           Maintenance scripts (data reset)
│  │  ├─ services/          Booking, invoice, notification, settings logic
│  │  ├─ utils/             Dates, validation, API errors
│  │  ├─ app.js             Express app factory
│  │  └─ index.js           Server entry point
│  ├─ tests/                API tests and private fixtures
│  │  ├─ api.test.js        End-to-end API integration tests
│  │  └─ fixtures/          Demo data used only by the test suite
│  └─ .env.example          Server environment template
├─ package.json             Root scripts
└─ spec.md                  Original project brief
```

The running application contains **no demo hotel data**. Test fixtures live under `server/tests/fixtures` and are never loaded by the server.

---

## Quick start

### Prerequisites

- Node.js 20.19+ (or 22.12+)
- npm 10+
- MongoDB — optional. If no local MongoDB is reachable, the server starts an in-memory instance automatically during development.

### 1. Install

```bash
npm install
npm run install:all
```

### 2. Configure (optional)

```bash
copy server\.env.example server\.env      # Windows
cp server/.env.example server/.env        # macOS / Linux
```

The defaults work out of the box. Change `JWT_SECRET` before deploying anywhere real.

### 3. Run

```bash
npm run dev
```

- Web app: http://localhost:5173
- API: http://localhost:5000/api
- Health check: http://localhost:5000/api/health

On the first visit, the app shows a **first-time setup** screen. Enter the hotel name, the owner's name, an email address, and a password. That creates the administrator account and the initial hotel settings. After signing in, add room types, rooms, staff accounts, and the rest of the hotel details.

With the in-memory fallback, data lasts only for that server session. Configure a persistent `MONGODB_URI` for real use.

### 4. Production build

```bash
npm run build
npm start
```

`npm run build` creates `client/dist`. When that folder exists, Express serves the built app, so the whole system is available from `http://localhost:5000` with SPA routing and no separate web server.

---

## First-time setup and handover

1. Start the app against the hotel's real database.
2. Open the app. The setup screen appears only while no user account exists.
3. Create the owner/administrator account and enter the hotel name.
4. Sign in and complete the hotel profile in **Settings** (contact details, address, currency, tax, check-in/out times, policies, service menu).
5. Add room types and rooms in **Rooms**, or run `npm run seed:inventory` to create the starting 100-room inventory (room types plus rooms numbered 001–100, ten per floor).
6. Add manager, receptionist, and housekeeping accounts in **Team & access**. For front-office and housekeeping hiring, use **Staff admin** under Administration for quick add/remove with generated credentials.
7. Share the public site with guests and start taking reservations.

The inventory script is safe to re-run: it only adds missing room types and rooms, so rates, descriptions, and statuses you edit later are never overwritten.

To wipe all data and return to the setup screen (for example, after testing), run:

```bash
npm run reset -- --yes
```

This deletes every record, including users, rooms, bookings, invoices, and settings. It requires the `--yes` flag.

Room photos are bundled in `client/public/images`, so the public site and the staff Rooms page show pictures without depending on an external image CDN.

---

## Roles and access

| Area | Admin | Manager | Receptionist | Housekeeping | Guest |
| --- | :---: | :---: | :---: | :---: | :---: |
| Dashboard | ✓ | ✓ | ✓ | ✓ | |
| Reception panel: front desk, bookings, guests | ✓ | ✓ | ✓ | | |
| Billing and invoices | ✓ | ✓ | ✓ | | |
| Housekeeping panel: rooms, housekeeping, maintenance, services | ✓ | ✓ | | ✓ | |
| Reports | ✓ | ✓ | | | |
| Feedback inbox | ✓ | ✓ | ✓ | | |
| Staff accounts | ✓ | ✓ | | | |
| Settings | ✓ | ✓ (read) | read | read | |
| Guest portal (`/app/my-stay`) | | | | | ✓ |

Guests can self-register from the login page and are linked to an existing guest profile by email when one exists.

---

## API overview

All routes are under `/api`. Protected routes expect `Authorization: Bearer <token>`.

| Group | Base path | Notes |
| --- | --- | --- |
| Health | `/health` | Status, uptime, database mode |
| Setup | `/setup` | First-run status and initial administrator creation |
| Auth | `/auth` | Login, guest registration, current user, password change |
| Users | `/users` | Staff account CRUD (admin/manager); supports `roles=receptionist,housekeeping` filtering |
| Guests | `/guests` | Guest profiles and stay statistics |
| Rooms | `/rooms` | Inventory, room detail, status updates |
| Room types | `/room-types` | Inventory types and rates |
| Bookings | `/bookings` | List, availability, calendar, create/update, confirm, check-in/out, cancel, no-show |
| Invoices | `/invoices` | List/summary, create, add items, pay, void |
| Services | `/services` | Guest service requests |
| Housekeeping | `/housekeeping` | Task queue, create/update/delete |
| Maintenance | `/maintenance` | Requests and resolution |
| Feedback | `/feedback` | Inbox, responses, publishing |
| Reports | `/reports` | Overview, occupancy, revenue, forecast, guests, CSV export |
| Settings | `/settings` | Hotel profile, tax, policies, service menu |
| Notifications | `/notifications` | Role-scoped feed and read state |
| Portal | `/portal` | Guest-only stay, bookings, services, invoices, feedback, maintenance |
| Public | `/public` | Hotel info, availability, online bookings (signed-in guests), feedback |

Errors are returned as `{ "message": "...", "details": [...] }` with appropriate status codes (`400`, `401`, `403`, `404`, `409`, `422`, `500`).

---

## Environment variables

| Variable | Default | Purpose |
| --- | --- | --- |
| `NODE_ENV` | `development` | Enables production behaviour and stricter startup |
| `PORT` | `5000` | API/server port |
| `MONGODB_URI` | local `luxurystay` database | MongoDB connection string |
| `USE_MEMORY_DB` | `true` | Allow in-memory fallback outside production |
| `JWT_SECRET` | dev placeholder | Token signing secret — change in production |
| `JWT_EXPIRES_IN` | `12h` | Session token lifetime |
| `CLIENT_ORIGIN` | `http://localhost:5173` | Allowed CORS origin(s), comma-separated |
| `LOG_LEVEL` | `dev` | Morgan request log format |

In production (`NODE_ENV=production`) the in-memory fallback is disabled, so a working `MONGODB_URI` is required.

---

## Scripts

Run from the repository root:

| Command | Description |
| --- | --- |
| `npm run install:all` | Install server and client dependencies |
| `npm run dev` | Start API and Vite dev server together |
| `npm run dev:server` | Start only the API with file watching |
| `npm run dev:client` | Start only the Vite dev server |
| `npm run reset -- --yes` | Delete all data and return to the first-run setup screen |
| `npm run seed:inventory` | Create the starting room types and 100 rooms (001–100) |
| `npm run build` | Build the client for production |
| `npm start` | Start the API (serves `client/dist` when present) |
| `npm test` | Run the server integration test suite |

---

## Tests

```bash
npm test
```

The suite starts its own in-memory MongoDB, loads private fixtures from `server/tests/fixtures`, and exercises the real Express app through Supertest. It covers health and public endpoints, online booking requests, authentication and role authorization, room and guest management, the full reservation/check-in/checkout flow, folios and payments, housekeeping and maintenance, reports, settings permissions, the guest portal, feedback, and 404 handling. Tests use a disposable database and never touch real hotel data.

---

## Deploying to Vercel

The repo deploys as one Vercel project: Vite builds the client to `client/dist`, and `api/index.js` exposes the Express API as a serverless function. All `/api/*` requests go to the function; every other path serves the SPA.

1. Import `https://github.com/Fahads-Code/LuxuryStay-Hospitality.git` into Vercel (Node.js 22.x). The root `vercel.json` already contains the install/build commands and rewrites.
2. Add these **Production** environment variables in the Vercel project:

   | Variable | Example | Notes |
   | --- | --- | --- |
   | `NODE_ENV` | `production` | Required — disables the in-memory database fallback. |
   | `MONGODB_URI` | `mongodb+srv://…` | A real MongoDB Atlas connection string. Allow all IPs (`0.0.0.0/0`) in Atlas Network Access because serverless egress addresses change. |
   | `JWT_SECRET` | long random value | Never reuse the development placeholder. |
   | `CLIENT_ORIGIN` | `https://luxurystay-black.vercel.app` | Your deployed origin; add custom domains here too. |
   | `USE_MEMORY_DB` | `false` | Data must survive serverless restarts. |
   | `LOG_LEVEL` | `combined` | Optional access logging. |

3. Deploy. The live production URL for this project is **https://luxurystay-black.vercel.app** (`luxurystay.vercel.app` is already registered by another account, so Vercel assigned a scoped alias). To use a custom domain such as `luxurystay.com`, add it under **Project → Settings → Domains** and include it in `CLIENT_ORIGIN`.
4. Open the site and sign in with the owner account. If the database is fresh, complete the first-run setup instead.

> Note: serverless functions are short-lived, so the server-sent-events stream (`/api/live`) may disconnect. The client automatically falls back to polling and refreshes on tab focus, so data still stays current.

---

## Production checklist

- Set `NODE_ENV=production`, a strong `JWT_SECRET`, and a real `MONGODB_URI`
- Set `USE_MEMORY_DB=false`
- Set `CLIENT_ORIGIN` to your deployed web origin(s)
- Run `npm run build` before `npm start`
- Complete the first-run setup with the owner's real account
- Serve over HTTPS and keep dependencies updated
