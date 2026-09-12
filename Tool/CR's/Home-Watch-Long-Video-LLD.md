# Home Feed + Creator Long Videos (Monetization)

**Status:** In implementation  
**Date:** 12 Sep 2026 (updated — creator uploads + ads; YouTube admin path removed)  
**Owner:** Product / Engineering (Taatom)  
**Scope:** Mobile (`frontend`), Web (`web`), Backend (`backend`), SuperAdmin (`SuperAdmin`)

---

## 1. Goal

| Tab | Purpose |
|-----|---------|
| **Feed** | Photo social feed — **recents only** |
| **Videos** | Long-form video from **approved creators** (user upload + Sevalla/HLS) |

Engagement: like, comment, share (existing post APIs). Monetization: AdMob rewarded + interstitial with automatic placement by duration.

## 2. Creator access

- Users submit **Creator Request** from the Videos tab.
- SuperAdmin reviews (`VideoCreatorRequest` + `User.videoCreatorStatus`).
- Only `approved` creators can `POST /api/v1/long-videos`.

## 3. Upload & surfaces

- Upload from profile menu / Videos CTA → multipart video (max 500 MB, 60 min).
- Appears in Videos feed and on creator profile (`GET /long-videos/user/:id`).

## 4–6. Ads

See `backend/src/services/longVideoAdSchedule.js` and mobile `frontend/utils/longVideoAdSchedule.ts` + `frontend/services/longVideoAds.ts`.

Rules: min 1 / max 4 ads; always pre-roll; resume after ad; rewarded preferred with interstitial fallback.

## Out of scope

- Creator revenue share / payouts  
- YouTube embed curation  
- Mid-roll VAST into HLS (client pause + AdMob overlay only)
