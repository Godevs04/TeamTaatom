const { buildLongVideoAdSchedule } = require('../services/longVideoAdSchedule');

describe('buildLongVideoAdSchedule', () => {
  it('≤ 4:00 → single pre-roll rewarded', () => {
    const { slots } = buildLongVideoAdSchedule(240);
    expect(slots).toHaveLength(1);
    expect(slots[0]).toMatchObject({ atSeconds: 0, type: 'rewarded', preferRewarded: true });
  });

  it('> 4:00 and < 5:00 → start + end', () => {
    const { slots } = buildLongVideoAdSchedule(270);
    expect(slots).toHaveLength(2);
    expect(slots[0].atSeconds).toBe(0);
    expect(slots[1].atSeconds).toBe('end');
  });

  it('10-minute video → start + midpoint 5:00', () => {
    const { slots } = buildLongVideoAdSchedule(600);
    expect(slots).toHaveLength(2);
    expect(slots[0].atSeconds).toBe(0);
    expect(slots[1].atSeconds).toBe(300);
  });

  it('25-minute video → start, 15:00, end', () => {
    const { slots } = buildLongVideoAdSchedule(25 * 60);
    expect(slots).toHaveLength(3);
    expect(slots.map((s) => s.atSeconds)).toEqual([0, 900, 'end']);
  });

  it('40-minute video → 0 / 10 / 20 / 30', () => {
    const { slots } = buildLongVideoAdSchedule(40 * 60);
    expect(slots).toHaveLength(4);
    expect(slots.map((s) => s.atSeconds)).toEqual([0, 600, 1200, 1800]);
  });

  it('60-minute video → 0 / 15 / 30 / 45', () => {
    const { slots } = buildLongVideoAdSchedule(60 * 60);
    expect(slots).toHaveLength(4);
    expect(slots.map((s) => s.atSeconds)).toEqual([0, 900, 1800, 2700]);
  });

  it('never exceeds 4 ads', () => {
    const { slots } = buildLongVideoAdSchedule(3 * 60 * 60);
    expect(slots.length).toBeLessThanOrEqual(4);
  });
});
