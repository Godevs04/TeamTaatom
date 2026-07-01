#!/usr/bin/env node
/**
 * Verifies Android Digital Asset Links for Google Play App Links.
 *
 * Usage:
 *   node scripts/verify-assetlinks.mjs
 *   node scripts/verify-assetlinks.mjs --url https://taatom.com
 *   ASSETLINKS_BASE_URL=http://localhost:3001 node scripts/verify-assetlinks.mjs
 */

const DEFAULT_BASE_URL = process.env.ASSETLINKS_BASE_URL || "https://taatom.com";
const ASSETLINKS_PATH = "/.well-known/assetlinks.json";

function parseArgs() {
  const args = process.argv.slice(2);
  let baseUrl = DEFAULT_BASE_URL;
  for (let i = 0; i < args.length; i += 1) {
    if (args[i] === "--url" && args[i + 1]) {
      baseUrl = args[i + 1];
      i += 1;
    }
  }
  return baseUrl.replace(/\/$/, "");
}

function isJsonContentType(value) {
  if (!value) return false;
  const normalized = value.toLowerCase().split(";")[0].trim();
  return normalized === "application/json";
}

async function checkUrl(label, url, { allowRedirect = false } = {}) {
  const result = {
    label,
    url,
    ok: false,
    status: 0,
    contentType: "",
    redirected: false,
    redirectStatus: 0,
    redirectLocation: "",
    errors: [],
  };

  try {
    const res = await fetch(url, {
      redirect: allowRedirect ? "follow" : "manual",
      headers: { Accept: "application/json" },
    });

    result.status = res.status;
    result.contentType = res.headers.get("content-type") || "";

    if (!allowRedirect && res.status >= 300 && res.status < 400) {
      result.redirected = true;
      result.redirectStatus = res.status;
      result.redirectLocation = res.headers.get("location") || "";
      result.errors.push(`Unexpected redirect ${res.status} → ${result.redirectLocation}`);
      return result;
    }

    if (res.status !== 200) {
      result.errors.push(`Expected HTTP 200, got ${res.status}`);
      return result;
    }

    if (!isJsonContentType(result.contentType)) {
      result.errors.push(
        `Expected Content-Type application/json, got "${result.contentType || "missing"}"`
      );
    }

    const body = await res.text();
    let parsed;
    try {
      parsed = JSON.parse(body);
    } catch {
      result.errors.push("Response body is not valid JSON");
      return result;
    }

    if (!Array.isArray(parsed) || parsed.length === 0) {
      result.errors.push("assetlinks.json must be a non-empty JSON array");
      return result;
    }

    const target = parsed[0]?.target;
    if (target?.package_name !== "com.taatom.app") {
      result.errors.push(`Expected package_name com.taatom.app, got "${target?.package_name}"`);
    }
    if (!Array.isArray(target?.sha256_cert_fingerprints) || target.sha256_cert_fingerprints.length === 0) {
      result.errors.push("Missing sha256_cert_fingerprints");
    }

    result.ok = result.errors.length === 0;
    return result;
  } catch (error) {
    result.errors.push(error instanceof Error ? error.message : String(error));
    return result;
  }
}

function printResult(result) {
  const status = result.ok ? "PASS" : "FAIL";
  console.log(`\n[${status}] ${result.label}`);
  console.log(`  URL: ${result.url}`);
  console.log(`  HTTP: ${result.status}`);
  console.log(`  Content-Type: ${result.contentType || "(none)"}`);
  if (result.redirected) {
    console.log(`  Redirect: ${result.redirectStatus} → ${result.redirectLocation}`);
  }
  if (result.errors.length) {
    for (const err of result.errors) {
      console.log(`  ✗ ${err}`);
    }
  } else {
    console.log("  ✓ HTTP 200, application/json, valid assetlinks.json");
  }
}

async function main() {
  const baseUrl = parseArgs();
  const assetlinksUrl = `${baseUrl}${ASSETLINKS_PATH}`;

  console.log("Taatom Android App Links verification");
  console.log("======================================");

  const apexCheck = await checkUrl("Apex (no redirect)", assetlinksUrl, { allowRedirect: false });
  printResult(apexCheck);

  const wwwCheck = await checkUrl(
    "www (fallback)",
    assetlinksUrl.replace("://taatom.com", "://www.taatom.com"),
    { allowRedirect: false }
  );
  printResult(wwwCheck);

  const allOk = apexCheck.ok && wwwCheck.ok;
  console.log("\n======================================");
  if (allOk) {
    console.log("All checks passed. Ready for Play Console recheck.");
    process.exit(0);
  } else {
    console.log("Some checks failed. Fix issues above before Play Console recheck.");
    if (!apexCheck.ok && apexCheck.redirected) {
      console.log(
        "\nHint: Google requires https://taatom.com/.well-known/assetlinks.json to return HTTP 200"
      );
      console.log(
        "without redirect. In Vercel → Domains, remove the apex→www redirect for /.well-known"
      );
      console.log("(or set taatom.com as the primary domain with no redirect).");
    }
    process.exit(1);
  }
}

main();
