const logger = require('./logger');
const { sendEmail } = require('./brevoService');

const sendOTPEmail = async (email, resetLink, fullName) => {
  try {
    const subject = '🔐 Verify Your Taatom Account - OTP Code';
    const html = `
        <!DOCTYPE html>
        <html lang="en">
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Verify Your Account</title>
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
            .otp-box {
              background: linear-gradient(135deg, #4A90E2, #50C878);
              color: white;
              padding: 20px;
              border-radius: 10px;
              text-align: center;
              margin: 30px 0;
            }
            .otp-code {
              font-size: 36px;
              font-weight: bold;
              letter-spacing: 8px;
              margin: 10px 0;
            }
            .warning {
              background: #FFF3CD;
              border: 1px solid #FFEAA7;
              color: #856404;
              padding: 15px;
              border-radius: 5px;
              margin: 20px 0;
            }
            .footer {
              text-align: center;
              margin-top: 30px;
              padding-top: 20px;
              border-top: 1px solid #eee;
              color: #666;
              font-size: 14px;
            }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <img src="${process.env.LOGO_IMAGE || 'https://res.cloudinary.com/dcvdqhqzc/image/upload/v1756537440/bokj2vfio8cenbo6wfea.png'}" alt="Taatom Logo" style="width:80px;height:80px;margin-bottom:8px;display:block;margin-left:auto;margin-right:auto;object-fit:contain;" />
              <h2>Welcome to Taatom!</h2>
              <p>Hi ${fullName}, please verify your account to get started.</p>
            </div>
            
            <div class="otp-box">
              <h3>Your Verification Code</h3>
              <div class="otp-code">${resetLink}</div>
              <p>This code will expire in 10 minutes</p>
            </div>
            
            <div class="warning">
              <strong>⚠️ Security Notice:</strong>
              <ul style="margin: 10px 0; padding-left: 20px;">
                <li>Never share this code with anyone</li>
                <li>Taatom will never ask for your OTP via phone or email</li>
                <li>If you didn't request this code, please ignore this email</li>
              </ul>
            </div>
            
            <p>Enter this code in the Taatom app to verify your account and start sharing your amazing photos with the world!</p>
            
            <div class="footer">
              <p>If you have any questions, contact us at contact@taatom.com</p>
              <p>&copy; 2026 Taatom. All rights reserved.</p>
            </div>
          </div>
        </body>
        </html>
      `;

    const info = await sendEmail(email, subject, html, null, 'Taatom App');
    logger.info('OTP email sent successfully:', info.messageId);
    return { success: true, messageId: info.messageId };
  } catch (error) {
    logger.error('Error sending OTP email:', error);
    throw new Error('Failed to send OTP email');
  }
};

// Send welcome email after verification
const sendWelcomeEmail = async (email, fullName) => {
  try {
    const subject = '🎉 Welcome to Taatom - Your Account is Verified!';
    const html = `
        <!DOCTYPE html>
        <html lang="en">
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Welcome to Taatom</title>
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
            .welcome-box {
              background: linear-gradient(135deg, #4A90E2, #50C878);
              color: white;
              padding: 30px;
              border-radius: 10px;
              text-align: center;
              margin: 30px 0;
            }
            .feature {
              padding: 15px;
              margin: 10px 0;
              border-left: 4px solid #4A90E2;
              background: #f8f9fa;
            }
            .footer {
              text-align: center;
              margin-top: 30px;
              padding-top: 20px;
              border-top: 1px solid #eee;
              color: #666;
              font-size: 14px;
            }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <img src="${process.env.LOGO_IMAGE || 'https://res.cloudinary.com/dcvdqhqzc/image/upload/v1756537440/bokj2vfio8cenbo6wfea.png'}" alt="Taatom Logo" style="width:80px;height:80px;margin-bottom:8px;display:block;margin-left:auto;margin-right:auto;object-fit:contain;" />
              <h2>🎉 Welcome to Taatom, ${fullName}!</h2>
            </div>
            
            <div class="welcome-box">
              <h3>Your account is now verified!</h3>
              <p>You're all set to start sharing your amazing photos with the world.</p>
            </div>
            
            <h3>What you can do now:</h3>
            
            <div class="feature">
              <strong>📱 Share Photos:</strong> Upload your favorite moments with location and captions
            </div>
            
            <div class="feature">
              <strong>🌍 Explore Feed:</strong> Discover amazing photos from users around the world
            </div>
            
            <div class="feature">
              <strong>❤️ Engage:</strong> Like and comment on posts that inspire you
            </div>
            
            <div class="feature">
              <strong>👥 Connect:</strong> Follow other users and build your network
            </div>
            
            <div class="feature">
              <strong>🗺️ Track Locations:</strong> View all your posted locations on your personal world map
            </div>
            
            <p style="text-align: center; margin: 30px 0;">
              <strong>Ready to start your Taatom journey? Open the app and share your first photo!</strong>
            </p>
            
            <div class="footer">
              <p>If you need help getting started, contact us at contact@taatom.com</p>
              <p>&copy; 2026 Taatom. All rights reserved.</p>
            </div>
          </div>
        </body>
        </html>
      `;

    const info = await sendEmail(email, subject, html, null, 'Taatom App');
    logger.info('✅ Welcome email sent successfully:', info.messageId);
    return { success: true, messageId: info.messageId };
  } catch (error) {
    logger.error('❌ Error sending welcome email:', error);
    // Don't throw error for welcome email, it's not critical
    return { success: false, error: error.message };
  }
};

