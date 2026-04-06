# SuperAdmin Security

## Authentication & Token Storage

- **Current behavior:** The SuperAdmin stores the session token in `localStorage` under the key `founder_token`.
- **Risk:** If the site is vulnerable to XSS (Cross-Site Scripting), an attacker could read `localStorage` and steal the token.
- **Mitigations in place:**
  - All API requests use the centralized `api` service with Bearer token; 401 responses clear the token and redirect to login.
  - Session expiry message is shown on 401 ("Session expired. Please sign in again.").
  - Auto-logout after configurable inactivity (from backend settings).
  - Test/debug page (`/test`) is only available in development builds, not in production.
- **Recommendation for production:** Prefer **httpOnly cookies** for SuperAdmin auth when possible: backend sets an httpOnly cookie on login, and the frontend sends credentials with each request. That way the token is not accessible to JavaScript and is less exposed to XSS. Until then, keep XSS surface minimal: avoid `dangerouslySetInnerHTML`, use CSP headers, and ensure all user-controlled input is sanitized.

## Environment Variables

- Do not commit `.env` or any file containing `VITE_API_URL` with secrets.
- `VITE_API_URL` is required for production builds; it is embedded at build time.

## Reporting Issues

If you discover a security issue, please report it privately to the team rather than opening a public issue.
