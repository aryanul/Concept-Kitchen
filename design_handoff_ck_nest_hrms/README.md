# Handoff: CK Nest HRMS

**Stack:** React (Vite) frontend + Node.js / Express backend + PostgreSQL (recommended) or MongoDB.

---

## Overview

CK Nest HRMS is an internal Human Resources Management System for a multi-branch Indian manufacturing/services company. The product covers the full employee lifecycle from hiring through exit, organised in three phases:

- **Phase 1 — Employment** *(scope of this handoff: fully designed)*
  Employee Master, Shifts & Roster, Holidays, Attendance, Salary Master, Payroll, Loans/Advances, Increments, Leaves, Tours, Incentives.
- **Phase 2 — Hiring** *(stubs only)*
  Job Profiles, Vacancy management, Induction & Onboarding.
- **Phase 3 — Relieving** *(stubs only)*
  Exit Clearance, Full & Final Settlement.

The product is web-only (desktop-first), used by HR admins, branch managers, and finance staff. Currency is INR. Locale is `en-IN`.

---

## About the Design Files

The files in `design/` are **HTML/JSX design references** — high-fidelity prototypes showing intended look and behaviour. **Do not ship them as-is.** Your task is to recreate these designs in a real React + Express codebase using the structure, tokens and API contracts defined in this handoff.

The prototype was built as a single HTML file with React loaded via CDN and inline Babel — that is a design-tool convention, not a production pattern. In production you should use Vite, real npm packages, JSX compilation, and a proper backend.

---

## Fidelity

**High-fidelity (hifi)** for all Phase 1 screens. Pixel-perfect mockups with final colours, typography, spacing, layouts, empty states, modals and interactions. Phase 2/3 screens are intentional placeholder pages explaining what's coming — recreate them as simple "Coming soon" route stubs that link from the sidebar.

---

## What's in this handoff

| File | Purpose |
|---|---|
| `README.md` (this file) | Index, overview, screen-by-screen specs |
| `FRONTEND.md` | React app structure, routing, component map, state, libraries |
| `BACKEND.md` | Express API spec, data models, auth, file structure |
| `DESIGN_TOKENS.md` | Exact colours, typography scale, spacing, radii, shadows |
| `design/` | Original HTML/JSX prototype — open `CK Nest HRMS.html` to interact |

A developer reading only this folder should be able to ship the product. Open the prototype in a browser as your visual source of truth.

---

## Screens (Phase 1)

For each screen below: the URL, layout, key components, and content. Exact tokens (colours/type/spacing) are in `DESIGN_TOKENS.md` and apply globally — they are not repeated per-screen.

### Global shell
Every authenticated screen renders inside a two-pane layout:

