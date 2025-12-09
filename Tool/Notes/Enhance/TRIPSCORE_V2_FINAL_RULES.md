# TripScore v2 – Final Rules & Production Guidelines

**Document Version:** 1.0  
**Last Updated:** January 2025  
**Status:** Production Ready  
**Purpose:** Final business rules, trust level definitions, and production guidelines for TripScore v2.

---

## Table of Contents

1. [Trust Levels & Scoring Rules](#trust-levels--scoring-rules)
2. [Source Type Mapping](#source-type-mapping)
3. [Fraud Detection](#fraud-detection)
4. [Unique Place Counting](#unique-place-counting)
5. [Configuration](#configuration)
6. [Production Checklist](#production-checklist)

---

## Trust Levels & Scoring Rules

### Trust Level Definitions

| Trust Level | Source | Counts Toward TripScore | Description |
|-------------|--------|------------------------|-------------|
| **high** | `taatom_camera_live` | ✅ Yes | In-app camera capture with live GPS. Highest trust level. |
| **medium** | `gallery_exif` | ✅ Yes | Gallery photo/video with EXIF GPS data. Verified location from metadata. |
| **low** | `gallery_no_exif` | ❌ No | Gallery photo/video with location but no EXIF GPS. Lower confidence. |
| **unverified** | `manual_only` | ❌ No | User manually entered location. No verification possible. |
| **suspicious** | Any (fraud detected) | ❌ No | Failed fraud detection (impossible travel patterns). |

### Scoring Rules

**Only TripVisits with `trustLevel` in `['high', 'medium']` contribute to TripScore.**

- **High trust visits:** Counted at full weight (1.0)
- **Medium trust visits:** Counted at full weight (1.0), but subject to fraud checks
- **Low trust visits:** Excluded from TripScore (weight = 0)
- **Unverified visits:** Excluded from TripScore (weight = 0)
- **Suspicious visits:** Excluded from TripScore (weight = 0), tracked for monitoring

### Configuration

Trust level filtering is controlled by `TRUSTED_TRUST_LEVELS` constant in `backend/src/config/tripScoreConfig.js`:

```javascript
const TRUSTED_TRUST_LEVELS = ['high', 'medium'];
```

Future low-trust weighting can be enabled via:

```javascript
const LOW_TRUST_WEIGHT = 0;  // 0 = excluded, 0.2 = 20% weight
const ALLOW_LOW_TRUST = false;
```

---

## Source Type Mapping

### Source Determination Flow

```
Frontend Upload
    ↓
LocationExtractionService.extractFromPhotos()
    ↓
Returns: { lat, lng, address, hasExifGps, takenAt, rawSource }
    ↓
Source Determination Logic:
    - Camera capture → 'taatom_camera_live'
    - rawSource === 'exif' → 'gallery_exif'
    - rawSource === 'asset' + location exists → 'gallery_no_exif'
    - No location → 'manual_only'
    ↓
Backend receives: { source, hasExifGps, takenAt, fromCamera }
    ↓
determineSource() validates and assigns source
    ↓
assignTrustLevel() assigns trust level:
    - taatom_camera_live → 'high'
    - gallery_exif → 'medium' (or 'suspicious' if fraud detected)
    - gallery_no_exif → 'low'
    - manual_only → 'unverified'
```

### Source → Trust Level Mapping

| Source | Default Trust Level | Conditions |
|--------|---------------------|------------|
| `taatom_camera_live` | `high` | Always high trust |
| `gallery_exif` | `medium` | Default, unless fraud detected |
| `gallery_exif` | `suspicious` | If impossible travel detected |
| `gallery_no_exif` | `low` | Always low trust |
| `manual_only` | `unverified` | Always unverified |

---

## Fraud Detection

### Impossible Travel Detection

**Rule:** If a user's travel speed exceeds 1000 km/h between consecutive trusted visits, mark as suspicious.

**Algorithm:**
```javascript
distance = calculateDistance(previousVisit.lat, previousVisit.lng, currentVisit.lat, currentVisit.lng);
timeDiffHours = abs(currentVisit.takenAt - previousVisit.takenAt) / (1000 * 60 * 60);
maxReasonableSpeed = 1000; // km/h
minTimeForDistance = distance / maxReasonableSpeed;

if (timeDiffHours > 0 && timeDiffHours < minTimeForDistance && distance > 100) {
  trustLevel = 'suspicious';
}
```

**Thresholds:**
- Minimum distance: 100 km (to avoid false positives for nearby locations)
- Maximum speed: 1000 km/h (commercial flights ~900 km/h)
- Only checks against previous trusted visits (`high` or `medium`)

**Logging:**
- Suspicious visits are logged if `ENABLE_SUSPICIOUS_LOGGING=true`
- Log includes: userId, coordinates, distance, time difference, reason

---

## Unique Place Counting

### Deduplication Logic

**TripScore counts unique places visited, not raw post count.**

**Deduplication Method:**
- Uses coordinate-based deduplication: `${lat},${lng}`
- Multiple posts at the same location count as 1 unique place
- Tolerance: Exact match (no tolerance currently)

**Example:**
- User posts 5 photos at Times Square (40.7580, -73.9855)
- Result: TripScore increases by 1 (not 5)

**Implementation:**
```javascript
const uniqueLocations = new Set();
trustedVisits.forEach(visit => {
  const locationKey = `${visit.lat},${visit.lng}`;
  if (!uniqueLocations.has(locationKey)) {
    uniqueLocations.add(locationKey);
    tripScore += 1;
  }
});
```

---

## Configuration

### Backend Configuration

**File:** `backend/src/config/tripScoreConfig.js`

```javascript
// Trust levels that contribute to TripScore
const TRUSTED_TRUST_LEVELS = ['high', 'medium'];

// Low trust level weight (future enhancement)
const LOW_TRUST_WEIGHT = 0;
const ALLOW_LOW_TRUST = false;

// Suspicious visit handling
const ALLOW_SUSPICIOUS_TRUST = false;
const SUSPICIOUS_TRUST_WEIGHT = 0;

// Unverified visit handling
const ALLOW_UNVERIFIED_TRUST = false;
const UNVERIFIED_TRUST_WEIGHT = 0;
```

### Environment Variables

**File:** `backend/.env`

```env
# Suspicious visit logging (for debugging)
ENABLE_SUSPICIOUS_LOGGING=true
```

---

## Production Checklist

### Pre-Launch Verification

- [ ] All TripScore APIs filter by `TRUSTED_TRUST_LEVELS`
- [ ] Trust level filtering is consistent across all endpoints
- [ ] Fraud detection is enabled and logging suspicious visits
- [ ] Unique place counting works correctly (deduplication)
- [ ] SuperAdmin analytics show trust level breakdown
- [ ] Suspicious visits are visible in SuperAdmin dashboard
- [ ] Tests pass for TripVisit creation and trust level assignment
- [ ] Tests pass for TripScore calculation with trust filtering

### Post-Launch Monitoring

- [ ] Monitor trust level distribution (high/medium/low/unverified/suspicious)
- [ ] Review suspicious visits weekly for false positives
- [ ] Check TripScore accuracy against user feedback
- [ ] Monitor SuperAdmin analytics for anomalies
- [ ] Review fraud detection thresholds (adjust if needed)

### Known Limitations

1. **Coordinate Tolerance:** Currently uses exact match (no tolerance). May need adjustment for GPS accuracy.
2. **Time Zone Handling:** `takenAt` timestamps may need timezone normalization.
3. **EXIF Parsing:** Limited EXIF date format support. May need enhancement for edge cases.
4. **Low Trust Weighting:** Currently disabled. Can be enabled via config if needed.

---

## API Endpoints Affected

All TripScore endpoints filter by trust level:

1. `GET /api/v1/profile/:id` - Profile TripScore
2. `GET /api/v1/profile/:id/tripscore/continents` - Continent breakdown
3. `GET /api/v1/profile/:id/tripscore/continents/:continent/countries` - Country breakdown
4. `GET /api/v1/profile/:id/tripscore/countries/:country` - Country details
5. `GET /api/v1/profile/:id/tripscore/countries/:country/locations` - Location list

All use: `trustLevel: { $in: TRUSTED_TRUST_LEVELS }`

---

## Summary

**TripScore v2 Final Rules:**

✅ Only `high` and `medium` trust visits count toward TripScore  
✅ Unique places are counted (deduplication by coordinates)  
✅ Fraud detection marks impossible travel as `suspicious`  
✅ Suspicious, low, and unverified visits are excluded from scoring  
✅ Configuration allows future adjustments (low-trust weighting)  
✅ All rules are consistently applied across all TripScore APIs  

**Production Status:** ✅ Ready for January 2026 Launch

---

**Document Version:** 1.0  
**Last Updated:** January 2025  
**Maintained By:** TeamTaatom Development Team

