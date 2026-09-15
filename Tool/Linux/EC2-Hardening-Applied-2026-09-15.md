# EC2 Hardening Applied — 2026-09-15

**Host:** `ubuntu@3.229.201.246`  
**Change ID:** `20260915-hardening`  
**Scope:** Mandatory + safe only (no `apt upgrade`, no reboot, no AWS SG edits)  
**App status after apply:** `taatom-backend` healthy; fresh SSH OK

---

## What changed

| # | Change | Before | After |
|---|--------|--------|-------|
| 1 | `backend/.env` perms | `664` | `600` |
| 2 | fail2ban | not installed | installed, enabled, `sshd` jail |
| 3 | UFW | inactive | active — allow **22 / 80 / 443** only |
| 4 | Swap | none | **2 Gi** `/swapfile` + `/etc/fstab` |

**Skipped (not “safe without a window”):** full `apt upgrade` / kernel reboot.

---

## Revert (one command)

On the EC2 box:

```bash
bash /home/ubuntu/taatom-hardening-20260915-hardening-REVERT.sh
```

That script will:

1. Restore `.env` to `664`
2. `ufw --force disable`
3. Stop/disable fail2ban (package left installed)
4. `swapoff` + remove `/swapfile` + drop fstab line

### Manual revert pieces (if needed)

```bash
# .env
chmod 664 /home/ubuntu/TeamTaatom/backend/.env

# UFW
sudo ufw --force disable

# fail2ban
sudo systemctl disable --now fail2ban
# optional full remove:
# sudo apt-get purge -y fail2ban

# swap
sudo swapoff /swapfile
sudo sed -i '\|/swapfile|d' /etc/fstab
sudo rm -f /swapfile
```

### Artifacts on the server

| Path | Purpose |
|------|---------|
| `/home/ubuntu/taatom-hardening-20260915-hardening.log` | Apply log |
| `/home/ubuntu/taatom-hardening-20260915-hardening-REVERT.sh` | One-shot revert |
| `/home/ubuntu/taatom-hardening-20260915-hardening-state/` | Captured before-state |
| `/etc/fail2ban/jail.d/sshd.local` | SSH jail config |
| `/swapfile` | 2 Gi swap |
| UFW backups under `/etc/ufw/*.20260915_181438` | Auto from `ufw reset` |

---

## Verify

```bash
PEM=/Users/kavinkumar/Kavin/Godevs/ClientDocumentation/TaatomOfficial/AWS/New_Prod/new-tatoom-keys.pem
ssh -i "$PEM" ubuntu@3.229.201.246

curl -fsS http://127.0.0.1:3000/health
stat -c '%a %n' ~/TeamTaatom/backend/.env          # expect 600
systemctl is-active fail2ban                         # expect active
sudo fail2ban-client status sshd
sudo ufw status verbose                              # 22/80/443 allow
free -h                                              # Swap ~2.0Gi
docker ps
```

---

## Notes

- UFW still allows SSH from anywhere (same as before at host layer). Tighten later via AWS SG → your IP only if you want.
- fail2ban: 5 failures / 10m → ban 1h on SSH.
- Nginx `/` 404 is unchanged and expected for API-only vhost.
