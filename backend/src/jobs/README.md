# Background Jobs

Background job queues are **disabled** when Redis is not configured. The queue module (`queue.js`) provides no-op implementations so code that calls `queue.add()` or `queue.process()` continues to work without failing.

## Queue names

| Queue name            | Purpose                    | Processor        |
|-----------------------|----------------------------|------------------|
| `email`               | Email sending              | `processors/email.js` |
| `image-processing`    | Image resizing/optimization | `processors/image.js` |
| `analytics`           | Analytics event processing  | `processors/analytics.js` |
| `cleanup`             | Periodic cleanup tasks     | `processors/cleanup.js` |

## Enabling queues (Redis)

To enable real background processing:

1. Set `REDIS_URL` (or the URL used in `queue.js`) in your environment.
2. Replace the no-op queue implementation with Bull/BullMQ (or similar) using the same queue names.
3. Start workers via `workers.js` (or your deployment process).

## Failure handling (when enabled)

- **Retries:** Configure in the queue options (e.g. Bull `attempts`, `backoff`).
- **Failed jobs:** Use the queue’s `failed` event or Bull dashboard to inspect and retry.
- **Dead letter:** Consider moving repeatedly failed jobs to a dead-letter queue for inspection.

When queues are disabled, no jobs are run and no failure handling applies; callers receive a resolved promise and a log warning.
