# npm audit – fixes and known issues

## 1. Fix npm cache permission (required for `npm audit fix`)

If `npm audit fix` fails with **EACCES** (cache folder contains root-owned files), fix permissions first:

```bash
sudo chown -R $(whoami) ~/.npm
```

Then run:

```bash
npm audit fix
```

## 2. Overrides in package.json

The backend `package.json` includes **overrides** to force patched versions of transitive dependencies:

- **fast-xml-parser** → `^5.3.4` (fixes high-severity DoS, GHSA-37qj-frw5-hhjh).  
  Used by `@aws-sdk/*` and `@google-cloud/storage`.
- **lodash** → `^4.17.23` (fixes moderate prototype pollution in `_.unset`/`_.omit`).

After changing overrides, run:

```bash
rm -rf node_modules package-lock.json
npm install
npm audit
```

Then run `npm audit fix` if needed (after fixing cache permissions).

## 3. Unfixable / accepted risks (if any remain)

The backend **no longer uses** `@sendinblue/client`; email is sent via the Brevo REST API (`src/utils/brevoService.js` using `fetch`), so the previous form-data/qs/tough-cookie/request chain from Brevo is gone.

If audit still reports **“No fix available”** for other packages (e.g. express/body-parser/qs), they are deep in the tree; monitor upstream updates and run `npm audit` after upgrades.

## 4. Regular checks

- Run **`npm audit`** regularly (e.g. in CI or before releases).
- Fix **critical** and **high** where a fix or override is available.
- Re-run after upgrading any direct dependency.
