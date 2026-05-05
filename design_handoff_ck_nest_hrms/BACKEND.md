# Backend — Node.js / Express API

**Stack:** Node 20 + Express 4 + TypeScript + Prisma + PostgreSQL + JWT auth + Zod validation + Pino logger + Jest. Background jobs via BullMQ + Redis (payroll runs, email, scheduled attendance import).

> PostgreSQL is recommended over MongoDB because every domain here is relational (employees → departments → branches; payroll → employee + components + loans + incentives; attendance → shifts; leaves → balances). If you must use MongoDB, replace Prisma with Mongoose and keep collection shapes close to the Prisma models below.

---

## 1. Project skeleton

```
apps/api/
├── src/
│   ├── server.ts                 # bootstrap: app.listen
│   ├── app.ts                    # express app, middleware, mounts routers
│   ├── config/
│   │   ├── env.ts                # zod-validated process.env
│   │   └── logger.ts             # pino
│   ├── db/
│   │   ├── client.ts             # PrismaClient singleton
│   │   └── seed.ts               # port from design/data.jsx
│   ├── middleware/
│   │   ├── auth.ts               # JWT verify → req.user
│   │   ├── requireRole.ts
│   │   ├── error.ts              # central error handler
│   │   └── validate.ts           # zod schema runner
│   ├── modules/                  # one folder per resource
│   │   ├── auth/
│   │   ├── employees/
│   │   ├── branches/
│   │   ├── departments/
│   │   ├── shifts/
│   │   ├── attendance/
│   │   ├── holidays/
│   │   ├── salary/               # grades + components
│   │   ├── payroll/
│   │   ├── loans/
│   │   ├── increments/
│   │   ├── leaves/
│   │   ├── tours/
│   │   └── incentives/
│   │       ├── *.controller.ts
│   │       ├── *.service.ts
│   │       ├── *.routes.ts
│   │       └── *.schema.ts       # zod
│   ├── jobs/                     # BullMQ workers
│   │   ├── payrollRun.ts
│   │   ├── attendanceSync.ts
│   │   └── email.ts
│   ├── lib/
│   │   ├── jwt.ts
│   │   ├── permissions.ts        # role × action → allow
│   │   ├── pagination.ts
│   │   └── inr.ts
│   └── types/
├── prisma/
│   ├── schema.prisma
│   └── migrations/
├── tests/
└── package.json
```

---

## 2. Bootstrap

```bash
mkdir -p apps/api && cd apps/api
npm init -y
npm i express cors helmet morgan compression cookie-parser \
       jsonwebtoken bcryptjs zod \
       @prisma/client prisma \
       pino pino-http \
       bullmq ioredis \
       date-fns
npm i -D typescript ts-node-dev @types/node @types/express \
       @types/jsonwebtoken @types/bcryptjs @types/cors \
       jest ts-jest supertest @types/jest @types/supertest
npx tsc --init
npx prisma init --datasource-provider postgresql
```

---

## 3. Data models (Prisma)

