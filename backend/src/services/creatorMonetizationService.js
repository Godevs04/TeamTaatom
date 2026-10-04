const mongoose = require('mongoose');
const CreatorProgramSettings = require('../models/CreatorProgramSettings');
const CreatorMonetization = require('../models/CreatorMonetization');
const CreatorMonthLedger = require('../models/CreatorMonthLedger');
const CreatorEligibleView = require('../models/CreatorEligibleView');
const CreatorEarningAdjustment = require('../models/CreatorEarningAdjustment');
const CreatorWithdrawal = require('../models/CreatorWithdrawal');
const Post = require('../models/Post');
const User = require('../models/User');
const Notification = require('../models/Notification');
const { getUserFollowCounts } = require('../utils/followCounts');
const logger = require('../utils/logger');

const IST_OFFSET_MS = (5 * 60 + 30) * 60 * 1000;
const OPEN_STATUSES = ['eligible', 'active', 'locked', 'under_review'];

const round2 = (value) => Math.round((Number(value) || 0) * 100) / 100;

const earningsFor = (views, rate) => round2((Number(views) || 0) / 1000 * (Number(rate) || 0));

const kolkataMonth = (date = new Date()) => {
  const shifted = new Date(date.getTime() + IST_OFFSET_MS);
  const year = shifted.getUTCFullYear();
  const month = shifted.getUTCMonth() + 1;
  return {
    year,
    month,
    key: `${year}-${String(month).padStart(2, '0')}`,
  };
};

const monthBounds = (year, month) => {
  const start = new Date(Date.UTC(year, month - 1, 1) - IST_OFFSET_MS);
  const nextYear = month === 12 ? year + 1 : year;
  const nextMonth = month === 12 ? 1 : month + 1;
  const end = new Date(Date.UTC(nextYear, nextMonth - 1, 1) - IST_OFFSET_MS);
  return { start, end };
};

const nextMonthKey = (key) => {
  const [year, month] = key.split('-').map(Number);
  if (month === 12) return `${year + 1}-01`;
  return `${year}-${String(month + 1).padStart(2, '0')}`;
};

const previousMonthKey = (key) => {
  const [year, month] = key.split('-').map(Number);
  if (month === 1) return `${year - 1}-12`;
  return `${year}-${String(month - 1).padStart(2, '0')}`;
};

const maskAccount = (value) => {
  const text = String(value || '');
  if (text.length <= 4) return text;
  return `${'•'.repeat(Math.max(0, text.length - 4))}${text.slice(-4)}`;
};

const isVideoEligible = (post) => {
  if (!post) return false;
  if (post.type !== 'short' && post.type !== 'long_video') return false;
  if (post.status && post.status !== 'active') return false;
  if (post.isActive === false) return false;
  if (post.isHidden || post.isArchived || post.flagged) return false;
  if (post.monetizationExcluded) return false;
  if (post.source === 'youtube' && !post.monetizationForceEligible) return false;
  return true;
};

const eligibleVideoFilter = (userId, start, end) => ({
  user: userId,
  type: { $in: ['short', 'long_video'] },
  status: 'active',
  isActive: { $ne: false },
  isHidden: { $ne: true },
  isArchived: { $ne: true },
  flagged: { $ne: true },
  monetizationExcluded: { $ne: true },
  createdAt: { $gte: start, $lt: end },
  $or: [
    { source: { $ne: 'youtube' } },
    { monetizationForceEligible: true },
  ],
});

const getSettings = async () => {
  let settings = await CreatorProgramSettings.findOne({ key: 'default' });
  if (settings) return settings;
  try {
    settings = await CreatorProgramSettings.create({ key: 'default' });
  } catch (error) {
    if (error && error.code === 11000) {
      settings = await CreatorProgramSettings.findOne({ key: 'default' });
    } else {
      throw error;
    }
  }
  return settings;
};

const ensureAccount = async (userId) => {
  let account = await CreatorMonetization.findOne({ user: userId });
  if (account) return account;
  try {
    account = await CreatorMonetization.create({ user: userId, status: 'not_eligible' });
  } catch (error) {
    if (error && error.code === 11000) {
      account = await CreatorMonetization.findOne({ user: userId });
    } else {
      throw error;
    }
  }
  return account;
};

const syncPending = async (userId) => {
  const userObjectId = new mongoose.Types.ObjectId(String(userId));
  const rows = await CreatorMonthLedger.aggregate([
    { $match: { user: userObjectId, settlement: 'pending' } },
    { $group: { _id: null, total: { $sum: '$earnings' } } },
  ]);
  const pending = round2(rows[0]?.total || 0);
  await CreatorMonetization.updateOne({ user: userId }, { $set: { pendingBalance: pending } });
  return pending;
};

const recomputeLedgerEarnings = async (ledger, rate) => {
  const formula = earningsFor(ledger.earningViews, rate);
  ledger.ratePerThousand = rate;
  ledger.earnings = round2(Math.max(0, formula + (ledger.manualAdjustment || 0)));
  await ledger.save();
  return ledger;
};

const notifyUser = async (userId, message) => {
  const account = await ensureAccount(userId);
  account.programNotices.push({ message, at: new Date() });
  if (account.programNotices.length > 20) {
    account.programNotices = account.programNotices.slice(-20);
  }
  await account.save();
  try {
    await Notification.createNotification({
      type: 'creator_program',
      fromUser: userId,
      toUser: userId,
      metadata: { message },
    });
  } catch (error) {
    logger.warn('Creator program notification failed:', error.message);
  }
};

