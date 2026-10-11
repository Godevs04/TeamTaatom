#!/usr/bin/env python3
"""Email a backend deploy report via the Brevo account already on the server.

Recipients, first match wins:
  1. DEPLOY_NOTIFY_EMAILS passed in by GitHub Actions (repository variable)
  2. DEPLOY_NOTIFY_EMAILS in backend/.env
  3. The built-in list below

Extend either list with commas. Example:
  kkavinkumar24@gmail.com,admin@taatom.com,ops@taatom.com

The script never prints the Brevo key, Redis password, or database host.
"""

import argparse
import html
import json
import os
import re
import subprocess
import sys
import urllib.error
import urllib.request
from datetime import datetime, timedelta, timezone

BREVO_URL = "https://api.brevo.com/v3/smtp/email"
DEFAULT_EMAILS = "kkavinkumar24@gmail.com,admin@taatom.com"
EMAIL_RE = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")
IST = timezone(timedelta(hours=5, minutes=30))


def parse_env_file(path):
    values = {}
    try:
        with open(path, "r", encoding="utf-8") as handle:
            for raw in handle:
                line = raw.strip()
                if not line or line.startswith("#") or "=" not in line:
                    continue
                key, value = line.split("=", 1)
                key = key.strip()
                value = value.strip()
                if len(value) >= 2 and value[0] == value[-1] and value[0] in ("'", '"'):
                    value = value[1:-1]
                values[key] = value
    except OSError:
        return {}
    return values


def split_emails(raw):
    found = []
    for part in (raw or "").split(","):
        email = part.strip()
        if email and EMAIL_RE.match(email) and email not in found:
            found.append(email)
    return found


def resolve_emails(env_file, override):
    for candidate in (override, os.environ.get("DEPLOY_NOTIFY_EMAILS", ""), env_file.get("DEPLOY_NOTIFY_EMAILS", ""), DEFAULT_EMAILS):
        emails = split_emails(candidate)
        if emails:
            return emails
    return split_emails(DEFAULT_EMAILS)


def run_cmd(args, cwd=None, timeout=20):
    try:
        completed = subprocess.run(
            args,
            cwd=cwd,
            capture_output=True,
            text=True,
            timeout=timeout,
            check=False,
        )
    except (OSError, subprocess.TimeoutExpired):
        return ""
    return (completed.stdout or "").strip()


def git_changes(repo, prev_sha, new_sha):
    if not repo or not os.path.isdir(os.path.join(repo, ".git")):
        return "Repository was not available when this report was built.", "No file list."
    head = new_sha or run_cmd(["git", "rev-parse", "HEAD"], cwd=repo)
    if not prev_sha or not head or prev_sha == head:
        subject = run_cmd(["git", "log", "-1", "--pretty=format:%h  %s"], cwd=repo)
        return subject or "Same commit was deployed again.", "No file changes."
    commits = run_cmd(
        ["git", "log", "--pretty=format:%h  %s", f"{prev_sha}..{head}"],
        cwd=repo,
    )
    stat = run_cmd(["git", "diff", "--stat", prev_sha, head], cwd=repo)
    commit_lines = [line for line in commits.splitlines() if line.strip()]
    stat_lines = [line for line in stat.splitlines() if line.strip()]
    if len(commit_lines) > 30:
        hidden = len(commit_lines) - 30
        commit_lines = commit_lines[:30] + [f"... {hidden} more commits"]
    if len(stat_lines) > 80:
        hidden = len(stat_lines) - 80
        stat_lines = stat_lines[:80] + [f"... {hidden} more lines"]
    return "\n".join(commit_lines) or "No commit subjects.", "\n".join(stat_lines) or "No file changes."


def timed_get(url):
    started = datetime.now(timezone.utc)
    req = urllib.request.Request(url, method="GET")
    try:
        with urllib.request.urlopen(req, timeout=10) as response:
            raw = response.read(200000)
            code = response.status
    except urllib.error.HTTPError as exc:
        raw = exc.read(200000)
        code = exc.code
    except Exception as exc:
        elapsed = int((datetime.now(timezone.utc) - started).total_seconds() * 1000)
        return code_block(code=0, elapsed_ms=elapsed, body=None, error=str(exc))
    elapsed = int((datetime.now(timezone.utc) - started).total_seconds() * 1000)
    try:
        body = json.loads(raw.decode("utf-8", errors="replace"))
    except Exception:
        body = None
    return code_block(code=code, elapsed_ms=elapsed, body=body, error="")


