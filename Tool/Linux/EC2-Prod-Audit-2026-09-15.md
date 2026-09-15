# Taatom Prod EC2 Audit

**Host:** `3.229.201.246` (`ip-172-31-88-136`)  
**Date:** 2026-09-15 (UTC)  
**Mode:** Read-only inspection (no config changes in this audit pass)  
**Repo on box:** `/home/ubuntu/TeamTaatom` → branch `main` @ `df765804`

---

## Executive summary

| Area | Status | Notes |
|------|--------|--------|
| App health | OK | `taatom-backend` healthy on `127.0.0.1:3000` |
| TLS | OK | `api.taatom.com` cert valid ~80 days (expires 2026-12-05) |
| Docker cleanup cron | OK | Weekly cleanup + keep 3 rollbacks (updated today) |
| Security posture | Needs work | UFW off, no fail2ban, `.env` world-readable |
| Capacity | Watch | 1.9 Gi RAM, **no swap**, disk fine (20%) |
| Fishy / compromise signs | None found | No miners, no odd tmp executables, 1 SSH key |

Nothing looked compromised. Main gaps are **hardening** and **small-instance resilience**, not active malware.

---

## What’s healthy

1. **Backend container**
   - `taatom-backend:latest` — Up, healthy
   - Bound to **`127.0.0.1:3000` only** (not public) — correct; Nginx terminates TLS
2. **Nginx**
   - Config test passes
   - Site: `api.taatom.com`
   - `client_max_body_size 512m` (Watch uploads)
   - Ports **80 / 443** public; proxy → `127.0.0.1:3000`
3. **SSH**
   - `PasswordAuthentication no`
   - `KbdInteractiveAuthentication no`
   - Single `authorized_keys` entry, perms `600` / `.ssh` `700`
4. **Docker image hygiene (as of this audit)**
   - Kept: `latest` + 3 newest `rollback-*`
   - Cron Sundays 03:00 builder prune, 04:00 image cleanup script
5. **Disk / load**
   - Root disk ~20% used (5.4 G / 28 G)
   - Load average ~0
6. **Threat sweep**
   - No miner-like processes
   - No unexpected executables under `/tmp`, `/var/tmp`, `/dev/shm`

---

## Findings (priority)

### P0 — Fix soon

#### 1. `backend/.env` is world-readable (`664`)

```text
-rw-rw-r--  ubuntu:ubuntu  /home/ubuntu/TeamTaatom/backend/.env
```

Any local user/process can read secrets. Prefer:

```bash
chmod 600 /home/ubuntu/TeamTaatom/backend/.env
# optional: chown root:ubuntu && chmod 640 if deploy user needs group read
```

#### 2. Host firewall (UFW) is **inactive**

Public exposure currently depends entirely on the **AWS Security Group**. That can be fine if SG is tight, but host UFW is a useful second layer.

Suggested allowlist once you confirm SG:

- `22/tcp` — your IP / bastion only (ideal)
- `80/tcp`, `443/tcp` — public
- Deny rest

#### 3. fail2ban **not installed**

Auth log shows routine internet SSH noise (`Invalid user` scans from random IPs). Password auth is off (good), but fail2ban still reduces log noise and slows scanners.

```bash
sudo apt-get update
sudo apt-get install -y fail2ban
sudo systemctl enable --now fail2ban
```

### P1 — Improve reliability

#### 4. No swap on a **1.9 Gi** instance

Under Node + Docker + Nginx spikes, OOM-killer risk is real. Add a small swapfile (e.g. 1–2 Gi) **or** move to a larger instance type if traffic grows.

#### 5. ~46 packages upgradable

`unattended-upgrades` is active (good). Still worth a controlled:

```bash
sudo apt-get update && sudo apt-get upgrade -y
# reboot if kernel updated
```

Schedule in a maintenance window; don’t surprise-reboot prod mid-day.

#### 6. Build cache still ~1 Gi reclaimable

Sunday builder prune handles this. Optional one-shot if disk gets tight:

```bash
docker builder prune -af
```

### P2 — Nice to have

#### 7. Explicit SSH hardening leftovers

Confirm in `/etc/ssh/sshd_config` (or drop-in):

- `PermitRootLogin no` (verify; not clearly printed in filtered grep)
- `MaxAuthTries 3`
- `AllowUsers ubuntu` (optional lock-down)

#### 8. Nginx `/` returns 404 on :80/:443

Expected for an API-only vhost hitting `/`. Optional: add a tiny `/health` (or `/`) stub that proxies to backend health for uptime monitors that hit the apex path.

#### 9. Keep cleanup script in git

`/usr/local/bin/taatom-docker-cleanup.sh` exists only on the box. Copy it into `Tool/Linux/` (or `backend/scripts/`) so a rebuilt EC2 doesn’t lose the job definition.

#### 10. AWS Security Group checklist (console)

Confirm SG allows:

| Port | Source |
|------|--------|
| 22 | Your IP / VPN / bastion only |
| 80, 443 | `0.0.0.0/0` (and `::/0` if needed) |
| 3000 | **not** open publicly |

---

## Current crontab (root)

| UTC schedule | Job |
|--------------|-----|
| `0 3 * * 0` | `docker builder prune -af` → `/var/log/docker-builder-prune.log` |
| `0 4 * * 0` | `taatom-docker-cleanup.sh` (keep 3 rollbacks) → `/var/log/docker-image-prune.log` |
| `0 5 1 * *` | `journalctl --vacuum-time=7d` → `/var/log/journal-cleanup.log` |

Ubuntu user crontab: empty.

---

## Listening surface

| Bind | Port | Process | Notes |
|------|------|---------|--------|
| `0.0.0.0` | 22 | sshd | Internet scanners hit this |
| `0.0.0.0` | 80 / 443 | nginx | Public API |
| `127.0.0.1` | 3000 | docker-proxy | Backend — correct |
| localhost | 53 | systemd-resolved | Normal |

---

## Recommended action plan (when you approve)

Do **not** run these until you say go — listed for convenience only.

1. `chmod 600` on `.env`
2. Install + enable fail2ban
3. Enable UFW with 22/80/443 (and lock SSH source if possible)
4. Add 1–2 Gi swapfile
5. Controlled `apt upgrade` (+ reboot if needed)
6. Commit cleanup script under `Tool/Linux/` for disaster recovery
7. Double-check AWS SG: no public `:3000`, SSH restricted

---

## Quick re-check commands

```bash
PEM=/Users/kavinkumar/Kavin/Godevs/ClientDocumentation/TaatomOfficial/AWS/New_Prod/new-tatoom-keys.pem
ssh -i "$PEM" ubuntu@3.229.201.246

curl -fsS http://127.0.0.1:3000/health
docker ps
sudo crontab -l
stat -c '%a %n' /home/ubuntu/TeamTaatom/backend/.env
sudo ufw status
systemctl is-active fail2ban
free -h
```

---

## Verdict

**No fishy compromise indicators.** Production app path looks correct (Nginx → localhost Docker → healthy API, TLS OK).

Highest ROI fixes: **lock down `.env` perms**, **fail2ban**, **UFW or tighter SG on SSH**, and **swap / slightly more RAM** so the 2 Gi box doesn’t OOM under load.
