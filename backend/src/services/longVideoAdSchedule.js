/**
 * Automatic ad placement schedule for long videos (TAATOM monetization spec).
 * Pure function — no I/O.
 *
 * @param {number} durationSeconds
 * @returns {{ slots: Array<{ atSeconds: number | 'end', type: 'rewarded' | 'interstitial', preferRewarded?: boolean }> }}
 */
function buildLongVideoAdSchedule(durationSeconds) {
  const d = Math.max(0, Number(durationSeconds) || 0);

  // ≤ 4:00 — 1 ad (rewarded preferred, interstitial fallback)
  if (d <= 4 * 60) {
    return {
      slots: [{ atSeconds: 0, type: 'rewarded', preferRewarded: true }],
    };
  }

  // > 4:00 and < 5:00 — rewarded + interstitial at start and end
  if (d > 4 * 60 && d < 5 * 60) {
    return {
      slots: [
        { atSeconds: 0, type: 'rewarded', preferRewarded: true },
        { atSeconds: 'end', type: 'interstitial' },
      ],
    };
  }

  // ≥ 5:00 and ≤ 20:00 — start + midpoint
  if (d >= 5 * 60 && d <= 20 * 60) {
    return {
      slots: [
        { atSeconds: 0, type: 'rewarded', preferRewarded: true },
        { atSeconds: Math.floor(d / 2), type: 'interstitial' },
      ],
    };
  }

  // > 20:00 and ≤ 30:00 — start, 15:00, end
  if (d > 20 * 60 && d <= 30 * 60) {
    return {
      slots: [
        { atSeconds: 0, type: 'rewarded', preferRewarded: true },
        { atSeconds: 15 * 60, type: 'interstitial' },
        { atSeconds: 'end', type: 'interstitial' },
      ],
    };
  }

  // > 30:00 — 4 ads at 0, D/4, 2D/4, 3D/4
  const q = Math.floor(d / 4);
  return {
    slots: [
      { atSeconds: 0, type: 'rewarded', preferRewarded: true },
      { atSeconds: q, type: 'interstitial' },
      { atSeconds: q * 2, type: 'interstitial' },
      { atSeconds: q * 3, type: 'interstitial' },
    ],
  };
}

module.exports = { buildLongVideoAdSchedule };
