const ShortUrl = require('../models/ShortUrl');
const Post = require('../models/Post');
const logger = require('../utils/logger');
const { sendError, sendSuccess } = require('../utils/errorCodes');

// Base62 characters for URL-safe short codes
const BASE62 = '0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ';

/**
 * Generate a random short code
 * @param {number} length - Length of the code (default: 8)
 * @returns {string} Short code
 */
function generateShortCode(length = 8) {
  let code = '';
  for (let i = 0; i < length; i++) {
    code += BASE62[Math.floor(Math.random() * BASE62.length)];
  }
  return code;
}

/**
 * Create or get existing short URL for a post
 * @route POST /api/v1/short-url/create
 * @access Private
 */
const createShortUrl = async (req, res) => {
  try {
    const { postId } = req.body;

    if (!postId) {
      return sendError(res, 'VAL_2001', 'Post ID is required');
    }

    // Validate post exists
    const post = await Post.findById(postId);
    if (!post) {
      return sendError(res, 'RES_3001', 'Post not found');
    }

    // Check if short URL already exists for this post
    let shortUrl = await ShortUrl.findOne({ postId });
    
    if (shortUrl) {
      // Return existing short URL
      const baseUrl = process.env.WEB_SHARE_URL || process.env.FRONTEND_URL || 'https://taatom.com';
      const shortUrlString = `${baseUrl}/s/${shortUrl.shortCode}`;
      
      return sendSuccess(res, 200, 'Short URL retrieved successfully', {
        data: {
          shortUrl: shortUrlString,
          shortCode: shortUrl.shortCode,
          postId: postId
        }
      });
    }

    // Generate unique short code
    let shortCode;
    let attempts = 0;
    const maxAttempts = 10;

    do {
      shortCode = generateShortCode(8);
      const existing = await ShortUrl.findOne({ shortCode });
      if (!existing) {
        break;
      }
      attempts++;
    } while (attempts < maxAttempts);

    if (attempts >= maxAttempts) {
      logger.error('Failed to generate unique short code after max attempts');
      return sendError(res, 'SRV_6001', 'Failed to generate short URL. Please try again.');
    }

    // Create new short URL
    shortUrl = new ShortUrl({
      shortCode,
      postId
    });

    await shortUrl.save();

    const baseUrl = process.env.WEB_SHARE_URL || process.env.FRONTEND_URL || 'https://taatom.com';
    const shortUrlString = `${baseUrl}/s/${shortCode}`;

    return sendSuccess(res, 201, 'Short URL created successfully', {
      data: {
        shortUrl: shortUrlString,
        shortCode: shortCode,
        postId: postId
      }
    });

  } catch (error) {
    logger.error('Create short URL error:', error);
    return sendError(res, 'SRV_6001', 'Error creating short URL');
  }
};

/**
 * Redirect short URL to app or web
 * @route GET /s/:shortCode
 * @access Public
 */
