## Taatom Web (Next.js App Router)

Premium web app for Taatom that reuses **existing backend APIs** (no backend changes) and matches the mobile app’s auth strategy:

- **Web auth**: backend sets **httpOnly `authToken` cookie** when same-origin (recommended)
- **Dev fallback**: backend can return `{ token }` for cross-origin local dev; web stores it in `sessionStorage`

### Tech stack

- Next.js (App Router) + TypeScript
- Tailwind CSS
- ShadCN-style UI primitives (Button/Input/Card/Skeleton) + Radix Slot
- TanStack React Query
- Axios client with CSRF + refresh handling
- Framer Motion animations
- Sonner toast notifications

### Local setup

In one terminal, run the backend (from repo root):

```bash
cd backend
npm install
npm run dev
```

In another terminal, run the web app (default port **3001**; backend uses 3000):

```bash
cd web
cp .env.example .env.local
npm install
npm run dev
```

Open `http://localhost:3001`.

### Troubleshooting: 404 on JS chunks (page blank or “Unable to load”)

If the app shell loads but scripts fail with **404** on `_next/static/chunks/...` (e.g. `main-app.js`, `app/(dashboard)/feed/page.js`), the dev build cache is likely stale or corrupted.

1. Stop the dev server (Ctrl+C).
2. From the `web/` directory run: `rm -rf .next`
3. Start again: `npm run dev`
4. Hard-refresh the browser (Ctrl+Shift+R or Cmd+Shift+R) or open `http://localhost:3001` in a new tab.

### Environment variables

**Vercel (production):** Set `BACKEND_ORIGIN` to your backend API URL (e.g. Sevalla). The **backend** must have `FRONTEND_URL=https://web-taatom.vercel.app` (or your Vercel web URL) set in its env; otherwise CORS will block sign-in and you’ll see 500 / “Something went wrong” on login.

Copy `web/.env.example` to `web/.env.local` and adjust:

- **`BACKEND_ORIGIN`**: backend base URL (default `http://localhost:3000`)
- **`NEXT_PUBLIC_WEB_URL`**: web base URL (default `http://localhost:3001`)
- **`APP_ENV`** / **`NEXT_PUBLIC_APP_ENV`**: `development` | `staging` | `production` (for config, analytics)
- Optional: **`NEXT_PUBLIC_GA_MEASUREMENT_ID`**, **`NEXT_PUBLIC_GTM_ID`** (analytics placeholder), **`IMAGE_CDN_BASE_URL`**, **`LOG_LEVEL`**

### How API calls work (important)

Client requests go to **`/api/v1/*` (same origin)**.
Next.js proxies them to your backend using `next.config.mjs` rewrites. This enables cookie auth to behave like “real apps” without changing backend.

### Deployment (Vercel)

- **Project root**: `web/`
- **Framework**: Next.js
- **Build command**: `npm run build`
- **Output**: Next.js default
- **Environment variables**:
  - `BACKEND_ORIGIN` = your deployed backend origin (e.g. `https://api.taatom.com`)
  - `NEXT_PUBLIC_WEB_URL` = your Vercel domain (e.g. `https://taatom-web.vercel.app`)

Because the web app proxies `/api/v1/*`, cookies are first-party on your domain (best for auth stability).
