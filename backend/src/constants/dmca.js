/**
 * DMCA Compliance Constants
 * 
 * This file contains constants related to DMCA (Digital Millennium Copyright Act) compliance.
 * Taatom follows DMCA Safe Harbor principles and does not proactively scan or detect copyrighted content.
 */

// DMCA Support Email
const DMCA_EMAIL = 'dmca@taatom.com';

// Copyright violation strike levels
const STRIKE_LEVELS = {
  WARNING: 1,
  SUSPENSION: 3,
  PERMANENT_BAN: 5
};

// Removal reasons
const REMOVAL_REASONS = {
  COPYRIGHT_CLAIM: 'copyright_claim',
  USER_REQUEST: 'user_request',
  POLICY_VIOLATION: 'policy_violation',
  OTHER: 'other'
};

module.exports = {
  DMCA_EMAIL,
  STRIKE_LEVELS,
  REMOVAL_REASONS
};

