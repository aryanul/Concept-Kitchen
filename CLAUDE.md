# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

CK Nest HRMS — internal Human Resources Management System for a multi-branch Indian
manufacturing/services company (currency INR, locale `en-IN`, desktop-first web app).
Covers the employee lifecycle in three phases: **Phase 1 Employment** (Employee Master,
Shifts, Holidays, Attendance, Salary, Payroll, Loans, Increments, Leaves, Tours, Incentives),
**Phase 2 Hiring** (Job Profiles, Vacancies, Onboarding), **Phase 3 Relieving** (Exit, FNF —
stubs). The active initiative is rebuilding pages to match the original writeup in
`design_handoff_ck_nest_hrms/`, which holds the binding specs, API contracts, and design
tokens. Treat that folder as the source of truth; its `design/` HTML files are references to
recreate, **not** code to ship.

## Commands

Run from the repo root (npm workspaces):

```bash
npm install            # installs root + all workspaces
npm run dev            # runs web + server concurrently
npm run dev:web        # frontend only → http://localhost:5173
npm run dev:server     # backend only → http://localhost:4000
```

Backend (`server/`):

```bash
npm --workspace server run dev       # tsx watch src/index.ts
npm --workspace server run build     # tsc → dist/
npm --workspace server run migrate   # apply pending SQL migrations
npm --workspace server run seed:all  # seed ref + employees + transactional data
# individual seeds: seed:ref, seed:employees, seed:transactional, seed:hiring,
# seed:hiring-masters, seed:prospects, seed:lookups, seed:skills, seed:atm-tasks,
# seed:jp-masters, seed:training-modules, seed:funnel-templates (see server/package.json)
```

Frontend (`web/`):

```bash
npm --workspace web run dev      # vite
npm --workspace web run build    # tsc -b && vite build
npm --workspace web run lint     # eslint
```

There is **no test suite** in this repo. The `/dev/wipe` page + `/api/v1/dev/wipe/*` routes
are a destructive developer tool for clearing DB tables — never invoke against production data.

## Environment