const notifyProgramCreators = async (message) => {
  const accounts = await CreatorMonetization.find({ status: { $in: OPEN_STATUSES } }).select('user');
  for (const account of accounts) {
    try {
      await notifyUser(account.user, message);
    } catch (error) {
      logger.warn(`Creator program notice failed for ${account.user}:`, error.message);
    }
  }
};

const liveGates = async (userId, settings, month = kolkataMonth()) => {
  const bounds = monthBounds(month.year, month.month);
  const [followCounts, videos, user, ledger] = await Promise.all([
    getUserFollowCounts(userId),
    Post.countDocuments(eligibleVideoFilter(userId, bounds.start, bounds.end)),
    User.findById(userId).select('isVerified username fullName'),
    CreatorMonthLedger.findOne({ user: userId, monthKey: month.key }),
  ]);
  const followers = followCounts.followersCount || 0;
  const eligibleViews = ledger?.eligibleViews || 0;
  const monthlyViews = ledger?.monthlyViews || 0;
  const goodStanding = !!(user && user.isVerified === true);
  const followersMet = followers >= settings.minFollowers;
  const videosMet = videos >= settings.minVideosPerMonth;
  const viewsMet = eligibleViews >= settings.minEligibleViewsPerMonth;
  return {
    month,
    user,
    ledger,
    followers,
    videos,
    eligibleViews,
    monthlyViews,
    goodStanding,
    followersMet,
    videosMet,
    viewsMet,
    allMet: followersMet && videosMet && viewsMet && goodStanding,
  };
};

const refreshPreActivationStatus = async (account, gates) => {
  if (account.status !== 'not_eligible' && account.status !== 'eligible') return account;
  const next = gates.allMet ? 'eligible' : 'not_eligible';
  if (account.status !== next) {
    account.status = next;
    await account.save();
  }
  return account;
};

const profileComplete = (account, settings) => {
  const profile = account.payoutProfile || {};
  if (!profile.legalName || !profile.legalName.trim()) return false;
  if (profile.method === 'bank') {
    if (!profile.bankAccountName || !profile.bankAccountNumber || !profile.bankIfsc) return false;
  } else if (profile.method === 'upi') {
    if (!profile.upiId) return false;
  } else {
    return false;
  }
  if (settings.requireTaxIdentity && !String(profile.taxId || '').trim()) return false;
  return true;
};

const publicProfile = (account) => {
  const profile = account.payoutProfile || {};
  return {
    legalName: profile.legalName || '',
    method: profile.method || '',
    bankAccountName: profile.bankAccountName || '',
    bankAccountNumber: maskAccount(profile.bankAccountNumber),
    bankIfsc: profile.bankIfsc || '',
    upiId: profile.upiId || '',
    taxId: profile.taxId ? maskAccount(profile.taxId) : '',
    hasBankAccount: !!profile.bankAccountNumber,
    hasTaxId: !!profile.taxId,
  };
};

const withdrawBlockReason = (account, settings) => {
  if (!account) return 'Creator account could not be loaded.';
  if (account.status === 'terminated') return 'Monetization has ended on this account.';
  if (account.status === 'under_review') {
    return account.reviewReason || 'Withdrawals are paused while this account is under review.';
  }
  if (account.status !== 'active' && account.status !== 'locked') {
    return 'Activate monetization before withdrawing.';
  }
  if (account.withdrawalHold) return account.withdrawalHoldReason || 'Withdrawals are on hold.';
  if (account.verificationStatus !== 'verified') return 'Verify your legal name and payout details before the first withdrawal.';
  const min = settings.minWithdrawal;
  const available = round2(account.availableBalance);
  if (available < min) {
    const shortfall = round2(min - available);
    return `You need ₹${shortfall.toFixed(2)} more to reach the ₹${round2(min).toFixed(0)} minimum.`;
  }
  return '';
};

const getDashboard = async (userId) => {
  const settings = await getSettings();
  let account = await ensureAccount(userId);
  const gates = await liveGates(userId, settings);
  account = await refreshPreActivationStatus(account, gates);
  await syncPending(userId);
  account = await CreatorMonetization.findById(account._id);
  if (!account) {
    const error = new Error('Creator account could not be loaded.');
    error.statusCode = 500;
    throw error;
  }
  const withdrawals = await CreatorWithdrawal.find({ user: userId }).sort({ createdAt: -1 }).limit(20).lean();
  const blockReason = withdrawBlockReason(account, settings);
  const thisMonthEarnings = round2(gates.ledger?.earnings || 0);
  return {
    status: account.status,
    activatedAt: account.activatedAt,
    consecutiveFailMonths: account.consecutiveFailMonths,
    qualifyingMonths: account.qualifyingMonths,
    failMonthsToLock: settings.consecutiveFailMonthsToLock,
    qualifyingMonthsToUnlock: settings.qualifyingMonthsToUnlock,
    monthKey: gates.month.key,
    followers: { current: gates.followers, required: settings.minFollowers, met: gates.followersMet },
    videos: { current: gates.videos, required: settings.minVideosPerMonth, met: gates.videosMet },
    monthlyViews: {
      current: gates.monthlyViews,
      required: settings.minEligibleViewsPerMonth,
      met: gates.monthlyViews >= settings.minEligibleViewsPerMonth,
    },
    eligibleViewsProgress: {
      current: gates.eligibleViews,
      required: settings.minEligibleViewsPerMonth,
      met: gates.viewsMet,
    },
    recordedViews: gates.monthlyViews,
    eligibleViews: gates.eligibleViews,
    ratePerThousand: settings.ratePerThousand,
    currency: 'INR',
    thisMonthEarnings,
    pending: round2(account.pendingBalance),
    available: round2(account.availableBalance),
    withdrawn: round2(account.withdrawnTotal),
    minimumWithdrawal: settings.minWithdrawal,
    lockReason: account.lockReason || '',
    reviewReason: account.reviewReason || '',
    withdrawalHold: account.withdrawalHold,
    withdrawalHoldReason: account.withdrawalHoldReason || '',
    verificationStatus: account.verificationStatus,
    verificationNote: account.verificationNote || '',
    payoutProfile: publicProfile(account),
    paymentMethods: settings.paymentMethods,
    requireTaxIdentity: settings.requireTaxIdentity,
    canActivate: account.status === 'eligible',
    canWithdraw: !blockReason,
    withdrawBlockReason: blockReason,
    notices: (account.programNotices || []).slice(-10).reverse(),
    policyText: settings.policyText,
    policyVersion: settings.policyVersion,
    goodStanding: gates.goodStanding,
    withdrawals: withdrawals.map((row) => ({
      id: row._id,
      amount: row.amount,
      method: row.method,
      status: row.status,
      holdReason: row.holdReason || '',
      rejectionReason: row.rejectionReason || '',
      payoutReference: row.payoutReference || '',
      createdAt: row.createdAt,
      processedAt: row.processedAt,
    })),
  };
};

