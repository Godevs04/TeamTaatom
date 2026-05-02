const https = require('https');
const crypto = require('crypto');
const logger = require('../utils/logger');

class CashfreeNotConfiguredError extends Error {
  constructor(message = 'Payments are not configured on this server.') {
    super(message);
    this.name = 'CashfreeNotConfiguredError';
    this.code = 'CASHFREE_NOT_CONFIGURED';
  }
}

const trimEnv = (v) => (typeof v === 'string' ? v.trim() : '');

/** True when Cashfree API credentials are present (non-empty after trim). */
const isCashfreeConfigured = () => {
  const appId = trimEnv(process.env.CASHFREE_APP_ID);
  const secretKey = trimEnv(process.env.CASHFREE_SECRET_KEY);
  return !!(appId && secretKey);
};

const assertCashfreeConfigured = () => {
  if (!isCashfreeConfigured()) {
    throw new CashfreeNotConfiguredError(
      'Payments are not configured on this server. Set CASHFREE_APP_ID and CASHFREE_SECRET_KEY.',
    );
  }
};

// Cashfree API configuration
const getConfig = () => {
  const env = process.env.CASHFREE_ENV || 'sandbox';
  const baseUrl = env === 'production'
    ? 'https://api.cashfree.com/pg'
    : 'https://sandbox.cashfree.com/pg';

  return {
    baseUrl,
    appId: trimEnv(process.env.CASHFREE_APP_ID),
    secretKey: trimEnv(process.env.CASHFREE_SECRET_KEY),
    apiVersion: '2023-08-01',
  };
};

const getHeaders = () => {
  assertCashfreeConfigured();
  const config = getConfig();
  return {
    'Content-Type': 'application/json',
    'x-client-id': config.appId,
    'x-client-secret': config.secretKey,
    'x-api-version': config.apiVersion,
  };
};

/**
 * Helper: Make HTTPS request using Node built-in module (no axios dependency)
 * @param {string} method - HTTP method
 * @param {string} url - Full URL
 * @param {Object|null} body - Request body (for POST/PUT)
 * @returns {Promise<{status: number, data: Object}>}
 */
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
        try {
          parsed = JSON.parse(data);
        } catch {
          parsed = data;
        }
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

// ─────────────────────────────────────────────
// Plans
// ─────────────────────────────────────────────

/**
 * Create a subscription plan on Cashfree.
 * Each Connect page with a subscription price gets its own plan.
 *
 * @param {Object} params
 * @param {string} params.planId - Unique plan ID (e.g., "taatom_connect_{pageId}")
 * @param {string} params.planName - Display name
 * @param {number} params.amount - Monthly amount in INR
 * @returns {Object} Cashfree plan object
 */
const createPlan = async ({ planId, planName, amount }) => {
  const config = getConfig();
  try {
    const result = await makeRequest('POST', `${config.baseUrl}/plans`, {
      plan_id: planId,
      plan_name: planName,
      plan_type: 'PERIODIC',
      plan_currency: 'INR',
      plan_recurring_amount: amount,
      plan_max_amount: amount * 12, // Max 12 months worth
      plan_max_cycles: 0, // 0 = unlimited cycles
      plan_intervals: 1,
      plan_interval_type: 'MONTH',
      plan_note: `Subscription plan for Connect page: ${planName}`,
    });
    logger.info(`Cashfree plan created: ${planId}`);
    return result.data;
  } catch (error) {
    if (isCashfreePlanDuplicate(error)) {
      logger.info(`Cashfree plan already exists, fetching: ${planId}`);
      const existing = await getPlan(planId);
      if (existing) return existing;
    }
    logger.error('Cashfree createPlan error:', error.responseData || error.message);
    throw new Error(error.responseData?.message || 'Failed to create subscription plan');
  }
};

/**
 * Cashfree returns missing-plan as 404 OR as 4xx with body { code: 'plan_not_found', message: '...' }.
 */
function isCashfreePlanMissing(error) {
  if (!error) return false;
  if (error.status === 404) return true;
  const rd = error.responseData;
  if (rd && typeof rd === 'object') {
    if (rd.code === 'plan_not_found') return true;
    const msg = typeof rd.message === 'string' ? rd.message : '';
    if (/plan does not exist/i.test(msg)) return true;
  }
  const em = error.message || '';
  if (/plan does not exist/i.test(em)) return true;
  return false;
}

function isCashfreePlanDuplicate(error) {
  const rd = error?.responseData;
  if (!rd || typeof rd !== 'object') return false;
  if (rd.code === 'plan_already_exists' || rd.code === 'duplicate_plan_id') return true;
  const msg = (rd.message || '').toLowerCase();
  if (msg.includes('already') && msg.includes('plan')) return true;
  return false;
}

/**
 * Get a plan from Cashfree
 * @param {string} planId
 */
