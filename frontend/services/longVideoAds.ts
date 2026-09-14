/**
 * Web / default stub — AdMob long-video slots are native-only.
 * Metro resolves this for web; native lives in longVideoAds.native.ts.
 */
import type { AdSlot } from '../utils/longVideoAdSchedule';

export async function showLongVideoAdSlot(_slot: AdSlot): Promise<'completed' | 'skipped'> {
  return 'skipped';
}
