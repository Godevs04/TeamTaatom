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
router.post('/', createCollection);
router.get('/', getCollections);
router.get('/:id', getCollection);
router.put('/:id', updateCollection);
router.delete('/:id', deleteCollection);

// Collection posts management
router.post('/:id/posts', addPostToCollection);
router.delete('/:id/posts/:postId', removePostFromCollection);
router.put('/:id/reorder', reorderCollectionPosts);

module.exports = router;

