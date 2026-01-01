const logger = require('../../utils/logger');
const { sendEmail } = require('../../utils/brevoService');

// Process email job
const processEmailJob = async (job) => {
  const { to, subject, html, text } = job.data;

  try {
    const info = await sendEmail(to, subject, html, text, 'Taatom');
    logger.info(`Email sent successfully: ${info.messageId}`);
    return { success: true, messageId: info.messageId };
  } catch (error) {
    logger.error('Error sending email:', error);
    throw error;
  }
};

module.exports = {
  processEmailJob,
};

