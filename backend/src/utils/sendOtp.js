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
const sendForgotPasswordMail = async (email, token, fullName) => {
  try {
    const mailOptions = {
      from: {
        name: 'Taatom App',
        address: process.env.EMAIL_USER
      },
      to: email,
      subject: '🔐 Taatom Password Reset Code',
      html: `
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Password Reset Code</title>
        <style>
          body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background: #f4f4f4; color: #333; }
          .container { background: #fff; border-radius: 10px; max-width: 500px; margin: 40px auto; padding: 32px; box-shadow: 0 0 20px rgba(0,0,0,0.08); }
          .logo { font-size: 32px; font-weight: bold; color: #4A90E2; text-align: center; margin-bottom: 10px; }
          .header { text-align: center; margin-bottom: 24px; }
          .code-box { background: linear-gradient(135deg, #4A90E2, #50C878); color: #fff; padding: 24px; border-radius: 10px; text-align: center; margin: 32px 0; }
          .reset-code { font-size: 36px; font-weight: bold; letter-spacing: 8px; margin: 10px 0; }
          .footer { text-align: center; margin-top: 32px; color: #666; font-size: 14px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="logo">📸 Taatom</div>
          <img src="${process.env.LOGO_IMAGE || 'https://res.cloudinary.com/dcvdqhqzc/image/upload/v1756537440/bokj2vfio8cenbo6wfea.png'}" alt="Taatom Logo" style="width:80px;height:80px;margin-bottom:8px;display:block;margin-left:auto;margin-right:auto;object-fit:contain;" />
          <div class="header">
            <h2>Password Reset Request</h2>
            <p>Hi ${fullName},</p>
            <p>We received a request to reset your Taatom account password.</p>
          </div>
          <div class="code-box">
            <h3>Your Password Reset Code</h3>
            <div class="reset-code">${token}</div>
            <p>This code will expire in 10 minutes.</p>
          </div>
          <p style="text-align:center;">Enter this code in the Taatom app to reset your password.</p>
          <div class="footer">
            <p>If you did not request this, you can safely ignore this email.</p>
            <p>Need help? Contact us at support@taatom.com</p>
            <p>&copy; 2024 Taatom. All rights reserved.</p>
          </div>
        </div>
      </body>
      </html>
      `
    };
    const info = await transporter.sendMail(mailOptions);
    console.log('✅ Password Reset email sent successfully:', info.messageId);
    return { success: true, messageId: info.messageId };
  } catch (error) {
    console.error('❌ Error sending password reset email:', error);
    return { success: false, error: error.message };
  }
};

// Send password reset confirmation email
const sendPasswordResetConfirmationEmail = async (email, fullName) => {
  try {
    const mailOptions = {
      from: {
        name: 'Taatom App',
        address: process.env.EMAIL_USER
      },
      to: email,
      subject: '✅ Your Taatom Password Has Been Reset',
      html: `
        <!DOCTYPE html>
        <html lang="en">
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Password Reset Confirmation</title>
          <style>
            body { background: #f4f8fb; color: #222; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; margin: 0; }
            .container { background: #fff; border-radius: 16px; max-width: 480px; margin: 48px auto; padding: 40px 32px 32px 32px; box-shadow: 0 8px 32px rgba(74,144,226,0.10), 0 1.5px 6px rgba(80,200,120,0.08); }
            .logo { font-size: 32px; font-weight: bold; color: #4A90E2; text-align: center; margin-bottom: 8px; }
            .success-icon { text-align: center; margin-bottom: 18px; }
            .success-icon span { display: inline-block; background: linear-gradient(135deg, #4A90E2, #50C878); border-radius: 50%; width: 64px; height: 64px; line-height: 64px; font-size: 36px; color: #fff; }
            .headline { text-align: center; font-size: 26px; font-weight: 700; color: #222; margin-bottom: 8px; }
            .greeting { text-align: center; font-size: 18px; color: #4A90E2; margin-bottom: 18px; }
            .message { text-align: center; font-size: 16px; color: #333; margin-bottom: 24px; }
            .divider { border-top: 1px solid #e6eaf0; margin: 32px 0 16px 0; }
            .footer { text-align: center; color: #888; font-size: 13px; margin-top: 8px; }
            .support { color: #4A90E2; text-decoration: none; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="logo">📸 Taatom</div>
            <img src="${process.env.LOGO_IMAGE || 'https://res.cloudinary.com/dcvdqhqzc/image/upload/v1756537440/bokj2vfio8cenbo6wfea.png'}" alt="Taatom Logo" style="width:80px;height:80px;margin-bottom:8px;display:block;margin-left:auto;margin-right:auto;object-fit:contain;" />
            <div class="success-icon">
              <span>✔️</span>
            </div>
            <div class="headline">Password Reset Successful</div>
            <div class="greeting">Hi ${fullName},</div>
            <div class="message">
              Your password for your Taatom account has been <b>securely reset</b>.<br>
              You can now sign in with your new password.<br><br>
              If you did <b>not</b> request this change, please <a href="mailto:support@taatom.com" class="support">contact our support team</a> immediately.
            </div>
            <div class="divider"></div>
            <div class="footer">
              &copy; 2024 Taatom. All rights reserved.<br>
              Need help? <a href="mailto:support@taatom.com" class="support">support@taatom.com</a>
            </div>
          </div>
        </body>
        </html>
      `
    };
    const info = await transporter.sendMail(mailOptions);
    console.log('✅ Password reset confirmation email sent:', info.messageId);
    return { success: true, messageId: info.messageId };
  } catch (error) {
    console.error('❌ Error sending password reset confirmation email:', error);
    return { success: false, error: error.message };
  }
};

const sendLoginNotificationEmail = async (email, fullName, device, location) => {
  try {
    const mailOptions = {
      from: {
        name: 'Taatom App',
        address: process.env.EMAIL_USER
      },
      to: email,
      subject: '🔔 New Login Detected on Your Taatom Account',
      html: `
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
            If you did <b>not</b> sign in, please <a href="mailto:support@taatom.com" style="color: #4A90E2;">contact support</a> immediately and consider changing your password.
          </p>
          <p style="color: #888; font-size: 13px; margin-top: 32px;">&copy; 2024 Taatom. All rights reserved.</p>
        </div>
      `
    };
    const info = await transporter.sendMail(mailOptions);
    console.log('✅ Login notification email sent:', info.messageId);
    return { success: true, messageId: info.messageId };
  } catch (error) {
    console.error('❌ Error sending login notification email:', error);
    return { success: false, error: error.message };
  }
};

module.exports = {
  sendOTPEmail,
  sendWelcomeEmail,
  sendForgotPasswordMail,
  sendPasswordResetConfirmationEmail,
  sendLoginNotificationEmail,
};
