# TripScore v2 & Location Enhancement - QA Checklist

**Document Version:** 1.0  
**Last Updated:** January 2025  
**Purpose:** Manual QA checklist for TripScore v2 and Location Enhancement features before production launch.

---

## Pre-Testing Setup

- [ ] Backend server running with latest code
- [ ] Frontend app built and running on device/emulator
- [ ] SuperAdmin dashboard accessible
- [ ] Test user account created
- [ ] Database cleared or test data seeded

---

## Test Scenarios

### 1. New In-App Camera Photo (Post)

**Steps:**
1. Open Taatom app
2. Navigate to Post screen
3. Tap camera icon to take a new photo
4. Ensure GPS/location permissions are granted
5. Verify location is auto-filled
6. Add caption and post

**Expected Results:**
- ✅ Location auto-filled from camera GPS
- ✅ Post created successfully
- ✅ TripScore increases after posting
- ✅ Visit shows as `high` trust in SuperAdmin
- ✅ Source: `taatom_camera_live`
- ✅ Trust level: `high`
- ✅ Visit counted in TripScore calculation

**SuperAdmin Verification:**
- [ ] Check TripScore Analytics → Trust Level Breakdown shows `high` visit
- [ ] Check user's TripScore increased by 1 (if unique location)
- [ ] Verify visit appears in "Top Users" if applicable

---

### 2. Old Gallery Photo with EXIF (Post)

**Steps:**
1. Open Post screen
2. Select a photo from gallery taken 6-12 months ago with location metadata
3. Verify location is auto-detected
4. Check that `takenAt` timestamp matches photo capture date
5. Add caption and post

**Expected Results:**
- ✅ Location auto-detected from EXIF data
- ✅ `takenAt` timestamp matches photo capture date (not upload date)
- ✅ Post created successfully
- ✅ TripScore counts that city/location
- ✅ Visit shows as `medium` trust in SuperAdmin
- ✅ Source: `gallery_exif`
- ✅ Trust level: `medium`
- ✅ Visit counted in TripScore calculation

**SuperAdmin Verification:**
- [ ] Check Trust Level Breakdown shows `medium` visit
- [ ] Verify `takenAt` date matches photo capture date
- [ ] Check TripScore increased correctly

---

### 3. Gallery Photo without EXIF (Post)

**Steps:**
1. Open Post screen
2. Select a photo from gallery with no location metadata
3. Manually select location on map
4. Add caption and post

**Expected Results:**
- ✅ Location manually selected
- ✅ Post created successfully
- ✅ Post shows on map
- ✅ TripScore either:
  - Doesn't change (if low-trust excluded), OR
  - Changes minimally (if low-trust weighting enabled)
- ✅ Visit shows as `low` or `unverified` trust in SuperAdmin
- ✅ Source: `gallery_no_exif` or `manual_only`
- ✅ Trust level: `low` or `unverified`
- ✅ Visit NOT counted in TripScore (if excluded)

**SuperAdmin Verification:**
- [ ] Check Trust Level Breakdown shows `low` or `unverified` visit
- [ ] Verify TripScore did NOT increase (or increased minimally)
- [ ] Check visit exists but excluded from scoring

---

### 4. Short Uploaded from Gallery Video with EXIF

**Steps:**
1. Open Post screen
2. Switch to Shorts tab
3. Select a video from gallery with location metadata
4. Verify location is auto-detected
5. Add caption and upload

**Expected Results:**
- ✅ Same behavior as photo post
- ✅ Location auto-detected from video metadata
- ✅ Short created successfully
- ✅ TripScore counts that location (if unique)
- ✅ Visit shows correct trust level (`medium` if EXIF, `low` if no EXIF)
- ✅ Source: `gallery_exif` or `gallery_no_exif`
- ✅ Consistent TripScore behavior with posts

**SuperAdmin Verification:**
- [ ] Check Short visit appears in analytics
- [ ] Verify trust level assignment matches photo posts
- [ ] Check TripScore calculation includes short visits

---

### 5. User Attempts to Cheat (Manual Country Hopping)

**Steps:**
1. Create multiple posts in quick succession
2. Manually select different countries on map
3. Try to fake multiple countries in short time
4. Check TripScore changes

**Expected Results:**
- ✅ TripScore does NOT explode
- ✅ Manual-only locations excluded or weighted low
- ✅ SuperAdmin shows reasonable `low`/`unverified`/`suspicious` numbers
- ✅ Suspicious patterns flagged if detected
- ✅ Fraud detection catches impossible travel

**SuperAdmin Verification:**
- [ ] Check Suspicious Visits table
- [ ] Verify fraud detection flags impossible travel
- [ ] Check Trust Level Breakdown shows high `low`/`unverified` percentage
- [ ] Verify TripScore didn't increase unfairly