```prisma
// prisma/schema.prisma  — abridged but production-shaped

generator client { provider = "prisma-client-js" }
datasource db { provider = "postgresql"; url = env("DATABASE_URL") }

enum Role { HR_ADMIN MANAGER EMPLOYEE FINANCE }
enum EmployeeStatus { ACTIVE PROBATION ON_LEAVE EXITED }
enum LeaveType { EL CL SL LWP TOUR COMP_OFF }
enum LeaveStatus { PENDING APPROVED REJECTED CANCELLED }
enum LoanKind { LOAN ADVANCE }
enum LoanStatus { ACTIVE CLOSED DEFAULTED }
enum PayrollStatus { DRAFT APPROVED DISBURSED }
enum PunchSource { BIOMETRIC MANUAL GEO }

model User {
  id        String   @id @default(cuid())
  email     String   @unique
  password  String
  role      Role
  employee  Employee? @relation(fields: [employeeId], references: [id])
  employeeId String?  @unique
  createdAt DateTime @default(now())
}

model Branch {
  id    String @id @default(cuid())
  code  String @unique          // 'mum','rai',...
  name  String
  city  String
  kind  String                  // 'Office' | 'Plant'
  employees Employee[]
}

model Department {
  id    String @id @default(cuid())
  name  String @unique
  employees Employee[]
}

model Shift {
  id        String @id @default(cuid())
  code      String @unique     // 'day','night',...
  name      String
  startTime String              // 'HH:mm'
  endTime   String
  kind      String
  breakMin  Int                 @default(45)
  rosterEntries RosterEntry[]
}

model SalaryGrade {
  id        String @id @default(cuid())
  code      String @unique     // 'L01'..
  kind      String
  minGross  Int                 // in paise
  maxGross  Int
  employees Employee[]
}

model Employee {
  id           String   @id @default(cuid())
  code         String   @unique // 'CK-EMP-001'
  firstName    String
  lastName     String
  designation  String
  status       EmployeeStatus  @default(ACTIVE)
  joiningDate  DateTime
  exitDate     DateTime?
  email        String   @unique
  phone        String
  branch       Branch   @relation(fields: [branchId], references: [id])
  branchId     String
  department   Department @relation(fields: [departmentId], references: [id])
  departmentId String
  manager      Employee?  @relation("Reports", fields: [managerId], references: [id])
  managerId    String?
  reports      Employee[] @relation("Reports")
  grade        SalaryGrade @relation(fields: [gradeId], references: [id])
  gradeId      String
  ctc          Int                 // annual, paise
  bankName     String?
  bankAccount  String?
  ifsc         String?
  pan          String?
  aadhaar      String?     // store hashed/encrypted in real life
  pf           String?
  esic         String?
  uan          String?
  user         User?
  attendance   Attendance[]
  leaves       Leave[]
  loans        Loan[]
  payrolls     PayrollItem[]
  increments   Increment[]
  tours        Tour[]
  incentives   Incentive[]
  rosterEntries RosterEntry[]
  createdAt    DateTime @default(now())
  updatedAt    DateTime @updatedAt
}

model RosterEntry {
  id         String @id @default(cuid())
  employee   Employee @relation(fields: [employeeId], references: [id])
  employeeId String
  shift      Shift    @relation(fields: [shiftId], references: [id])
  shiftId    String
  date       DateTime
  @@unique([employeeId, date])
}

model Attendance {
  id         String @id @default(cuid())
  employee   Employee @relation(fields: [employeeId], references: [id])
  employeeId String
  date       DateTime
  inAt       DateTime?
  outAt      DateTime?
  totalMin   Int      @default(0)
  otMin      Int      @default(0)
  source     PunchSource @default(BIOMETRIC)
  isLate     Boolean  @default(false)
  notes      String?
  @@unique([employeeId, date])
}

model Holiday {
  id       String @id @default(cuid())
  date     DateTime @unique
  name     String
  kind     String              // 'Public' | 'Restricted'
  branches String[]            // empty array = all
}

model Leave {
  id          String @id @default(cuid())
  employee    Employee @relation(fields: [employeeId], references: [id])
  employeeId  String
  type        LeaveType
  fromDate    DateTime
  toDate      DateTime
  days        Float
  reason      String
  status      LeaveStatus @default(PENDING)
  attachment  String?
  approverId  String?
  decidedAt   DateTime?
  createdAt   DateTime @default(now())
}

model LeaveBalance {
  id         String @id @default(cuid())
  employeeId String
  type       LeaveType
  year       Int
  opening    Float
  consumed   Float @default(0)
  closing    Float
  @@unique([employeeId, type, year])
}

model PayrollPeriod {
  id        String @id @default(cuid())
  month     Int                  // 1-12
  year      Int
  status    PayrollStatus @default(DRAFT)
  runAt     DateTime?
  approvedAt DateTime?
  disbursedAt DateTime?
  items     PayrollItem[]
  @@unique([month, year])
}

model PayrollItem {
  id         String @id @default(cuid())
  period     PayrollPeriod @relation(fields: [periodId], references: [id])
  periodId   String
  employee   Employee @relation(fields: [employeeId], references: [id])
  employeeId String
  daysPaid   Float
  gross      Int                 // paise
  earnings   Json                // [{component:'Basic', amount}]
  deductions Json
  loanRecovery Int @default(0)
  net        Int
  status     PayrollStatus @default(DRAFT)
  @@unique([periodId, employeeId])
}

model Loan {
  id           String @id @default(cuid())
  employee     Employee @relation(fields: [employeeId], references: [id])
  employeeId   String
  kind         LoanKind
  principal    Int
  outstanding  Int
  emi          Int
  tenureMonths Int
  remaining    Int
  status       LoanStatus @default(ACTIVE)
  purpose      String?
  startedAt    DateTime
  payments     LoanPayment[]
}

model LoanPayment {
  id      String @id @default(cuid())
  loanId  String
  loan    Loan   @relation(fields: [loanId], references: [id])
  amount  Int
  payrollItemId String?
  paidAt  DateTime
}

model Increment {
  id          String @id @default(cuid())
  employee    Employee @relation(fields: [employeeId], references: [id])
  employeeId  String
  cycleYear   Int
  current     Int
  proposed    Int
  hikePct     Float
  rating      String
  stage       String              // 'manager_review' | 'hr' | 'finance' | 'done'
  effective   DateTime?
  remarks     String?
  approvals   Json                // audit log
  createdAt   DateTime @default(now())
}

model Tour {
  id         String @id @default(cuid())
  code       String @unique
  employee   Employee @relation(fields: [employeeId], references: [id])
  employeeId String
  fromCity   String
  toCity     String
  fromDate   DateTime
  toDate     DateTime
  advance    Int
  expense    Int @default(0)
  status     String              // 'requested'|'approved'|'in_progress'|'settled'|'rejected'
  itinerary  Json
}

model Incentive {
  id         String @id @default(cuid())
  employee   Employee @relation(fields: [employeeId], references: [id])
  employeeId String
  kind       String              // 'production_bonus' | 'quality_award' | ...
  month      Int
  year       Int
  amount     Int
  status     String              // 'draft'|'approved'|'rejected'
  pushed     Boolean @default(false)
  pushedAt   DateTime?
  createdAt  DateTime @default(now())
}

model AuditLog {
  id        String @id @default(cuid())
  actorId   String
  action    String
  resource  String
  resourceId String
  before    Json?
  after     Json?
  at        DateTime @default(now())
}
```