const getPlan = async (planId) => {
  const config = getConfig();
  try {
    const result = await makeRequest('GET', `${config.baseUrl}/plans/${planId}`);
    return result.data;
  } catch (error) {
    if (isCashfreePlanMissing(error)) {
      logger.info(`Cashfree plan not found (will create): ${planId}`);
      return null;
    }
    logger.error('Cashfree getPlan error:', error.responseData || error.message);
    throw new Error(error.responseData?.message || error.message || 'Failed to fetch plan');
  }
};

// ─────────────────────────────────────────────
// Subscriptions
// ─────────────────────────────────────────────

/**
 * Create a subscription on Cashfree for a user.
 * Returns the subscription_session_id used to open checkout.
 *
 * @param {Object} params
 * @param {string} params.subscriptionId - Unique subscription ID (e.g., "sub_{userId}_{pageId}_{timestamp}")
 * @param {string} params.planId - Cashfree plan ID
 * @param {number} params.authorizationAmount - Mandate / first-debit amount in INR (same unit as plan); must not be 0 for UPI/card
 * @param {Object} params.customer - { id, email, phone, name }
 * @param {string} params.returnUrl - URL to redirect after payment
 * @returns {Object} { subscriptionId, paymentSessionId }
 */
const createSubscription = async ({
  subscriptionId,
  planId,
  authorizationAmount,
  customer,
  returnUrl,
}) => {
  const config = getConfig();
  const authAmt = Math.round(Number(authorizationAmount));
  if (!Number.isFinite(authAmt) || authAmt < 1) {
    throw new Error('Invalid subscription authorization amount');
  }
  try {
    // API expects plan_id under plan_details (not top-level plan_id)
    const result = await makeRequest('POST', `${config.baseUrl}/subscriptions`, {
      subscription_id: subscriptionId,
      plan_details: {
        plan_id: planId,
      },
      customer_details: {
        customer_id: customer.id,
        customer_email: customer.email,
        customer_phone: customer.phone,
        customer_name: customer.name,
      },
      // 0 is invalid for UPI/card mandate flows; align with plan recurring amount (INR)
      authorization_details: {
        authorization_amount: authAmt,
        authorization_amount_refund: false,
      },
      subscription_meta: {
        return_url: returnUrl,
      },
      subscription_expiry_time: null, // No expiry — runs until cancelled
    });

    const data = result.data;
    logger.info(`Cashfree subscription created: ${subscriptionId}`);

    return {
      subscriptionId: data.subscription_id || subscriptionId,
      paymentSessionId: data.payment_session_id || data.subscription_session_id,
      status: data.subscription_status,
    };
  } catch (error) {
    logger.error('Cashfree createSubscription error:', error.responseData || error.message);
    throw new Error(error.responseData?.message || 'Failed to create subscription');
  }
};

/**
 * Get subscription details from Cashfree
 * @param {string} subscriptionId
 */
const getSubscription = async (subscriptionId) => {
  const config = getConfig();
  try {
    const result = await makeRequest('GET', `${config.baseUrl}/subscriptions/${subscriptionId}`);
    return result.data;
  } catch (error) {
    logger.error('Cashfree getSubscription error:', error.responseData || error.message);
    throw new Error('Failed to fetch subscription');
  }
};

/**
 * Cancel a subscription on Cashfree
 * @param {string} subscriptionId
 */
const cancelSubscription = async (subscriptionId) => {
  const config = getConfig();
  try {
    const result = await makeRequest('POST', `${config.baseUrl}/subscriptions/${subscriptionId}/cancel`, {
      subscription_id: subscriptionId,
      cancel_immediately: false, // Allow current period to finish
    });
    logger.info(`Cashfree subscription cancelled: ${subscriptionId}`);
    return result.data;
  } catch (error) {
    logger.error('Cashfree cancelSubscription error:', error.responseData || error.message);
    throw new Error(error.responseData?.message || 'Failed to cancel subscription');
  }
};

// ─────────────────────────────────────────────
// Webhook Verification
// ─────────────────────────────────────────────

/**
 * Verify Cashfree webhook signature
 * @param {string} rawBody - Raw request body as string
 * @param {string} timestamp - x-webhook-timestamp header
 * @param {string} signature - x-webhook-signature header
 * @returns {boolean}
 */
const verifyWebhookSignature = (rawBody, timestamp, signature) => {
  try {
    const config = getConfig();
    const payload = timestamp + rawBody;
    const expectedSignature = crypto
      .createHmac('sha256', config.secretKey)
      .update(payload)
      .digest('base64');
    return expectedSignature === signature;
  } catch (error) {
    logger.error('Webhook signature verification failed:', error);
    return false;
  }
};

module.exports = {
  CashfreeNotConfiguredError,
  isCashfreeConfigured,
  createPlan,
  getPlan,
  createSubscription,
  getSubscription,
  cancelSubscription,
  verifyWebhookSignature,
};