Two separate env files: the **server** reads `.env` at the repo root (copy from
`.env.example`); the **web** app reads `web/.env.local` (`VITE_API_URL`, points at
`…/api/v1`). The server **refuses to start** without `JWT_ACCESS_SECRET`. Set
`CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, and `CLOUDINARY_API_SECRET` to enable
file/photo uploads (obtained from the Cloudinary dashboard). The DB connection reads
`DATABASE_URL` if set, otherwise the discrete
`DB_HOST`/`DB_PORT`/`DB_USER`/`DB_PASSWORD`/`DB_NAME` fields. Set `DB_SSL=true` for TiDB
Serverless (which requires TLS) — note `DB_SSL` is read in `db.ts` but is **not** in
`.env.example`, so add it yourself for a serverless DB. `SESSION_IDLE_MINUTES` (default 30)
is how long a session survives **without interaction**; `CK_STAFF_EMAIL_DOMAIN` (default
`conceptkitchen.net`) is the domain of the sign-in addresses derived for provisioned CK staff.

After `seed:all`, three demo accounts are available:

| Email | Password | Role |
|---|---|---|
| `hr@cknest.local` | `Hr@123` | HR_ADMIN |
| `manager@cknest.local` | `Mgr@123` | MANAGER |
| `emp@cknest.local` | `Emp@123` | EMPLOYEE |

## Database

**The database is TiDB**, not MySQL, despite the `mysql2` driver and "MySQL" mentions in
the README/handoff. This matters when writing migrations:

- Migrations are raw `.sql` files in `server/migrations/`, applied in filename sort order
  by `server/src/migrate.ts`, tracked in a `migrations` table.
- The migration runner uses a **naive `;` splitter** ([migrate.ts:23](server/src/migrate.ts#L23)):
  it strips `--` line comments then splits on `;`. So: **never put `;` inside a string
  literal** in a migration, and **split multi-clause `ALTER TABLE` statements** into
  separate statements where TiDB needs them.
- Seed scripts are `tsx` programs in `server/scripts/`, run via the `seed:*` npm scripts.
  All seeds are **idempotent** — they truncate relevant tables before inserting, so they can
  be re-run safely to reset data.

## Architecture

Monorepo with three npm workspaces: `web/`, `server/`, `shared/` (`shared/` is currently
just a `.gitkeep` — intended for cross-cutting TS types but unused so far; the `Role` union
is duplicated in both `server/src/auth.ts` and `web/src/stores/auth.ts`).

### Server (`server/`)

Express 4 + TypeScript. Two route files register everything:

- [server/src/index.ts](server/src/index.ts) — a **monolithic ~140-route file** holding all
  domain endpoints (auth, employees, compensations, hiring/applicants/onboarding, attendance,
  leaves, payroll, loans, activity logs, file uploads, etc.). New domain routes go here unless
  they're master/reference CRUD.
- [server/src/masters.ts](server/src/masters.ts) — `registerMasterRoutes(app)`, ~110 routes
  for master/reference data (branches, departments, shifts, salary grades, skills, templates,
  lookups, tags, assets, onboarding catalogues). Registered **after** global
  middleware in `index.ts` so `req.body` and CORS are available.
- [server/src/users.ts](server/src/users.ts) — `registerUserRoutes(app)`: the Users console,
  the Roles & Permissions screen, and CK staff provisioning (`syncCkUsers`).

Conventions enforced across both files:

- **Response envelope:** success is `res.json({ data: … })`; errors are
  `res.status(n).json({ error: { code, message } })` with codes like `VALIDATION`,
  `UNAUTHORIZED`, `FORBIDDEN`, `NOT_FOUND`. Match this shape in new routes.
- **IDs are ULIDs** (`ulid()`), not auto-increment. Human-facing codes (e.g. `BR001`) are
  generated by the `nextCode()` helper in `masters.ts`. PATCH routes use the `updateSets(body,
  allowedFields)` helper (also in `masters.ts`) to build `SET col = ?` clauses from a
  whitelist — never build SET clauses by hand.
- **Auth** ([server/src/auth.ts](server/src/auth.ts)): JWT bearer access tokens.
  `authRequired` populates `req.user`; `readUserFromToken(req)` decodes without rejecting
  (used by the permission guard, which runs before any route). Roles:
  `HR_ADMIN | MANAGER | EMPLOYEE | FINANCE`. The session is an **inactivity window**, not a
  fixed clock: token TTL = `SESSION_IDLE_MINUTES` (default 30), and the client slides it via
  `POST /auth/refresh` while the user interacts (`web/src/components/IdleSessionGuard.tsx`).
  `JWT_ACCESS_TTL` is no longer read — it was a hard 15-minute expiry that signed people out
  mid-task. Accounts have an `Active`/`Inactive` status; Inactive cannot sign in or refresh.
- **Permissions** ([server/src/permissions.ts](server/src/permissions.ts)): one
  `module.action` key per governable thing, enforced **centrally**. `permissionGuard` derives
  the required key from the method + resource path, so a new route under an existing resource
  is governed the moment it exists — do not add per-route guards. To govern a *new* resource,
  add its path segment to the owning module's `resources` in `MODULES`. `HR_ADMIN` holds
  everything in code and cannot be edited down. Effective set = role grants + user allows −
  user denies (a deny always wins).
- **DB access** ([server/src/db.ts](server/src/db.ts)): a single shared `pool` and a
  `query<T>(sql, params)` helper. Always use parameterized queries.
- **Audit:** auditing is **on by default** —
  [auditMiddleware.ts](server/src/auditMiddleware.ts) logs every successful mutation on
  `/api/v1`. A handler that wants a richer entry calls
  `writeAudit(actorId, action, resource, resourceId, before, after)`
  ([audit.ts](server/src/audit.ts)); that flags the request (via `AsyncLocalStorage`) so the
  middleware does not log it twice. Surfaced by `GET /api/v1/activity-logs`, whose filter
  options come from `GET /api/v1/activity-logs/facets` rather than a hard-coded list.
- **File uploads:** [server/src/upload.ts](server/src/upload.ts) wraps Cloudinary; the
  `POST /api/v1/upload` route uses `multer` memory storage and routes images vs. raw files to
  separate Cloudinary folders (`cknest/photos`, `cknest/documents`).
- The mysql2 driver returns `CAST(... AS UNSIGNED)` results as **strings** — coerce with
  `Number()` before arithmetic (see the comment in `nextCode`).
- **Connection resilience:** [db.ts](server/src/db.ts) enables `enableKeepAlive` (TiDB
  Serverless drops idle connections) and `query()` transparently retries once on
  connection-lost error codes (`ECONNRESET`, `PROTOCOL_CONNECTION_LOST`, `EPIPE`,
  `ETIMEDOUT`). Don't wrap call sites in their own retry logic for these — it's handled
  centrally.

### Concept Kitchen master-data sync (`server/src/ck*.ts`)

Branches, departments, divisions, designations, skills, lookup value sets and the **staff
list** are **mirrored** from an external system ("Concept Kitchen") rather than owned
outright — this is an editable, co-owned mirror, not a one-way import:

- [ckApi.ts](server/src/ckApi.ts) — thin fetch wrapper around CK's REST API
  (`CK_API_URL` / `CK_API_KEY` env vars, single `AuthKey` header). Returns `[]` on 404 or
  empty body rather than throwing, so a childless parent never aborts a sync.
  **Three different response shapes are in play** and each has its own reader — `ckList`
  (`{id,name}`), the DDD readers (`departmentCode`/`departmentName`…), the Skill readers
  (`skillsId`/`skillsName`…) and `ckSpecifications` (`specId`/`specName`). Using the wrong
  one silently imports **zero rows**: that is exactly what had happened to every
  `/Specification/*` category before `ckSpecifications` existed. Verify a new endpoint's
  field names against the live API before wiring it up.
- **Blood group and gender are not exposed by CK** (no endpoint, and no specification
  `typeId` carries them — verified by sweeping `/Specification/ByType`). They are owned
  locally and reconciled by `LOCAL_ONLY_LOOKUPS` in `ckSync.ts`, where the lookup **code is
  the label** (`'A+'`, `'Male'`) because employee/applicant rows store the code. Never slug
  these codes: `slug()` drops punctuation, so `A+` and `A-` would collide.
- [ckSync.ts](server/src/ckSync.ts) — the sync engine. Matches/dedupes rows on `ck_id`,
  **never on name** (CK has duplicate names). On UPDATE it only ever sets CK-owned columns
  (name, CK-derived FK links); locally-owned columns (code, city, kind, description, custom
  flags) are never named in an UPDATE, so a re-sync can never blob-overwrite a local edit. A
  CK row that disappears is left in place — rows are never deleted by a sync. Each domain is
  wrapped in its own try/catch so one failing endpoint degrades only that domain.
- [ckSchedule.ts](server/src/ckSchedule.ts) — unattended scheduling on top of the manual
  `POST /api/v1/ck/sync` route: syncs once per IST half-day window (AM/PM) on the first
  login of that window, plus a daily timer at IST midnight as a backstop for when nobody
  logs in. A single in-flight guard (`isSyncing()` / `tryBeginSync()` / `endSync()`) is the
  source of truth the UI polls via `GET /ck/sync-state` (see `SyncIndicator` in the web app).
  The last-synced window is recovered on boot from the most recent `ck-sync` audit row, so a
  Render cold-start restart doesn't cause a redundant re-sync.

- **Staff provisioning** ([users.ts](server/src/users.ts) `syncCkUsers`): CK's `/User` list
  is mirrored into `ck_users`, and each new person gets a sign-in created **Inactive** with
  role `EMPLOYEE`, a derived email and a random password. It only ever *creates* — status,
  role and email on an existing account survive every later sync. The corollary: to keep
  someone out, **deactivate rather than delete**; deleting takes the `ck_user_id` link with
  it and the next sync makes a fresh Inactive account for the same person.

If you touch synced tables, preserve the "CK-owned columns only" UPDATE discipline in
`ckSync.ts` — widening an UPDATE to include a locally-owned column will silently blank
user edits on the next sync.

### Web (`web/`)

React 19 + Vite 8 + TypeScript SPA. **No Tailwind** — styling is plain CSS with a large set
of `--ck-*` design tokens defined in [web/src/index.css](web/src/index.css) (mirrors
`design_handoff_ck_nest_hrms/DESIGN_TOKENS.md`). Font is Manrope; status colors use OKLCH.

- **Routing** ([web/src/App.tsx](web/src/App.tsx)): `react-router-dom` v7. `ProtectedRoute`
  guards authenticated routes (redirects to `/login` when no token); `AppLayout` is the shell.
  Routes are organized by phase; unbuilt modules render `StubPage`.
- **State:** `zustand`. Auth lives in [web/src/stores/auth.ts](web/src/stores/auth.ts),
  **persisted** to localStorage under key `ck-nest-auth`.
- **API client** ([web/src/lib/api.ts](web/src/lib/api.ts)): a single axios instance with a
  request interceptor that attaches the bearer token and a response interceptor that, on 401,
  clears auth and redirects to `/login`. Use this `api` export for all backend calls.
- **ServerWakeGate** ([web/src/components/ServerWakeGate.tsx](web/src/components/ServerWakeGate.tsx)):
  wraps the app and polls `/healthz` before rendering, because the backend is deployed on
  Render's free tier and cold-starts can take 30–60s. It re-gates on network/5xx failures.
- **Forms** use `react-hook-form` + `zod` (`@hookform/resolvers`); toasts via `sonner`;
  icons via `lucide-react`.
- Components are grouped under `web/src/components/` (`ui/` primitives, `shell/`, and
  domain folders `employees/`, `hiring/`, `masters/`); pages live under `web/src/routes/<domain>/`.
- **UI component styling:** primitives in `ui/` use **inline `style` objects** with CSS
  variable references (e.g. `style={{ background: 'var(--ck-accent)' }}`), not CSS Modules
  or external stylesheets. Follow this pattern when building new primitives. The `Button`
  component accepts `variant` (`primary | accent | secondary | ghost | danger`) and `size`
  (`sm | md | lg`).
- **Shared primitives to reuse** (in `ui/`): `IconAction` for icon buttons — always give it a
  visible caption + hover hint rather than a bare icon; `MediaUpload` for photo/document
  uploads, which POSTs to `/api/v1/upload` and returns the Cloudinary URL.
- **Cascading org pickers — do not rebuild these per screen.**
  `components/org/CompanyBranchLocation.tsx` is the Company → Branch → Location cascade
  (plus `useScopeNames` for resolving ids to names and `RemoveRowButton`);
  `components/org/ScopeGridEditor.tsx` is the repeatable grid for things that apply to
  *many* company/branch/location sets (duty shifts, holidays), with `ScopeCountCell` /
  `ScopeDetailModal` for showing a count in a list instead of a run-on name list.
  `components/filters/HierarchyFilters.tsx` is the filter-bar equivalent for both chains.
  In all of them a child level is **locked until its parent is chosen** — an unlocked child
  invites contradictory filter pairs that return nothing.
- **Permissions:** `usePermissions()` ([web/src/lib/permissions.ts](web/src/lib/permissions.ts))
  answers what the signed-in user may do, cached per user id. Use it to hide UI that would
  only 403 — never as the control, which is the server's `permissionGuard`.
- **List loading:** `lib/listCache.ts` is a small stale-while-revalidate cache. Seed page
  state from `readCache` so returning to a list paints instantly, then revalidate; call
  `invalidateCache(name)` after a mutation so a save is not followed by the pre-save row.