- **Sidebar** — fixed left, 244px wide, white background `#FFFFFF`, right border `1px solid #ECECEC`. Top brand block ("CK Nest" wordmark + small "HRMS" tag). Below it, three collapsible nav groups: **Employment** (expanded by default), **Hiring** (collapsed), **Relieving** (collapsed). At the bottom: a "Settings" item and a logged-in user chip (avatar + name + role).
- **Top bar** — 64px tall, white, bottom border `1px solid #ECECEC`. Left: page-context breadcrumb. Centre: global search input (placeholder *"Search employees, payroll, leaves…"*). Right: weather chip (date + city + temp), notifications bell with unread dot, user avatar.
- **Main content** — light grey background `#F9FAFB`, padded `28px 32px 60px`. Each route enters with a 220ms `slideIn` animation (translateY 8px → 0, opacity 0 → 1).
- **PageHeader** at top of every content area: page title (24px / 600), subtitle (13.5px / 400 #6B7280), right-side action buttons.

### 1. Dashboard `/`
Snapshot view; the landing screen post-login.

- **Top row — 4 stat tiles** in a CSS grid (`grid-template-columns: repeat(4, 1fr)`, gap 16): Total Employees (264, +12 this month), Present Today (231 / 87.5%), On Leave (18), Pending Approvals (7). Each tile: white card, 14px radius, 20px padding, icon top-right inside soft tinted square, label uppercase 11px tracking 0.06em, value 28px / 700, delta hint 12px / 500 with ↑/↓ arrow.
- **Row 2** — Two cards side by side, 2/3 + 1/3 split:
  - *Attendance trend* — bar chart, 14 days, 2 colours (present `#1F8A5B`, absent `#E8504C`). SVG bars with hover tooltip.
  - *Branch breakdown* — list of 4 branches with avatar group + employee count + active-shift indicator.
- **Row 3** — Two cards: *Pending approvals* (table of 5 items: leaves, increments, loans with quick-approve buttons) and *Upcoming events* (next holidays + birthdays + work anniversaries).
- **Row 4** — *Activity feed* full-width: 6 most recent system events with timestamps and tiny icons.

### 2. Employee Master `/employees`
The CRUD list of all employees.

- **Filters bar** — search input (320px), branch select, department select, status pill toggle (All / Active / On Leave / Probation / Exited), `+ Add Employee` button (primary, accent-coloured).
- **Table** — sticky header, columns: checkbox, Avatar+Name+Code, Designation, Department, Branch, Joining Date, Status pill, row-actions (View / Edit / More icon-buttons). 14 rows per page. Row hover `#FAFAFA`. Click anywhere → opens employee profile drawer (right side, 720px wide).
- **Add Employee** — modal, 4-step wizard with progress chips at top: *Basic info → Job & department → Compensation → Review*. Each step has a 2-column form grid. Final step shows a summary + Submit primary button.
- **Employee profile drawer** — header band with avatar (72px), name, code, status pill, designation; below, tabs: *Overview / Documents / Salary / Leaves / Attendance / Loans*. Overview shows job, manager, contact, bank, statutory IDs (PF, ESIC, UAN, PAN, Aadhaar masked).

### 3. Shifts & Roster `/shifts`
Two views in tabs.

- **Shift definitions** — 4 cards in a row showing: Day Shift (09:00–18:00), Night Shift (22:00–07:00), General Office, Half-Day. Each card: name, timing pill, kind tag, break rule, headcount stat, edit icon.
- **Weekly roster grid** — first column = employee (avatar + name), next 7 columns = days with shift code chip (D/N/G/-). Click any cell → small popover to swap shift. "Publish roster" primary button top-right.

### 4. Holidays `/holidays`
- **Top stats** — 3 small cards: total holidays (14), public (8), restricted (6).
- **Filters** — kind select, branch select, year toggle.
- **List** — each holiday row: date block (day number large + month above), name, kind tag, branches text. Right side: edit icon.
- **Mini calendar** sidebar — current month with holiday dots and a legend.

### 5. Attendance `/attendance`
Today's punch-in/out view.

- **Top stats** — 4 PunchStat cards: Present, Late, On Leave, Absent. Each with icon + label + count + tone-coloured left accent.
- **Filters** — date picker (defaults to today), branch select, status select, search.
- **Table** — Avatar+Name, Branch, In Time, Out Time, Total Hours, OT, Status pill, Source (Biometric / Manual / Geo). Late entries flagged red.
- **Manual punch** modal accessed via "Mark attendance" button.

### 6. Salary Master `/salary-master`
- **Grade ladder table** — 5 rows (L01–L05): Grade code, kind, min gross, max gross, headcount in grade, CTC range. Each row clickable → opens grade detail.
- **Component cards** below — list of salary components in use: Basic, HRA, Conveyance, Medical, Special Allowance, PF (employer), ESIC (employer), Gratuity (provision). Each card: name, calculation rule (e.g. `40% of Basic`), tax treatment tag (taxable / exempt / partial).

### 7. Payroll `/payroll`
- **Stat strip** — full-width white card, 4 segments separated by vertical dividers: This Month Period (May 2026), Employees (260), Gross (₹1.42 Cr), Net Payable (₹1.18 Cr).
- **Filters** — month select, branch select, search.
- **Table** — Employee, Days Paid, Gross, Deductions, Net, Status pill (Draft / Approved / Disbursed), action icons (View slip / Email / Download).
- **Run Payroll** modal — multi-step: select period → run validations → preview totals → approve → disburse. Each step is a card with status icon.
- **Pay slip drawer** — A4-shaped preview with company header, employee block, earnings table, deductions table, net pay highlighted, footer with "This is computer-generated" note.

### 8. Loans & Advances `/loans`
- **Stats** — Total disbursed, Outstanding, Active loans count, Defaulters.
- **Table** — Loan ID, Employee, Kind (Loan / Advance), Principal, Outstanding, EMI, Tenure, Remaining months, Status. Sortable.
- **New loan** modal — employee select, kind, principal, tenure, EMI auto-calc, purpose textarea, approval routing chips.

### 9. Increments `/increments`
- **Tabs** — *In-flight (4) / Approved (12) / History*.
- **In-flight cards grid** — each card: employee row, current CTC → proposed CTC with arrow and hike%, rating tag (Outstanding / Exceeds / Meets), 4-step approval pipeline visualised as connected dots (Manager Review → HR → Finance → Done) with current stage highlighted.
- **Cycle config** drawer — define rating scale, budget cap, eligibility rules.

### 10. Leaves `/leaves`
- **Tabs** — All / Pending / Approved / Rejected.
- **Top strip** — Leave balance summary card showing the requesting user's balances if HR / their team if manager (EL, CL, SL with dial-style mini chart).
- **Table** — Employee, Type pill (EL/CL/SL/LWP/Tour/Comp-off), From, To, Days, Reason snippet, Status, Actions (Approve / Reject for pending).
- **Apply leave** modal with date range picker, type select, reason textarea, attachment upload.

### 11. Tours `/tours`
- **Table** — Tour ID, Employee, From → To (with arrow), Dates, Advance, Expense, Status (Approved / In-progress / Settled / Rejected), action icons.
- **New tour request** modal with itinerary editor (multi-row from/to/date) and advance request field.

### 12. Incentives `/incentives`
- **Bulk header** — "X selected" + bulk-action buttons (Push to Payroll / Mark Approved / Reject).
- **Table** — checkbox, Employee, Kind (Production Bonus / Quality Award / Referral / Spot), Month, Amount, Status, Pushed-to-payroll badge.
- **Add incentive** modal — single or bulk import (CSV).

### Phase 2 / 3 stubs
Single-screen placeholder route per item:
`/job-profile`, `/vacancy`, `/onboarding`, `/exit-clearance`, `/fnf`, `/settings`.

Each: PageHeader with title + subtitle + a centered card explaining "this module is part of Phase X" with a back-to-dashboard link. Use the `StubView` component pattern from `design/views-2.jsx`.

---

## Interactions & Behaviour

**Navigation** — clicking a sidebar item swaps the main content with a 220ms slide-up fade. URL updates via React Router. The sidebar item gets an accent-coloured left rail and `#272727` text; siblings stay neutral.

**Modals** — open with backdrop fade (160ms). Close on Esc, backdrop click, or X icon. Body scroll locked while open. Focus trapped inside.

**Drawers** (employee profile, pay slip) — slide in from right, 360ms ease-out, 720px wide, 100vh tall, with a close X.

**Toasts** — bottom-right stack, auto-dismiss 4s, kinds: info / success / warning / error. Triggered after every successful create/update/delete.

**Tables** — column sort on header click (toggle asc/desc), selection via checkbox column, row hover background `#FAFAFA`, click row to open detail drawer.

**Forms** — inline validation on blur. Required fields marked with `*`. Submit button disabled until valid. Show field error in red 12px below input.

**Empty states** — every list/table has an empty state: centered icon, headline, description, primary CTA.

**Loading states** — skeleton rows for tables, skeleton cards for grids, spinner inline on buttons during async actions.

**Permissions** — role gates: HR Admin (full), Manager (own team), Employee (self). Hide / disable actions accordingly. Backend must enforce too.

---

## Files

In `design/`:

- `CK Nest HRMS.html` — entry point; open in browser.
- `app.jsx` — root component, routing, tweak panel wiring.
- `shell.jsx` — Sidebar + TopBar.
- `ui.jsx` — primitives: Icon, Avatar, StatusPill, Button, Card, Select, TextInput, Toast, Modal, Table, PageHeader, SectionHeader, GlobalStyles.
- `views-1.jsx` — Dashboard, Employee Master, Shifts, Holidays, Attendance.
- `views-2.jsx` — Salary Master, Payroll, Loans, Increments, Leaves, Tours, Incentives, StubView.
- `data.jsx` — seeded mock data (60 employees, attendance, leaves, payroll, loans, increments, tours, incentives, holidays, salary grades). Use this as a starting point for backend seed scripts.

---

## Implementation order (recommended)

1. **Repo skeleton** — `apps/web` (React/Vite) + `apps/api` (Express) + `packages/shared` for types.
2. **Auth + shell** — login screen → JWT → protected routes → Sidebar + TopBar wired with real user.
3. **Employee Master end-to-end** — model, API, list page, drawer, add wizard. This unblocks every other module.
4. **Shifts, Holidays, Attendance** — scheduling foundation.
5. **Salary Master + Payroll** — finance core. Payroll depends on Attendance + Salary Master + Loans + Incentives.
6. **Leaves, Loans, Increments, Tours, Incentives** — can be parallelised.
7. **Phase 2 / 3 stubs** — wire routes only.
8. **Reports, exports, audit log** — cross-cutting concerns last.

See `FRONTEND.md` and `BACKEND.md` for code-level detail.
