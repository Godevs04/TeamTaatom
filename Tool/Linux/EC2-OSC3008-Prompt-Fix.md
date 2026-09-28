# Fix: OSC 3008 junk before SSH prompt

**Date:** 2026-09-15  
**Host:** `ubuntu@3.229.201.246`

## Symptom

Before `ubuntu@ip-…:~$` you saw escape garbage like:

```text
]3008;end=…;exit=success\]3008;start=…;machineid=…;user=ubuntu;hostname=…
```

## Cause

systemd ships `/etc/profile.d/80-systemd-osc-context.sh` (UAPI OSC 3008 “shell context”).  
You had disabled it earlier (`.disabled` symlink), but **`apt upgrade` restored the active `.sh`**, so it came back after reboot.

## Fix applied

1. Diverted the path so package updates cannot recreate the real script:
   - `dpkg-divert` → `/etc/profile.d/80-systemd-osc-context.sh.distrib`
2. Left a no-op stub at `/etc/profile.d/80-systemd-osc-context.sh`

## Revert (if you want OSC back)

```bash
bash /home/ubuntu/taatom-hardening-20260915-osc-REVERT.sh
```

## Verify

Open a **new** SSH session — prompt should be clean:

```text
ubuntu@ip-172-31-88-136:~$
```