const activate = async (userId) => {
  const settings = await getSettings();
  let account = await ensureAccount(userId);
  if (account.status === 'terminated') {
    const error = new Error('Monetization has ended on this account.');
    error.statusCode = 400;
    throw error;
  }
  if (account.status === 'active') return getDashboard(userId);
  if (account.status === 'locked' || account.status === 'under_review') {
    const error = new Error(account.lockReason || account.reviewReason || 'This account cannot be activated right now.');
    error.statusCode = 400;
    throw error;
  }
  const gates = await liveGates(userId, settings);
  account = await refreshPreActivationStatus(account, gates);
  if (!gates.allMet || account.status !== 'eligible') {
    const error = new Error('The follower, video, and view requirements are not all met yet.');
    error.statusCode = 400;
    throw error;
  }
  account.status = 'active';
  account.activatedAt = account.activatedAt || new Date();
  account.consecutiveFailMonths = 0;
  account.qualifyingMonths = 0;
  await account.save();
  return getDashboard(userId);
};

const savePayoutProfile = async (userId, body) => {
  const settings = await getSettings();
  const account = await ensureAccount(userId);
  const method = body.method === 'upi' ? 'upi' : 'bank';
  if (!settings.paymentMethods.includes(method)) {
    const error = new Error('That payout method is not available.');
    error.statusCode = 400;
    throw error;
  }
  const legalName = String(body.legalName || '').trim();
  if (legalName.length < 2) {
    const error = new Error('Enter the legal name on the account.');
    error.statusCode = 400;
    throw error;
  }
  const profile = {
    legalName,
    method,
    bankAccountName: String(body.bankAccountName || '').trim(),
    bankAccountNumber: String(body.bankAccountNumber || '').replace(/\s/g, ''),
    bankIfsc: String(body.bankIfsc || '').trim().toUpperCase(),
    upiId: String(body.upiId || '').trim(),
    taxId: String(body.taxId || '').trim().toUpperCase(),
  };
  if (!body.bankAccountNumber && account.payoutProfile?.bankAccountNumber) {
    profile.bankAccountNumber = account.payoutProfile.bankAccountNumber;
  }
  if (!body.taxId && account.payoutProfile?.taxId) {
    profile.taxId = account.payoutProfile.taxId;
  }
  if (method === 'bank') {
    if (!/^\d{9,18}$/.test(profile.bankAccountNumber)) {
      const error = new Error('Enter a valid bank account number.');
      error.statusCode = 400;
      throw error;
    }
    if (!/^[A-Z]{4}0[A-Z0-9]{6}$/.test(profile.bankIfsc)) {
      const error = new Error('Enter a valid IFSC code.');
      error.statusCode = 400;
      throw error;
    }
    if (!profile.bankAccountName) {
      const error = new Error('Enter the bank account name.');
      error.statusCode = 400;
      throw error;
    }
  } else if (!/^[a-zA-Z0-9.\-_]{2,}@[a-zA-Z]{2,}$/.test(profile.upiId)) {
    const error = new Error('Enter a valid UPI ID.');
    error.statusCode = 400;
    throw error;
  }
  if (settings.requireTaxIdentity && !/^[A-Z]{5}[0-9]{4}[A-Z]$/.test(profile.taxId)) {
    const error = new Error('Enter a valid PAN for tax identity.');
    error.statusCode = 400;
    throw error;
  }
  const changed = JSON.stringify(profile) !== JSON.stringify({
    legalName: account.payoutProfile?.legalName || '',
    method: account.payoutProfile?.method || '',
    bankAccountName: account.payoutProfile?.bankAccountName || '',
    bankAccountNumber: account.payoutProfile?.bankAccountNumber || '',
    bankIfsc: account.payoutProfile?.bankIfsc || '',
    upiId: account.payoutProfile?.upiId || '',
    taxId: account.payoutProfile?.taxId || '',
  });
  account.payoutProfile = profile;
  if (changed && account.verificationStatus === 'verified') {
    account.verificationStatus = 'pending';
    account.verificationNote = 'Payout details changed and need to be checked again.';
  }
  await account.save();
  return getDashboard(userId);
};

const submitVerification = async (userId) => {
  const settings = await getSettings();
  const account = await ensureAccount(userId);
  if (!profileComplete(account, settings)) {
    const error = new Error('Add your legal name, payout method, and tax details first.');
    error.statusCode = 400;
    throw error;
  }
  account.verificationStatus = 'pending';
  account.verificationSubmittedAt = new Date();
  account.verificationNote = '';
  await account.save();
  return getDashboard(userId);
};

