const express = require('express');
const multer = require('multer');
const { authMiddleware } = require('../middleware/authMiddleware');
const {
  createLongVideoUpload,
  listLongVideos,
  getLongVideo,
  listUserLongVideos,
} = require('../controllers/longVideoController');

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 500 * 1024 * 1024 },
});

const router = express.Router();

router.get('/', authMiddleware, listLongVideos);
router.get('/user/:userId', authMiddleware, listUserLongVideos);
router.post(
  '/',
  authMiddleware,
  upload.fields([
    { name: 'video', maxCount: 1 },
    { name: 'image', maxCount: 1 },
  ]),
  createLongVideoUpload
);
router.get('/:id', authMiddleware, getLongVideo);

module.exports = router;