// Send welcome email after verification
const sendForgotPasswordMail = async (email, token, fullName) => {
  try {
    const subject = '🔐 Taatom Password Reset Code';
    const html = `
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Password Reset Code</title>
        <style>
          * { margin: 0; padding: 0; box-sizing: border-box; }
          body { 
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: #222; 
            font-family: 'Segoe UI', -apple-system, BlinkMacSystemFont, 'Roboto', 'Helvetica Neue', Arial, sans-serif; 
            margin: 0; 
            padding: 20px;
            line-height: 1.6;
          }
          .email-wrapper {
            max-width: 600px;
            margin: 0 auto;
            background: #ffffff;
            border-radius: 24px;
            overflow: hidden;
            box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3), 0 0 0 1px rgba(255, 255, 255, 0.1);
          }
          .header-gradient {
            background: linear-gradient(135deg, #4A90E2 0%, #50C878 100%);
            padding: 40px 32px;
            text-align: center;
            position: relative;
            overflow: hidden;
          }
          .header-gradient::before {
            content: '';
            position: absolute;
            top: -50%;
            left: -50%;
            width: 200%;
            height: 200%;
            background: radial-gradient(circle, rgba(255,255,255,0.1) 0%, transparent 70%);
            animation: pulse 3s ease-in-out infinite;
          }
          @keyframes pulse {
            0%, 100% { opacity: 0.3; transform: scale(1); }
            50% { opacity: 0.5; transform: scale(1.1); }
          }
          .logo-container {
            position: relative;
            z-index: 1;
          }
          .logo-img {
            width: 100px;
            height: 100px;
            margin: 0 auto 16px;
            display: block;
            border-radius: 20px;
            box-shadow: 0 8px 24px rgba(0, 0, 0, 0.2);
            background: rgba(255, 255, 255, 0.2);
            padding: 8px;
          }
          .logo-text {
            font-size: 36px;
            font-weight: 800;
            color: #ffffff;
            text-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
            letter-spacing: -0.5px;
          }
          .content {
            padding: 48px 40px;
            background: #ffffff;
          }
          .headline {
            text-align: center;
            font-size: 32px;
            font-weight: 800;
            color: #1a1a1a;
            margin-bottom: 12px;
            letter-spacing: -0.5px;
            background: linear-gradient(135deg, #4A90E2 0%, #50C878 100%);
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
            background-clip: text;
          }
          .greeting {
            text-align: center;
            font-size: 20px;
            font-weight: 600;
            color: #4A90E2;
            margin-bottom: 24px;
          }
          .message-box {
            background: linear-gradient(135deg, #f8f9ff 0%, #f0f7ff 100%);
            border-left: 4px solid #4A90E2;
            border-radius: 12px;
            padding: 24px;
            margin: 32px 0;
            box-shadow: 0 4px 12px rgba(74, 144, 226, 0.08);
          }
          .message {
            font-size: 16px;
            color: #333;
            line-height: 1.8;
            margin-bottom: 16px;
          }
          .message strong {
            color: #4A90E2;
            font-weight: 600;
          }
          .otp-container {
            text-align: center;
            margin: 40px 0;
          }
          .otp-label {
            font-size: 14px;
            color: #666;
            text-transform: uppercase;
            letter-spacing: 1px;
            margin-bottom: 12px;
            font-weight: 600;
          }
          .otp-box {
            background: linear-gradient(135deg, #4A90E2 0%, #50C878 100%);
            border-radius: 16px;
            padding: 32px 24px;
            margin: 24px auto;
            max-width: 400px;
            box-shadow: 0 12px 32px rgba(74, 144, 226, 0.3), inset 0 1px 0 0 rgba(255, 255, 255, 0.2);
            position: relative;
            overflow: hidden;
          }
          .otp-box::before {
            content: '';
            position: absolute;
            top: -50%;
            left: -50%;
            width: 200%;
            height: 200%;
            background: radial-gradient(circle, rgba(255,255,255,0.15) 0%, transparent 70%);
            animation: shimmer 2s ease-in-out infinite;
          }
          @keyframes shimmer {
            0%, 100% { opacity: 0.3; transform: translate(-50%, -50%) rotate(0deg); }
            50% { opacity: 0.6; transform: translate(-50%, -50%) rotate(180deg); }
          }
          .otp-code {
            font-size: 48px;
            font-weight: 800;
            letter-spacing: 12px;
            color: #ffffff;
            text-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
            position: relative;
            z-index: 1;
            font-family: 'Courier New', monospace;
            margin: 16px 0;
          }
          .otp-expiry {
            color: rgba(255, 255, 255, 0.9);
            font-size: 14px;
            margin-top: 12px;
            position: relative;
            z-index: 1;
          }
          .security-notice {
            background: #fff3cd;
            border: 2px solid #ffc107;
            border-radius: 12px;
            padding: 20px;
            margin: 32px 0;
            display: flex;
            align-items: flex-start;
            gap: 12px;
          }
          .security-icon {
            font-size: 24px;
            flex-shrink: 0;
          }
          .security-text {
            font-size: 14px;
            color: #856404;
            line-height: 1.6;
          }
          .security-text strong {
            color: #856404;
            font-weight: 600;
          }
          .instructions-box {
            background: #f8f9fa;
            border-radius: 12px;
            padding: 24px;
            margin: 32px 0;
          }
          .instructions-title {
            font-size: 16px;
            font-weight: 600;
            color: #4A90E2;
            margin-bottom: 12px;
          }
          .instructions-list {
            list-style: none;
            padding: 0;
          }
          .instructions-list li {
            padding: 8px 0;
            padding-left: 24px;
            position: relative;
            color: #333;
            font-size: 14px;
            line-height: 1.6;
          }
          .instructions-list li::before {
            content: '✓';
            position: absolute;
            left: 0;
            color: #50C878;
            font-weight: bold;
            font-size: 16px;
          }
          .divider {
            height: 1px;
            background: linear-gradient(90deg, transparent 0%, #e0e0e0 50%, transparent 100%);
            margin: 40px 0;
          }
          .footer {
            text-align: center;
            color: #888;
            font-size: 14px;
            padding: 24px 40px;
            background: #f8f9fa;
          }
          .footer-links {
            margin-bottom: 12px;
          }
          .footer-link {
            color: #4A90E2;
            text-decoration: none;
            font-weight: 500;
            margin: 0 8px;
          }
          .footer-link:hover {
            text-decoration: underline;
          }
          .footer-copyright {
            color: #999;
            font-size: 12px;
            margin-top: 12px;
          }
          @media only screen and (max-width: 600px) {
            .content { padding: 32px 24px; }
            .header-gradient { padding: 32px 24px; }
            .headline { font-size: 26px; }
            .otp-code { font-size: 36px; letter-spacing: 8px; }
            .footer { padding: 20px 24px; }
          }
        </style>
      </head>
      <body>
        <div class="email-wrapper">
          <div class="header-gradient">
            <div class="logo-container">
              <img src="${process.env.LOGO_IMAGE || 'https://res.cloudinary.com/dcvdqhqzc/image/upload/v1756537440/bokj2vfio8cenbo6wfea.png'}" alt="Taatom Logo" class="logo-img" />
              <div class="logo-text">Taatom</div>
            </div>
          </div>
          
          <div class="content">
            <h1 class="headline">Password Reset Request</h1>
            <p class="greeting">Hi ${fullName},</p>
            
            <div class="message-box">
              <p class="message">
                We received a request to reset your Taatom account password. Use the code below to complete the reset process.
              </p>
            </div>
            
            <div class="otp-container">
              <div class="otp-label">Your Password Reset Code</div>
              <div class="otp-box">
                <div class="otp-code">${token}</div>
                <div class="otp-expiry">⏱️ This code expires in 30 minutes</div>
              </div>
            </div>
            
            <div class="instructions-box">
              <div class="instructions-title">📱 How to use this code:</div>
              <ul class="instructions-list">
                <li>Open the Taatom app on your device</li>
                <li>Navigate to the Reset Password page</li>
                <li>Enter your email address and this 6-digit code</li>
                <li>Create your new secure password</li>
              </ul>
            </div>
            
            <div class="security-notice">
              <div class="security-icon">⚠️</div>
              <div class="security-text">
                <strong>Security Notice:</strong> Never share this code with anyone. Taatom will never ask for your password reset code via phone, email, or any other method. If you did not request this password reset, please ignore this email and contact our support team immediately.
              </div>
            </div>
            
            <div class="divider"></div>
            
            <div class="footer">
              <div class="footer-links">
                Need help? <a href="mailto:contact@taatom.com" class="footer-link">contact@taatom.com</a>
              </div>
              <div class="footer-copyright">
                &copy; 2026 Taatom. All rights reserved.<br>
                This is an automated security notification. Please do not reply to this email.
              </div>
            </div>
          </div>
        </div>
      </body>
      </html>
      `;

    const info = await sendEmail(email, subject, html, null, 'Taatom App');
    logger.info('✅ Password Reset email sent successfully:', info.messageId);
    return { success: true, messageId: info.messageId };
  } catch (error) {
    logger.error('❌ Error sending password reset email:', error);
    return { success: false, error: error.message };
  }
};

