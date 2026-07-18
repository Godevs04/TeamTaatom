# 003_transcode_legacy_shorts

One-time backfill that re-encodes existing short videos in MongoDB from their
current codec (often HEVC from iPhones) to **H.264 720p / AAC** so they stop
crashing older Android decoders with the heap-OOM bug fixed in commit `bc725c6`.

The runtime behavior is implemented in
[`003_transcode_legacy_shorts.js`](./003_transcode_legacy_shorts.js).
This file is the runbook.

## What it does

For every `Post` document where `type === 'short'` and a video storage key is
set, the migration:

1. Downloads the current video bytes from R2 via a short-lived signed GET URL.
2. Calls `transcodeIfNeeded(buffer, 'video/mp4')` from
   `backend/src/services/videoTranscode.js`.
3. If the source was already H.264 it skips (logged as `passthrough`).
4. Otherwise it uploads the new buffer under a sibling key with a `-h264.mp4`
   suffix, then repoints `storageKey` and `storageKeys[0]` to the new key.
5. Stamps the document with `transcodedAt` and `originalStorageKey` so the
   migration is **idempotent (resumable)** and **reversible**.
 
The original R2 object is **not** deleted in `up()`; that's reserved for
`down()` so a rollback can restore from the original bytes.

## Required dependencies

These were added to `backend/package.json` in commit `bc725c6` but may not yet
be installed on a production host:

- `fluent-ffmpeg`
- `@ffmpeg-installer/ffmpeg`
- `@ffprobe-installer/ffprobe`

Run `npm install` on the migration host before invoking the migration. The
`@ffmpeg-installer/ffmpeg` and `@ffprobe-installer/ffprobe` packages bundle
prebuilt binaries, so no system-level `apt install ffmpeg` is required.

## Running the migration

The migration honors three env vars. **Always start with a dry run** against
a small batch.

| Env var       | Default | Notes                                                                    |
|---------------|---------|--------------------------------------------------------------------------|
| `DRY_RUN`     | unset   | When `1`, logs what would happen but does not write to R2 or Mongo.      |
| `LIMIT`       | unset   | When set, only processes the first N candidate posts.                    |
| `CONCURRENCY` | `1`     | Posts to process in parallel. Capped at `3` — ffmpeg + R2 IO is heavy.   |

### Recommended sequence

```bash
cd backend

# 1. Dry-run on 10 posts to verify the pipeline end-to-end (no writes).
DRY_RUN=1 LIMIT=10 npm run migrate:up

# 2. Live run on 10 posts. Inspect the resulting Mongo docs and R2 objects.
LIMIT=10 npm run migrate:up

# 3. Full run on the remaining backlog. Bump CONCURRENCY only if the box
#    has spare CPU + bandwidth (ffmpeg pegs ~1 core per worker).
CONCURRENCY=2 npm run migrate:up
```

The migration is **resumable**: if the process crashes or is killed, just
re-run `npm run migrate:up` and it will skip every post that already has
`transcodedAt` set.

## Estimated runtime

Roughly **10-30 seconds per post**, dominated by ffmpeg encode time for the
average 15-second short. Expect:

- 1,000 shorts at concurrency 1 -> ~3-8 hours
- 1,000 shorts at concurrency 3 -> ~1-3 hours

Bandwidth scales with average video size; assume ~5-15 MB downloaded and
~3-8 MB uploaded per transcoded post.

## Cost

Per **transcoded** post (no charge for `passthrough` posts beyond the GET):

- 1 R2 GET (existing)
- 1 R2 PUT (new H.264 object)
- 1 R2 DELETE on rollback (`down()` only)

Egress bandwidth from R2 is currently free, but ingress and storage of the
new H.264 objects will incur the usual costs. Originals are retained until
explicitly deleted, so storage will roughly double for the migrated set
until follow-up cleanup.

## Rollback

```bash
cd backend
npm run migrate:down
```

`down()` restores `storageKey` and `storageKeys[0]` from `originalStorageKey`,
unsets the marker fields, and deletes the H.264 object from R2. It will refuse
to repoint a doc whose original key is missing from R2 (logs a warning and
moves on) so you don't accidentally break a post by rolling back.

## Operational notes

- The migration runs **in series by default**. Don't bump `CONCURRENCY` blindly
  on a small dyno — ffmpeg is the bottleneck.
- All progress is logged to stdout. Pipe to a file:
  `npm run migrate:up 2>&1 | tee /var/log/transcode-backfill.log`.
- Per-post errors are caught and logged with the post `_id`; they never abort
  the migration. Re-running picks up any failed posts (since they won't have
  `transcodedAt` set).
- The migration uses Node 18+ global `fetch` to download from R2.

## Follow-up cleanup

Once the team is confident the new H.264 encodes are healthy in production
(give it ~1 week of monitoring), originals can be reclaimed by listing all
Posts with `originalStorageKey` set and deleting that key from R2. That
cleanup is intentionally **not** part of this migration so we keep an easy
rollback window.