---

### 6. Multiple Posts at Same Location

**Steps:**
1. Take/post 5 photos at the same location (e.g., Times Square)
2. Check TripScore after each post

**Expected Results:**
- ✅ All 5 posts created successfully
- ✅ TripScore increases by 1 (not 5)
- ✅ Unique place counting works correctly
- ✅ Deduplication by coordinates works

**SuperAdmin Verification:**
- [ ] Check user's TripScore = 1 (not 5)
- [ ] Verify 5 visits exist but only 1 unique location counted
- [ ] Check continent/country breakdown shows correct count

---

### 7. TripScore Info Modal

**Steps:**
1. Navigate to Profile screen
2. Find TripScore section
3. Tap info icon (ℹ️) next to "TripScore"

**Expected Results:**
- ✅ Info modal appears
- ✅ Shows explanation: "What is TripScore?"
- ✅ Explains verified locations and manual locations
- ✅ Modal closes on tap outside or close button

---

### 8. Upload Screen Hints

**Steps:**
1. Open Post screen
2. Select a photo/video with location
3. Check for hint text below location field

**Expected Results:**
- ✅ Hint appears: "Tip: Photos and videos with real location data..."
- ✅ Hint only shows when location is detected
- ✅ Hint is subtle and non-intrusive

---

### 9. SuperAdmin Analytics

**Steps:**
1. Log into SuperAdmin dashboard
2. Navigate to TripScore Analytics
3. Check all views: Overview, Top Users, Fraud Monitor, Geography

**Expected Results:**
- ✅ KPI cards show correct metrics
- ✅ Trust Level Breakdown chart displays correctly
- ✅ Source Type Breakdown chart displays correctly
- ✅ Trust Level Timeline shows trends over time
- ✅ Top Users leaderboard shows correct rankings
- ✅ Suspicious Visits table shows flagged visits
- ✅ Continent Breakdown chart displays correctly
- ✅ All filters (7d, 30d, 90d, 1y) work correctly
- ✅ Export functionality works

**Verification:**
- [ ] Total Visits count matches database
- [ ] Trust Score % = (High + Medium) / Total
- [ ] Fraud Rate % = Suspicious / Total
- [ ] Top Users sorted by TripScore correctly
- [ ] Suspicious visits show flagged reason

---

### 10. Edge Cases

#### 10.1 Post without Location
- [ ] Post created without location → No TripVisit created
- [ ] TripScore unchanged

#### 10.2 Post with Invalid Coordinates (0,0)
- [ ] Post with lat=0, lng=0 → No TripVisit created
- [ ] TripScore unchanged

#### 10.3 Post Deletion
- [ ] Delete post → Associated TripVisit deactivated (`isActive: false`)
- [ ] TripScore decreases accordingly

#### 10.4 Post Update (Location Change)
- [ ] Update post location → TripVisit updated
- [ ] TripScore recalculated correctly

#### 10.5 User Deletion
- [ ] Delete user → All TripVisits deactivated
- [ ] User removed from Top Users leaderboard

---

## Performance Testing

- [ ] TripScore calculation completes in < 1 second for users with 1000+ visits
- [ ] SuperAdmin analytics load in < 3 seconds
- [ ] Location extraction completes in < 2 seconds
- [ ] Post upload with location metadata completes successfully

---

## Security Testing

- [ ] Users cannot manipulate TripScore via API
- [ ] Trust level assignment cannot be bypassed
- [ ] Suspicious visit detection cannot be gamed
- [ ] SuperAdmin endpoints require proper authentication

---

## Cross-Platform Testing

### iOS
- [ ] Location extraction works on iOS
- [ ] EXIF data accessible on iOS
- [ ] Camera capture includes GPS on iOS
- [ ] All features work as expected

### Android
- [ ] Location extraction works on Android
- [ ] EXIF data accessible on Android
- [ ] Camera capture includes GPS on Android
- [ ] All features work as expected

---

## Regression Testing

- [ ] Existing TripScore displays still work
- [ ] Profile page loads correctly
- [ ] Post creation without location still works
- [ ] Map displays locations correctly
- [ ] No breaking changes to existing APIs

---

## Sign-Off Checklist

- [ ] All test scenarios pass
- [ ] No critical bugs found
- [ ] Performance acceptable
- [ ] Security verified
- [ ] Documentation updated
- [ ] SuperAdmin analytics verified
- [ ] Ready for production deployment

---

## Known Issues & Workarounds

*Document any issues found during testing:*

1. **Issue:** [Description]
   - **Workaround:** [Solution]
   - **Status:** [Open/Resolved]

---

**Document Version:** 1.0  
**Last Updated:** January 2025  
**Maintained By:** TeamTaatom QA Team

