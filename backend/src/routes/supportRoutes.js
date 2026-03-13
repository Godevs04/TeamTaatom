const express = require('express');
const router = express.Router();
const { sendEmail } = require('../utils/brevoService');
const logger = require('../utils/logger');

/**
 * POST /api/v1/support/contact
 * Send a contact email from web/app to contact@taatom.com
 */
router.post('/contact', async (req, res) => {
  try {
    const { fullName, email, subject, message } = req.body || {};

    const trimmedEmail = typeof email === 'string' ? email.trim() : '';
    const trimmedSubject = typeof subject === 'string' ? subject.trim() : '';
    const trimmedMessage = typeof message === 'string' ? message.trim() : '';
    const trimmedName = typeof fullName === 'string' ? fullName.trim() : '';

    if (!trimmedEmail || !trimmedSubject || trimmedMessage.length < 10) {
      return res.status(400).json({
        success: false,
        error: 'Invalid payload',
      });
    }

    const safeName = trimmedName.slice(0, 120);
    const safeEmail = trimmedEmail.slice(0, 200);
    const safeSubject = trimmedSubject.slice(0, 200);
    const safeMessage = trimmedMessage.slice(0, 4000);

    const html = `
      <!DOCTYPE html>
      <html lang="en">
        <head>
          <meta charset="UTF-8" />
          <title>New Contact Message · Taatom</title>
          <style>
            body {
              margin: 0;
              padding: 24px;
              font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
              background: #0f172a;
              background: radial-gradient(circle at top left, #22c55e33, transparent 55%),
                          radial-gradient(circle at bottom right, #3b82f633, transparent 55%),
                          #020617;
            }
            .wrapper {
              max-width: 640px;
              margin: 0 auto;
            }
            .card {
              border-radius: 20px;
              background: #ffffff;
              box-shadow: 0 24px 60px rgba(15, 23, 42, 0.35);
              overflow: hidden;
            }
            .card-header {
              padding: 20px 24px;
              background: linear-gradient(135deg, #4f46e5, #06b6d4);
              color: #f9fafb;
            }
            .badge {
              display: inline-flex;
              align-items: center;
              gap: 8px;
              padding: 4px 10px;
              border-radius: 999px;
              background: rgba(15, 23, 42, 0.25);
              font-size: 11px;
              text-transform: uppercase;
              letter-spacing: 0.08em;
            }
            .badge-dot {
              width: 8px;
              height: 8px;
              border-radius: 999px;
              background: #22c55e;
            }
            h1 {
              margin: 12px 0 0;
              font-size: 22px;
              font-weight: 700;
            }
            .subtitle {
              margin-top: 6px;
              font-size: 13px;
              color: #e5e7eb;
            }
            .card-body {
              padding: 20px 24px 22px;
              background: linear-gradient(180deg, #f9fafb, #ffffff);
            }
            .meta {
              display: grid;
              grid-template-columns: minmax(0, 1.1fr) minmax(0, 0.9fr);
              gap: 10px 18px;
              margin-bottom: 18px;
              padding: 12px 14px;
              border-radius: 14px;
              background: #f3f4f6;
            }
            .meta-label {
              font-size: 11px;
              text-transform: uppercase;
              letter-spacing: 0.08em;
              color: #6b7280;
              margin-bottom: 2px;
            }
            .meta-value {
              font-size: 14px;
              color: #111827;
              font-weight: 500;
              word-break: break-word;
            }
            .message-title {
              margin: 4px 0 6px;
              font-size: 13px;
              font-weight: 600;
              color: #4b5563;
              text-transform: uppercase;
              letter-spacing: 0.08em;
            }
            .message-box {
              padding: 14px 14px 16px;
              border-radius: 14px;
              background: #ffffff;
              border: 1px solid #e5e7eb;
              box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.7);
              font-size: 14px;
              color: #111827;
              white-space: pre-line;
              line-height: 1.6;
            }
            .footer {
              padding: 12px 24px 18px;
              font-size: 11px;
              color: #6b7280;
              background: #f9fafb;
              border-top: 1px solid #e5e7eb;
            }
            .footer strong {
              color: #111827;
            }
          </style>
        </head>
        <body>
          <div class="wrapper">
            <div class="card">
              <div class="card-header">
                <div class="badge">
                  <span class="badge-dot"></span>
                  New contact message
                </div>
                <h1>Taatom Web · Contact Form</h1>
                <p class="subtitle">
                  A user submitted a new message from the contact page. Review the details below and
                  reply from your support inbox.
                </p>
              </div>
              <div class="card-body">
                <div class="meta">
                  <div>
                    <div class="meta-label">Name</div>
                    <div class="meta-value">${safeName || '—'}</div>
                  </div>
                  <div>
                    <div class="meta-label">From email</div>
                    <div class="meta-value">${safeEmail}</div>
                  </div>
                  <div>
                    <div class="meta-label">Subject</div>
                    <div class="meta-value">${safeSubject}</div>
                  </div>
                </div>
                <div class="message-title">Message</div>
                <div class="message-box">
                  ${safeMessage.replace(/</g, '&lt;').replace(/>/g, '&gt;')}
                </div>
              </div>
              <div class="footer">
                <p>
                  <strong>Tip:</strong> Reply directly to <strong>${safeEmail}</strong> from your
                  support inbox. This message was sent via the Taatom contact form.
                </p>
              </div>
            </div>
          </div>
        </body>
      </html>
    `;

    await sendEmail('contact@taatom.com', `Contact: ${safeSubject}`, html, safeMessage, 'Taatom Contact');

    return res.status(200).json({ success: true });
  } catch (error) {
    logger.error('❌ Error sending contact email:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to send message',
    });
  }
});

module.exports = router;

