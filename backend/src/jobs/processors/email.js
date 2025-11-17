const nodemailer = require('nodemailer');
const logger = require('../../utils/logger');

// Get email credentials (support both EMAIL_* and SMTP_* for backward compatibility)
const emailUser = process.env.SMTP_USER || process.env.EMAIL_USER;
const emailPass = process.env.SMTP_PASS || process.env.EMAIL_PASS;
const smtpHost = process.env.SMTP_HOST || 'smtp.gmail.com';
const smtpPort = parseInt(process.env.SMTP_PORT) || 587;

// Create email transporter only if credentials are available
let transporter = null;

if (emailUser && emailPass) {
  transporter = nodemailer.createTransport({
    host: smtpHost,
    port: smtpPort,
    secure: false,
    auth: {
      user: emailUser,
      pass: emailPass,
    },
  });
  
  logger.info('Email transporter configured for background jobs');
} else {
  logger.warn('⚠️  Email credentials not found. Background email jobs will fail.');
  logger.warn('   Please set SMTP_USER/SMTP_PASS or EMAIL_USER/EMAIL_PASS in .env');
  
  // Create a dummy transporter that will fail gracefully
  transporter = {
    sendMail: async () => {
      throw new Error('Email credentials not configured. Please set SMTP_USER/SMTP_PASS or EMAIL_USER/EMAIL_PASS in .env');
    }
  };
}

// Process email job
const processEmailJob = async (job) => {
  const { to, subject, html, text } = job.data;

  try {
    const mailOptions = {
      from: process.env.SMTP_FROM || emailUser,
      to,
      subject,
      html,
      text,
    };

    const info = await transporter.sendMail(mailOptions);
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