// Send password reset confirmation email
const sendPasswordResetConfirmationEmail = async (email, fullName) => {
  try {
    const subject = '✅ Your Taatom Password Has Been Reset';
    const html = `
        <!DOCTYPE html>
        <html lang="en">
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Password Reset Confirmation</title>
          <style>
            * { margin: 0; padding: 0; box-sizing: border-box; }
            body { 
              background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
              color: #222; 
              font-family: 'Segoe UI', -apple-system, BlinkMacSystemFont, 'Roboto', 'Helvetica Neue', Arial, sans-serif; 
              margin: 0; 
              padding: 20px;
              line-height: 1.6;
            }
            .email-wrapper {
              max-width: 600px;
              margin: 0 auto;
              background: #ffffff;
              border-radius: 24px;
              overflow: hidden;
              box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3), 0 0 0 1px rgba(255, 255, 255, 0.1);
            }
            .header-gradient {
              background: linear-gradient(135deg, #4A90E2 0%, #50C878 100%);
              padding: 40px 32px;
              text-align: center;
              position: relative;
              overflow: hidden;
            }
            .header-gradient::before {
              content: '';
              position: absolute;
              top: -50%;
              left: -50%;
              width: 200%;
              height: 200%;
              background: radial-gradient(circle, rgba(255,255,255,0.1) 0%, transparent 70%);
              animation: pulse 3s ease-in-out infinite;
            }
            @keyframes pulse {
              0%, 100% { opacity: 0.3; transform: scale(1); }
              50% { opacity: 0.5; transform: scale(1.1); }
            }
            .logo-container {
              position: relative;
              z-index: 1;
            }
            .logo-img {
              width: 100px;
              height: 100px;
              margin: 0 auto 16px;
              display: block;
              border-radius: 20px;
              box-shadow: 0 8px 24px rgba(0, 0, 0, 0.2);
              background: rgba(255, 255, 255, 0.2);
              padding: 8px;
            }
            .logo-text {
              font-size: 36px;
              font-weight: 800;
              color: #ffffff;
              text-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
              letter-spacing: -0.5px;
            }
            .content {
              padding: 48px 40px;
              background: #ffffff;
            }
            .success-badge {
              text-align: center;
              margin-bottom: 32px;
            }
            .success-icon-wrapper {
              display: inline-block;
              width: 80px;
              height: 80px;
              background: linear-gradient(135deg, #50C878 0%, #4A90E2 100%);
              border-radius: 50%;
              position: relative;
              box-shadow: 0 8px 24px rgba(74, 144, 226, 0.3);
              margin-bottom: 24px;
            }
            .success-icon-wrapper::after {
              content: '';
              position: absolute;
              top: 50%;
              left: 50%;
              transform: translate(-50%, -50%);
              width: 60px;
              height: 60px;
              background: rgba(255, 255, 255, 0.2);
              border-radius: 50%;
            }
            .success-check {
              position: relative;
              z-index: 2;
              font-size: 42px;
              line-height: 80px;
              color: #ffffff;
              text-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
            }
            .headline {
              text-align: center;
              font-size: 32px;
              font-weight: 800;
              color: #1a1a1a;
              margin-bottom: 12px;
              letter-spacing: -0.5px;
              background: linear-gradient(135deg, #4A90E2 0%, #50C878 100%);
              -webkit-background-clip: text;
              -webkit-text-fill-color: transparent;
              background-clip: text;
            }
            .greeting {
              text-align: center;
              font-size: 20px;
              font-weight: 600;
              color: #4A90E2;
              margin-bottom: 24px;
            }
            .message-box {
              background: linear-gradient(135deg, #f8f9ff 0%, #f0f7ff 100%);
              border-left: 4px solid #4A90E2;
              border-radius: 12px;
              padding: 24px;
              margin: 32px 0;
              box-shadow: 0 4px 12px rgba(74, 144, 226, 0.08);
            }
            .message {
              font-size: 16px;
              color: #333;
              line-height: 1.8;
              margin-bottom: 16px;
            }
            .message strong {
              color: #4A90E2;
              font-weight: 600;
            }
            .security-notice {
              background: #fff3cd;
              border: 2px solid #ffc107;
              border-radius: 12px;
              padding: 20px;
              margin: 24px 0;
              display: flex;
              align-items: flex-start;
              gap: 12px;
            }
            .security-icon {
              font-size: 24px;
              flex-shrink: 0;
            }
            .security-text {
              font-size: 14px;
              color: #856404;
              line-height: 1.6;
            }
            .security-text strong {
              color: #856404;
              font-weight: 600;
            }
            .cta-section {
              text-align: center;
              margin: 40px 0;
            }
            .cta-button {
              display: inline-block;
              background: linear-gradient(135deg, #4A90E2 0%, #50C878 100%);
              color: #ffffff;
              text-decoration: none;
              padding: 16px 40px;
              border-radius: 12px;
              font-weight: 600;
              font-size: 16px;
              box-shadow: 0 8px 24px rgba(74, 144, 226, 0.3);
              transition: transform 0.2s, box-shadow 0.2s;
            }
            .cta-button:hover {
              transform: translateY(-2px);
              box-shadow: 0 12px 32px rgba(74, 144, 226, 0.4);
            }
            .divider {
              height: 1px;
              background: linear-gradient(90deg, transparent 0%, #e0e0e0 50%, transparent 100%);
              margin: 40px 0;
            }
            .footer {
              text-align: center;
              color: #888;
              font-size: 14px;
              padding: 24px 40px;
              background: #f8f9fa;
            }
            .footer-links {
              margin-bottom: 12px;
            }
            .footer-link {
              color: #4A90E2;
              text-decoration: none;
              font-weight: 500;
              margin: 0 8px;
            }
            .footer-link:hover {
              text-decoration: underline;
            }
            .footer-copyright {
              color: #999;
              font-size: 12px;
              margin-top: 12px;
            }
            .info-grid {
              display: grid;
              grid-template-columns: 1fr 1fr;
              gap: 16px;
              margin: 32px 0;
            }
            .info-item {
              background: #f8f9fa;
              border-radius: 12px;
              padding: 20px;
              text-align: center;
            }
            .info-icon {
              font-size: 32px;
              margin-bottom: 8px;
            }
            .info-label {
              font-size: 12px;
              color: #666;
              text-transform: uppercase;
              letter-spacing: 0.5px;
              margin-bottom: 4px;
            }
            .info-value {
              font-size: 16px;
              font-weight: 600;
              color: #4A90E2;
            }
            @media only screen and (max-width: 600px) {
              .content { padding: 32px 24px; }
              .header-gradient { padding: 32px 24px; }
              .headline { font-size: 26px; }
              .info-grid { grid-template-columns: 1fr; }
              .footer { padding: 20px 24px; }
            }
          </style>
        </head>
        <body>
          <div class="email-wrapper">
            <div class="header-gradient">
              <div class="logo-container">
                <img src="${process.env.LOGO_IMAGE || 'https://res.cloudinary.com/dcvdqhqzc/image/upload/v1756537440/bokj2vfio8cenbo6wfea.png'}" alt="Taatom Logo" class="logo-img" />
                <div class="logo-text">Taatom</div>
              </div>
            </div>
            
            <div class="content">
              <div class="success-badge">
                <div class="success-icon-wrapper">
                  <div class="success-check">✓</div>
                </div>
              </div>
              
              <h1 class="headline">Password Reset Successful</h1>
              <p class="greeting">Hi ${fullName},</p>
              
              <div class="message-box">
                <p class="message">
                  Great news! Your Taatom account password has been <strong>securely reset</strong>.
                </p>
                <p class="message">
                  You can now sign in to your account using your new password and continue exploring amazing travel destinations.
                </p>
              </div>
              
              <div class="info-grid">
                <div class="info-item">
                  <div class="info-icon">🔒</div>
                  <div class="info-label">Account Status</div>
                  <div class="info-value">Secure</div>
                </div>
                <div class="info-item">
                  <div class="info-icon">✅</div>
                  <div class="info-label">Action</div>
                  <div class="info-value">Completed</div>
                </div>
              </div>
              
              <div class="security-notice">
                <div class="security-icon">⚠️</div>
                <div class="security-text">
                  <strong>Security Notice:</strong> If you did <strong>not</strong> request this password reset, please contact our support team immediately to secure your account.
                </div>
              </div>
              
              <div class="cta-section">
                <a href="#" class="cta-button" style="color: #ffffff; text-decoration: none;">Sign In to Your Account</a>
              </div>
              
              <div class="divider"></div>
              
              <div class="footer">
                <div class="footer-links">
                  Need help? <a href="mailto:contact@taatom.com" class="footer-link">contact@taatom.com</a>
                </div>
                <div class="footer-copyright">
                  &copy; 2026 Taatom. All rights reserved.<br>
                  This is an automated security notification. Please do not reply to this email.
                </div>
              </div>
            </div>
          </div>
        </body>
        </html>
      `;

    const info = await sendEmail(email, subject, html, null, 'Taatom App');
    logger.info('✅ Password reset confirmation email sent:', info.messageId);
    return { success: true, messageId: info.messageId };
  } catch (error) {
    logger.error('❌ Error sending password reset confirmation email:', error);
    return { success: false, error: error.message };
  }
};

