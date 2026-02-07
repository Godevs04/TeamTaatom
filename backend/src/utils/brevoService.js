/**
 * Brevo (formerly Sendinblue) Email Service
 *
 * Uses Brevo REST API (no SDK) for email sending - avoids deprecated
 * request/form-data/qs/tough-cookie dependency chain.
 * POST https://api.brevo.com/v3/smtp/email
 */

const logger = require('./logger');

const BREVO_API_URL = 'https://api.brevo.com/v3/smtp/email';

const brevoApiKey = process.env.BREVO_API_KEY;
const smtpFrom = process.env.SMTP_FROM || 'contact@taatom.com';

let apiKeyTrimmed = null;
let isConfigured = false;

if (brevoApiKey) {
  apiKeyTrimmed = brevoApiKey.trim();

  if (apiKeyTrimmed.length < 30) {
    logger.warn(`⚠️  BREVO_API_KEY appears to be too short (${apiKeyTrimmed.length} chars).`);
    logger.warn('   Brevo API keys are typically 40+ characters long.');
    logger.warn('   Get your full API key from: https://app.brevo.com/settings/keys/api');
  }

  isConfigured = true;
  const maskedKey =
    apiKeyTrimmed.length > 8
      ? `${apiKeyTrimmed.substring(0, 4)}...${apiKeyTrimmed.substring(apiKeyTrimmed.length - 4)}`
      : '***';
  logger.info(`✅ Brevo email service configured (API Key: ${maskedKey}, From: ${smtpFrom})`);
} else {
  logger.warn('⚠️  BREVO_API_KEY not found. Email functionality disabled.');
  logger.warn('   Set BREVO_API_KEY in your environment (e.g. backend/.env).');
}

/**
 * Send email via Brevo REST API
 * @param {string} to - Recipient email address
 * @param {string} subject - Email subject
 * @param {string} html - HTML email content
 * @param {string} text - Plain text email content (optional)
 * @param {string} fromName - Sender name (optional, defaults to "Taatom")
 * @returns {Promise<Object>} - Success response with messageId
 */
const sendEmail = async (to, subject, html, text = null, fromName = 'Taatom') => {
  if (!isConfigured || !apiKeyTrimmed) {
    throw new Error('Brevo email service not configured. Please set BREVO_API_KEY in environment variables.');
  }

  if (!smtpFrom) {
    throw new Error('SMTP_FROM not configured. Please set SMTP_FROM in environment variables.');
  }

  const body = {
    sender: { name: fromName, email: smtpFrom },
    to: [{ email: to }],
    subject,
    htmlContent: html
  };
  if (text) body.textContent = text;

  const response = await fetch(BREVO_API_URL, {
    method: 'POST',
    headers: {
      'api-key': apiKeyTrimmed,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(body)
  });

  const responseData = await response.json().catch(() => ({}));

  if (response.ok) {
    const messageId = responseData.messageId || null;
    if (messageId) {
      logger.info(`✅ Email sent via Brevo to ${to}: ${messageId}`);
    } else {
      if (process.env.NODE_ENV === 'development') {
        logger.debug('Brevo response:', JSON.stringify(responseData, null, 2));
      }
      logger.info(`✅ Email sent via Brevo to ${to} (messageId not in response)`);
    }
    return { success: true, messageId, service: 'brevo' };
  }

  const errorMessage = responseData.message || response.message || 'Unknown error';
  const errorCode = responseData.code || 'UNKNOWN';

  logger.error('❌ Brevo API error:', {
    code: errorCode,
    message: errorMessage,
    status: response.status,
    details: responseData
  });

  if (
    errorCode === 'unauthorized' ||
    errorMessage.includes('Key not found') ||
    errorMessage.includes('Invalid')
  ) {
    logger.error('💡 Check BREVO_API_KEY in backend/.env and Brevo dashboard: https://app.brevo.com/settings/keys/api');
    const currentKey = process.env.BREVO_API_KEY;
    if (currentKey) {
      const trimmed = currentKey.trim();
      const masked =
        trimmed.length > 8 ? `${trimmed.substring(0, 4)}...${trimmed.substring(trimmed.length - 4)}` : '***';
      logger.error(`   Current key: ${masked} (length: ${trimmed.length})`);
    }
  }

  throw new Error(`Failed to send email: ${errorMessage}`);
};

module.exports = {
  sendEmail,
  isConfigured,
  smtpFrom
};
