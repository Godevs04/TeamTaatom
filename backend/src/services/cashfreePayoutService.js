const https = require('https');
const crypto = require('crypto');
const logger = require('../utils/logger');

class CashfreePayoutNotConfiguredError extends Error {
  constructor(message = 'Cashfree Payouts is not configured on this server.') {
    super(message);
    this.name = 'CashfreePayoutNotConfiguredError';
    this.code = 'CASHFREE_PAYOUT_NOT_CONFIGURED';
  }
}

const trimEnv = (v) => (typeof v === 'string' ? v.trim() : '');

const isPayoutConfigured = () => {
  const appId = trimEnv(process.env.CASHFREE_PAYOUT_APP_ID);
  const secret = trimEnv(process.env.CASHFREE_PAYOUT_SECRET_KEY);
  return !!(appId && secret);
};

const assertPayoutConfigured = () => {
  if (!isPayoutConfigured()) {
    throw new CashfreePayoutNotConfiguredError(
      'Cashfree Payouts is not configured. Set CASHFREE_PAYOUT_APP_ID and CASHFREE_PAYOUT_SECRET_KEY.'
    );
  }
};

const getConfig = () => {
  const env = (process.env.CASHFREE_PAYOUT_ENV || process.env.CASHFREE_ENV || 'sandbox').toLowerCase();
  const baseUrl = env === 'production'
    ? 'https://api.cashfree.com/payout'
    : 'https://sandbox.cashfree.com/payout';
  return {
    baseUrl,
    appId: trimEnv(process.env.CASHFREE_PAYOUT_APP_ID),
    secretKey: trimEnv(process.env.CASHFREE_PAYOUT_SECRET_KEY),
    apiVersion: trimEnv(process.env.CASHFREE_PAYOUT_API_VERSION) || '2024-01-01',
  };
};

const getHeaders = () => {
  assertPayoutConfigured();
  const cfg = getConfig();
  return {
    'Content-Type': 'application/json',
    'x-client-id': cfg.appId,
    'x-client-secret': cfg.secretKey,
    'x-api-version': cfg.apiVersion,
  };
};

// Cashfree Payouts field limits — kept here so callers never need to truncate.
// Source: Cashfree Payouts API reference (v2). Update if Cashfree changes the schema.
const LIMITS = {
  BENE_NAME_MAX: 50,
  BENE_EMAIL_MAX: 100,
  BENE_PHONE_MAX: 15,
  BENE_ADDRESS_MAX: 150,
  TRANSFER_REMARKS_MAX: 100,
  TRANSFER_ID_MAX: 40,
  BENE_ID_MAX: 50,
};

const truncate = (value, max) => {
  const s = String(value == null ? '' : value);
  return s.length > max ? s.slice(0, max).trim() : s;
};

const makeRequest = (method, url, body = null) => {
  return new Promise((resolve, reject) => {
    const parsedUrl = new URL(url);
    const postData = body ? JSON.stringify(body) : null;
    const headers = getHeaders();
    if (postData) {
      headers['Content-Length'] = Buffer.byteLength(postData);
    }

    const options = {
      hostname: parsedUrl.hostname,
      port: 443,
      path: parsedUrl.pathname + parsedUrl.search,
      method: method.toUpperCase(),
      headers,
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        let parsed;
        try { parsed = JSON.parse(data); } catch { parsed = data; }
        if (res.statusCode >= 200 && res.statusCode < 300) {
          resolve({ status: res.statusCode, data: parsed });
        } else {
          const err = new Error(parsed?.message || `HTTP ${res.statusCode}`);
          err.status = res.statusCode;
          err.responseData = parsed;
          reject(err);
        }
      });
    });

    req.on('error', (err) => reject(err));
    req.setTimeout(30000, () => {
      req.destroy();
      reject(new Error('Request timed out'));
    });

    if (postData) req.write(postData);
    req.end();
  });
};