const requestWithdrawal = async (userId, body) => {
  const settings = await getSettings();
  const account = await ensureAccount(userId);
  const blockReason = withdrawBlockReason(account, settings);
  if (blockReason) {
    const error = new Error(blockReason);
    error.statusCode = 400;
    throw error;
  }
  const amount = round2(body.amount);
  if (!(amount > 0)) {
    const error = new Error('Enter a withdrawal amount.');
    error.statusCode = 400;
    throw error;
  }
  if (amount < settings.minWithdrawal) {
    const error = new Error(`The minimum withdrawal is ₹${round2(settings.minWithdrawal).toFixed(0)}.`);
    error.statusCode = 400;
    throw error;
  }
  if (amount > round2(account.availableBalance)) {
    const error = new Error('That amount is higher than the available balance.');
    error.statusCode = 400;
    throw error;
  }
  const method = account.payoutProfile.method;
  const claimed = await CreatorMonetization.findOneAndUpdate(
    {
      _id: account._id,
      availableBalance: { $gte: amount },
      status: { $in: ['active', 'locked'] },
      verificationStatus: 'verified',
      withdrawalHold: { $ne: true },
    },
    { $inc: { availableBalance: -amount, withdrawnTotal: amount } },
    { new: true }
  );
  if (!claimed) {
    const fresh = await CreatorMonetization.findById(account._id);
    const error = new Error(withdrawBlockReason(fresh || account, settings) || 'That amount is higher than the available balance.');
    error.statusCode = 400;
    throw error;
  }
  const profile = claimed.payoutProfile || {};
  try {
    await CreatorWithdrawal.create({
      user: userId,
      amount,
      method,
      status: 'requested',
      destinationSnapshot: {
        legalName: profile.legalName,
        method,
        bankAccountName: profile.bankAccountName,
        bankAccountNumber: profile.bankAccountNumber,
        bankIfsc: profile.bankIfsc,
        upiId: profile.upiId,
      },
    });
  } catch (error) {
    await CreatorMonetization.updateOne(
      { _id: account._id },
      { $inc: { availableBalance: amount, withdrawnTotal: -amount } }
    );
    throw error;
  }
  return getDashboard(userId);
};

const listWithdrawals = async (userId) => {
  const rows = await CreatorWithdrawal.find({ user: userId }).sort({ createdAt: -1 }).limit(50).lean();
  return rows.map((row) => ({
    id: row._id,
    amount: row.amount,
    method: row.method,
    status: row.status,
    holdReason: row.holdReason || '',
    rejectionReason: row.rejectionReason || '',
    payoutReference: row.payoutReference || '',
    createdAt: row.createdAt,
    processedAt: row.processedAt,
  }));
};

const touchLedger = async (ownerId, month, monthlyIncrement) => {
  const update = {
    $setOnInsert: {
      user: ownerId,
      monthKey: month.key,
      year: month.year,
      month: month.month,
      settlement: 'pending',
    },
  };
  if (monthlyIncrement) update.$inc = { monthlyViews: 1 };
  return CreatorMonthLedger.findOneAndUpdate(
    { user: ownerId, monthKey: month.key },
    update,
    { upsert: true, new: true }
  );
};

const recordMonetizationView = async ({ post, viewerId, countMonthlyView, watchMs }) => {
  if (!post || (post.type !== 'short' && post.type !== 'long_video')) return;
  const ownerId = post.user;
  if (!ownerId) return;
  const month = kolkataMonth();

  if (countMonthlyView) {
    await touchLedger(ownerId, month, true);
  }
  if (watchMs != null && watchMs !== '' && Number(watchMs) < 1000) return;

  if (!viewerId) return;
  if (String(viewerId) === String(ownerId)) return;
  if (!isVideoEligible(post)) return;

  const [viewer, owner] = await Promise.all([
    User.findById(viewerId).select('isVerified'),
    User.findById(ownerId).select('isVerified'),
  ]);
  if (!viewer || viewer.isVerified !== true) return;
  if (!owner || owner.isVerified !== true) return;

  const account = await CreatorMonetization.findOne({ user: ownerId }).select('status');
  if (account && account.status === 'terminated') return;

  try {
    await CreatorEligibleView.create({
      user: ownerId,
      viewer: viewerId,
      post: post._id,
      monthKey: month.key,
    });
  } catch (error) {
    if (error && error.code === 11000) return;
    throw error;
  }

  try {
    if (!account) {
      await ensureAccount(ownerId);
    }

    const settings = await getSettings();
    const earningIncrement = account && account.status === 'active' ? 1 : 0;
    const updated = await CreatorMonthLedger.findOneAndUpdate(
      { user: ownerId, monthKey: month.key },
      {
        $setOnInsert: {
          user: ownerId,
          monthKey: month.key,
          year: month.year,
          month: month.month,
          settlement: 'pending',
        },
        $inc: {
          eligibleViews: 1,
          earningViews: earningIncrement,
        },
      },
      { upsert: true, new: true }
    );
    await recomputeLedgerEarnings(updated, settings.ratePerThousand);
    if (account || earningIncrement) await syncPending(ownerId);
  } catch (error) {
    await CreatorEligibleView.deleteOne({ viewer: viewerId, post: post._id });
    throw error;
  }
};