All currency stored as **integer paise** (multiply rupees × 100). Format on the way out using `inr()`.

---

## 4. REST API surface

Base path: `/api/v1`. JSON in / JSON out. Standard responses:

```
{ "data": <T> }                              // success single
{ "data": [...], "meta": { page, pageSize, total } }   // success list
{ "error": { "code":"VALIDATION", "message":"…", "fields":{…} } }
```

### Auth
| Method | Path | Notes |
|---|---|---|
| POST | `/auth/login` | `{email, password}` → `{token, user}` |
| POST | `/auth/logout` | clears server-side refresh token |
| GET  | `/auth/me` | current user + employee |
| POST | `/auth/password/reset-request` | sends email |
| POST | `/auth/password/reset` | `{token, password}` |

### Employees
| Method | Path |
|---|---|
| GET    | `/employees?search&branchId&departmentId&status&page&pageSize&sort` |
| GET    | `/employees/:id` |
| POST   | `/employees` |
| PATCH  | `/employees/:id` |
| DELETE | `/employees/:id` (soft → status=EXITED) |
| GET    | `/employees/:id/documents` |
| POST   | `/employees/:id/documents` (multipart) |

### Org
- `GET /branches`, `POST /branches`, `PATCH /branches/:id`
- `GET /departments`, `POST /departments`, `PATCH /departments/:id`

### Shifts & Roster
- `GET/POST/PATCH /shifts`
- `GET /roster?branchId&from&to` → grid
- `POST /roster/bulk` `[ {employeeId, date, shiftId} ]`
- `POST /roster/publish` `{branchId, weekStart}`