const sendLoginNotificationEmail = async (email, fullName, device, location) => {
  try {
    const subject = '🔔 New Login Detected on Your Taatom Account';
    const html = `
        <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 600px; margin: 0 auto; background: #fff; border-radius: 10px; padding: 32px;">
          <h2 style="color: #4A90E2; margin-bottom: 24px;">New Login Detected</h2>
          <p style="font-size: 16px;">Hi <b>${fullName}</b>,</p>
          <p style="font-size: 15px; margin-bottom: 24px;">
            Your Taatom account was just signed in from a new device or location:
          </p>
          <div style="background: #f8f9fa; border-radius: 8px; padding: 20px 24px; margin-bottom: 24px;">
            <table style="width: 100%; font-size: 15px;">
              <tr>
                <td style="font-weight: bold; padding: 6px 0;">Device:</td>
                <td style="padding: 6px 0;">${device}</td>
              </tr>
              <tr>
                <td style="font-weight: bold; padding: 6px 0;">Location:</td>
                <td style="padding: 6px 0;">${location && location.trim() ? location : ' 🌏 Unknown or Local Network'}</td>
              </tr>
              <tr>
                <td style="font-weight: bold; padding: 6px 0;">Time:</td>
                <td style="padding: 6px 0;">${new Date().toLocaleString()}</td>
              </tr>
            </table>
          </div>
          <p style="font-size: 15px;">
            If this was you, you can safely ignore this email.<br>
            If you did <b>not</b> sign in, please <a href="mailto:contact@taatom.com" style="color: #4A90E2;">contact support</a> immediately and consider changing your password.
          </p>
          <p style="color: #888; font-size: 13px; margin-top: 32px;">&copy; 2026 Taatom. All rights reserved.</p>
        </div>
      `;

    const info = await sendEmail(email, subject, html, null, 'Taatom App');
    logger.info('✅ Login notification email sent:', info.messageId);
    return { success: true, messageId: info.messageId };
  } catch (error) {
    logger.error('❌ Error sending login notification email:', error);
    return { success: false, error: error.message };
  }
};

