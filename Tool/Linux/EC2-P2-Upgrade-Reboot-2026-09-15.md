# EC2 P2 + apt upgrade / reboot — 2026-09-15

**Host:** `ubuntu@3.229.201.246`  
**Change ID:** `20260915-p2-upgrade`  
**Reboot:** 18:20:32 UTC → back ~18:21:38 UTC  
**Post-check:** All green (see below)

---

## P2 completed

| Item | Action |
|------|--------|
| SSH hardening | Drop-in `/etc/ssh/sshd_config.d/99-taatom-hardening.conf`: `PermitRootLogin no`, `MaxAuthTries 3`, `AllowUsers ubuntu`, password auth off |
| Nginx `/health` | Explicit `location /health` → `127.0.0.1:3000` (backup under state dir) |
| Cleanup script in git | Already in `Tool/Linux/taatom-docker-cleanup.sh`; re-synced to `/usr/local/bin/` |
| AWS SG checklist | Host cannot change SG from here — verify in AWS console (see below) |

## Upgrade + reboot

- `apt-get upgrade`: **43 packages** upgraded (6 netplan-related deferred by Ubuntu phasing)
- Services enabled before reboot: `docker`, `nginx`, `fail2ban`
- Reboot completed; stack auto-started (`restart: unless-stopped`)

---

## Post-reboot verification (passed)

| Check | Result |
|-------|--------|
| SSH | OK |
| `docker` / `nginx` / `fail2ban` / `cron` / `ufw` | **active + enabled** |
| `taatom-backend` | Up, **healthy** |
| `http://127.0.0.1:3000/health` | OK |
| `https://127.0.0.1/health` (Host: api.taatom.com) | OK |
| `https://api.taatom.com/health` | OK |
| `.env` perms | `600` |
| Swap | 2.0 Gi |
| SSH policy | root login no, max tries 3, allow ubuntu only |

---

## Revert

### P2 SSH + nginx only

```bash
bash /home/ubuntu/taatom-hardening-20260915-p2-upgrade-REVERT.sh
```

### Earlier hardening (env / UFW / fail2ban / swap)

```bash
bash /home/ubuntu/taatom-hardening-20260915-hardening-REVERT.sh
```

**Note:** apt packages are **not** auto-downgraded. Use an AMI/snapshot if you need full package rollback.

### Artifacts on server

| Path | Purpose |
|------|---------|
| `/home/ubuntu/taatom-hardening-20260915-p2-upgrade.log` | Apply log |
| `/home/ubuntu/taatom-hardening-20260915-p2-upgrade-REVERT.sh` | Revert P2 |
| `/home/ubuntu/taatom-hardening-20260915-p2-upgrade-state/` | nginx backup + before state |
| `/etc/ssh/sshd_config.d/99-taatom-hardening.conf` | SSH drop-in |

---

## AWS Security Group checklist (manual)

Confirm in AWS console for this instance:

| Port | Recommended source |
|------|--------------------|
| 22 | Your IP / bastion only (not `0.0.0.0/0` if avoidable) |
| 80, 443 | Public |
| 3000 | **Not** public (backend is localhost-only already) |
