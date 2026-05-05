# Frontend — React Implementation Guide

**Stack:** React 18 + Vite + TypeScript + React Router + TanStack Query + Zustand + Tailwind CSS + shadcn/ui + Lucide icons + React Hook Form + Zod + date-fns + Recharts.

> Tailwind+shadcn is the recommended path because it maps cleanly to the prototype's primitive set (Card, Button, Input, Select, Modal, Table, Toast). If you prefer plain CSS Modules or styled-components, the design tokens in `DESIGN_TOKENS.md` translate directly — just keep component APIs identical.

---

## 1. Project skeleton

```
apps/web/
├── public/
├── src/
│   ├── main.tsx                  # React root, providers
│   ├── App.tsx                   # Router shell
│   ├── routes/                   # one folder per route
│   │   ├── dashboard/
│   │   ├── employees/
│   │   ├── shifts/
│   │   ├── holidays/
│   │   ├── attendance/
│   │   ├── salary-master/
│   │   ├── payroll/
│   │   ├── loans/
│   │   ├── increments/
│   │   ├── leaves/
│   │   ├── tours/
│   │   ├── incentives/
│   │   ├── settings/
│   │   └── stubs/                # phase 2/3 placeholders
│   ├── components/
│   │   ├── shell/                # Sidebar, TopBar, AppLayout
│   │   ├── ui/                   # primitives (Button, Card, Modal, …)
│   │   ├── data-table/           # generic Table + filters + pagination
│   │   ├── forms/                # FieldGroup, FormSection, FormStepper
│   │   └── empty-state/
│   ├── features/                 # domain logic per module
│   │   ├── employees/{api,hooks,types,components}.ts(x)
│   │   ├── payroll/…
│   │   └── …
│   ├── lib/
│   │   ├── api.ts                # axios/fetch wrapper, auth header injection
│   │   ├── auth.ts               # token storage, role helpers
│   │   ├── format.ts             # inr(), dateFmt(), etc.
│   │   └── permissions.ts
│   ├── hooks/
│   │   ├── useToast.ts
│   │   └── useDebounce.ts
│   ├── stores/                   # Zustand
│   │   ├── auth.ts
│   │   └── ui.ts                 # sidebar collapsed, density tweak
│   ├── styles/
│   │   ├── index.css             # Tailwind layers + token CSS vars
│   │   └── globals.css
│   └── types/                    # shared TS types (mirror backend DTOs)
├── index.html
├── tailwind.config.ts
├── tsconfig.json
└── vite.config.ts
```

---

## 2. Bootstrap

```bash
npm create vite@latest web -- --template react-ts
cd web
npm install react-router-dom @tanstack/react-query zustand axios \
  react-hook-form zod @hookform/resolvers \
  date-fns recharts lucide-react clsx tailwind-merge \
  class-variance-authority sonner
npm install -D tailwindcss postcss autoprefixer @types/node
npx tailwindcss init -p
npx shadcn@latest init
# Add primitives:
npx shadcn@latest add button card dialog dropdown-menu input label \
  select separator sheet table tabs toast tooltip popover \
  checkbox radio-group switch
```

---

## 3. Token wiring

Paste the `:root { … }` block from `DESIGN_TOKENS.md` into `src/styles/index.css`, then bridge to Tailwind in `tailwind.config.ts`:

```ts
export default {
  content: ['./src/**/*.{ts,tsx,html}'],
  theme: {
    extend: {
      colors: {
        accent: { DEFAULT: 'var(--ck-accent)', hover: 'var(--ck-accent-hover)', soft: 'var(--ck-accent-soft)' },
        ink: { DEFAULT: 'var(--ck-ink)', soft: 'var(--ck-ink-soft)', muted: 'var(--ck-muted)', faint: 'var(--ck-faint)' },
        line: { DEFAULT: 'var(--ck-line)', soft: 'var(--ck-line-soft)' },
        bg: 'var(--ck-bg)',
        surface: { DEFAULT: 'var(--ck-surface)', alt: 'var(--ck-surface-alt)' },
      },
      fontFamily: { sans: ['Inter', 'Roboto', 'system-ui'], mono: ['Roboto Mono', 'monospace'] },
      borderRadius: { md: 'var(--ck-r-md)', lg: 'var(--ck-r-lg)', xl: 'var(--ck-r-xl)' },
      boxShadow: { sm: 'var(--ck-shadow-sm)', md: 'var(--ck-shadow-md)', lg: 'var(--ck-shadow-lg)' },
    },
  },
  plugins: [require('tailwindcss-animate')],
};
```

---

## 4. Routing

```tsx
// App.tsx
<BrowserRouter>
  <Routes>
    <Route path="/login" element={<LoginPage />} />
    <Route element={<ProtectedRoute />}>
      <Route element={<AppLayout />}>
        <Route index element={<DashboardPage />} />
        <Route path="employees/*" element={<EmployeesPage />} />
        <Route path="shifts" element={<ShiftsPage />} />
        <Route path="holidays" element={<HolidaysPage />} />
        <Route path="attendance" element={<AttendancePage />} />
        <Route path="salary-master" element={<SalaryMasterPage />} />
        <Route path="payroll/*" element={<PayrollPage />} />
        <Route path="loans" element={<LoansPage />} />
        <Route path="increments" element={<IncrementsPage />} />
        <Route path="leaves" element={<LeavesPage />} />
        <Route path="tours" element={<ToursPage />} />
        <Route path="incentives" element={<IncentivesPage />} />
        <Route path="settings/*" element={<SettingsPage />} />
        {/* Phase 2/3 stubs */}
        <Route path="job-profile" element={<StubPage feature="job-profile" />} />
        <Route path="vacancy" element={<StubPage feature="vacancy" />} />
        <Route path="onboarding" element={<StubPage feature="onboarding" />} />
        <Route path="exit-clearance" element={<StubPage feature="exit-clearance" />} />
        <Route path="fnf" element={<StubPage feature="fnf" />} />
      </Route>
    </Route>
    <Route path="*" element={<NotFound />} />
  </Routes>
</BrowserRouter>
```