const applyMonthOutcome = (account, passed, settings) => {
  if (account.status === 'active') {
    if (passed) {
      account.consecutiveFailMonths = 0;
    } else {
      account.consecutiveFailMonths += 1;
      if (account.consecutiveFailMonths >= settings.consecutiveFailMonthsToLock) {
        account.status = 'locked';
        account.qualifyingMonths = 0;
        account.lockReason = `Monetization is locked after ${account.consecutiveFailMonths} consecutive months below the follower, video, or view requirements. One qualifying month unlocks it.`;
      }
    }
    return;
  }
  if (account.status === 'locked') {
    if (passed) {
      account.qualifyingMonths += 1;
      if (account.qualifyingMonths >= settings.qualifyingMonthsToUnlock) {
        account.status = 'active';
        account.lockReason = '';
        account.consecutiveFailMonths = 0;
        account.qualifyingMonths = 0;
      }
    } else {
      account.qualifyingMonths = 0;
    }
  }
};

const settleAccountMonth = async (account, monthKey, settings) => {
  const [year, monthNumber] = monthKey.split('-').map(Number);
  const bounds = monthBounds(year, monthNumber);
  let ledger = await CreatorMonthLedger.findOne({ user: account.user, monthKey });
  if (ledger && ledger.settlement === 'settled') return account;
  if (!ledger) {
    ledger = new CreatorMonthLedger({
      user: account.user,
      monthKey,
      year,
      month: monthNumber,
      settlement: 'pending',
    });
  }

  const [followCounts, videos, user] = await Promise.all([
    getUserFollowCounts(account.user),
    Post.countDocuments(eligibleVideoFilter(account.user, bounds.start, bounds.end)),
    User.findById(account.user).select('isVerified'),
  ]);
  ledger.followers = followCounts.followersCount || 0;
  ledger.eligibleVideos = videos;
  const goodStanding = !!(user && user.isVerified === true);
  const passed = goodStanding
    && ledger.followers >= settings.minFollowers
    && ledger.eligibleVideos >= settings.minVideosPerMonth
    && ledger.eligibleViews >= settings.minEligibleViewsPerMonth;
  ledger.passed = passed;
  await recomputeLedgerEarnings(ledger, settings.ratePerThousand);

  const payout = round2(ledger.earnings);
  const previousStatus = account.status;
  const claimed = await CreatorMonthLedger.findOneAndUpdate(
    { _id: ledger._id, settlement: 'pending' },
    {
      $set: {
        settlement: 'settled',
        settledAt: new Date(),
        passed,
        followers: ledger.followers,
        eligibleVideos: ledger.eligibleVideos,
        earnings: ledger.earnings,
        ratePerThousand: settings.ratePerThousand,
      },
    }
  );
  if (!claimed) return CreatorMonetization.findById(account._id);

  account.availableBalance = round2(account.availableBalance + payout);
  if (account.status === 'active' || account.status === 'locked') {
    applyMonthOutcome(account, passed, settings);
  }
  try {
    await account.save();
  } catch (error) {
    await CreatorMonthLedger.updateOne({ _id: ledger._id }, { $set: { settlement: 'pending', settledAt: null } });
    throw error;
  }
  await syncPending(account.user);
  if (previousStatus !== 'locked' && account.status === 'locked') {
    await notifyUser(account.user, account.lockReason);
  } else if (previousStatus === 'locked' && account.status === 'active') {
    await notifyUser(account.user, 'Monetization is active again after a qualifying month.');
  }
  return CreatorMonetization.findById(account._id);
};

const closeElapsedMonths = async () => {
  const current = kolkataMonth();
  const endKey = previousMonthKey(current.key);
  const settings = await getSettings();
  const accounts = await CreatorMonetization.find({
    status: { $in: ['active', 'locked', 'under_review'] },
    activatedAt: { $ne: null },
  }).select('_id user activatedAt');

  for (const row of accounts) {
    try {
      let account = await CreatorMonetization.findById(row._id);
      if (!account || !account.activatedAt) continue;
      let key = kolkataMonth(account.activatedAt).key;
      let guard = 0;
      while (key <= endKey && guard < 36) {
        account = await settleAccountMonth(account, key, settings);
        if (!account) break;
        key = nextMonthKey(key);
        guard += 1;
      }
      await syncPending(row.user);
    } catch (error) {
      logger.error(`Creator month close failed for ${row.user}:`, error);
    }
  }
};

const updateSettings = async (patch, actorId) => {
  const settings = await getSettings();
  const numericFields = [
    'minFollowers',
    'minVideosPerMonth',
    'minEligibleViewsPerMonth',
    'ratePerThousand',
    'minWithdrawal',
    'consecutiveFailMonthsToLock',
    'qualifyingMonthsToUnlock',
  ];
  numericFields.forEach((field) => {
    if (patch[field] != null && patch[field] !== '') {
      const value = Number(patch[field]);
      if (!Number.isFinite(value) || value < 0) return;
      if ((field === 'consecutiveFailMonthsToLock' || field === 'qualifyingMonthsToUnlock') && value < 1) return;
      settings[field] = value;
    }
  });
  if (typeof patch.requireTaxIdentity === 'boolean') settings.requireTaxIdentity = patch.requireTaxIdentity;
  if (typeof patch.policyText === 'string' && patch.policyText.trim()) {
    settings.policyText = patch.policyText.trim();
    settings.policyVersion += 1;
  }
  if (Array.isArray(patch.paymentMethods)) {
    const methods = patch.paymentMethods.filter((method) => method === 'bank' || method === 'upi');
    if (methods.length) settings.paymentMethods = methods;
  }
  await settings.save();

  const openLedgers = await CreatorMonthLedger.find({ settlement: 'pending' });
  const touched = new Set();
  for (const ledger of openLedgers) {
    await recomputeLedgerEarnings(ledger, settings.ratePerThousand);
    touched.add(String(ledger.user));
  }
  for (const userId of touched) {
    await syncPending(userId);
  }

  await notifyProgramCreators('Creator Monetization Program settings were updated. Open Creator Dashboard to see the current requirements and rate.');
  logger.info(`Creator program settings updated by ${actorId || 'admin'}`);
  return settings;
};