const isDuplicate = (error) => {
  const rd = error?.responseData;
  if (!rd || typeof rd !== 'object') return false;
  if (rd.code === 'beneficiary_already_exists' || rd.code === 'transfer_already_exists' || rd.code === 'duplicate_request') return true;
  const msg = (rd.message || '').toLowerCase();
  return msg.includes('already exists') || msg.includes('duplicate');
};

const isMissing = (error) => {
  if (!error) return false;
  if (error.status === 404) return true;
  const rd = error?.responseData;
  if (!rd || typeof rd !== 'object') return false;
  if (rd.code === 'beneficiary_not_found' || rd.code === 'transfer_not_found') return true;
  const msg = (rd.message || '').toLowerCase();
  return msg.includes('not found') || msg.includes('does not exist');
};

// ─────────────────────────────────────────────
// Beneficiary
// ─────────────────────────────────────────────

/**
 * Create or fetch a beneficiary on Cashfree Payouts.
 * Treats "already exists" as success — never throw on duplicate.
 *
 * @param {Object} params
 * @param {string} params.beneId - Deterministic id (e.g. `bene_${creatorUserId}`)
 * @param {string} params.name
 * @param {string} params.email
 * @param {string} params.phone
 * @param {Object} params.bank - { accountNumber, ifsc } for bank, OR { vpa } for UPI, OR { wise: ... }
 * @param {string} [params.address1]
 * @returns {Promise<Object>} Beneficiary object as Cashfree returned (or the existing one).
 */
const createBeneficiary = async ({ beneId, name, email, phone, bank, address1 }) => {
  const cfg = getConfig();
  const safeBeneId = truncate(beneId, LIMITS.BENE_ID_MAX);
  const body = {
    beneficiary_id: safeBeneId,
    beneficiary_name: truncate(name || 'Creator', LIMITS.BENE_NAME_MAX),
    beneficiary_instrument_details: {},
    beneficiary_contact_details: {
      beneficiary_email: truncate(email || '', LIMITS.BENE_EMAIL_MAX),
      beneficiary_phone: truncate(phone || '', LIMITS.BENE_PHONE_MAX),
      beneficiary_country_code: '+91',
      beneficiary_address: truncate(address1 || '', LIMITS.BENE_ADDRESS_MAX),
    },
  };

  if (bank?.vpa) {
    body.beneficiary_instrument_details.vpa = bank.vpa.trim();
  } else if (bank?.accountNumber && bank?.ifsc) {
    body.beneficiary_instrument_details.bank_account_number = String(bank.accountNumber).trim();
    body.beneficiary_instrument_details.bank_ifsc = String(bank.ifsc).trim().toUpperCase();
  } else {
    throw new Error('Beneficiary requires either VPA (UPI) or accountNumber+ifsc (bank).');
  }

  try {
    const result = await makeRequest('POST', `${cfg.baseUrl}/beneficiary`, body);
    logger.info(`Cashfree Payouts beneficiary created: ${safeBeneId}`);
    return result.data;
  } catch (error) {
    if (isDuplicate(error)) {
      logger.info(`Cashfree Payouts beneficiary already exists, fetching: ${safeBeneId}`);
      const existing = await getBeneficiary(safeBeneId);
      if (existing) return existing;
    }
    logger.error('Cashfree Payouts createBeneficiary error:', error.responseData || error.message);
    throw new Error(error.responseData?.message || 'Failed to create beneficiary');
  }
};

const getBeneficiary = async (beneId) => {
  const cfg = getConfig();
  try {
    const url = `${cfg.baseUrl}/beneficiary?beneficiary_id=${encodeURIComponent(beneId)}`;
    const result = await makeRequest('GET', url);
    return result.data;
  } catch (error) {
    if (isMissing(error)) return null;
    logger.error('Cashfree Payouts getBeneficiary error:', error.responseData || error.message);
    throw new Error(error.responseData?.message || 'Failed to fetch beneficiary');
  }
};

// ─────────────────────────────────────────────
// Transfer
// ─────────────────────────────────────────────

