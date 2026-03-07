# Web app — New features & further improvements

This document suggests **new features** and **additional improvements** for the web app. It complements `improvements.md` (which focuses on technical debt and quality). Items here are ideas to consider for future sprints.

---

## New features (product & UX)

### Keyboard shortcuts
- **Idea:** Global shortcuts (e.g. `?` for help, `N` for new post, `G then F` for feed) and list them in a small “Keyboard shortcuts” modal or in Settings → About.
- **Why:** Power users and accessibility; faster navigation without the mouse.

### Share trip to social / copy link
- **Idea:** On trip detail and post card, add “Share” (copy link, or native share if available). Optional: Open Graph meta so pasted links show a rich preview (image + title) on Twitter, Slack, etc.
- **Why:** Growth and discoverability; users can share trips outside the app.

### Draft / save post for later
- **Idea:** On the create page, allow “Save draft” so caption, photos, and place are stored locally (e.g. localStorage or IndexedDB) and can be resumed later.
- **Why:** Reduces loss when the user leaves by mistake or wants to finish later.

### Richer empty states
- **Idea:** Replace generic “No posts” / “No results” with illustrated empty states and a clear CTA (e.g. “Create your first trip”, “Follow people to see their posts”, “Try a different search”).
- **Why:** Better onboarding and guidance; feels more polished.

### Real-time updates (feed / notifications)
- **Idea:** Use WebSockets or polling (if the backend supports it) to refresh the feed or notification badge when new content arrives, without a full reload.
- **Why:** Keeps the feed and notifications feeling live.

### Internationalization (i18n)
- **Idea:** Add next-intl or next-i18next (or similar) and extract UI strings; support at least one other locale (e.g. Hindi, Spanish) for landing and auth.
- **Why:** Broader reach and consistency with a future mobile i18n strategy.

### PWA (installable web app)
- **Idea:** Add a web app manifest and a service worker (e.g. next-pwa or workbox) so users can “Add to home screen” and get basic offline behavior (cached shell, optional cached feed).
- **Why:** App-like experience on mobile; better engagement.

### Trip / profile in sitemap
- **Idea:** Extend `app/sitemap.ts` to fetch public trip IDs and profile IDs from the API and add dynamic URLs so search engines can index individual trips and profiles.
- **Why:** SEO and shareable links; already noted in sitemap comments.

### Per-page Open Graph (trips, profiles)
- **Idea:** For `/trip/[id]` and `/profile/[id]`, set `metadata.openGraph` (and Twitter card) with the trip title, first image, and profile name/avatar so shared links show a rich preview.
- **Why:** Better sharing on social and in chat.

### “Back to top” on long feeds
- **Idea:** A floating button or link that appears after scrolling down the feed and scrolls smoothly to the top.
- **Why:** Usability on long feeds without losing place.

### Connectivity / offline hint
- **Idea:** Show a small banner or toast when the app goes offline (“You’re offline. Some features may be limited.”) and optionally hide it when back online. Optionally disable or adjust actions that require network.
- **Why:** Clear feedback; avoids confusing errors when the network drops.

---

## Further technical & UX improvements

### Dynamic sitemap from API
- **Current:** Sitemap has static routes only; comment says “Dynamic trip and profile URLs can be added.”
- **Suggestion:** Call the backend (or a dedicated sitemap endpoint) to get public trip and profile IDs and merge them into the sitemap with `lastModified` and `changeFrequency`.
- **Why:** Better crawlability and SEO for trips/profiles.

### Error boundaries per section
- **Idea:** Wrap key sections (e.g. feed list, settings sidebar, profile header) in error boundaries so a failure in one block doesn’t take down the whole page; show a “Something went wrong here” with retry.
- **Why:** More resilient UX; easier to isolate bugs.

### Retry with exponential backoff for API
- **Idea:** In `lib/axios.ts` or API helpers, for transient errors (e.g. 502, 503, network timeout), retry a limited number of times with exponential backoff before surfacing the error to the user.
- **Why:** Handles flaky networks and brief backend issues.

### Optimistic updates (likes, follow)
- **Idea:** When the user likes a post or follows someone, update the UI immediately and revert only if the API call fails (with a toast).
- **Why:** Feels instant and reduces perceived latency.

### Analytics events for key actions
- **Idea:** Send events (e.g. GA4, GTM, or your analytics) for sign-up, create post, share, search, and key settings changes. Keep PII out of event payloads.
- **Why:** Product insights and conversion funnel analysis.

### Version from package or env
- **Current:** Settings → About uses a hardcoded `APP_VERSION = "1.0.0"`.
- **Suggestion:** Read version from `package.json` at build time (e.g. via env like `NEXT_PUBLIC_APP_VERSION`) or from a small API that returns the deployed version.
- **Why:** Accurate “About” info and easier support.

### Focus management (modals, navigation)
- **Idea:** When opening modals or changing major sections, move focus into the modal or to the new content and trap focus where appropriate; on close, return focus to the trigger.
- **Why:** Accessibility and keyboard-only usage.

### Reduced motion preference
- **Idea:** Respect `prefers-reduced-motion: reduce` (e.g. in CSS and Framer Motion) to shorten or disable animations for users who prefer it.
- **Why:** Accessibility and comfort for sensitive users.

---

## Summary table

| Area              | Suggestion                    | Type        |
|-------------------|-------------------------------|------------|
| Product           | Keyboard shortcuts            | New feature |
| Product           | Share trip / copy link        | New feature |
| Product           | Draft / save post             | New feature |
| Product           | Richer empty states           | New feature |
| Product           | Real-time feed/notifications  | New feature |
| Product           | i18n                          | New feature |
| Product           | PWA (installable, offline)    | New feature |
| SEO               | Dynamic sitemap (trips/profiles) | Improvement |
| SEO               | Per-page Open Graph           | Improvement |
| UX                | Back to top                   | New feature |
| UX                | Offline/connectivity hint     | New feature |
| Technical         | Error boundaries per section  | Improvement |
| Technical         | API retry with backoff        | Improvement |
| Technical         | Optimistic updates            | Improvement |
| Technical         | Analytics events              | Improvement |
| Technical         | Version from package/env      | Improvement |
| A11y              | Focus management              | Improvement |
| A11y              | Reduced motion                | Improvement |

---

*Add or remove items as the product evolves. Prioritize with the team and track in your backlog.*
