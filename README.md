# UniStay MSU: A Unified Institutional & Private Housing Management Information System

> **Mindanao State University - Main Campus, Marawi City**  
> Offline-First Housing Management, Fair-Rate Billing, Verifiable Utility Splitting, and Student Micro-Jobs Engine.

---

## 🏗 Monorepo Architecture

The repository is structured as a TypeScript monorepo with strict shared typing and decoupled client/API architecture:

```
unistay-msu/
├── api/                      # Backend API (Node.js / NestJS 10 / TypeORM / PostgreSQL 16)
│   ├── src/
│   │   ├── common/           # RBAC decorators, guards, filters, interceptors
│   │   ├── config/           # Database, JWT, and MinIO storage configuration
│   │   ├── modules/
│   │   │   ├── auth/         # Google OAuth 2.0 (@msu.edu.ph domain) & Scoped JWTs
│   │   │   ├── users/        # User accounts & RBAC profiles
│   │   │   ├── housing/      # Team 2: Property directory, units & applications
│   │   │   ├── billing/      # Team 3: Ledger, utility splitter & offline payments
│   │   │   ├── maintenance/  # Team 4: Tickets with photos & utility outage alerts
│   │   │   ├── facilities/   # Team 4: Smart laundry/parking bookings & dorm governance
│   │   │   ├── gigs/         # Team 5: Student gig marketplace (job creation)
│   │   │   ├── sync/         # Team 5: Dexie.js offline mutation queue batch sync
│   │   │   └── storage/      # S3 / MinIO media upload service
│   │   ├── app.module.ts
│   │   └── main.ts           # Swagger documentation & validation setup
│   ├── .env.example
│   ├── .env
│   ├── Dockerfile
│   ├── package.json
│   └── tsconfig.json         # Extends ../tsconfig.base.json
│
├── client/                   # Frontend Client (Vue 3 / Vite / Pinia / Dexie.js / PWA)
│   ├── src/
│   │   ├── api/              # Axios HTTP client with Bearer auth interceptors
│   │   ├── components/       # Layouts, Navbar, Sidebar, OfflineBanner
│   │   ├── db/               # Dexie.js IndexedDB schema & Offline Sync Engine
│   │   ├── stores/           # Pinia stores (Auth, Network, Housing, Billing, etc.)
│   │   ├── types/            # TypeScript domain interfaces
│   │   ├── views/            # Dashboard, Directory, Billing, Service Desk, Gigs, etc.
│   │   ├── App.vue
│   │   ├── main.ts
│   │   └── style.css         # Tailwind CSS directives
│   ├── .env.example
│   ├── .env
│   ├── Dockerfile
│   ├── package.json
│   ├── vite.config.ts        # Vite + PWA + Proxy configuration
│   └── tsconfig.json         # Extends ../tsconfig.base.json
│
├── tsconfig.base.json        # Shared base TypeScript configuration
├── docker-compose.yml        # PostgreSQL 16, MinIO, API & Client orchestration
├── package.json              # Root workspace orchestration
├── .gitignore
├── .env.example
└── README.md
```

---

## 🚀 Quick Start & Development

### 1. Prerequisites
- **Node.js**: v18+ or v20+ / v22+
- **Docker & Docker Compose** (for PostgreSQL & MinIO)

### 2. Install Dependencies
Run from the root directory:
```bash
npm install
```

### 3. Start PostgreSQL & MinIO Services (Docker)
```bash
npm run docker:up
```
- **PostgreSQL 16**: Port `5432` (`localhost:5432`, db: `unistay_db`)
- **MinIO S3 API**: Port `9000` (`localhost:9000`)
- **MinIO Web Console**: Port `9001` (`http://localhost:9001`, user: `unistay_admin`, pass: `unistay_minio_secret_2026`)

### 4. Run Development Servers
To run both backend API and frontend client concurrently:
```bash
npm run dev
```

Or run individually:
- **API (NestJS)**: `npm run dev:api` (Runs on `http://localhost:3000`, OpenAPI Swagger at `http://localhost:3000/api/docs`)
- **Client (Vue 3 / Vite)**: `npm run dev:client` (Runs on `http://localhost:5173`)

---

## 🔐 Identity & Authentication

- **Institutional Domain Constraint**: Restricts Google OAuth to `@msu.edu.ph` accounts.
- **Local Dev Login**: For offline or rapid testing, 1-click dev accounts are available on the login page:
  - **Student**: `student.msu@msu.edu.ph`
  - **Property Manager**: `manager.dorm@msu.edu.ph`
  - **University Admin**: `admin.housing@msu.edu.ph`

---

## ⚡ Offline-First Architecture (Dexie.js + IndexedDB)

UniStay MSU operates even during campus network outages:
1. All browse data (properties, invoices, tickets, bookings, gigs) is cached into local IndexedDB via **Dexie.js**.
2. When creating transactions (such as logging an offline payment, filing a repair ticket, or reserving laundry while offline), the client queues mutations into `db.syncQueue`.
3. The **SyncEngine** monitors connectivity and immediately replays the mutation batch to `/api/v1/sync/batch` upon network restoration.
4. An interactive **OfflineBanner** displays real-time connectivity status and pending queue counts.

---

## 👥 Scrum Team Alignment (5 Teams / 27 Developers)

| Team | Focus Area | Backend Modules | Frontend Views |
| :--- | :--- | :--- | :--- |
| **Team 1: Identity & Core** | Auth, RBAC, Directory Service, API Gateway | `modules/auth`, `modules/users` | `LoginView.vue`, `Navbar.vue` |
| **Team 2: Tenancy Lifecycle** | Housing Listings, Applications, Leases, Governance | `modules/housing` | `HousingDirectoryView.vue` |
| **Team 3: Billing & Payments** | Financial Ledger, Utility Splitter, Offline Payments | `modules/billing` | `BillingLedgerView.vue` |
| **Team 4: Facilities & Utils** | Maintenance Tickets, Photos, Utility Outages, Bookings | `modules/maintenance`, `modules/facilities`, `modules/storage` | `MaintenanceDeskView.vue`, `FacilityBookingView.vue` |
| **Team 5: Occupant Services** | Student Gig Board, Sync Engine, Dexie PWA | `modules/gigs`, `modules/sync` | `GigBoardView.vue`, `sync-engine.ts` |
