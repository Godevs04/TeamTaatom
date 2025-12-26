const express = require('express');
const fs = require('fs').promises;
const path = require('path');
const router = express.Router();

/**
 * Policy Routes - Serve policy markdown files
 * Routes: /privacy, /terms, /copyright
 * These routes serve the policy markdown files from frontend/policies/
 */

// Path to policy files (relative to backend root)
const POLICY_DIR = path.join(__dirname, '../../frontend/policies');

/**
 * Helper to read and serve markdown file
 */
const servePolicyFile = async (filename, res) => {
  try {
    const filePath = path.join(POLICY_DIR, filename);
    const content = await fs.readFile(filePath, 'utf-8');
    
    // Return as plain text/markdown (browser will render it)
    res.setHeader('Content-Type', 'text/markdown; charset=utf-8');
    res.send(content);
  } catch (error) {
    if (error.code === 'ENOENT') {
      res.status(404).json({
        error: 'Policy file not found',
        message: `The ${filename} policy file could not be found`
      });
    } else {
      console.error(`Error serving policy file ${filename}:`, error);
      res.status(500).json({
        error: 'Server error',
        message: 'Failed to serve policy file'
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

