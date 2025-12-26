/**
 * Brevo (formerly Sendinblue) Email Service
 * 
 * Uses Brevo API for email sending - perfect for serverless platforms
 * that block SMTP ports.
 */

const SibApiV3Sdk = require('@sendinblue/client');
const logger = require('./logger');

// Initialize Brevo API client
const brevoApiKey = process.env.BREVO_API_KEY;
const smtpFrom = process.env.SMTP_FROM || 'contact@taatom.com';

let apiInstance = null;
let isConfigured = false;

if (brevoApiKey) {
  // Trim whitespace that might cause issues
  const trimmedKey = brevoApiKey.trim();
  
  // Validate API key format (Brevo keys are typically long alphanumeric strings)
  if (trimmedKey.length < 30) {
    logger.warn(`⚠️  BREVO_API_KEY appears to be too short (${trimmedKey.length} chars).`);
    logger.warn('   Brevo API keys are typically 40+ characters long.');
    logger.warn('   Please verify your API key is complete and correct.');
    logger.warn('   Get your full API key from: https://app.brevo.com/settings/keys/api');
  }
  
  try {
    apiInstance = new SibApiV3Sdk.TransactionalEmailsApi();
    apiInstance.setApiKey(SibApiV3Sdk.TransactionalEmailsApiApiKeys.apiKey, trimmedKey);
    isConfigured = true;
    // Log configuration status (mask API key for security)
    const maskedKey = trimmedKey.length > 8 
      ? `${trimmedKey.substring(0, 4)}...${trimmedKey.substring(trimmedKey.length - 4)}`
      : '***';
    logger.info(`✅ Brevo email service configured (API Key: ${maskedKey}, From: ${smtpFrom})`);
  } catch (error) {
    logger.error('❌ Failed to initialize Brevo client:', error.message);
    isConfigured = false;
  }
} else {
  logger.warn('⚠️  BREVO_API_KEY not found. Email functionality disabled.');
  logger.warn('   Please set BREVO_API_KEY in your environment variables.');
  logger.warn('   Check your .env file in the backend directory.');
  logger.warn('   Example: BREVO_API_KEY=d2K7bZEGX0mqagjA');
}

/**
 * Send email using Brevo API
 * @param {string} to - Recipient email address
 * @param {string} subject - Email subject
 * @param {string} html - HTML email content
 * @param {string} text - Plain text email content (optional)
 * @param {string} fromName - Sender name (optional, defaults to "TeamTaatom")
 * @returns {Promise<Object>} - Success response with messageId
 */
const sendEmail = async (to, subject, html, text = null, fromName = 'TeamTaatom') => {
  if (!isConfigured || !apiInstance) {
    throw new Error('Brevo email service not configured. Please set BREVO_API_KEY in environment variables.');
  }

  if (!smtpFrom) {
    throw new Error('SMTP_FROM not configured. Please set SMTP_FROM in environment variables.');
  }

  try {
    const sendSmtpEmail = new SibApiV3Sdk.SendSmtpEmail();
    
    sendSmtpEmail.subject = subject;
    sendSmtpEmail.htmlContent = html;
    if (text) {
      sendSmtpEmail.textContent = text;
    }
    
    sendSmtpEmail.sender = {
      name: fromName,
      email: smtpFrom
    };
    
    sendSmtpEmail.to = [{
      email: to
    }];

    const result = await apiInstance.sendTransacEmail(sendSmtpEmail);
    
    logger.info('✅ Email sent via Brevo:', result.messageId);
    return {
      success: true,
      messageId: result.messageId,
      service: 'brevo'
    };
  } catch (error) {
    // Extract detailed error message from Brevo API response
    let errorMessage = error.message || 'Unknown error';
    let errorCode = 'UNKNOWN';
    
    if (error.response && error.response.body) {
      const errorBody = error.response.body;
      errorMessage = errorBody.message || errorMessage;
      errorCode = errorBody.code || errorCode;
      
      logger.error('❌ Brevo API error:', {
        code: errorCode,
        message: errorMessage,
        status: error.response.status,
        details: errorBody
      });
      
      // Provide user-friendly error messages
      if (errorCode === 'unauthorized' || errorMessage.includes('Key not found') || errorMessage.includes('Invalid')) {
        errorMessage = 'Brevo API key is invalid or not found. Please check BREVO_API_KEY in your .env file.';
        logger.error('💡 Troubleshooting:');
        logger.error('   1. Verify BREVO_API_KEY is set in backend/.env file');
        logger.error('   2. Check that the API key is correct and complete');
        logger.error('   3. Ensure there are no extra spaces, quotes, or newlines around the key');
        logger.error('   4. Verify the API key in your Brevo dashboard: https://app.brevo.com/settings/keys/api');
        logger.error('   5. Make sure the API key has "Send emails" permission');
        logger.error('   6. Restart the server after updating .env file');
        
        // Show current key status (masked)
        const currentKey = process.env.BREVO_API_KEY;
        if (currentKey) {
          const trimmed = currentKey.trim();
          const masked = trimmed.length > 8 
            ? `${trimmed.substring(0, 4)}...${trimmed.substring(trimmed.length - 4)}`
            : '***';
          logger.error(`   Current key in env: ${masked} (length: ${trimmed.length})`);
          if (trimmed.length < 30) {
            logger.error('   ⚠️  WARNING: API key seems too short. Brevo keys are usually 40+ characters.');
            logger.error('   💡 The key might be incomplete. Get the full key from Brevo dashboard.');
          }
        } else {
          logger.error('   ⚠️  BREVO_API_KEY not found in process.env');
          logger.error('   💡 Make sure .env file is in the backend/ directory');
          logger.error('   💡 Restart the server after adding BREVO_API_KEY to .env');
        }
      }
    } else {
      logger.error('❌ Error sending email via Brevo:', errorMessage);
      if (error.stack) {
        logger.error('Stack trace:', error.stack);
      }
    }
    
    throw new Error(`Failed to send email: ${errorMessage}`);
  }
};

module.exports = {
  sendEmail,
  isConfigured,
  smtpFrom
};

