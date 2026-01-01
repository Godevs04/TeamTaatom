const express = require('express');
const router = express.Router();
const { authMiddleware } = require('../middleware/authMiddleware');
const {
  createCollection,
  getCollections,
  getCollection,
  updateCollection,
  deleteCollection,
  addPostToCollection,
  removePostFromCollection,
  reorderCollectionPosts
} = require('../controllers/collectionController');

// All routes require authentication
router.use(authMiddleware);

// Collection CRUD
/**
 * @swagger
 * /api/v1/collections:
 *   post:
 *     summary: Create a new collection
 *     tags: [Collections]
 *     security:
 *       - bearerAuth: []
 *       - cookieAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *               description:
 *                 type: string
 *     responses:
 *       201:
 *         description: Collection created
 */
router.post('/', createCollection);
/**
 * @swagger
 * /api/v1/collections:
 *   get:
 *     summary: List authenticated user's collections
 *     tags: [Collections]
 *     security:
 *       - bearerAuth: []
 *       - cookieAuth: []
 *     responses:
 *       200:
 *         description: Collection list
 */
router.get('/', getCollections);
/**
 * @swagger
 * /api/v1/collections/{id}:
 *   get:
 *     summary: Get collection by ID
 *     tags: [Collections]
 *     security:
 *       - bearerAuth: []
 *       - cookieAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Collection details
 */
router.get('/:id', getCollection);
/**
 * @swagger
 * /api/v1/collections/{id}:
 *   put:
 *     summary: Update a collection
 *     tags: [Collections]
 *     security:
 *       - bearerAuth: []
 *       - cookieAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *               description:
 *                 type: string
 *     responses:
 *       200:
 *         description: Collection updated
 */
router.put('/:id', updateCollection);
/**
 * @swagger
 * /api/v1/collections/{id}:
 *   delete:
 *     summary: Delete a collection
 *     tags: [Collections]
 *     security:
 *       - bearerAuth: []
 *       - cookieAuth: []
 *     responses:
 *       200:
 *         description: Collection deleted
 */
router.delete('/:id', deleteCollection);

// Collection posts management
/**
 * @swagger
 * /api/v1/collections/{id}/posts:
 *   post:
 *     summary: Add a post to a collection
 *     tags: [Collections]
 *     security:
 *       - bearerAuth: []
 *       - cookieAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - postId
 *             properties:
 *               postId:
 *                 type: string
 *     responses:
 *       200:
 *         description: Post added
 */
router.post('/:id/posts', addPostToCollection);
/**
 * @swagger
 * /api/v1/collections/{id}/posts/{postId}:
 *   delete:
 *     summary: Remove a post from a collection
 *     tags: [Collections]
 *     security:
 *       - bearerAuth: []
 *       - cookieAuth: []
 */
router.delete('/:id/posts/:postId', removePostFromCollection);
/**
 * @swagger
 * /api/v1/collections/{id}/reorder:
 *   put:
 *     summary: Reorder posts inside a collection
 *     tags: [Collections]
 *     security:
 *       - bearerAuth: []
 *       - cookieAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               order:
 *                 type: array
 *                 items:
 *                   type: string
 *     responses:
 *       200:
 *         description: Order updated
 */
router.put('/:id/reorder', reorderCollectionPosts);

module.exports = router;

