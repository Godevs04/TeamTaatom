const fs = require('fs');
const path = require('path');

const filePath = 'h:/Ganesh Files/RootedAI/taatom/TeamTaatom/backend/src/utils/cascadeDelete.js';
let content = fs.readFileSync(filePath, 'utf8');

console.log('Original content length:', content.length);

// Normalize line endings
content = content.replace(/\r\n/g, '\n');

// 1. Add imports for Like and Follow models
const targetImports = `const Post = require('../models/Post');
const User = require('../models/User');`;

const replacementImports = `const Post = require('../models/Post');
const User = require('../models/User');
const Like = require('../models/Like');
const Follow = require('../models/Follow');`;

if (content.includes(targetImports)) {
  content = content.replace(targetImports, replacementImports);
  console.log('Successfully replaced imports.');
} else {
  console.warn('Could not find imports target!');
}

// 2. Refactor cascadeDeletePost likes cleanup
const targetPostLikes = `    // Update user's total likes count (decrement for each like)
    if (post.likes && post.likes.length > 0) {
      await User.findByIdAndUpdate(post.user, {
        $inc: { totalLikes: -post.likes.length }
      });
      logger.debug(\`Updated user \${post.user} totalLikes (decremented by \${post.likes.length})\`);
      
      // Also update totalLikes for users who liked this post (if they have a totalLikes field)
      // This ensures user stats are accurate when they liked posts that get deleted
      await User.updateMany(
        { _id: { $in: post.likes } },
        { $inc: { totalLikes: -1 } }
      );
      logger.debug(\`Updated totalLikes for \${post.likes.length} users who liked this post\`);
    }`;

const replacementPostLikes = `    // Update user's total likes count (decrement for each like)
    const postLikes = await Like.find({ post: postId }).select('user').lean();
    const likesCount = postLikes.length;
    if (likesCount > 0) {
      await User.findByIdAndUpdate(post.user, {
        $inc: { totalLikes: -likesCount }
      });
      logger.debug(\`Updated user \${post.user} totalLikes (decremented by \${likesCount})\`);
      
      // Delete associated Like documents
      await Like.deleteMany({ post: postId });
      logger.debug(\`Deleted \${likesCount} Like documents for post \${postId}\`);
    }`;

if (content.includes(targetPostLikes)) {
  content = content.replace(targetPostLikes, replacementPostLikes);
  console.log('Successfully refactored cascadeDeletePost likes cleanup.');
} else {
  console.warn('Could not find cascadeDeletePost likes target!');
}

// 3. Refactor cascadeDeleteUser post likes cleanup
const targetUserLikes = `    // Remove user's comments from all posts (embedded comments)
    await Post.updateMany(
      { 'comments.user': userId },
      { $pull: { comments: { user: userId } } }
    );
    logger.debug(\`Removed embedded comments by user \${userId}\`);

    // Remove user from all posts' likes arrays and update post owners' totalLikes
    const postsLikedByUser = await Post.find({ likes: userId });
    const postOwnerIds = [...new Set(postsLikedByUser.map(p => p.user.toString()))];
    
    await Post.updateMany({ likes: userId }, { $pull: { likes: userId } });
    logger.debug(\`Removed user \${userId} from all post likes\`);
    
    // Decrement totalLikes for each post owner (one like removed per post)
    if (postOwnerIds.length > 0) {
      await User.updateMany(
        { _id: { $in: postOwnerIds } },
        { $inc: { totalLikes: -1 } }
      );
      logger.debug(\`Updated totalLikes for \${postOwnerIds.length} post owners\`);
    }`;

const replacementUserLikes = `    // Remove user's comments from all posts (embedded comments)
    await Post.updateMany(
      { 'comments.user': userId },
      { $pull: { comments: { user: userId } } }
    );
    logger.debug(\`Removed embedded comments by user \${userId}\`);

    // Find all likes by this user
    const userLikes = await Like.find({ user: userId }).select('post').lean();
    const postIdsLiked = userLikes.map(l => l.post);
    
    if (postIdsLiked.length > 0) {
      const postsLiked = await Post.find({ _id: { $in: postIdsLiked } }).select('_id user').lean();
      
      // Decrement likesCount on all affected posts
      await Post.updateMany({ _id: { $in: postIdsLiked } }, { $inc: { likesCount: -1 } });
      logger.debug(\`Decremented likesCount for \${postIdsLiked.length} posts liked by user \${userId}\`);
      
      // Group posts by owner to decrement totalLikes
      const ownerLikesDecrement = {};
      for (const p of postsLiked) {
        if (p.user) {
          const ownerId = p.user.toString();
          ownerLikesDecrement[ownerId] = (ownerLikesDecrement[ownerId] || 0) + 1;
        }
      }
      for (const [ownerId, count] of Object.entries(ownerLikesDecrement)) {
        await User.findByIdAndUpdate(ownerId, { $inc: { totalLikes: -count } });
      }
      logger.debug(\`Decremented totalLikes for \${Object.keys(ownerLikesDecrement).length} post owners\`);
      
      // Delete Like documents
      await Like.deleteMany({ user: userId });
      logger.debug(\`Deleted \${userLikes.length} Like documents by user \${userId}\`);
    }`;

if (content.includes(targetUserLikes)) {
  content = content.replace(targetUserLikes, replacementUserLikes);
  console.log('Successfully refactored cascadeDeleteUser likes cleanup.');
} else {
  console.warn('Could not find cascadeDeleteUser likes target!');
}

// 4. Refactor cascadeDeleteUser follow list cleanup
const targetUserFollows = `    // Remove user from all followers/following lists
    await User.updateMany(
      { followers: userId },
      { $pull: { followers: userId } }
    );
    await User.updateMany(
      { following: userId },
      { $pull: { following: userId } }
    );
    logger.debug(\`Removed user \${userId} from followers/following lists\`);`;

const replacementUserFollows = `    // Find follow relationships where the user is a follower or followed
    const followsAsFollower = await Follow.find({ follower: userId }).select('following').lean();
    const followsAsFollowing = await Follow.find({ following: userId }).select('follower').lean();
    
    const followedUserIds = followsAsFollower.map(f => f.following);
    const followerUserIds = followsAsFollowing.map(f => f.follower);
    
    // Decrement followersCount for users followed by this user
    if (followedUserIds.length > 0) {
      await User.updateMany({ _id: { $in: followedUserIds } }, { $inc: { followersCount: -1 } });
    }
    
    // Decrement followingCount for users who follow this user
    if (followerUserIds.length > 0) {
      await User.updateMany({ _id: { $in: followerUserIds } }, { $inc: { followingCount: -1 } });
    }
    
    // Delete Follow relationships
    await Follow.deleteMany({
      $or: [
        { follower: userId },
        { following: userId }
      ]
    });
    logger.debug(\`Removed user \${userId} follow relationships and updated counts\`);`;

if (content.includes(targetUserFollows)) {
  content = content.replace(targetUserFollows, replacementUserFollows);
  console.log('Successfully refactored cascadeDeleteUser follow lists cleanup.');
} else {
  console.warn('Could not find cascadeDeleteUser follow lists target!');
}

fs.writeFileSync(filePath, content, 'utf8');
console.log('Done refactoring cascadeDelete.js. New length:', content.length);
