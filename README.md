# CK Nest HRMS

Internal Human Resources Management System for a multi-branch Indian manufacturing/services company. Built from the design handoff in [design_handoff_ck_nest_hrms/](design_handoff_ck_nest_hrms/).

## Stack

- **web/** — React + Vite + TypeScript (single-page app)
- **server/** — Node.js + Express + TypeScript (REST API; `mysql2` against MySQL)
- **shared/** — TypeScript types reused by both
- **Database** — MySQL (hosted on Railway in production)

This repo is a single monorepo using npm workspaces.

## Getting started

> The web/ and server/ apps are scaffolded incrementally. Until both exist, `npm install` at the root is a no-op for the workspaces.

```bash
# 1. Configure environment
cp .env.example .env
# edit .env with your DB credentials and JWT secrets

# 2. Install dependencies (root + all workspaces)
npm install

# 3. Run apps
npm run dev:web      # frontend on http://localhost:5173
npm run dev:server   # backend on http://localhost:4000
```

## Layout

```
.
├── web/                       # Vite frontend
├── server/                    # Express API
├── shared/                    # Shared TS types
├── design_handoff_ck_nest_hrms/  # Design reference (do not ship as-is)
├── .env.example
├── package.json               # workspace root
└── README.md
```