### Attendance
- `GET /attendance?date&branchId&status&search`
- `POST /attendance/punch` `{employeeId, kind:'in'|'out', source}` (manual punch)
- `POST /attendance/import` (CSV from biometric — async job)
- `GET /attendance/summary?from&to&branchId`

### Holidays
- `GET/POST/PATCH/DELETE /holidays`

### Salary
- `GET/POST/PATCH /salary/grades`
- `GET/POST/PATCH /salary/components`
- `GET /salary/employees/:id` → current breakdown

### Payroll
- `GET /payroll/periods` (list)
- `POST /payroll/periods` `{month, year}` (creates DRAFT)
- `POST /payroll/periods/:id/run` (queues background job; idempotent)
- `GET /payroll/periods/:id`
- `GET /payroll/periods/:id/items?search&status`
- `PATCH /payroll/periods/:id/items/:itemId` (overrides)
- `POST /payroll/periods/:id/approve`
- `POST /payroll/periods/:id/disburse`
- `GET /payroll/items/:id/slip.pdf`
- `POST /payroll/items/:id/email-slip`

### Loans
- `GET/POST/PATCH /loans`
- `POST /loans/:id/close`
- `GET /loans/:id/schedule`

### Increments
- `GET /increments?cycleYear&stage`
- `POST /increments` (single or bulk)
- `POST /increments/:id/decide` `{decision:'approve'|'reject', remarks}`
- `GET /increments/cycles` / `POST /increments/cycles`

### Leaves
- `GET /leaves?status&type&employeeId&from&to`
- `POST /leaves` (apply)
- `POST /leaves/:id/decide`
- `GET /leaves/balance/:employeeId?year`
- `POST /leaves/balance/recompute` (year-open job)

### Tours
- `GET/POST /tours`
- `POST /tours/:id/decide`
- `POST /tours/:id/settle` `{expense, attachments[]}`

### Incentives
- `GET /incentives?month&year&status`
- `POST /incentives` (single) / `POST /incentives/bulk` (CSV)
- `POST /incentives/:id/decide`
- `POST /incentives/push-to-payroll` `{ids[], periodId}`

### Dashboard
- `GET /dashboard/summary` → all stat-tile values + recent approvals + activity feed

---

## 5. Validation pattern

```ts
// modules/employees/employees.schema.ts
import { z } from 'zod';

export const createEmployeeSchema = z.object({
  firstName: z.string().min(1).max(50),
  lastName:  z.string().min(1).max(50),
  email:     z.string().email(),
  phone:     z.string().regex(/^[6-9]\d{9}$/),    // Indian mobile
  designation: z.string().min(1),
  branchId:    z.string().cuid(),
  departmentId: z.string().cuid(),
  gradeId:     z.string().cuid(),
  managerId:   z.string().cuid().optional(),
  joiningDate: z.coerce.date(),
  ctc:         z.number().int().positive(),
  pan:         z.string().regex(/^[A-Z]{5}\d{4}[A-Z]$/).optional(),
  aadhaar:     z.string().regex(/^\d{12}$/).optional(),
});
export type CreateEmployeeDto = z.infer<typeof createEmployeeSchema>;
```

```ts
// middleware/validate.ts
export const validate = (schema: ZodSchema, where: 'body'|'query'|'params'='body') =>
  (req,res,next) => {
    const r = schema.safeParse(req[where]);
    if (!r.success) return res.status(400).json({ error: { code:'VALIDATION', fields: r.error.flatten().fieldErrors } });
    req[where] = r.data; next();
  };
```

---

## 6. Auth & permissions

- Passwords hashed with `bcryptjs` (cost 12).
- Issue **access JWT** (15 min) + **refresh JWT** (7 days, httpOnly cookie).
- `auth` middleware: verify access JWT → attach `req.user = {id, role, employeeId}`.
- `requireRole('HR_ADMIN','FINANCE')` per route.
- Resource-level rules in `lib/permissions.ts`:
  - `MANAGER` can read/decide leaves only for their `reports`.
  - `EMPLOYEE` can read only their own resources.
  - `HR_ADMIN` full read; write per module flags.
  - `FINANCE` payroll + loans + reimbursements.
