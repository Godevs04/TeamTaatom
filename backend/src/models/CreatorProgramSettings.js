const mongoose = require('mongoose');

const DEFAULT_POLICY = [
  'A view earns only when it comes from a logged-in TAATOM account that is not the video owner, is verified, watched at least one second, and has not already counted for that video. Logged-out traffic, repeats, and your own views do not earn.',
  'Eligible videos are your own shorts and long videos that are active and not hidden, archived, flagged, or removed. Photos do not earn. YouTube imports do not earn unless TAATOM marks that video eligible.',
  'Content must be original, follow the community guidelines, and not infringe copyright.',
  'Do not buy views or followers, use bots, automated viewing, fake accounts, view exchanges, or bug abuse. TAATOM may remove invalid views, reverse earnings, lock the account, hold a withdrawal, or end monetization.',
  'This month’s earnings stay pending until the Asia/Kolkata month is validated, then move to Available. The minimum withdrawal is ₹1000 unless TAATOM changes it. Payouts are marked paid after a manual transfer. Timing depends on the bank, verification, and holidays.',
  'The program rewards consistent original travel content: create, share, engage, grow, and earn.',
].join('\n\n');

const creatorProgramSettingsSchema = new mongoose.Schema({
  key: {
    type: String,
    default: 'default',
    unique: true,
  },
  minFollowers: { type: Number, default: 100 },
  minVideosPerMonth: { type: Number, default: 4 },
  minEligibleViewsPerMonth: { type: Number, default: 2000 },
  ratePerThousand: { type: Number, default: 0 },
  minWithdrawal: { type: Number, default: 1000 },
  consecutiveFailMonthsToLock: { type: Number, default: 2 },
  qualifyingMonthsToUnlock: { type: Number, default: 1 },
  requireTaxIdentity: { type: Boolean, default: true },
  paymentMethods: {
    type: [String],
    default: ['bank', 'upi'],
  },
  policyVersion: { type: Number, default: 1 },
  policyText: { type: String, default: DEFAULT_POLICY },
}, { timestamps: true });

creatorProgramSettingsSchema.statics.DEFAULT_POLICY = DEFAULT_POLICY;

module.exports = mongoose.model('CreatorProgramSettings', creatorProgramSettingsSchema);
