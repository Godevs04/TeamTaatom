const logger = require('./logger');
const { sendEmail } = require('./brevoService');

// Send downtime notification email to all users
const sendDowntimeNotificationEmail = async (userEmail, userName, scheduledDate, scheduledTime, duration, reason) => {
  try {
    const subject = '🔧 Scheduled Maintenance - Taatom';
      html: `
        <!DOCTYPE html>
        <html lang="en">
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Scheduled Maintenance</title>
          <style>
            body {
              font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
              line-height: 1.6;
              color: #333;
              max-width: 600px;
              margin: 0 auto;
              padding: 20px;
              background-color: #f4f4f4;
            }
            .container {
              background: white;
              border-radius: 10px;
              padding: 30px;
              box-shadow: 0 0 20px rgba(0,0,0,0.1);
            }
            .header {
              text-align: center;
              margin-bottom: 30px;
            }
            .logo {
              font-size: 32px;
              font-weight: bold;
              color: #4A90E2;
              margin-bottom: 10px;
            }
            .maintenance-box {
              background: linear-gradient(135deg, #FF6B6B, #FFA07A);
              color: white;
              padding: 30px;
              border-radius: 10px;
              text-align: center;
              margin: 30px 0;
            }
            .info-box {
              background: #f8f9fa;
              border-left: 4px solid #FF6B6B;
              padding: 20px;
              border-radius: 5px;
              margin: 20px 0;
            }
            .info-row {
              display: flex;
              justify-content: space-between;
              padding: 8px 0;
              border-bottom: 1px solid #e0e0e0;
            }
            .info-row:last-child {
              border-bottom: none;
            }
            .info-label {
              font-weight: bold;
              color: #555;
            }
            .info-value {
              color: #333;
            }
            .footer {
              text-align: center;
              margin-top: 30px;
              padding-top: 20px;
              border-top: 1px solid #eee;
              color: #666;
              font-size: 14px;
            }
            .warning-icon {
              font-size: 48px;
              margin-bottom: 10px;
            }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <img src="${process.env.LOGO_IMAGE || 'https://res.cloudinary.com/dcvdqhqzc/image/upload/v1756537440/bokj2vfio8cenbo6wfea.png'}" alt="Taatom Logo" style="width:80px;height:80px;margin-bottom:8px;display:block;margin-left:auto;margin-right:auto;object-fit:contain;" />
              <h2>📸 Taatom - Scheduled Maintenance</h2>
              <p>Hi ${userName},</p>
            </div>
            
            <div class="maintenance-box">
              <div class="warning-icon">🔧</div>
              <h3>System Maintenance Scheduled</h3>
              <p>${reason || "We'll be performing essential upgrades to improve your experience."}</p>
            </div>
            
            <div class="info-box">
              <h3 style="color: #FF6B6B; margin-top: 0;">Maintenance Details</h3>
              <div class="info-row">
                <span class="info-label">📅 Date:</span>
                <span class="info-value">${scheduledDate}</span>
              </div>
              <div class="info-row">
                <span class="info-label">⏰ Time:</span>
                <span class="info-value">${scheduledTime}</span>
              </div>
              <div class="info-row">
                <span class="info-label">⏱️ Duration:</span>
                <span class="info-value">${duration} minutes</span>
              </div>
            </div>
            
            <p style="text-align: center; margin: 30px 0;">
              During this time, Taatom services will be temporarily unavailable. 
              We apologize for any inconvenience and appreciate your patience.
            </p>
            
            <div style="background: #FFF3CD; border: 1px solid #FFEAA7; color: #856404; padding: 15px; border-radius: 5px; margin: 20px 0;">
              <strong>💡 What to expect:</strong>
              <ul style="margin: 10px 0; padding-left: 20px;">
                <li>The app will be unavailable during the maintenance window</li>
                <li>You'll receive a notification once we're back online</li>
                <li>All your photos and data are safe and secure</li>
              </ul>
            </div>
            
            <p style="text-align: center; color: #666;">
              Thank you for being part of the Taatom community! 🎉
            </p>
            
            <div class="footer">
              <p>If you have any questions, contact us at support@taatom.com</p>
              <p>&copy; 2026 Taatom. All rights reserved.</p>
            </div>
          </div>
        </body>
        </html>
      `;

    const info = await sendEmail(userEmail, subject, html, null, 'Taatom');
    logger.info('✅ Downtime notification email sent to', userEmail);
    return { success: true, messageId: info.messageId };
  } catch (error) {
    logger.error('❌ Error sending downtime notification email:', error);
    return { success: false, error: error.message };
  }
};

