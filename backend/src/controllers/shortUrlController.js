const ShortUrl = require('../models/ShortUrl');
const Post = require('../models/Post');
const Journey = require('../models/Journey');
const ConnectPage = require('../models/ConnectPage');
const logger = require('../utils/logger');
const { sendError, sendSuccess } = require('../utils/errorCodes');

/**
 * Escapes HTML characters to prevent HTML/XSS injection.
 */
function escapeHtml(unsafe) {
  if (!unsafe) return '';
  return String(unsafe)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

// Base62 characters for URL-safe short codes
const BASE62 = '0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ';

/**
 * Public web origin used in share + Universal Links.
 * Prefer www: apex taatom.com currently 307→www on Vercel, and Apple/Google
 * reject AASA/assetlinks served via redirect — so shared links must hit www
 * or the OS opens Safari instead of the installed app.
 */
function getPublicWebOrigin() {
  const raw = (
    process.env.WEB_SHARE_URL ||
    process.env.WEB_FRONTEND_URL ||
    process.env.FRONTEND_URL ||
    'https://www.taatom.com'
  ).trim().replace(/\/$/, '');
  try {
    const u = new URL(raw.includes('://') ? raw : `https://${raw}`);
    if (u.hostname === 'taatom.com') {
      u.hostname = 'www.taatom.com';
    }
    return u.origin;
  } catch {
    return 'https://www.taatom.com';
  }
}

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
    const { postId, journeyId, connectPageId } = req.body;

    const provided = [postId, journeyId, connectPageId].filter(Boolean);
    if (provided.length !== 1) {
      return sendError(res, 'VAL_2001', 'Provide exactly one of postId, journeyId, or connectPageId');
    }

    let resourceField;
    let resourceId;
    if (connectPageId) {
      resourceField = 'connectPageId';
      resourceId = connectPageId;
      const page = await ConnectPage.findById(connectPageId).select('_id status').lean();
      if (!page || page.status === 'archived') {
        return sendError(res, 'RES_3001', 'Connect page not found');
      }
    } else if (journeyId) {
      resourceField = 'journeyId';
      resourceId = journeyId;
      const journey = await Journey.findById(journeyId).select('_id').lean();
      if (!journey) {
        return sendError(res, 'RES_3001', 'Journey not found');
      }
    } else {
      resourceField = 'postId';
      resourceId = postId;
      const post = await Post.findById(postId).select('_id').lean();
      if (!post) {
        return sendError(res, 'RES_3001', 'Post not found');
      }
    }

    // Check if short URL already exists
    let shortUrl = await ShortUrl.findOne({ [resourceField]: resourceId });

    if (shortUrl) {
      const baseUrl = getPublicWebOrigin();
      const shortUrlString = `${baseUrl}/s/${shortUrl.shortCode}`;

      return sendSuccess(res, 200, 'Short URL retrieved successfully', {
        data: {
          shortUrl: shortUrlString,
          shortCode: shortUrl.shortCode,
          [resourceField]: resourceId
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

    shortUrl = new ShortUrl({
      shortCode,
      [resourceField]: resourceId
    });

    await shortUrl.save();

    const baseUrl = getPublicWebOrigin();
    const shortUrlString = `${baseUrl}/s/${shortCode}`;

    return sendSuccess(res, 201, 'Short URL created successfully', {
      data: {
        shortUrl: shortUrlString,
        shortCode: shortCode,
        [resourceField]: resourceId
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

    const isJourney = !!shortUrl.journeyId;
    const isConnectPage = !!shortUrl.connectPageId;

    let previewTitle = 'Opening Taatom...';
    let previewDescription = 'Travel stories that feel alive.';
    let previewImage = '';

    if (isConnectPage) {
      const page = await ConnectPage.findById(shortUrl.connectPageId)
        .select('name bio profileImage bannerImage status')
        .lean();
      if (!page || page.status === 'archived') {
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
            <p>This community is no longer available.</p>
          </body>
          </html>
        `);
      }
      previewTitle = `${page.name || 'Community'} on Taatom`;
      previewDescription = page.bio
        ? page.bio.substring(0, 160)
        : `Join ${page.name || 'this community'} on Taatom.`;
      const baseUrl = getPublicWebOrigin();
      previewImage = page.bannerImage || page.profileImage || `${baseUrl}/icon.png`;
    } else if (isJourney) {
      const journey = await Journey.findById(shortUrl.journeyId)
        .populate('user', 'fullName username')
        .populate({
          path: 'waypoints.post',
          select: 'imageUrl thumbnailUrl images mediaUrl videoUrl',
          match: { _id: { $exists: true } }
        });

      if (!journey || !journey.isActive) {
        return res.status(404).send(`
          <!DOCTYPE html>
          <html>
          <head>
            <title>Journey Not Found</title>
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <style>
              body { font-family: Arial, sans-serif; text-align: center; padding: 50px; }
              h1 { color: #333; }
              p { color: #666; }
            </style>
          </head>
          <body>
            <h1>Journey Not Found</h1>
            <p>This journey is no longer available.</p>
          </body>
          </html>
        `);
      }

      const journeyTitle = journey.title || 'Journey';
      const distanceString = journey.distanceTraveled
        ? journey.distanceTraveled >= 1000
          ? `${(journey.distanceTraveled / 1000).toFixed(1)} km`
          : `${Math.round(journey.distanceTraveled)} m`
        : '0 m';

      previewTitle = `${journeyTitle} • ${distanceString} on Taatom`;
      previewDescription = `Check out this journey by ${journey.user?.fullName || 'a traveler'}. Distance traveled: ${distanceString}.`;

      // Find first waypoint's post image
      let journeyImage = '';
      if (journey.waypoints && journey.waypoints.length > 0) {
        for (const wp of journey.waypoints) {
          if (wp.post) {
            const img = wp.post.imageUrl || 
                        wp.post.thumbnailUrl || 
                        (wp.post.images && wp.post.images.length > 0 ? wp.post.images[0] : '') || 
                        wp.post.mediaUrl;
            if (img) {
              journeyImage = img;
              break;
            }
          }
        }
      }
      const baseUrl = getPublicWebOrigin();
      previewImage = journeyImage || `${baseUrl}/icon.png`;

    } else {
      // Get post to verify it exists
      const post = await Post.findById(shortUrl.postId)
        .populate('user', 'fullName username');

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

      const postTitle = post.caption 
        ? `${post.caption.substring(0, 60)}${post.caption.length > 60 ? '...' : ''}` 
        : `Post by ${post.user?.fullName || 'Traveler'}`;
      previewTitle = `${postTitle} on Taatom`;
      previewDescription = post.caption 
        ? `Check out this post by ${post.user?.fullName || 'Traveler'}: "${post.caption}"`
        : `Check out this post by ${post.user?.fullName || 'Traveler'} on Taatom.`;

      const img = post.imageUrl || 
                  post.thumbnailUrl || 
                  (post.images && post.images.length > 0 ? post.images[0] : '') || 
                  post.mediaUrl;
      const baseUrl = getPublicWebOrigin();
      previewImage = img || `${baseUrl}/icon.png`;
    }

    const webOrigin = getPublicWebOrigin();

    // Prefer HTTPS Universal/App Links; custom scheme is a secondary handoff.
    // IMPORTANT: use taatom://host/path (two slashes), NEVER taatom:///path.
    // Triple-slash URLs parse as an empty host on iOS/Expo and open as
    // "taatom:///" → Unmatched Route / crash in production.
    // Use www origin so links hit a host that serves AASA/assetlinks with HTTP 200.
    let deepLink, universalLink, intentPath, shortUniversalLink;
    if (isConnectPage) {
      const id = String(shortUrl.connectPageId);
      deepLink = `taatom://connect/page/${id}`;
      universalLink = `${webOrigin}/connect/page/${id}`;
      shortUniversalLink = `${webOrigin}/s/${shortCode}`;
      intentPath = `connect/page/${id}`;
    } else if (isJourney) {
      const id = String(shortUrl.journeyId);
      deepLink = `taatom://navigate/detail?journeyId=${id}`;
      universalLink = `${webOrigin}/journey/${id}`;
      shortUniversalLink = `${webOrigin}/s/${shortCode}`;
      intentPath = `navigate/detail?journeyId=${id}`;
    } else {
      const id = String(shortUrl.postId);
      deepLink = `taatom://post/${id}`;
      universalLink = `${webOrigin}/post/${id}`;
      shortUniversalLink = `${webOrigin}/s/${shortCode}`;
      intentPath = `post/${id}`;
    }
    
    logger.debug('Redirecting to app:', {
      deepLink,
      universalLink,
      postId: shortUrl.postId,
      journeyId: shortUrl.journeyId,
      connectPageId: shortUrl.connectPageId,
    });
    
    // Return HTML page that attempts to open app via HTTPS Universal Links first
    return res.send(`
        <!DOCTYPE html>
        <html>
        <head>
          <title>${escapeHtml(previewTitle)}</title>
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <meta name="apple-itunes-app" content="app-id=6757185352, app-argument=${escapeHtml(universalLink)}">
          <meta http-equiv="refresh" content="4;url=${universalLink}">

          <!-- Open Graph / Facebook -->
          <meta property="og:type" content="website">
          <meta property="og:url" content="${shortUniversalLink}">
          <meta property="og:title" content="${escapeHtml(previewTitle)}">
          <meta property="og:description" content="${escapeHtml(previewDescription)}">
          <meta property="og:image" content="${escapeHtml(previewImage)}">
          <meta property="og:site_name" content="Taatom">

          <!-- Twitter -->
          <meta name="twitter:card" content="summary_large_image">
          <meta name="twitter:url" content="${shortUniversalLink}">
          <meta name="twitter:title" content="${escapeHtml(previewTitle)}">
          <meta name="twitter:description" content="${escapeHtml(previewDescription)}">
          <meta name="twitter:image" content="${escapeHtml(previewImage)}">
          <script>
            (function() {
              var deepLink = '${deepLink}';
              var universalLink = '${universalLink}';
              var shortUniversalLink = '${shortUniversalLink}';
              var intentPath = '${intentPath}';
              var isAndroid = /Android/i.test(navigator.userAgent);
              var isIOS = /iPhone|iPad|iPod/i.test(navigator.userAgent);

              function tryCustomScheme() {
                if (!deepLink || deepLink.indexOf('taatom://') !== 0 || deepLink.length <= 'taatom://'.length + 1) return;
                window.location.href = deepLink;
              }

              // When this HTML is shown, Universal Links for the original tap
              // already failed (or user is in an in-app browser). Try custom
              // scheme / Android intent immediately, then HTTPS fallback.
              if (isAndroid) {
                var intentLink = 'intent://' + intentPath + '#Intent;scheme=taatom;package=com.taatom.app;S.browser_fallback_url=' + encodeURIComponent(universalLink) + ';end';
                window.location.href = intentLink;
              } else if (isIOS) {
                tryCustomScheme();
                setTimeout(function() {
                  if (document.hasFocus && document.hasFocus()) {
                    window.location.href = universalLink;
                  }
                }, 900);
              } else {
                window.location.href = universalLink;
              }

              setTimeout(function() {
                if (document.hasFocus && document.hasFocus()) {
                  window.location.href = universalLink;
                }
                setTimeout(function() {
                  var el = document.getElementById('fallback');
                  if (el) el.style.display = 'block';
                }, 500);
              }, 2200);
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
              <a href="${deepLink}" class="button">Open in Taatom app</a>
              <br>
              <a href="${universalLink}" class="button" style="background: transparent; color: white; border: 2px solid white;">Open in browser</a>
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

/**
 * Resolve a short code to an in-app path (JSON for the mobile client).
 * GET /api/v1/short-url/resolve/:shortCode
 * @access Public
 */
const resolveShortUrl = async (req, res) => {
  try {
    const { shortCode } = req.params;
    if (!shortCode || !/^[A-Za-z0-9]{4,16}$/.test(shortCode)) {
      return sendError(res, 'VAL_2001', 'Invalid short code');
    }

    const shortUrl = await ShortUrl.findOne({ shortCode }).lean();
    if (!shortUrl) {
      return sendError(res, 'RES_3001', 'Short URL not found');
    }

    // Fire-and-forget click tracking
    ShortUrl.updateOne(
      { _id: shortUrl._id },
      { $inc: { clickCount: 1 }, $set: { lastClickedAt: new Date() } }
    ).catch(() => {});

    if (shortUrl.connectPageId) {
      const page = await ConnectPage.findById(shortUrl.connectPageId).select('status').lean();
      if (!page || page.status === 'archived') {
        return sendError(res, 'RES_3001', 'Connect page not found');
      }
      return sendSuccess(res, 200, 'Resolved', {
        type: 'connect_page',
        path: `/connect/page/${shortUrl.connectPageId}`,
        connectPageId: String(shortUrl.connectPageId),
      });
    }

    if (shortUrl.journeyId) {
      const journey = await Journey.findById(shortUrl.journeyId).select('isActive').lean();
      if (!journey || journey.isActive === false) {
        return sendError(res, 'RES_3001', 'Journey not found');
      }
      return sendSuccess(res, 200, 'Resolved', {
        type: 'journey',
        path: `/navigate/detail?journeyId=${shortUrl.journeyId}`,
        journeyId: String(shortUrl.journeyId),
      });
    }

    if (shortUrl.postId) {
      const post = await Post.findById(shortUrl.postId).select('isActive').lean();
      if (!post || post.isActive === false) {
        return sendError(res, 'RES_3001', 'Post not found');
      }
      return sendSuccess(res, 200, 'Resolved', {
        type: 'post',
        path: `/post/${shortUrl.postId}`,
        postId: String(shortUrl.postId),
      });
    }

    return sendError(res, 'RES_3001', 'Short URL has no target');
  } catch (error) {
    logger.error('Resolve short URL error:', error);
    return sendError(res, 'SRV_6001', 'Error resolving short URL');
  }
};

module.exports = {
  createShortUrl,
  redirectShortUrl,
  resolveShortUrl,
};