const adminListCreators = async ({ status, q, page = 1, limit = 20 }) => {
  const filter = {};
  if (status) filter.status = status;
  if (q) {
    const { escapeRegex } = require('../utils/regexEscape');
    const users = await User.find({
      $or: [
        { username: new RegExp(escapeRegex(q), 'i') },
        { fullName: new RegExp(escapeRegex(q), 'i') },
      ],
    }).select('_id').limit(50);
    filter.user = { $in: users.map((user) => user._id) };
  }
  const skip = (Math.max(1, page) - 1) * limit;
  const settings = await getSettings();
  const [rows, total] = await Promise.all([
    CreatorMonetization.find(filter).sort({ updatedAt: -1 }).skip(skip).limit(limit).populate('user', 'username fullName isVerified followersCount').lean(),
    CreatorMonetization.countDocuments(filter),
  ]);
  const creators = await Promise.all(rows.map(async (row) => {
    const userId = row.user?._id || row.user;
    const gates = await liveGates(userId, settings);
    return {
      ...row,
      gates: {
        followers: gates.followers,
        videos: gates.videos,
        eligibleViews: gates.eligibleViews,
        monthlyViews: gates.monthlyViews,
        allMet: gates.allMet,
      },
    };
  }));
  return { creators, total, page: Number(page), limit: Number(limit) };
};

const adminGetCreator = async (userId) => {
  const settings = await getSettings();
  const account = await CreatorMonetization.findOne({ user: userId }).populate('user', 'username fullName isVerified email');
  if (!account) {
    const error = new Error('Creator monetization account not found.');
    error.statusCode = 404;
    throw error;
  }
  const gates = await liveGates(userId, settings);
  const [ledgers, withdrawals, adjustments] = await Promise.all([
    CreatorMonthLedger.find({ user: userId }).sort({ monthKey: -1 }).limit(18).lean(),
    CreatorWithdrawal.find({ user: userId }).sort({ createdAt: -1 }).limit(20).lean(),
    CreatorEarningAdjustment.find({ user: userId }).sort({ createdAt: -1 }).limit(20).lean(),
  ]);
  return {
    account,
    gates: {
      followers: gates.followers,
      videos: gates.videos,
      eligibleViews: gates.eligibleViews,
      monthlyViews: gates.monthlyViews,
      allMet: gates.allMet,
      goodStanding: gates.goodStanding,
    },
    settings: {
      minFollowers: settings.minFollowers,
      minVideosPerMonth: settings.minVideosPerMonth,
      minEligibleViewsPerMonth: settings.minEligibleViewsPerMonth,
      ratePerThousand: settings.ratePerThousand,
    },
    ledgers,
    withdrawals,
    adjustments,
  };
};

const adminSetStatus = async ({ userId, status, reason, reverseAvailable, actorId }) => {
  const allowed = ['active', 'locked', 'under_review', 'terminated'];
  if (!allowed.includes(status)) {
    const error = new Error('Choose active, locked, under review, or terminated.');
    error.statusCode = 400;
    throw error;
  }
  const note = String(reason || '').trim();
  if (!note) {
    const error = new Error('A reason is required.');
    error.statusCode = 400;
    throw error;
  }
  const account = await ensureAccount(userId);
  account.status = status;
  if (status === 'locked') {
    account.lockReason = note;
    account.qualifyingMonths = 0;
  } else if (status === 'under_review') {
    account.reviewReason = note;
  } else if (status === 'terminated') {
    account.reviewReason = note;
    account.lockReason = note;
    if (reverseAvailable) {
      const reversed = round2(account.availableBalance);
      account.availableBalance = 0;
      account.pendingBalance = 0;
      await CreatorMonthLedger.updateMany(
        { user: userId, settlement: 'pending' },
        { $set: { earnings: 0, earningViews: 0, manualAdjustment: 0 } }
      );
      await CreatorEarningAdjustment.create({
        user: userId,
        actor: actorId || null,
        amountDelta: -reversed,
        target: 'available',
        reason: note,
        availableAfter: 0,
        pendingAfter: 0,
      });
    }
  } else if (status === 'active') {
    account.lockReason = '';
    account.reviewReason = '';
    account.consecutiveFailMonths = 0;
    account.qualifyingMonths = 0;
    if (!account.activatedAt) account.activatedAt = new Date();
  }
  await account.save();
  await notifyUser(userId, note);
  return adminGetCreator(userId);
};

const adminSetHold = async ({ userId, hold, reason, actorId }) => {
  const note = String(reason || '').trim();
  if (hold && !note) {
    const error = new Error('A reason is required to hold withdrawals.');
    error.statusCode = 400;
    throw error;
  }
  const account = await ensureAccount(userId);
  account.withdrawalHold = !!hold;
  account.withdrawalHoldReason = hold ? note : '';
  await account.save();
  if (hold) await notifyUser(userId, note);
  logger.info(`Creator withdrawal hold ${hold} for ${userId} by ${actorId || 'admin'}`);
  return adminGetCreator(userId);
};

