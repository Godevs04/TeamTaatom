const nodemailer = require('nodemailer');

// Create transporter
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS
  }
});

// Verify transporter configuration
transporter.verify((error, success) => {
  if (error) {
    console.error('❌ Email transporter verification failed:', error);
  } else {
    console.log('✅ Email transporter is ready to send messages');
  }
});

const sendOTPEmail = async (email, resetLink, fullName) => {
  try {
    const mailOptions = {
      from: {
        name: 'Taatom App',
        address: process.env.EMAIL_USER
      },
      to: email,
      subject: 'Reset Password Taatom Account - OTP Code',
      html: `
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
              <div class="logo">📸 Taatom</div>
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
              <p>If you have any questions, contact us at support@taatom.com</p>
              <p>&copy; 2024 Taatom. All rights reserved.</p>
            </div>
          </div>
        </body>
        </html>
      `
    };

    const info = await transporter.sendMail(mailOptions);
    console.log('✅ OTP email sent successfully:', info.messageId);
    return { success: true, messageId: info.messageId };
  } catch (error) {
    console.error('❌ Error sending OTP email:', error);
    throw new Error('Failed to send OTP email');
  }
};

// Send welcome email after verification
const sendWelcomeEmail = async (email, fullName) => {
  try {
    const mailOptions = {
      from: {
        name: 'Taatom App',
        address: process.env.EMAIL_USER
      },
      to: email,
      subject: '🎉 Welcome to Taatom - Your Account is Verified!',
      html: `
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
              <div class="logo">📸 Taatom</div>
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
              <p>If you need help getting started, contact us at support@taatom.com</p>
              <p>&copy; 2024 Taatom. All rights reserved.</p>
            </div>
          </div>
        </body>
        </html>
      `
    };

    const info = await transporter.sendMail(mailOptions);
    console.log('✅ Welcome email sent successfully:', info.messageId);
    return { success: true, messageId: info.messageId };
  } catch (error) {
    console.error('❌ Error sending welcome email:', error);
    // Don't throw error for welcome email, it's not critical
    return { success: false, error: error.message };
  }
};

// Send welcome email after verification
const sendForgotPasswordMail = async (email, resetLink, fullName) => {
  try {
    const mailOptions = {
      from: {
      name: 'Taatom App',
      address: process.env.EMAIL_USER
      },
      to: email,
      subject: '🔐 Reset Your Taatom Password',
      html: `
      <!DOCTYPE html>
      <html lang="en">
      <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Reset Password</title>
      <style>
        /* ... keeping same styles ... */
      </style>
      </head>
      <body>
      <div class="container">
      <div class="header">
        <div class="logo">📸 Taatom</div>
        <h2>Reset Your Password, ${fullName}</h2>
      </div>
      
      <div class="welcome-box">
        <h3>Password Reset Link</h3>
        <a href="${resetLink}" class="reset-link">Click here to reset your password</a>
        <p>This link will expire in 10 minutes for security reasons.</p>
      </div>

      <p>If you can't click the link, open the Taatom app and enter this code:</p>
      <div style="text-align: center; padding: 15px; background: #f5f5f5; margin: 15px 0;">
        <code style="font-size: 18px; font-weight: bold;">${resetLink}</code>
      </div>

      <p>If you didn't request this reset, please ignore this email.</p>
      <p>If you need help, contact us at support@taatom.com</p>
      <p>&copy; 2024 Taatom. All rights reserved.</p>
      </div>
      </body>
      </html>
      `
    };

    const info = await transporter.sendMail(mailOptions);
    console.log('✅ Password Reset email sent successfully:', info.messageId);
    return { success: true, messageId: info.messageId };
  } catch (error) {
    console.error('❌ Error sending welcome email:', error);
    // Don't throw error for welcome email, it's not critical
    return { success: false, error: error.message };
  }
};

module.exports = {
  sendOTPEmail,
  sendWelcomeEmail,
  sendForgotPasswordMail
};
