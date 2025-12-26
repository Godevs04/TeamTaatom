const express = require('express');
const fs = require('fs').promises;
const path = require('path');
const { marked } = require('marked');
const router = express.Router();

/**
 * Policy Routes - Serve policy markdown files
 * Routes: /privacy, /terms, /copyright
 * These routes serve the policy markdown files from frontend/policies/
 */

// Path to policy files - use robust path resolution for production
// Priority: backend/policies (copied during build) > frontend/policies (development) > project root
const getPolicyDir = () => {
  const fs = require('fs');
  
  // Option 1: Backend policies directory (best for production - files copied here during build)
  // backend/src/routes/ -> ../../ -> backend root -> policies
  const backendPoliciesPath = path.resolve(__dirname, '../../policies');
  
  // Option 2: From project root (development - when frontend folder is available)
  // backend/src/routes/ -> ../../.. -> project root -> frontend/policies
  const projectRootPath = path.resolve(__dirname, '../../../frontend/policies');
  
  // Option 3: From process.cwd() (production deployments where cwd might be backend/)
  const cwdPath = path.resolve(process.cwd(), 'policies');
  
  // Option 4: From process.cwd() if we're at project root
  const cwdFrontendPath = path.resolve(process.cwd(), 'frontend/policies');
  
  // Check which path exists (in priority order)
  if (fs.existsSync(backendPoliciesPath)) {
    return backendPoliciesPath;
  }
  if (fs.existsSync(projectRootPath)) {
    return projectRootPath;
  }
  if (fs.existsSync(cwdPath)) {
    return cwdPath;
  }
  if (fs.existsSync(cwdFrontendPath)) {
    return cwdFrontendPath;
  }
  
  // Log for debugging
  const logger = require('../utils/logger');
  logger.warn('Policy directory not found. Tried:', {
    backendPoliciesPath,
    projectRootPath,
    cwdPath,
    cwdFrontendPath,
    __dirname,
    cwd: process.cwd()
  });
  
  // Fallback to backend policies path
  return backendPoliciesPath;
};

const POLICY_DIR = getPolicyDir();

/**
 * Helper to read and serve markdown file
 */
