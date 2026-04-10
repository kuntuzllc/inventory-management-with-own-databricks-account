# InventorySelf

InventorySelf is a production-ready inventory management monorepo with:

- `apps/web`: Vite + React + TypeScript SPA
- `apps/server`: Express + TypeScript API
- `databricks`: Databricks schema design, initialization SQL, and migrations
- npm workspaces at the repo root

The app is Databricks-only for stored product data and app metadata:

- Databricks stores users, encrypted Databricks connection metadata, audit logs, inventory, sales, imports, and activity
- server `.env` is only for app-wide secrets such as JWT signing and encryption keys
- the UI never writes per-user Databricks details into `.env`

## Product capabilities

- Username/password auth with protected routes
- Databricks-first onboarding
- Inventory CRUD with search, filter, sort, and detail views
- Image URL support and local image uploads
- CSV/XLSX preview + mapped import flow
- Sales tracking with partial/full quantity sold
- Revenue, profit, COGS, valuation, purchases, and monthly reports
- Dashboard summaries and recent activity

## Tech stack

- Frontend: React 19, Vite, TypeScript, React Router, TanStack Query
- Backend: Express 5, TypeScript, Zod, JWT, bcrypt, raw SQL
- Data store: Databricks SQL tables in the user-selected workspace

## Monorepo scripts

```bash
npm run dev
npm run build
```

- `npm run dev` starts both `apps/web` and `apps/server`
- `npm run build` builds both packages

## Setup

1. Install dependencies:

```bash
npm install
```

2. Copy the example environment file:

```bash
copy .env.example .env
```

You can also place the same file at `apps/server/.env`. The server loads either location.

3. Fill in app-wide settings:

- `JWT_SECRET`
- `APP_ENCRYPTION_KEY`
- optional server settings like `PORT` and `APP_ORIGIN`

4. Start the stack:

```bash
npm run dev
```

5. Open the app:

- Frontend: `http://localhost:5173`
- API health check: `http://localhost:4000/api/health`

## How auth works

1. On the first page, a user enters:

- workspace nickname
- Databricks host
- SQL warehouse HTTP path
- personal access token
- username
- password

2. The server connects to that Databricks workspace, creates the generated catalog/schema if needed, and initializes the required metadata and inventory tables.

3. The user account, Databricks connection metadata, and audit logs are stored in that same Databricks workspace.

4. On later login, the user enters:

- workspace nickname
- Databricks host
- SQL warehouse HTTP path
- personal access token
- username
- password

This is required because the app does not use a separate bootstrap database.

## Databricks tables

The generated catalog/schema contains fixed app metadata tables:

- `app_users`
- `app_databricks_connections`
- `app_audit_logs`

It also contains inventory tables:

- `inventory_items`
- `inventory_sales`
- `inventory_imports`
- `inventory_activity_log`

Optional `table_prefix` values are applied only to the inventory tables.

## Security model

- User Databricks host, HTTP path, and token come from the UI
- Sensitive connection fields are encrypted before storage in Databricks metadata tables
- Databricks tokens are never written into `.env`
- Protected requests use an encrypted connection payload inside the auth token
- Every operational Databricks table includes `user_id`
- Every operational query filters by authenticated `user_id`

## Deployment notes

- `apps/web` produces a static build via Vite
- `apps/server` produces a Node build via `tsc`
- Frontend and API can be deployed separately
- The API can be adapted later for serverless targets if needed

## Important implementation note

This repo uses raw SQL for Databricks. Repositories are the only layer allowed to execute SQL so route handlers stay thin and the service layer remains focused on business logic.