const sendSuperAdmin2FAEmail = async (email, otpCode, fullName = 'SuperAdmin') => {
  try {
    const subject = '🔐 SuperAdmin 2FA Verification Code';
    const html = `
        <!DOCTYPE html>
        <html lang="en">
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>SuperAdmin 2FA Verification</title>
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
              color: #2563EB;
              margin-bottom: 10px;
            }
            .otp-box {
              background: linear-gradient(135deg, #2563EB, #1E40AF);
              color: white;
              padding: 20px;
              border-radius: 10px;
              text-align: center;
              margin: 30px 0;
            }
            .otp-code {
              font-size: 36px;
              font-weight: bold;
              letter-spacing: 8px;
              margin: 10px 0;
            }
            .warning {
              background: #FEF3C7;
              border: 1px solid #F59E0B;
              color: #92400E;
              padding: 15px;
              border-radius: 5px;
              margin: 20px 0;
            }
            .footer {
              text-align: center;
              margin-top: 30px;
              padding-top: 20px;
              border-top: 1px solid #eee;
              color: #666;
              font-size: 14px;
            }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <div class="logo">🛡️ Taatom SuperAdmin</div>
              <h2>Two-Factor Authentication</h2>
              <p>Hi ${fullName}, please verify your SuperAdmin login.</p>
            </div>
            
            <div class="otp-box">
              <h3>Your Verification Code</h3>
              <div class="otp-code">${otpCode}</div>
              <p>This code will expire in 5 minutes</p>
            </div>
            
            <div class="warning">
              <strong>⚠️ Security Notice:</strong>
              <ul style="margin: 10px 0; padding-left: 20px;">
                <li>Never share this code with anyone</li>
                <li>This code is only valid for 5 minutes</li>
                <li>If you didn't request this login, please contact support immediately</li>
              </ul>
            </div>
            
            <p>Enter this code in the SuperAdmin dashboard to complete your login.</p>
            
            <div class="footer">
              <p>If you have any questions, contact us at contact@taatom.com</p>
              <p>&copy; 2026 Taatom. All rights reserved.</p>
            </div>
          </div>
        </body>
        </html>
      `;

    const info = await sendEmail(email, subject, html, null, 'Taatom SuperAdmin');
    logger.info('✅ SuperAdmin 2FA email sent successfully:', info.messageId);
    return { success: true, messageId: info.messageId };
  } catch (error) {
    logger.error('❌ Error sending SuperAdmin 2FA email:', error);
    throw new Error('Failed to send 2FA email');
  }
};

