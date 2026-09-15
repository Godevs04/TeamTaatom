#!/usr/bin/env bash
# Taatom EC2 Docker cleanup
# - Keeps images used by any container
# - Keeps taatom-backend:latest
# - Keeps the N newest taatom-backend:rollback-* tags
# - Removes older rollback tags and other unused images
# - Prunes dangling images
#
# Install on EC2:
#   sudo cp Tool/Linux/taatom-docker-cleanup.sh /usr/local/bin/taatom-docker-cleanup.sh
#   sudo chmod 755 /usr/local/bin/taatom-docker-cleanup.sh
#
# Cron (root, Sundays 04:00 UTC):
#   0 4 * * 0 KEEP_ROLLBACK_COUNT=3 /usr/local/bin/taatom-docker-cleanup.sh >> /var/log/docker-image-prune.log 2>&1
set -euo pipefail

KEEP_ROLLBACK="${KEEP_ROLLBACK_COUNT:-3}"
LOG_TS="$(date -u '+%Y-%m-%dT%H:%M:%SZ')"
echo "[$LOG_TS] Starting Taatom Docker cleanup (keep last ${KEEP_ROLLBACK} rollbacks)"

mapfile -t USED_IDS < <(docker ps -a --format '{{.Image}}' | while read -r ref; do
  docker image inspect --format '{{.Id}}' "$ref" 2>/dev/null || true
done | sort -u)

keep_id() {
  local id="$1"
  local u
  for u in "${USED_IDS[@]+"${USED_IDS[@]}"}"; do
    [[ -n "$u" && "$u" == "$id" ]] && return 0
  done
  return 1
}

LATEST_ID="$(docker image inspect --format '{{.Id}}' taatom-backend:latest 2>/dev/null || true)"

mapfile -t ROLLBACK_TAGS < <(
  docker images --format '{{.CreatedAt}}\t{{.Repository}}:{{.Tag}}' \
    | awk -F'\t' '$2 ~ /^taatom-backend:rollback-/ {print}' \
    | sort -r \
    | cut -f2
)

KEEP_TAGS=("taatom-backend:latest")
count=0
for tag in "${ROLLBACK_TAGS[@]+"${ROLLBACK_TAGS[@]}"}"; do
  if (( count < KEEP_ROLLBACK )); then
    KEEP_TAGS+=("$tag")
    count=$((count + 1))
  fi
done

echo "Keeping tags: ${KEEP_TAGS[*]}"

declare -A KEEP_IDS=()
for tag in "${KEEP_TAGS[@]}"; do
  id="$(docker image inspect --format '{{.Id}}' "$tag" 2>/dev/null || true)"
  [[ -n "$id" ]] && KEEP_IDS["$id"]=1
done
[[ -n "${LATEST_ID:-}" ]] && KEEP_IDS["$LATEST_ID"]=1
for u in "${USED_IDS[@]+"${USED_IDS[@]}"}"; do
  [[ -n "$u" ]] && KEEP_IDS["$u"]=1
done

rollback_count=${#ROLLBACK_TAGS[@]}
if (( rollback_count > KEEP_ROLLBACK )); then
  for ((i=KEEP_ROLLBACK; i<rollback_count; i++)); do
    tag="${ROLLBACK_TAGS[$i]}"
    echo "Removing old rollback tag: $tag"
    docker rmi "$tag" 2>/dev/null || echo "  (skip) could not remove $tag"
  done
fi

mapfile -t ALL_REPO_TAGS < <(docker images --format '{{.Repository}}:{{.Tag}} {{.ID}}')
for line in "${ALL_REPO_TAGS[@]+"${ALL_REPO_TAGS[@]}"}"; do
  tag="${line%% *}"
  id="${line##* }"
  [[ "$tag" == *":<none>"* ]] && continue
  [[ "$tag" == "taatom-backend:latest" ]] && continue
  [[ "$tag" == taatom-backend:rollback-* ]] && continue
  if [[ -n "${KEEP_IDS[$id]:-}" ]] || keep_id "$id"; then
    continue
  fi
  echo "Removing unused image: $tag ($id)"
  docker rmi "$tag" 2>/dev/null || echo "  (skip) could not remove $tag"
done

echo "Pruning dangling images..."
docker image prune -f || true

echo "Disk after cleanup:"
docker system df || true
df -h / | tail -1 || true
echo "[$(date -u '+%Y-%m-%dT%H:%M:%SZ')] Cleanup finished"
