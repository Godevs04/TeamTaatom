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
 *     description: |
 *       Creates a new collection for organizing saved posts. Collections allow users to group posts by theme, location, or any custom category.
 *       
 *       **Use Cases:**
 *       - Save posts to themed collections
 *       - Organize travel memories
 *       - Create custom categories
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
 *             required:
 *               - name
 *             properties:
 *               name:
 *                 type: string
 *                 minLength: 1
 *                 maxLength: 100
 *                 description: Collection name
 *                 example: "Summer 2024"
 *               description:
 *                 type: string
 *                 maxLength: 500
 *                 description: Optional collection description
 *                 example: "My summer travel memories"
 *     responses:
 *       201:
 *         description: Collection created successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: "Collection created successfully"
 *                 collection:
 *                   type: object
 *                   properties:
 *                     _id:
 *                       type: string
 *                     name:
 *                       type: string
 *                     description:
 *                       type: string
 *                     posts:
 *                       type: array
 *                       items:
 *                         type: string
 *                     createdAt:
 *                       type: string
 *                       format: date-time
 *       400:
 *         $ref: '#/components/responses/BadRequest'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       500:
 *         $ref: '#/components/responses/InternalServerError'
 */
router.post('/', createCollection);
/**
 * @swagger
 * /api/v1/collections:
 *   get:
 *     summary: List authenticated user's collections
 *     description: |
 *       Retrieves all collections created by the authenticated user. Returns collections with post counts and metadata.
 *     tags: [Collections]
 *     security:
 *       - bearerAuth: []
 *       - cookieAuth: []
 *     responses:
 *       200:
 *         description: Collections retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 collections:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       _id:
 *                         type: string
 *                       name:
 *                         type: string
 *                       description:
 *                         type: string
 *                       postCount:
 *                         type: integer
 *                       createdAt:
 *                         type: string
 *                         format: date-time
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       500:
 *         $ref: '#/components/responses/InternalServerError'
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
 *     description: Adds a post to the specified collection. The post must belong to the authenticated user or be a public post they can access.
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
 *         description: MongoDB ObjectId of the collection
 *         example: "507f1f77bcf86cd799439011"
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
 *                 description: MongoDB ObjectId of the post to add
 *                 example: "507f1f77bcf86cd799439012"
 *     responses:
 *       200:
 *         description: Post added to collection successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: "Post added to collection"
 *       400:
 *         $ref: '#/components/responses/BadRequest'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 *       500:
 *         $ref: '#/components/responses/InternalServerError'
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