// SuperAdmin Login Alert Email
const sendSuperAdminLoginAlertEmail = async (email, fullName, device, location, ipAddress) => {
  try {
    const subject = '🔐 SuperAdmin Login Alert - Taatom Dashboard';
    const html = `
        <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 600px; margin: 0 auto; background: #fff; border-radius: 10px; padding: 32px; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
          <!-- Header -->
          <div style="text-align: center; margin-bottom: 32px;">
            <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 20px; border-radius: 10px; margin-bottom: 20px;">
              <h1 style="margin: 0; font-size: 24px; font-weight: bold;">🛡️ SuperAdmin Login Alert</h1>
              <p style="margin: 8px 0 0 0; opacity: 0.9;">Taatom Dashboard Access</p>
            </div>
          </div>

          <!-- Content -->
          <div style="margin-bottom: 24px;">
            <p style="font-size: 16px; color: #333; margin-bottom: 16px;">Hello <strong>${fullName}</strong>,</p>
            <p style="font-size: 15px; color: #666; margin-bottom: 20px;">
              Your SuperAdmin account has been successfully accessed. Here are the login details:
            </p>
          </div>

          <!-- Login Details Card -->
          <div style="background: linear-gradient(135deg, #f8f9fa 0%, #e9ecef 100%); border-radius: 12px; padding: 24px; margin-bottom: 24px; border-left: 4px solid #28a745;">
            <h3 style="color: #28a745; margin: 0 0 16px 0; font-size: 18px;">✅ Login Details</h3>
            <table style="width: 100%; font-size: 14px; color: #333;">
              <tr>
                <td style="font-weight: bold; padding: 8px 0; width: 120px;">👤 User:</td>
                <td style="padding: 8px 0;">${fullName}</td>
              </tr>
              <tr>
                <td style="font-weight: bold; padding: 8px 0;">📧 Email:</td>
                <td style="padding: 8px 0;">${email}</td>
              </tr>
              <tr>
                <td style="font-weight: bold; padding: 8px 0;">🖥️ Device:</td>
                <td style="padding: 8px 0;">${device}</td>
              </tr>
              <tr>
                <td style="font-weight: bold; padding: 8px 0;">🌍 Location:</td>
                <td style="padding: 8px 0;">${location && location.trim() ? location : 'Unknown or Local Network'}</td>
              </tr>
              <tr>
                <td style="font-weight: bold; padding: 8px 0;">🌐 IP Address:</td>
                <td style="padding: 8px 0; font-family: monospace; background: #f1f3f4; padding: 4px 8px; border-radius: 4px;">${ipAddress}</td>
              </tr>
              <tr>
                <td style="font-weight: bold; padding: 8px 0;">⏰ Time:</td>
                <td style="padding: 8px 0;">${new Date().toLocaleString('en-US', { 
                  timeZone: 'UTC',
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit',
                  second: '2-digit',
                  timeZoneName: 'short'
                })}</td>
              </tr>
              <tr>
                <td style="font-weight: bold; padding: 8px 0;">🔐 Security:</td>
                <td style="padding: 8px 0; color: #28a745;">✅ 2FA Verified</td>
              </tr>
            </table>
          </div>

          <!-- Security Notice -->
          <div style="background: #fff3cd; border: 1px solid #ffeaa7; border-radius: 8px; padding: 16px; margin-bottom: 24px;">
            <h4 style="color: #856404; margin: 0 0 8px 0; font-size: 16px;">🔒 Security Notice</h4>
            <p style="color: #856404; margin: 0; font-size: 14px;">
              If you did not perform this login, please immediately change your password and contact the system administrator. 
              This login was secured with two-factor authentication.
            </p>
          </div>

          <!-- Dashboard Access -->
          <div style="text-align: center; margin-bottom: 24px;">
            <a href="${process.env.SUPERADMIN_URL || (process.env.NODE_ENV === 'production' ? '' : 'http://localhost:5001')}/dashboard" 
               style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block;">
              🚀 Access Dashboard
            </a>
          </div>

          <!-- Footer -->
          <div style="border-top: 1px solid #e9ecef; padding-top: 20px; text-align: center; color: #6c757d; font-size: 12px;">
            <p style="margin: 0 0 8px 0;">This is an automated security notification from Taatom SuperAdmin System</p>
            <p style="margin: 0;">For security reasons, please do not reply to this email</p>
          </div>
        </div>
      `;

    const info = await sendEmail(email, subject, html, null, 'Taatom SuperAdmin');
    logger.info('✅ SuperAdmin login alert email sent successfully:', info.messageId);
    return { success: true, messageId: info.messageId };
  } catch (error) {
    logger.error('❌ Error sending SuperAdmin login alert email:', error);
    throw new Error('Failed to send login alert email');
  }
};

module.exports = {
  sendOTPEmail,
  sendWelcomeEmail,
  sendForgotPasswordMail,
  sendPasswordResetConfirmationEmail,
  sendLoginNotificationEmail,
  sendSuperAdmin2FAEmail,
  sendSuperAdminLoginAlertEmail,
};