/**
 * Request a transfer to a beneficiary.
 * `transferId` MUST be deterministic per Payout (e.g. `payout_${payoutId}`) so
 * retries don't double-pay. Cashfree treats duplicate transfer_id as
 * idempotent — we surface its existing record instead of erroring.
 *
 * @param {Object} params
 * @param {string} params.transferId
 * @param {string} params.beneId
 * @param {number} params.amount - In INR (numeric, 2 decimals)
 * @param {string} [params.remarks]
 * @param {string} [params.transferMode] - 'banktransfer' | 'upi' | 'imps' | 'neft' | 'rtgs' (auto if omitted)
 * @returns {Promise<Object>} Cashfree response.
 */
const requestTransfer = async ({ transferId, beneId, amount, remarks, transferMode }) => {
  const cfg = getConfig();
  const amt = Math.round(Number(amount) * 100) / 100;
  if (!Number.isFinite(amt) || amt < 1) {
    throw new Error('Invalid transfer amount');
  }
  const body = {
    transfer_id: truncate(transferId, LIMITS.TRANSFER_ID_MAX),
    transfer_amount: amt,
    transfer_currency: 'INR',
    beneficiary_details: {
      beneficiary_id: truncate(beneId, LIMITS.BENE_ID_MAX),
    },
    transfer_remarks: truncate(remarks || 'Taatom creator payout', LIMITS.TRANSFER_REMARKS_MAX),
  };
  if (transferMode) body.transfer_mode = transferMode;

  try {
    const result = await makeRequest('POST', `${cfg.baseUrl}/transfers`, body);
    logger.info(`Cashfree Payouts transfer created: ${body.transfer_id} amt=${amt}`);
    return result.data;
  } catch (error) {
    if (isDuplicate(error)) {
      logger.info(`Cashfree Payouts transfer already exists, fetching: ${body.transfer_id}`);
      const existing = await getTransferStatus(body.transfer_id);
      if (existing) return existing;
    }
    logger.error('Cashfree Payouts requestTransfer error:', error.responseData || error.message);
    throw new Error(error.responseData?.message || 'Failed to request transfer');
  }
};

const getTransferStatus = async (transferId) => {
  const cfg = getConfig();
  try {
    const url = `${cfg.baseUrl}/transfers?transfer_id=${encodeURIComponent(transferId)}`;
    const result = await makeRequest('GET', url);
    return result.data;
  } catch (error) {
    if (isMissing(error)) return null;
    logger.error('Cashfree Payouts getTransferStatus error:', error.responseData || error.message);
    throw new Error(error.responseData?.message || 'Failed to fetch transfer');
  }
};

// ─────────────────────────────────────────────
// Webhook
// ─────────────────────────────────────────────

/**
 * Verify Cashfree Payouts webhook signature.
 * Same scheme as PG: HMAC-SHA256(timestamp + rawBody, secret) → base64.
 */
const verifyWebhookSignature = (rawBody, timestamp, signature) => {
  try {
    const cfg = getConfig();
    const payload = String(timestamp || '') + String(rawBody || '');
    const expected = crypto
      .createHmac('sha256', cfg.secretKey)
      .update(payload)
      .digest('base64');
    return expected === signature;
  } catch (error) {
    logger.error('Cashfree Payouts webhook signature verification failed:', error);
    return false;
  }
};

/**
 * Map a Cashfree transfer status string to our internal Payout status.
 * Cashfree statuses: RECEIVED, APPROVED, PENDING, REJECTED, FAILED, REVERSED, SUCCESS
 */
const mapTransferStatus = (cfStatus) => {
  const s = String(cfStatus || '').toUpperCase();
  if (s === 'SUCCESS' || s === 'COMPLETED') return 'completed';
  if (s === 'FAILED' || s === 'REJECTED' || s === 'REVERSED') return 'failed';
  if (s === 'RECEIVED' || s === 'APPROVED' || s === 'PENDING' || s === 'PROCESSING') return 'processing';
  return null;
};

module.exports = {
  CashfreePayoutNotConfiguredError,
  isPayoutConfigured,
  createBeneficiary,
  getBeneficiary,
  requestTransfer,
  getTransferStatus,
  verifyWebhookSignature,
  mapTransferStatus,
  LIMITS,
};
