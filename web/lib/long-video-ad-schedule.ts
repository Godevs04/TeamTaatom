/**
 * Long-video ad schedule (mirrors frontend/utils/longVideoAdSchedule.ts).
 */
export type AdSlotType = "rewarded" | "interstitial";

export type AdSlot = {
  atSeconds: number | "end";
  type: AdSlotType;
  preferRewarded?: boolean;
};

export function buildLongVideoAdSchedule(durationSeconds: number): { slots: AdSlot[] } {
  const d = Math.max(0, Number(durationSeconds) || 0);

  if (d <= 4 * 60) {
    return { slots: [{ atSeconds: 0, type: "rewarded", preferRewarded: true }] };
  }
  if (d > 4 * 60 && d < 5 * 60) {
    return {
      slots: [
        { atSeconds: 0, type: "rewarded", preferRewarded: true },
        { atSeconds: "end", type: "interstitial" },
      ],
    };
  }
  if (d >= 5 * 60 && d <= 20 * 60) {
    return {
      slots: [
        { atSeconds: 0, type: "rewarded", preferRewarded: true },
        { atSeconds: Math.floor(d / 2), type: "interstitial" },
      ],
    };
  }
  if (d > 20 * 60 && d <= 30 * 60) {
    return {
      slots: [
        { atSeconds: 0, type: "rewarded", preferRewarded: true },
        { atSeconds: 15 * 60, type: "interstitial" },
        { atSeconds: "end", type: "interstitial" },
      ],
    };
  }
  const q = Math.floor(d / 4);
  return {
    slots: [
      { atSeconds: 0, type: "rewarded", preferRewarded: true },
      { atSeconds: q, type: "interstitial" },
      { atSeconds: q * 2, type: "interstitial" },
      { atSeconds: q * 3, type: "interstitial" },
    ],
  };
}