// Send maintenance completion email
const sendMaintenanceCompletedEmail = async (userEmail, userName) => {
  try {
    const subject = '✅ Maintenance Complete - Taatom is Back Online!';
      html: `
        <!DOCTYPE html>
        <html lang="en">
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Maintenance Complete</title>
          <style>
            body {
              font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
              line-height: 1.6;
              color: #333;
              max-width: 600px;
              margin: 0 auto;
              padding: 20px;
              background-color: #f4f4f4;
            }
            .container {
              background: white;
              border-radius: 10px;
              padding: 30px;
              box-shadow: 0 0 20px rgba(0,0,0,0.1);
            }
            .header {
              text-align: center;
              margin-bottom: 30px;
            }
            .logo {
              font-size: 32px;
              font-weight: bold;
              color: #4A90E2;
              margin-bottom: 10px;
            }
            .success-box {
              background: linear-gradient(135deg, #50C878, #4A90E2);
              color: white;
              padding: 30px;
              border-radius: 10px;
              text-align: center;
              margin: 30px 0;
            }
            .success-icon {
              font-size: 64px;
              margin-bottom: 15px;
            }
            .updates-box {
              background: #f8f9fa;
              border-left: 4px solid #50C878;
              padding: 20px;
              border-radius: 5px;
              margin: 20px 0;
            }
            .feature {
              padding: 12px;
              margin: 8px 0;
              background: white;
              border-radius: 5px;
              border-left: 3px solid #4A90E2;
            }
            .footer {
              text-align: center;
              margin-top: 30px;
              padding-top: 20px;
              border-top: 1px solid #eee;
              color: #666;
              font-size: 14px;
            }
            .cta-button {
              display: inline-block;
              background: linear-gradient(135deg, #50C878, #4A90E2);
              color: white;
              padding: 12px 24px;
              text-decoration: none;
              border-radius: 5px;
              font-weight: bold;
              margin: 20px 0;
            }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <img src="${process.env.LOGO_IMAGE || 'https://res.cloudinary.com/dcvdqhqzc/image/upload/v1756537440/bokj2vfio8cenbo6wfea.png'}" alt="Taatom Logo" style="width:80px;height:80px;margin-bottom:8px;display:block;margin-left:auto;margin-right:auto;object-fit:contain;" />
              <h2>📸 Taatom - We're Back!</h2>
              <p>Hi ${userName},</p>
            </div>
            
            <div class="success-box">
              <div class="success-icon">✅</div>
              <h3 style="margin: 10px 0;">Maintenance Complete!</h3>
              <p style="margin: 0;">We've successfully completed the upgrade.</p>
            </div>
            
            <div class="updates-box">
              <h3 style="color: #50C878; margin-top: 0;">🎉 What's New</h3>
              <div class="feature">
                <strong>🚀 Performance Improvements</strong>
                <p style="margin: 5px 0 0 0; color: #666; font-size: 14px;">
                  Faster loading times and smoother experience
                </p>
              </div>
              <div class="feature">
                <strong>🔒 Enhanced Security</strong>
                <p style="margin: 5px 0 0 0; color: #666; font-size: 14px;">
                  Better protection for your photos and personal data
                </p>
              </div>
              <div class="feature">
                <strong>✨ Bug Fixes</strong>
                <p style="margin: 5px 0 0 0; color: #666; font-size: 14px;">
                  Resolved issues for a more stable app
                </p>
              </div>
            </div>
            
            <p style="text-align: center; margin: 30px 0;">
              Thank you for your patience during the maintenance window!
            </p>
            
            <div style="text-align: center;">
              <a href="#" class="cta-button">🎯 Open Taatom App</a>
            </div>
            
            <div class="footer">
              <p>If you have any questions, contact us at support@taatom.com</p>
              <p>&copy; 2026 Taatom. All rights reserved.</p>
            </div>
          </div>
        </body>
        </html>
      `;

    const info = await sendEmail(userEmail, subject, html, null, 'Taatom');
    logger.info('✅ Maintenance completion email sent to', userEmail);
    return { success: true, messageId: info.messageId };
  } catch (error) {
    logger.error('❌ Error sending maintenance completion email:', error);
    return { success: false, error: error.message };
  }
};

module.exports = {
  sendDowntimeNotificationEmail,
  sendMaintenanceCompletedEmail
};

