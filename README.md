# AQQUIRE (WorkOS + React + Vite)

This project no longer uses Convex. The app runs as a Vite frontend with a local browser data layer (`localStorage`) and WorkOS AuthKit for authentication.

## Stack

- [React](https://react.dev/)
- [Vite](https://vite.dev/)
- [Tailwind CSS](https://tailwindcss.com/)
- [WorkOS AuthKit](https://workos.com/docs/authkit)

## Setup

1. Install dependencies:

```bash
npm install
```

2. Copy env template and configure WorkOS:

```bash
cp .env.local.example .env.local
```

Required env vars:

- `VITE_WORKOS_CLIENT_ID`
- `VITE_WORKOS_REDIRECT_URI`

Optional env vars:

- `VITE_STRIPE_SETUP_URL` (used for the profile "Stripe Setup" button)
- `VITE_DEMO_MODE=1` (bypass WorkOS auth and run with a local demo user)
- `VITE_ROUTER_MODE=hash` (recommended for static hosting)
- `VITE_BASE_PATH=/repo-name/` (for project-site deploys)

3. Start development server:

```bash
npm run dev
```

## Scripts

- `npm run dev` - start Vite dev server
- `npm run build` - typecheck and build
- `npm run lint` - run TypeScript + ESLint
- `npm run preview` - preview production build

## GitHub Pages Demo Deploy

This repo includes a Pages workflow at `.github/workflows/deploy-pages.yml` that:

- builds with `VITE_DEMO_MODE=1`
- uses hash routing for static hosting
- auto-detects base path (`/` for `owner.github.io`, `/<repo>/` for project pages)
- deploys `dist/` using GitHub Actions Pages

To enable it:

1. Push to `main` or `master` (or run the workflow manually).
2. In GitHub repo settings, set **Pages** source to **GitHub Actions**.
3. The workflow will publish and expose the Pages URL in the deploy job output.

## Data model behavior

- App state persists in `localStorage` under `aqquire.local.db.v1`.
- Initial feed/policy/trophy seed runs automatically after sign-in.
- AQQUIRE capture analysis uses deterministic local matching (no backend required).