const voidPostEligibleViews = async ({ post, reason, actorId }) => {
  const views = await CreatorEligibleView.find({ post: post._id });
  if (!views.length) return;
  const settings = await getSettings();
  const byUserMonth = new Map();
  views.forEach((view) => {
    const mapKey = `${view.user}:${view.monthKey}`;
    if (!byUserMonth.has(mapKey)) byUserMonth.set(mapKey, []);
    byUserMonth.get(mapKey).push(view);
  });

  for (const group of byUserMonth.values()) {
    const { user, monthKey } = group[0];
    const account = await CreatorMonetization.findOne({ user });
    const ledger = await CreatorMonthLedger.findOne({ user, monthKey });
    if (!ledger) continue;
    const previousEarnings = round2(ledger.earnings);
    const earningDeletes = account && account.activatedAt
      ? group.filter((view) => view.createdAt >= account.activatedAt).length
      : 0;
    ledger.eligibleViews = Math.max(0, ledger.eligibleViews - group.length);
    ledger.earningViews = Math.max(0, ledger.earningViews - earningDeletes);
    await recomputeLedgerEarnings(ledger, settings.ratePerThousand);
    const delta = round2(ledger.earnings - previousEarnings);
    if (ledger.settlement === 'settled' && account && delta !== 0) {
      account.availableBalance = round2(Math.max(0, account.availableBalance + delta));
      await account.save();
    } else if (account) {
      await syncPending(user);
    }
    const fresh = await CreatorMonetization.findOne({ user });
    await CreatorEarningAdjustment.create({
      user,
      actor: actorId || null,
      monthKey,
      post: post._id,
      eligibleViewsDelta: -group.length,
      amountDelta: delta,
      target: 'views',
      reason,
      pendingAfter: fresh?.pendingBalance || 0,
      availableAfter: fresh?.availableBalance || 0,
    });
    await notifyUser(user, reason);
  }
  await CreatorEligibleView.deleteMany({ post: post._id });
};

const adminSetVideoEligibility = async ({ postId, eligible, reason, voidExisting, actorId }) => {
  const note = String(reason || '').trim();
  if (!note) {
    const error = new Error('A reason is required.');
    error.statusCode = 400;
    throw error;
  }
  const post = await Post.findById(postId);
  if (!post || (post.type !== 'short' && post.type !== 'long_video')) {
    const error = new Error('Short or long video not found.');
    error.statusCode = 404;
    throw error;
  }
  if (eligible) {
    post.monetizationExcluded = false;
    if (post.source === 'youtube') post.monetizationForceEligible = true;
  } else {
    post.monetizationExcluded = true;
    post.monetizationForceEligible = false;
  }
  post.monetizationEligibilityReason = note;
  await post.save();
  if (!eligible && voidExisting) {
    await voidPostEligibleViews({ post, reason: note, actorId });
  }
  return {
    id: post._id,
    type: post.type,
    source: post.source || 'upload',
    monetizationExcluded: post.monetizationExcluded,
    monetizationForceEligible: post.monetizationForceEligible,
    reason: post.monetizationEligibilityReason,
  };
};

const adminSearchVideos = async ({ q, page = 1, limit = 20 }) => {
  const filter = { type: { $in: ['short', 'long_video'] } };
  if (q && mongoose.Types.ObjectId.isValid(q) && String(q).length === 24) {
    filter._id = q;
  } else if (q) {
    const { escapeRegex } = require('../utils/regexEscape');
    filter.caption = new RegExp(escapeRegex(q), 'i');
  }
  const skip = (Math.max(1, page) - 1) * limit;
  const rows = await Post.find(filter)
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(limit)
    .select('caption type source status isHidden isArchived flagged monetizationExcluded monetizationForceEligible monetizationEligibilityReason user createdAt views')
    .populate('user', 'username')
    .lean();
  return rows.map((post) => ({
    ...post,
    eligible: isVideoEligible(post),
  }));
};

const adminAdjust = async ({ userId, monthKey, eligibleViewsDelta = 0, amountDelta = 0, target = 'available', reason, actorId }) => {
  const note = String(reason || '').trim();
  if (!note) {
    const error = new Error('A reason is required.');
    error.statusCode = 400;
    throw error;
  }
  const settings = await getSettings();
  const account = await ensureAccount(userId);
  const month = monthKey || kolkataMonth().key;
  const [year, monthNumber] = month.split('-').map(Number);
  let ledger = await CreatorMonthLedger.findOne({ user: userId, monthKey: month });
  if (!ledger) {
    ledger = await CreatorMonthLedger.create({
      user: userId,
      monthKey: month,
      year,
      month: monthNumber,
      settlement: 'pending',
    });
  }
  const viewDelta = Number(eligibleViewsDelta) || 0;
  if (viewDelta) {
    ledger.eligibleViews = Math.max(0, ledger.eligibleViews + viewDelta);
    ledger.earningViews = Math.max(0, ledger.earningViews + viewDelta);
  }
  const moneyDelta = round2(amountDelta);
  if (target === 'pending') {
    ledger.manualAdjustment = round2((ledger.manualAdjustment || 0) + moneyDelta);
  }
  const previousEarnings = round2(ledger.earnings);
  await recomputeLedgerEarnings(ledger, settings.ratePerThousand);
  const earningsDelta = round2(ledger.earnings - previousEarnings);

  if (ledger.settlement === 'settled') {
    account.availableBalance = round2(Math.max(0, account.availableBalance + earningsDelta + (target === 'available' ? moneyDelta : 0)));
  } else if (target === 'available') {
    account.availableBalance = round2(Math.max(0, account.availableBalance + moneyDelta));
    await syncPending(userId);
  } else {
    await syncPending(userId);
  }
  const refreshed = await CreatorMonetization.findById(account._id);
  if (ledger.settlement === 'settled' || target === 'available') {
    account.pendingBalance = refreshed ? refreshed.pendingBalance : account.pendingBalance;
    await account.save();
  }
  const finalAccount = await CreatorMonetization.findById(account._id);
  await CreatorEarningAdjustment.create({
    user: userId,
    actor: actorId || null,
    monthKey: month,
    eligibleViewsDelta: viewDelta,
    amountDelta: target === 'available' ? moneyDelta : earningsDelta,
    target: viewDelta && !moneyDelta ? 'views' : target,
    reason: note,
    pendingAfter: finalAccount?.pendingBalance || 0,
    availableAfter: finalAccount?.availableBalance || 0,
  });
  await notifyUser(userId, note);
  return adminGetCreator(userId);
};

