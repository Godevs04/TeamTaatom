#!/usr/bin/env bash
# Dry-run (default) or apply UGC wipe — keeps Locales + admin essentials.
#
# Usage:
#   ./scripts/wipe-ugc-keep-locales.sh
#   ./scripts/wipe-ugc-keep-locales.sh --env .env.prod
#   ./scripts/wipe-ugc-keep-locales.sh --env .env.prod --apply
#
# --apply also requires: CONFIRM_WIPE=YES_WIPE_UGC
#
set -euo pipefail
cd "$(dirname "$0")/.."

ENV_FILE=""
EXTRA_ARGS=()

while [[ $# -gt 0 ]]; do
  case "$1" in
    --env)
      ENV_FILE="$2"
      shift 2
      ;;
    *)
      EXTRA_ARGS+=("$1")
      shift
      ;;
  esac
done

if [[ -n "$ENV_FILE" ]]; then
  if [[ ! -f "$ENV_FILE" ]]; then
    echo "Env file not found: $ENV_FILE"
    exit 1
  fi
  # shellcheck disable=SC1090
  set -a
  # Export KEY=VAL lines (skip comments / blanks)
  while IFS= read -r line || [[ -n "$line" ]]; do
    [[ -z "$line" || "$line" =~ ^[[:space:]]*# ]] && continue
    if [[ "$line" =~ ^[A-Za-z_][A-Za-z0-9_]*= ]]; then
      export "$line"
    fi
  done < "$ENV_FILE"
  set +a
fi

if [[ -z "${MONGO_URL:-}" ]]; then
  echo "MONGO_URL is not set. Pass --env .env.prod or export MONGO_URL."
  exit 1
fi

echo "Using MONGO_URL host: $(printf '%s' "$MONGO_URL" | sed -E 's#mongodb(\+srv)?://[^@]+@#mongodb\1://***:***@#')"
echo "Sevalla bucket: ${SEVALLA_STORAGE_BUCKET:-'(not set)'}"
echo

# macOS bash 3.2 + set -u: empty "${arr[@]}" is "unbound variable"
if ((${#EXTRA_ARGS[@]} > 0)); then
  exec node scripts/wipe-ugc-keep-locales.js "${EXTRA_ARGS[@]}"
else
  exec node scripts/wipe-ugc-keep-locales.js
fi