`AppLayout` renders Sidebar + TopBar + `<Outlet/>` and applies the page-enter animation via Framer Motion or pure CSS keyframes.

---

## 5. State

| Concern | Tool |
|---|---|
| Server data (employees, payroll, …) | **TanStack Query** — one hook per resource (`useEmployees`, `useEmployee(id)`, `useCreateEmployee`). Cache key conventions: `['employees', filters]`. |
| Auth (user, token, role) | **Zustand** persisted to localStorage. |
| UI prefs (sidebar collapse, density) | **Zustand** persisted; reflects the prototype's Tweak panel (drop the panel itself in production — keep density as a user preference). |
| Form state | **React Hook Form + Zod** schemas. Each feature exports its `*Schema` so backend validators can mirror it. |

---

## 6. API client

```ts
// lib/api.ts
import axios from 'axios';
import { useAuth } from '@/stores/auth';

export const api = axios.create({ baseURL: import.meta.env.VITE_API_URL });

api.interceptors.request.use((cfg) => {
  const t = useAuth.getState().token;
  if (t) cfg.headers.Authorization = `Bearer ${t}`;
  return cfg;
});

api.interceptors.response.use(
  (r) => r,
  (err) => {
    if (err.response?.status === 401) useAuth.getState().logout();
    return Promise.reject(err);
  }
);
```

Each feature wraps its endpoints:

```ts
// features/employees/api.ts
export const employeesApi = {
  list: (params: ListEmployeesParams) => api.get<Paginated<Employee>>('/employees', { params }).then(r => r.data),
  get:  (id: string) => api.get<Employee>(`/employees/${id}`).then(r => r.data),
  create: (dto: CreateEmployeeDto) => api.post<Employee>('/employees', dto).then(r => r.data),
  update: (id: string, dto: UpdateEmployeeDto) => api.patch<Employee>(`/employees/${id}`, dto).then(r => r.data),
  remove: (id: string) => api.delete(`/employees/${id}`),
};
```

---

## 7. Component map (prototype → production)

| Prototype (`design/ui.jsx`) | Production |
|---|---|
| `Button` | shadcn `Button` + variants (`primary`/`secondary`/`ghost`/`danger`) via cva |
| `Card` | shadcn `Card` |
| `TextInput` | shadcn `Input` |
| `Select` | shadcn `Select` (use `Combobox` when searchable) |
| `Modal` | shadcn `Dialog` |
| `Table` | shadcn `Table` wrapped by a generic `<DataTable columns rows />` |
| `StatusPill` | custom `<StatusBadge status="active" />` (cva for tone mapping) |
| `Avatar` | shadcn `Avatar` + initials fallback with hue from name hash |
| `Toast` | sonner |
| `PageHeader` / `SectionHeader` | keep as-is, use shared layout components |
| `Sidebar` / `TopBar` | from `design/shell.jsx` — port verbatim, replace inline styles with Tailwind |

The 4-step Add Employee wizard, Run Payroll modal, and increment pipeline cards are purpose-built feature components — port their layout directly from `views-1.jsx` / `views-2.jsx` and wire to RHF.

---

## 8. Charts

Use **Recharts**:
- Dashboard attendance trend → stacked `<BarChart>` with present/absent series.
- Leave balance dial → `<RadialBarChart>` with two segments.
- Branch breakdown → `<PieChart>` (small, no labels — caption sits next to it).

---

## 9. i18n & locale

- Currency: `new Intl.NumberFormat('en-IN', { style:'currency', currency:'INR', maximumFractionDigits: 0 })` — provide a `inr(n)` helper.
- Dates: `date-fns` with `import { enIN } from 'date-fns/locale'`. Display `dd MMM yyyy` everywhere; ISO on the wire.
- Numbers in tables: `new Intl.NumberFormat('en-IN').format(n)`.

---

## 10. Auth flow

1. `POST /auth/login` returns `{ token, user }`.
2. Store in Zustand → axios attaches `Authorization`.
3. `ProtectedRoute` redirects to `/login` if no token; otherwise hits `GET /auth/me` once on mount to refresh user.
4. Role gates use a `<Can role="hr_admin"/>` wrapper or a `useCan(action, resource)` hook reading from `permissions.ts`.

---

## 11. Testing

- **Vitest** for unit (utilities, hooks, schema validators).
- **React Testing Library** for component tests of forms & data tables.
- **Playwright** for 4–5 critical E2E flows: login, add employee, approve leave, run payroll dry-run, generate pay slip.

---

## 12. Environment

```
VITE_API_URL=http://localhost:4000/api
VITE_APP_NAME=CK Nest HRMS
```

Build: `npm run build` → static `dist/` served by the Express backend or any CDN.