def code_block(code, elapsed_ms, body, error):
    return {"code": code, "ms": elapsed_ms, "body": body, "error": error}


def safe_health(detailed):
    data = {}
    if isinstance(detailed, dict):
        data = detailed.get("data") if isinstance(detailed.get("data"), dict) else detailed
    services = data.get("services") if isinstance(data.get("services"), dict) else {}
    database = services.get("database") if isinstance(services.get("database"), dict) else {}
    redis = services.get("redis") if isinstance(services.get("redis"), dict) else {}
    stats = database.get("stats") if isinstance(database.get("stats"), dict) else {}
    system = data.get("system") if isinstance(data.get("system"), dict) else {}
    memory = system.get("memory") if isinstance(system.get("memory"), dict) else {}
    return {
        "overall": data.get("status") or "unknown",
        "version": data.get("version") or "",
        "uptime_s": data.get("uptime"),
        "database_status": database.get("status") or "unknown",
        "database_name": database.get("name") or "",
        "collections": stats.get("collections"),
        "data_mb": stats.get("dataSize"),
        "redis_status": redis.get("status") or "unknown",
        "redis_ms": redis.get("responseTimeMs"),
        "memory_mb": memory.get("rss"),
        "node": system.get("nodeVersion") or "",
    }


def containers(backend_path):
    if not backend_path or not os.path.isdir(backend_path):
        return "Backend directory was not available."
    text = run_cmd(
        ["docker", "compose", "ps", "--format", "{{.Name}}\t{{.Service}}\t{{.Status}}"],
        cwd=backend_path,
        timeout=30,
    )
    if not text:
        text = run_cmd(["docker", "compose", "ps"], cwd=backend_path, timeout=30)
    return text or "No container status."


def esc(value):
    return html.escape("" if value is None else str(value))


def pre(value):
    return f"<pre style=\"margin:0;white-space:pre-wrap;font-family:ui-monospace,Menlo,Consolas,monospace;font-size:13px;line-height:1.45;\">{esc(value)}</pre>"


def row(label, value):
    return (
        "<tr>"
        f"<td style=\"padding:8px 12px;border-bottom:1px solid #e6e8ee;color:#52606d;width:220px;vertical-align:top;\">{esc(label)}</td>"
        f"<td style=\"padding:8px 12px;border-bottom:1px solid #e6e8ee;color:#102a43;vertical-align:top;\">{value}</td>"
        "</tr>"
    )


