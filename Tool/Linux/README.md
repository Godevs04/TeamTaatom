# Tool / Linux

Ops notes and scripts for the Taatom production EC2 host.

| File | Purpose |
|------|---------|
| [EC2-Prod-Audit-2026-09-15.md](./EC2-Prod-Audit-2026-09-15.md) | Read-only audit: health, security, cron, recommendations |
| [EC2-Hardening-Applied-2026-09-15.md](./EC2-Hardening-Applied-2026-09-15.md) | Hardening applied + revert (env/UFW/fail2ban/swap) |
| [EC2-P2-Upgrade-Reboot-2026-09-15.md](./EC2-P2-Upgrade-Reboot-2026-09-15.md) | P2 + apt upgrade + reboot + post-health |
| [EC2-OSC3008-Prompt-Fix.md](./EC2-OSC3008-Prompt-Fix.md) | Disable systemd OSC 3008 junk before SSH prompt |
| [taatom-docker-cleanup.sh](./taatom-docker-cleanup.sh) | Weekly Docker image cleanup (keep `latest` + N rollbacks) |

**Host:** `ubuntu@3.229.201.246`  
**App path:** `/home/ubuntu/TeamTaatom`

### Instant revert (on EC2)

```bash
# P2 SSH/nginx
bash /home/ubuntu/taatom-hardening-20260915-p2-upgrade-REVERT.sh

# Earlier hardening (env/UFW/fail2ban/swap)
bash /home/ubuntu/taatom-hardening-20260915-hardening-REVERT.sh
```