const servePolicyFile = async (filename, res) => {
  const logger = require('../utils/logger');
  
  try {
    const filePath = path.join(POLICY_DIR, filename);
    
    // Verify file exists before trying to read
    try {
      await fs.access(filePath);
    } catch (accessError) {
      logger.error(`Policy file not found at: ${filePath}`);
      logger.error(`Policy directory: ${POLICY_DIR}`);
      logger.error(`Current working directory: ${process.cwd()}`);
      logger.error(`__dirname: ${__dirname}`);
      
      return res.status(404).json({
        error: 'Policy file not found',
        message: `The ${filename} policy file could not be found`,
        debug: {
          policyDir: POLICY_DIR,
          filename: filename,
          filePath: filePath,
          cwd: process.cwd(),
          __dirname: __dirname
        }
      });
    }
    
    const markdownContent = await fs.readFile(filePath, 'utf-8');
    
    // Convert markdown to HTML using marked
    const htmlBody = marked(markdownContent);
    
    // Get page title from filename
    const pageTitle = filename
      .replace('.md', '')
      .replace(/([A-Z])/g, ' $1')
      .trim()
      .split(' ')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join(' ');
    
    // Return as HTML with professional styling for App Store/Play Store review
    const htmlContent = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="description" content="${pageTitle} for Taatom - Social Media Platform">
  <title>${pageTitle} - Taatom</title>
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }
    
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
      line-height: 1.8;
      max-width: 900px;
      margin: 0 auto;
      padding: 40px 20px;
      color: #1d1d1f;
      background: #ffffff;
    }
    
    /* Typography */
    h1 {
      font-size: 2.5em;
      font-weight: 700;
      color: #000000;
      margin: 0 0 20px 0;
      padding-bottom: 15px;
      border-bottom: 3px solid #007AFF;
    }
    
    h2 {
      font-size: 1.75em;
      font-weight: 600;
      color: #000000;
      margin: 40px 0 20px 0;
      padding-bottom: 10px;
      border-bottom: 2px solid #e5e5e7;
    }
    
    h3 {
      font-size: 1.35em;
      font-weight: 600;
      color: #1d1d1f;
      margin: 30px 0 15px 0;
    }
    
    h4 {
      font-size: 1.15em;
      font-weight: 600;
      color: #1d1d1f;
      margin: 25px 0 12px 0;
    }
    
    p {
      margin: 15px 0;
      color: #424245;
      font-size: 16px;
    }
    
    /* Lists */
    ul, ol {
      margin: 15px 0 15px 30px;
      padding-left: 20px;
    }
    
    li {
      margin: 10px 0;
      color: #424245;
      font-size: 16px;
      line-height: 1.7;
    }
    
    ul li {
      list-style-type: disc;
    }
    
    ol li {
      list-style-type: decimal;
    }
    
    /* Strong and emphasis */
    strong {
      color: #000000;
      font-weight: 600;
    }
    
    em {
      font-style: italic;
    }
    
    /* Links */
    a {
      color: #007AFF;
      text-decoration: none;
      border-bottom: 1px solid transparent;
      transition: border-color 0.2s;
    }
    
    a:hover {
      border-bottom-color: #007AFF;
    }
    
    /* Code */
    code {
      background: #f5f5f7;
      padding: 3px 8px;
      border-radius: 4px;
      font-family: 'SF Mono', Monaco, 'Cascadia Code', 'Roboto Mono', Consolas, 'Courier New', monospace;
      font-size: 0.9em;
      color: #d63384;
    }
    
    pre {
      background: #f5f5f7;
      padding: 20px;
      border-radius: 8px;
      overflow-x: auto;
      margin: 20px 0;
      border-left: 4px solid #007AFF;
    }
    
    pre code {
      background: transparent;
      padding: 0;
      color: #1d1d1f;
    }
    
    /* Blockquotes */
    blockquote {
      border-left: 4px solid #007AFF;
      padding-left: 20px;
      margin: 20px 0;
      color: #6e6e73;
      font-style: italic;
    }
    
    /* Horizontal rule */
    hr {
      border: none;
      border-top: 2px solid #e5e5e7;
      margin: 40px 0;
    }
    
    /* Responsive */
    @media (max-width: 768px) {
      body {
        padding: 20px 15px;
      }
      
      h1 {
        font-size: 2em;
      }
      
      h2 {
        font-size: 1.5em;
      }
      
      h3 {
        font-size: 1.25em;
      }
    }
    
    /* Dark mode support */
    @media (prefers-color-scheme: dark) {
      body {
        background: #1c1c1e;
        color: #f2f2f7;
      }
      
      h1, h2, h3, h4 {
        color: #ffffff;
      }
      
      h1 {
        border-bottom-color: #007AFF;
      }
      
      h2 {
        border-bottom-color: #3a3a3c;
      }
      
      p, li {
        color: #e5e5e7;
      }
      
      strong {
        color: #ffffff;
      }
      
      code {
        background: #2c2c2e;
        color: #ff6b9d;
      }
      
      pre {
        background: #2c2c2e;
      }
      
      blockquote {
        border-left-color: #007AFF;
        color: #a1a1a6;
      }
      
      hr {
        border-top-color: #3a3a3c;
      }
    }
    
    /* Print styles */
    @media print {
      body {
        max-width: 100%;
        padding: 20px;
      }
      
      a {
        color: #000000;
        text-decoration: underline;
      }
    }
  </style>
</head>
<body>
  ${htmlBody}
</body>
</html>`;
    
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader('Cache-Control', 'public, max-age=3600'); // Cache for 1 hour
    res.send(htmlContent);
  } catch (error) {
    logger.error(`Error serving policy file ${filename}:`, error);
    
    if (error.code === 'ENOENT') {
      res.status(404).json({
        error: 'Policy file not found',
        message: `The ${filename} policy file could not be found`,
        path: path.join(POLICY_DIR, filename)
      });
    } else {
      res.status(500).json({
        error: 'Server error',
        message: 'Failed to serve policy file',
        details: error.message
      });
    }
  }
};

/**
 * @swagger
 * /privacy:
 *   get:
 *     summary: Get Privacy Policy
 *     tags: [Policies]
 *     description: Returns the privacy policy markdown file
 *     responses:
 *       200:
 *         description: Privacy policy content
 *         content:
 *           text/markdown:
 *             schema:
 *               type: string
 *       404:
 *         description: Policy file not found
 */
router.get('/privacy', async (req, res) => {
  await servePolicyFile('privacyPolicy.md', res);
});

/**
 * @swagger
 * /terms:
 *   get:
 *     summary: Get Terms of Service
 *     tags: [Policies]
 *     description: Returns the terms of service markdown file
 *     responses:
 *       200:
 *         description: Terms of service content
 *         content:
 *           text/markdown:
 *             schema:
 *               type: string
 *       404:
 *         description: Policy file not found
 */
router.get('/terms', async (req, res) => {
  await servePolicyFile('terms.md', res);
});

/**
 * @swagger
 * /copyright:
 *   get:
 *     summary: Get Copyright Consent Policy
 *     tags: [Policies]
 *     description: Returns the copyright consent policy markdown file
 *     responses:
 *       200:
 *         description: Copyright consent policy content
 *         content:
 *           text/markdown:
 *             schema:
 *               type: string
 *       404:
 *         description: Policy file not found
 */
router.get('/copyright', async (req, res) => {
  await servePolicyFile('copyrightConsent.md', res);
});

module.exports = router;