def build_bodies(args, emails, commits, files, health_rows, ready, summary):
    when = datetime.now(IST).strftime("%d %b %Y, %H:%M IST")
    status = args.status
    titles = {
        "success": "Backend deployed to production",
        "rolled_back": "Backend deploy failed and was rolled back",
        "failed": "Backend deploy failed",
    }
    title = titles.get(status, "Backend deploy report")
    colors = {"success": "#0f7b4c", "rolled_back": "#9a6700", "failed": "#b42318"}
    color = colors.get(status, "#243b53")
    short = (args.new_sha or args.intended_sha or "unknown")[:7]
    subject = f"[Taatom] {title} — {short}"

    uptime = summary.get("uptime_s")
    uptime_text = "n/a"
    if isinstance(uptime, (int, float)):
        minutes = int(uptime // 60)
        uptime_text = f"{minutes} min" if minutes < 180 else f"{minutes // 60} h {minutes % 60} min"

    redis_ms = summary.get("redis_ms")
    redis_text = summary.get("redis_status") or "unknown"
    if redis_ms is not None:
        redis_text = f"{redis_text} ({redis_ms} ms ping)"

    text_lines = [
        title,
        f"When: {when}",
        f"Result: {status}",
        f"Reason: {args.reason}",
        f"Triggered by: {args.actor or 'unknown'} ({args.event or 'push'})",
        f"Branch: {args.ref or 'main'}",
        f"Previous: {args.prev_sha or 'n/a'}",
        f"Deployed: {args.new_sha or args.intended_sha or 'n/a'}",
        f"Workflow: {args.run_url or 'n/a'}",
        "",
        "Commits",
        commits,
        "",
        "Files",
        files,
        "",
        "Health",
        f"Overall: {summary.get('overall')}",
        f"Redis: {redis_text}",
        f"Database: {summary.get('database_status')} {summary.get('database_name')}".strip(),
        f"Readiness: {ready}",
        "",
        "Containers",
        args.containers,
        "",
        "Recipients are a comma-separated list.",
        "Set GitHub repository variable DEPLOY_NOTIFY_EMAILS, or DEPLOY_NOTIFY_EMAILS in backend/.env.",
        f"This message was sent to: {', '.join(emails)}",
    ]
    text = "\n".join(text_lines)

    health_html = "".join(health_rows)
    html_body = f"""
<div style="font-family:Georgia, 'Times New Roman', serif;background:#f4f6f8;padding:24px;color:#102a43;">
  <div style="max-width:720px;margin:0 auto;background:#ffffff;border:1px solid #e6e8ee;border-radius:12px;overflow:hidden;">
    <div style="background:{color};color:#ffffff;padding:20px 24px;">
      <div style="font-size:13px;letter-spacing:0.04em;text-transform:uppercase;opacity:0.9;">Taatom production</div>
      <div style="font-size:24px;line-height:1.3;margin-top:6px;">{esc(title)}</div>
    </div>
    <div style="padding:8px 12px 20px;">
      <table style="width:100%;border-collapse:collapse;font-family:Calibri, Arial, sans-serif;font-size:15px;">
        {row("When", esc(when))}
        {row("Result", esc(status.replace("_", " ")))}
        {row("What happened", esc(args.reason))}
        {row("Triggered by", esc(f"{args.actor or 'unknown'} via {args.event or 'push'}"))}
        {row("Branch", esc(args.ref or "main"))}
        {row("Previous commit", f"<code>{esc(args.prev_sha or 'n/a')}</code>")}
        {row("Deployed commit", f"<code>{esc(args.new_sha or args.intended_sha or 'n/a')}</code>")}
        {row("Workflow run", f'<a href="{esc(args.run_url)}">{esc(args.run_url or "n/a")}</a>' if args.run_url else "n/a")}
        {row("API health", health_html or "n/a")}
        {row("Redis", esc(redis_text))}
        {row("Database", esc(f"{summary.get('database_status') or 'unknown'} · {summary.get('database_name') or 'name hidden'}"))}
        {row("Database size", esc(f"{summary.get('collections')} collections · {summary.get('data_mb')} MB" if summary.get("collections") is not None else "n/a"))}
        {row("Readiness", esc(ready))}
        {row("Process", esc(f"uptime {uptime_text} · memory {summary.get('memory_mb') or 'n/a'} MB · {summary.get('node') or ''}".strip()))}
        {row("Version", esc(summary.get("version") or "n/a"))}
      </table>
      <h2 style="font-family:Calibri, Arial, sans-serif;font-size:16px;margin:22px 12px 8px;">Commits in this deploy</h2>
      <div style="margin:0 12px 8px;padding:12px;background:#f8fafc;border-radius:8px;">{pre(commits)}</div>
      <h2 style="font-family:Calibri, Arial, sans-serif;font-size:16px;margin:22px 12px 8px;">Files changed</h2>
      <div style="margin:0 12px 8px;padding:12px;background:#f8fafc;border-radius:8px;">{pre(files)}</div>
      <h2 style="font-family:Calibri, Arial, sans-serif;font-size:16px;margin:22px 12px 8px;">Containers</h2>
      <div style="margin:0 12px 8px;padding:12px;background:#f8fafc;border-radius:8px;">{pre(args.containers)}</div>
      <p style="font-family:Calibri, Arial, sans-serif;font-size:13px;color:#52606d;margin:18px 12px 8px;">
        Sent to {esc(", ".join(emails))}. To add people later, set the comma-separated
        GitHub variable <code>DEPLOY_NOTIFY_EMAILS</code>, or the same key in <code>backend/.env</code>.
        Times above are measured on the server, not from a phone.
      </p>
    </div>
  </div>
</div>
"""
    return subject, text, html_body


def send_brevo(api_key, sender, recipient, subject, text, html_body):
    payload = {
        "sender": {"name": "Taatom Deploy", "email": sender},
        "to": [{"email": recipient}],
        "subject": subject,
        "htmlContent": html_body,
        "textContent": text,
    }
    req = urllib.request.Request(
        BREVO_URL,
        data=json.dumps(payload).encode("utf-8"),
        headers={"api-key": api_key, "Content-Type": "application/json", "Accept": "application/json"},
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=20) as response:
            response.read(1000)
            return response.status, ""
    except urllib.error.HTTPError as exc:
        detail = exc.read(500).decode("utf-8", errors="replace")
        return exc.code, detail[:300]
    except Exception as exc:
        return 0, str(exc)


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--status", default="failed", choices=["success", "failed", "rolled_back"])
    parser.add_argument("--reason", default="Deploy stopped before it finished")
    parser.add_argument("--prev-sha", default="")
    parser.add_argument("--new-sha", default="")
    parser.add_argument("--intended-sha", default="")
    parser.add_argument("--repo", default="")
    parser.add_argument("--backend", default="")
    parser.add_argument("--health-url", default="")
    parser.add_argument("--actor", default="")
    parser.add_argument("--ref", default="")
    parser.add_argument("--run-url", default="")
    parser.add_argument("--event", default="")
    parser.add_argument("--emails", default="")
    parser.add_argument("--sent-flag", default="/tmp/taatom-deploy-mail.sent")
    parser.add_argument("--dry-run", action="store_true")
    args = parser.parse_args()

    env_path = os.path.join(args.backend, ".env") if args.backend else ""
    env_file = parse_env_file(env_path) if env_path else {}
    emails = resolve_emails(env_file, args.emails)
    api_key = (env_file.get("BREVO_API_KEY") or os.environ.get("BREVO_API_KEY") or "").strip()
    sender = (env_file.get("SMTP_FROM") or os.environ.get("SMTP_FROM") or "contact@taatom.com").strip()

    commits, files = git_changes(args.repo, args.prev_sha.strip(), args.new_sha.strip())
    args.containers = containers(args.backend)

    probes = []
    detailed_body = None
    ready_text = "not checked"
    base = (args.health_url or "").rstrip("/")
    if base:
        for label, url in (
            ("Liveness /health", base),
            ("Detailed /health/detailed", base + "/detailed"),
            ("Readiness /health/ready", base + "/ready"),
        ):
            probe = timed_get(url)
            probes.append((label, probe))
            if url.endswith("/detailed") and isinstance(probe.get("body"), dict):
                detailed_body = probe["body"]
            if url.endswith("/ready"):
                body = probe.get("body") if isinstance(probe.get("body"), dict) else {}
                data = body.get("data") if isinstance(body.get("data"), dict) else body
                ready_text = f"HTTP {probe['code']} in {probe['ms']} ms · database {data.get('database', 'n/a')} · redis {data.get('redis', 'n/a')}"
                if probe.get("error"):
                    ready_text = f"unreachable ({probe['error']})"

    summary = safe_health(detailed_body)
    health_rows = []
    for label, probe in probes:
        if probe.get("error") and probe["code"] == 0:
            health_rows.append(f"<div>{esc(label)}: unreachable</div>")
        else:
            health_rows.append(f"<div>{esc(label)}: HTTP {esc(probe['code'])} in {esc(probe['ms'])} ms</div>")

    subject, text, html_body = build_bodies(args, emails, commits, files, "".join(health_rows), ready_text, summary)

    if args.dry_run:
        print(subject)
        print("TO " + ", ".join(emails))
        print(text)
        return 0

    if not api_key:
        print("WARNING: BREVO_API_KEY is missing on the server, so the deploy email was not sent.", file=sys.stderr)
        return 0

    failures = []
    for recipient in emails:
        code, detail = send_brevo(api_key, sender, recipient, subject, text, html_body)
        if 200 <= code < 300:
            print(f"Deploy email sent to {recipient}")
        else:
            failures.append(recipient)
            print(f"WARNING: deploy email to {recipient} failed (HTTP {code})", file=sys.stderr)

    if failures and len(failures) == len(emails):
        return 0
    try:
        with open(args.sent_flag, "w", encoding="utf-8") as handle:
            handle.write(subject + "\n")
    except OSError:
        pass
    return 0


if __name__ == "__main__":
    sys.exit(main())