const redirectShortUrl = async (req, res) => {
  try {
    const { shortCode } = req.params;
    
    logger.debug('Short URL redirect requested:', { shortCode, path: req.path, url: req.url });

    if (!shortCode) {
      logger.warn('Short URL redirect: missing shortCode');
      return res.status(400).send('Invalid short URL');
    }

    // Find short URL
    logger.debug('Looking up short URL in database:', shortCode);
    const shortUrl = await ShortUrl.findOne({ shortCode });
    
    if (!shortUrl) {
      return res.status(404).send(`
        <!DOCTYPE html>
        <html>
        <head>
          <title>Link Not Found</title>
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <style>
            body { font-family: Arial, sans-serif; text-align: center; padding: 50px; }
            h1 { color: #333; }
            p { color: #666; }
          </style>
        </head>
        <body>
          <h1>Link Not Found</h1>
          <p>This link has expired or does not exist.</p>
        </body>
        </html>
      `);
    }

    // Update click count
    shortUrl.clickCount += 1;
    shortUrl.lastClickedAt = new Date();
    await shortUrl.save().catch(err => logger.error('Error updating short URL click count:', err));

    // Get post to verify it exists
    const post = await Post.findById(shortUrl.postId);
    if (!post || !post.isActive) {
      return res.status(404).send(`
        <!DOCTYPE html>
        <html>
        <head>
          <title>Post Not Found</title>
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <style>
            body { font-family: Arial, sans-serif; text-align: center; padding: 50px; }
            h1 { color: #333; }
            p { color: #666; }
          </style>
        </head>
        <body>
          <h1>Post Not Found</h1>
          <p>This post is no longer available.</p>
        </body>
        </html>
      `);
    }

    // Always redirect to app (regardless of device type)
    const deepLink = `taatom://post/${shortUrl.postId}`;
    const universalLink = `https://taatom.com/post/${shortUrl.postId}`;
    
    logger.debug('Redirecting to app:', { deepLink, postId: shortUrl.postId });
    
    // Return HTML page that attempts to open app, with fallback
    // Use both deep link and universal link for better compatibility
    return res.send(`
        <!DOCTYPE html>
        <html>
        <head>
          <title>Opening Taatom...</title>
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <meta http-equiv="refresh" content="2;url=${universalLink}">
          <script>
            // Try to open app immediately with deep link
            (function() {
              var deepLink = '${deepLink}';
              var universalLink = '${universalLink}';
              
              // Try deep link first
              window.location.href = deepLink;
              
              // Fallback: if app doesn't open in 1.5 seconds, try universal link
              setTimeout(function() {
                // Check if we're still on this page (app didn't open)
                if (document.hasFocus && document.hasFocus()) {
                  window.location.href = universalLink;
                }
                // Show fallback UI after 2 seconds
                setTimeout(function() {
                  document.getElementById('fallback').style.display = 'block';
                }, 500);
              }, 1500);
            })();
          </script>
          <style>
            body {
              font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
              display: flex;
              justify-content: center;
              align-items: center;
              min-height: 100vh;
              margin: 0;
              background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
              color: white;
            }
            .container {
              text-align: center;
              padding: 40px;
            }
            h1 { font-size: 24px; margin-bottom: 20px; }
            p { font-size: 16px; margin-bottom: 30px; opacity: 0.9; }
            #fallback {
              display: none;
              margin-top: 30px;
            }
            .button {
              display: inline-block;
              padding: 12px 24px;
              background: white;
              color: #667eea;
              text-decoration: none;
              border-radius: 8px;
              font-weight: 600;
              margin: 10px;
            }
            .spinner {
              border: 3px solid rgba(255,255,255,0.3);
              border-radius: 50%;
              border-top: 3px solid white;
              width: 40px;
              height: 40px;
              animation: spin 1s linear infinite;
              margin: 20px auto;
            }
            @keyframes spin {
              0% { transform: rotate(0deg); }
              100% { transform: rotate(360deg); }
            }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="spinner"></div>
            <h1>Opening Taatom...</h1>
            <p>If the app doesn't open automatically, tap the button below.</p>
            <div id="fallback">
              <a href="${deepLink}" class="button">Open in Taatom App</a>
              <br>
              <a href="https://taatom.com" class="button" style="background: transparent; color: white; border: 2px solid white;">Visit Website</a>
            </div>
          </div>
        </body>
        </html>
      `);

  } catch (error) {
    logger.error('Redirect short URL error:', error);
    return res.status(500).send(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Error</title>
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <style>
          body { font-family: Arial, sans-serif; text-align: center; padding: 50px; }
          h1 { color: #333; }
          p { color: #666; }
        </style>
      </head>
      <body>
        <h1>Error</h1>
        <p>An error occurred while processing your request.</p>
      </body>
      </html>
    `);
  }
};

module.exports = {
  createShortUrl,
  redirectShortUrl
};
