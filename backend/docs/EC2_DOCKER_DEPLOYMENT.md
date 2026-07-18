# EC2 Docker Deployment Guide (Taatom Backend)

Production target: **AWS EC2 Ubuntu 24.04** + **Docker Compose** + **Nginx** + **Cloudflare DNS**.

External services (not containerized): MongoDB Atlas, Upstash Redis, Sevalla Storage, Firebase, Google Maps, Cashfree, Sentry.

**No application logic changes are required.** Health already exists at `GET /health`.

---

## 1. Architecture snapshot

| Item | Value |
|------|--------|
| Entry | `npm start` → `node src/server.js` |
| HTTP + Socket.IO | Same port (`PORT`, compose uses `3000`) |
| Bind | `0.0.0.0` inside container; compose maps `127.0.0.1:3000` |
| Health | `GET /health` (also `/health/live`, `/health/ready`, `/api/v1/health/*`) |
| Uploads | Multer `memoryStorage()`; FFmpeg temps in `/tmp` |
| Jobs | In-process `setInterval` (journey auto-end, Cashfree poll); no Bull/cron |
| Build | None — plain Node JS |

```text
Internet → Cloudflare DNS → EC2 Nginx (:80/:443)
                              → 127.0.0.1:3000 (Docker: taatom-backend)
                                   → MongoDB Atlas
                                   → Upstash Redis
                                   → Sevalla object storage
```

---

## 2. One-time EC2 setup

### 2.1 Packages

```bash
sudo apt update && sudo apt upgrade -y
sudo apt install -y ca-certificates curl git nginx

# Docker Engine + Compose plugin (official docs)
curl -fsSL https://get.docker.com | sudo sh
sudo usermod -aG docker ubuntu   # or your SSH user
# log out / log in again
docker --version
docker compose version
```

### 2.2 App directory

```bash
# Actual EC2 layout:
#   /home/ubuntu/taatom/TeamTaatom          ← monorepo root
#   /home/ubuntu/taatom/TeamTaatom/backend  ← Docker Compose + .env

cd /home/ubuntu/taatom/TeamTaatom
# (or: git clone <YOUR_REPO_URL> /home/ubuntu/taatom/TeamTaatom)
cd backend
cp .env.example .env
# Prefer production values from .env.prod if you maintain that file:
# cp .env.prod .env
nano .env   # fill production secrets — never commit
```

Minimum production `.env`:

- `NODE_ENV=production`
- `PORT=3000`
- `MONGO_URL` (Atlas)
- `JWT_SECRET`
- `WS_ALLOWED_ORIGIN` (required for Socket.IO in production)
- `REDIS_URL` (Upstash)
- `SEVALLA_STORAGE_*`
- CORS URLs: `FRONTEND_URL` / `WEB_FRONTEND_URL` / `SUPERADMIN_URL`
- Optional: Firebase, Google Maps, Cashfree, Brevo, Sentry

### 2.3 Nginx

```bash
sudo cp /home/ubuntu/taatom/TeamTaatom/backend/nginx.conf /etc/nginx/sites-available/taatom-api
sudo ln -sf /etc/nginx/sites-available/taatom-api /etc/nginx/sites-enabled/taatom-api
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t && sudo systemctl reload nginx
```

Point Cloudflare `api.taatom.com` (or your API host) at the EC2 Elastic IP. Prefer **Full** or **Full (strict)** SSL mode when origin TLS is configured.

### 2.4 Security group

- Inbound: `80`, `443` from Cloudflare (or `0.0.0.0/0` if needed)
- Inbound: `22` from your IP only
- Do **not** open `3000` publicly (compose binds localhost only)

---

## 3. Manual deploy commands

```bash
cd /home/ubuntu/taatom/TeamTaatom/backend

# Build
docker compose build

# Start / restart
docker compose up -d

# Status
docker compose ps
docker ps --filter name=taatom-backend

# Logs
docker compose logs -f --tail=200
docker logs -f taatom-backend

# Shell into container
docker exec -it taatom-backend sh

# Health (host → container)
curl -fsS http://127.0.0.1:3000/health
curl -fsS https://api.taatom.com/health   # via Nginx + Cloudflare

# Stop
docker compose down
```

Expected health: HTTP **200** with `status: "ok"` and `uptime` (plus existing `success` / `message` fields from the API helper).

---

## 4. GitHub Actions deploy

Workflow: [`.github/workflows/deploy-backend.yml`](../../.github/workflows/deploy-backend.yml)

On push to `main` (backend paths) or manual `workflow_dispatch`:

1. SSH into EC2  
2. Tag previous image for rollback  
3. `git reset --hard origin/main`  
4. `docker compose build && docker compose up -d`  
5. Poll `GET /health`  
6. On failure → restore previous git SHA + rollback image tag  

### Required GitHub secrets

| Secret | Purpose |
|--------|---------|
| `EC2_HOST` | EC2 public DNS or Elastic IP |
| `EC2_USER` | SSH user (e.g. `ubuntu`) |
| `EC2_SSH_KEY` | Private key (PEM contents) |
| `EC2_SSH_PORT` | Optional; default `22` |
| `EC2_REPO_PATH` | Optional; default `/home/ubuntu/taatom/TeamTaatom` |
| `EC2_BACKEND_PATH` | Optional; default `/home/ubuntu/taatom/TeamTaatom/backend` |
| `BACKEND_HEALTH_URL` | Optional; default `http://127.0.0.1:3000/health` |

EC2 must already have the repo cloned and a production `.env` in `backend/`. Deploy never writes secrets from CI into the server.

---

## 5. Files in this package

| File | Role |
|------|------|
| `Dockerfile` | Multi-stage Node 20 production image, non-root, healthcheck |
| `docker-compose.yml` | `taatom-backend` service, `taatom-prod` network, no Mongo/Redis |
| `.dockerignore` | Lean build context |
| `.env.example` | All discovered `process.env` keys (placeholders) |
| `nginx.conf` | Reverse proxy, WebSocket, large uploads, security headers |
| `docs/DOCKER_ARCHITECTURE_REPORT.md` | Earlier architecture analysis |
| `docs/EC2_DOCKER_DEPLOYMENT.md` | This guide |

---

## 6. Operational notes

- **Single replica:** in-process timers are fine; avoid running multiple compose replicas without job locking.
- **Redis:** set `REDIS_URL` to Upstash so cache/rate-limit are not stuck on in-memory defaults.
- **Sevalla:** keep media public URLs on Sevalla; EC2 only uploads via the S3-compatible API.
- **Rollback:** Actions auto-rolls back on failed health; manual: `git reset --hard <sha> && docker compose up -d --build`.