const adminListVerifications = async () => {
  const rows = await CreatorMonetization.find({ verificationStatus: { $in: ['pending', 'rejected', 'verified'] } })
    .sort({ verificationSubmittedAt: -1 })
    .limit(100)
    .populate('user', 'username fullName email')
    .lean();
  return rows;
};

const adminReviewVerification = async ({ userId, status, note }) => {
  if (!['verified', 'rejected', 'pending'].includes(status)) {
    const error = new Error('Status must be verified, rejected, or pending.');
    error.statusCode = 400;
    throw error;
  }
  const account = await ensureAccount(userId);
  account.verificationStatus = status;
  account.verificationNote = String(note || '').trim();
  await account.save();
  if (status === 'rejected' || status === 'verified') {
    await notifyUser(userId, account.verificationNote || (status === 'verified'
      ? 'Your payout details were verified.'
      : 'Your payout details were rejected. Update them and submit again.'));
  }
  return adminGetCreator(userId);
};

const adminListWithdrawals = async ({ status }) => {
  const filter = {};
  if (status) filter.status = status;
  return CreatorWithdrawal.find(filter).sort({ createdAt: -1 }).limit(100).populate('user', 'username fullName').lean();
};

const adminWithdrawalAction = async ({ withdrawalId, action, reason, payoutReference, actorId }) => {
  const withdrawal = await CreatorWithdrawal.findById(withdrawalId);
  if (!withdrawal) {
    const error = new Error('Withdrawal not found.');
    error.statusCode = 404;
    throw error;
  }
  if (withdrawal.status === 'paid' || withdrawal.status === 'rejected') {
    const error = new Error('This withdrawal is already finished.');
    error.statusCode = 400;
    throw error;
  }
  const openStatuses = ['requested', 'on_hold', 'processing'];
  const claim = (nextStatus, extra) => CreatorWithdrawal.findOneAndUpdate(
    { _id: withdrawal._id, status: { $in: openStatuses } },
    { $set: { status: nextStatus, ...extra } },
    { new: false }
  );
  if (action === 'hold') {
    const note = String(reason || '').trim();
    if (!note) {
      const error = new Error('A hold reason is required.');
      error.statusCode = 400;
      throw error;
    }
    const claimed = await claim('on_hold', { holdReason: note });
    if (!claimed) {
      const error = new Error('This withdrawal is already finished.');
      error.statusCode = 400;
      throw error;
    }
    await notifyUser(claimed.user, note);
  } else if (action === 'processing') {
    const claimed = await claim('processing', {});
    if (!claimed) {
      const error = new Error('This withdrawal is already finished.');
      error.statusCode = 400;
      throw error;
    }
  } else if (action === 'reject') {
    const note = String(reason || '').trim() || 'Withdrawal rejected.';
    const claimed = await claim('rejected', {
      rejectionReason: note,
      processedBy: actorId || null,
      processedAt: new Date(),
    });
    if (!claimed) {
      const error = new Error('This withdrawal is already finished.');
      error.statusCode = 400;
      throw error;
    }
    try {
      await CreatorMonetization.updateOne(
        { user: claimed.user },
        { $inc: { availableBalance: claimed.amount, withdrawnTotal: -claimed.amount } }
      );
    } catch (error) {
      await CreatorWithdrawal.updateOne({ _id: claimed._id }, { $set: { status: claimed.status } });
      throw error;
    }
    await notifyUser(claimed.user, note);
  } else if (action === 'paid') {
    const reference = String(payoutReference || '').trim();
    if (!reference) {
      const error = new Error('Enter the UTR or UPI reference.');
      error.statusCode = 400;
      throw error;
    }
    const claimed = await claim('paid', {
      payoutReference: reference,
      processedBy: actorId || null,
      processedAt: new Date(),
    });
    if (!claimed) {
      const error = new Error('This withdrawal is already finished.');
      error.statusCode = 400;
      throw error;
    }
    await notifyUser(claimed.user, `Withdrawal of ₹${round2(claimed.amount).toFixed(2)} was marked paid. Reference: ${reference}. Timing still depends on the bank, verification, and holidays.`);
  } else {
    const error = new Error('Unknown withdrawal action.');
    error.statusCode = 400;
    throw error;
  }
  return CreatorWithdrawal.findById(withdrawalId);
};

const adminListAdjustments = async () => (
  CreatorEarningAdjustment.find({}).sort({ createdAt: -1 }).limit(50).populate('user', 'username').lean()
);

module.exports = {
  getSettings,
  getDashboard,
  activate,
  savePayoutProfile,
  submitVerification,
  requestWithdrawal,
  listWithdrawals,
  recordMonetizationView,
  closeElapsedMonths,
  updateSettings,
  adminListCreators,
  adminGetCreator,
  adminSetStatus,
  adminSetHold,
  adminSetVideoEligibility,
  adminSearchVideos,
  adminAdjust,
  adminListVerifications,
  adminReviewVerification,
  adminListWithdrawals,
  adminWithdrawalAction,
  adminListAdjustments,
  kolkataMonth,
  isVideoEligible,
  earningsFor,
  applyMonthOutcome,
  withdrawBlockReason,
};