- All mutations write an `AuditLog` row with `before` / `after`.

---

## 7. Payroll engine (core logic)

```
1. Resolve eligible employees for period (active during month, not exited before period.start).
2. For each employee:
   a. daysWorked   = attendance days in period (paid leave counts)
   b. lopDays      = LWP days
   c. earnings     = expand salary components from grade × employee overrides
   d. proRate      = (daysPaid / monthDays) for new joiners / exits
   e. add incentives.pushed=true for {month,year}
   f. add tour reimbursements settled in period
   g. compute deductions: PF (12% Basic capped), ESIC (if gross ≤ 21k), professional tax slabs, TDS (declared regime),
      loan EMIs (active loans → create LoanPayment + decrement outstanding/remaining)
   h. net = gross + reimbursements − deductions
3. Persist PayrollItem rows in a transaction.
4. status = DRAFT until /approve. /disburse triggers email-slip + bank file generation.
```

Run via BullMQ so a 1000-employee run doesn't tie up the request thread; expose progress via SSE or poll `GET /payroll/periods/:id`.

---

## 8. Seed

Port `design/data.jsx` to `prisma/seed.ts`:
- 4 branches, 10 departments, 5 grades, 4 shifts, 14 holidays.
- 60 employees with deterministic seeded random (the prototype uses seed=42).
- 24 attendance rows for "today", 18 leaves, 30 payroll items for current month, 8 loans, 4 in-flight increments, 5 tours, 8 incentives.
- Three demo logins:
  - `hr@cknest.local / Hr@123` → `HR_ADMIN`
  - `manager@cknest.local / Mgr@123` → `MANAGER` (linked to employee CK-EMP-006)
  - `emp@cknest.local / Emp@123` → `EMPLOYEE` (linked to CK-EMP-001)

```bash
npx prisma migrate dev --name init
npx prisma db seed
```

---

## 9. Cross-cutting

- **Logging**: pino-http with redaction for `password`, `aadhaar`, `pan`.
- **Errors**: every controller wrapped with an `asyncHandler`; central error middleware maps `ZodError`, `Prisma.PrismaClientKnownRequestError`, `AppError`.
- **Rate limit**: `express-rate-limit` on `/auth/*`.
- **CORS**: allow web origin from env.
- **Helmet** on all routes; **compression** for JSON.
- **Pagination**: helper that returns `{data, meta:{page,pageSize,total}}`. Default page size 20, max 100.
- **File uploads** (employee documents, tour bills, incentive CSVs): use `multer` → S3-compatible store; persist URL only.
- **Background jobs**: `payrollRun`, `attendanceImport`, `monthlyAccruals` (leave accrual on the 1st), `birthdayDigest`.
- **Healthcheck**: `GET /healthz` returns DB + Redis pings.

---

## 10. Environment

```
DATABASE_URL=postgres://ck:ck@localhost:5432/cknest
REDIS_URL=redis://localhost:6379
JWT_ACCESS_SECRET=...
JWT_REFRESH_SECRET=...
JWT_ACCESS_TTL=15m
JWT_REFRESH_TTL=7d
WEB_ORIGIN=http://localhost:5173
S3_BUCKET=ck-nest-docs
S3_REGION=ap-south-1
SMTP_URL=smtp://...
PORT=4000
```

---

## 11. Testing

- **Unit**: services with Prisma mocked (`vitest-mock-extended`-style for jest).
- **Integration**: spin up Postgres in Docker, run real Prisma migrations, hit Express via `supertest`. Cover auth, employee CRUD, payroll run dry-run, leave approval RBAC.
- Aim for 70%+ on services, 100% on auth and payroll engine.

---

## 12. Deployment outline

- Dockerise both apps. `docker-compose.yml` for dev: postgres + redis + api + web.
- Production: API on Render/Fly/Railway/EC2, web on Vercel/Netlify or behind the same Express via `app.use(express.static('web/dist'))` + SPA fallback.
- Run `prisma migrate deploy` in CI before boot.
- Daily Postgres backup; weekly full + hourly WAL.
