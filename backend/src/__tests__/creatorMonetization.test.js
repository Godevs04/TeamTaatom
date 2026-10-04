const {
  kolkataMonth,
  isVideoEligible,
  earningsFor,
  applyMonthOutcome,
  withdrawBlockReason,
} = require('../services/creatorMonetizationService');

const settings = {
  minWithdrawal: 1000,
  consecutiveFailMonthsToLock: 2,
  qualifyingMonthsToUnlock: 1,
};

describe('Creator monetization rules', () => {
  test('earnings round to two decimal rupees', () => {
    expect(earningsFor(2500, 10)).toBe(25);
    expect(earningsFor(1, 10)).toBe(0.01);
    expect(earningsFor(2000, 0)).toBe(0);
  });

  test('calendar months use Asia/Kolkata', () => {
    expect(kolkataMonth(new Date('2026-03-31T18:29:59.000Z')).key).toBe('2026-03');
    expect(kolkataMonth(new Date('2026-03-31T18:30:00.000Z')).key).toBe('2026-04');
  });

  test('payout details reject an account number, IFSC, or PAN in the wrong shape', () => {
    const { validatePayoutFields } = require('../services/creatorMonetizationService');
    expect(validatePayoutFields({
      legalName: 'Kavinkumar K',
      method: 'bank',
      bankAccountName: 'Kanihj',
      bankAccountNumber: 'KASHIU',
      bankIfsc: '987698076',
      taxId: '83472389',
    })).toMatch(/9 to 18 digits/);
    expect(validatePayoutFields({
      legalName: 'Kavinkumar K',
      method: 'bank',
      bankAccountName: 'Kanihj',
      bankAccountNumber: '123456789012',
      bankIfsc: '987698076',
      taxId: 'ABCDE1234F',
    })).toMatch(/IFSC/);
    expect(validatePayoutFields({
      legalName: 'Kavinkumar K',
      method: 'bank',
      bankAccountName: 'Kanihj',
      bankAccountNumber: '123456789012',
      bankIfsc: 'HDFC0000001',
      taxId: '83472389',
    })).toMatch(/PAN/);
    expect(validatePayoutFields({
      legalName: 'Kavinkumar K',
      method: 'upi',
      upiId: 'kavin@okaxis',
      taxId: 'ABCDE1234F',
    }    )).toBe('');
  });

  test('IFSC addresses split the street from the glued city and PIN', () => {
    const { formatIfscAddress } = require('../services/creatorMonetizationService');
    expect(formatIfscAddress(
      'NO. 37/953, 24TH MAIN, J. P. NAGAR,II PHASE, BANGALOREKARNATAKABANGALOREKARNATAKA560078',
      { centre: 'BANGALORE', district: 'BANGALORE', city: 'BANGALORE URBAN', state: 'KARNATAKA' }
    )).toEqual({
      street: 'NO. 37/953, 24TH MAIN, J. P. NAGAR, II PHASE',
      pin: '560078',
    });
  });

  test('only active shorts and long videos are eligible', () => {
    expect(isVideoEligible({ type: 'photo', status: 'active' })).toBe(false);
    expect(isVideoEligible({ type: 'short', status: 'active', source: 'youtube' })).toBe(false);
    expect(isVideoEligible({
      type: 'long_video',
      status: 'active',
      source: 'youtube',
      monetizationForceEligible: true,
    })).toBe(true);
    expect(isVideoEligible({ type: 'short', status: 'removed' })).toBe(false);
    expect(isVideoEligible({ type: 'short', status: 'active', isHidden: true })).toBe(false);
    expect(isVideoEligible({ type: 'short', status: 'active', monetizationExcluded: true })).toBe(false);
    expect(isVideoEligible({ type: 'short', status: 'active', source: 'upload' })).toBe(true);
  });

  test('two failing months lock an active creator and one qualifying month unlocks', () => {
    const account = {
      status: 'active',
      consecutiveFailMonths: 0,
      qualifyingMonths: 0,
      lockReason: '',
    };

    applyMonthOutcome(account, false, settings);
    expect(account.status).toBe('active');
    expect(account.consecutiveFailMonths).toBe(1);

    applyMonthOutcome(account, true, settings);
    expect(account.consecutiveFailMonths).toBe(0);

    applyMonthOutcome(account, false, settings);
    applyMonthOutcome(account, false, settings);
    expect(account.status).toBe('locked');
    expect(account.lockReason).toContain('locked');

    applyMonthOutcome(account, false, settings);
    expect(account.status).toBe('locked');
    expect(account.qualifyingMonths).toBe(0);

    applyMonthOutcome(account, true, settings);
    expect(account.status).toBe('active');
    expect(account.lockReason).toBe('');
  });

  test('withdrawal rules match available balance, verification, and holds', () => {
    const ready = {
      status: 'locked',
      withdrawalHold: false,
      verificationStatus: 'verified',
      availableBalance: 1000,
    };
    expect(withdrawBlockReason(ready, settings)).toBe('');

    expect(withdrawBlockReason({ ...ready, status: 'under_review', reviewReason: 'Checking views' }, settings)).toBe('Checking views');
    expect(withdrawBlockReason({
      ...ready,
      status: 'active',
      withdrawalHold: true,
      withdrawalHoldReason: 'Extra verification',
    }, settings)).toBe('Extra verification');

    expect(withdrawBlockReason({ ...ready, status: 'terminated' }, settings)).toMatch(/ended/);
    expect(withdrawBlockReason({ ...ready, availableBalance: 250 }, settings)).toMatch(/₹750.00 more/);
    expect(withdrawBlockReason({ ...ready, verificationStatus: 'pending' }, settings)).toMatch(/Verify/);
  });
});
