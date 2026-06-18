const fs = require('fs');
const path = require('path');

const filePath = 'h:/Ganesh Files/RootedAI/taatom/TeamTaatom/backend/src/routes/enhancedSuperAdminRoutes.js';
let content = fs.readFileSync(filePath, 'utf8');

console.log('Original content length:', content.length);

// Normalize line endings
content = content.replace(/\r\n/g, '\n');

// 1. group totalLikes sum size
const target1 = `        { $group: { 
          _id: null, 
          totalLikes: { $sum: { $size: '$likes' } }, 
          totalComments: { $sum: { $size: '$comments' } }
        }}`;
const replacement1 = `        { $group: { 
          _id: null, 
          totalLikes: { $sum: { $ifNull: ['$likesCount', 0] } }, 
          totalComments: { $sum: { $size: '$comments' } }
        }}`;

if (content.includes(target1)) {
  content = content.replace(target1, replacement1);
  console.log('Successfully replaced totalLikes sum target 1.');
} else {
  console.warn('Could not find target 1!');
}

// 2. postMetrics aggregate size
const target2 = `    // 1. Batch fetch post counts and total likes for all users
    const postMetrics = await Post.aggregate([
      { $match: { user: { $in: userIds } } },
      { $group: {
        _id: '$user',
        totalPosts: { $sum: 1 },
        totalLikes: { $sum: { $size: { $ifNull: ['$likes', []] } } }
      } }
    ])`;
const replacement2 = `    // 1. Batch fetch post counts and total likes for all users
    const postMetrics = await Post.aggregate([
      { $match: { user: { $in: userIds } } },
      { $group: {
        _id: '$user',
        totalPosts: { $sum: 1 },
        totalLikes: { $sum: { $ifNull: ['$likesCount', 0] } }
      } }
    ])`;

if (content.includes(target2)) {
  content = content.replace(target2, replacement2);
  console.log('Successfully replaced postMetrics aggregate target 2.');
} else {
  console.warn('Could not find target 2!');
}

// 3. usersWithFollowers select and map
const target3 = `    // 2. Batch fetch followers count (users already loaded, just extract followers array length)
    const usersWithFollowers = await User.find({ _id: { $in: userIds } })
      .select('_id followers')
      .lean()
    const followersMap = new Map()
    usersWithFollowers.forEach(user => {
      followersMap.set(user._id.toString(), user.followers?.length || 0)
    })`;
const replacement3 = `    // 2. Batch fetch followers count
    const usersWithFollowers = await User.find({ _id: { $in: userIds } })
      .select('_id followersCount')
      .lean()
    const followersMap = new Map()
    usersWithFollowers.forEach(user => {
      followersMap.set(user._id.toString(), user.followersCount || 0)
    })`;

if (content.includes(target3)) {
  content = content.replace(target3, replacement3);
  console.log('Successfully replaced usersWithFollowers target 3.');
} else {
  console.warn('Could not find target 3!');
}

// 4. getTopPerformingRegions totalLikes sum size
const target4 = `        totalLikes: { $sum: { $size: '$likes' } } 
      } 
    },
    { $sort: { totalLikes: -1 } },`;
const replacement4 = `        totalLikes: { $sum: { $ifNull: ['$likesCount', 0] } } 
      } 
    },
    { $sort: { totalLikes: -1 } },`;

if (content.includes(target4)) {
  content = content.replace(target4, replacement4);
  console.log('Successfully replaced getTopPerformingRegions target 4.');
} else {
  console.warn('Could not find target 4!');
}

// 5. getVIPUsers totalLikes sum map size
const target5 = `        totalPosts: { $size: '$posts' },
        totalLikes: { $sum: { $map: { input: '$posts', as: 'post', in: { $size: '$$post.likes' } } } } 
      }`;
const replacement5 = `        totalPosts: { $size: '$posts' },
        totalLikes: { $sum: { $map: { input: '$posts', as: 'post', in: { $ifNull: ['$$post.likesCount', 0] } } } } 
      }`;

if (content.includes(target5)) {
  content = content.replace(target5, replacement5);
  console.log('Successfully replaced getVIPUsers target 5.');
} else {
  console.warn('Could not find target 5!');
}

// 6. getContentStats totalLikes sum size
const target6 = `        totalLikes: { $sum: { $size: '$likes' } },
        totalComments: { $sum: { $size: '$comments' } }`;
const replacement6 = `        totalLikes: { $sum: { $ifNull: ['$likesCount', 0] } },
        totalComments: { $sum: { $size: '$comments' } }`;

if (content.includes(target6)) {
  content = content.replace(target6, replacement6);
  console.log('Successfully replaced getContentStats target 6.');
} else {
  console.warn('Could not find target 6!');
}

// 7. getEngagementMetrics avgLikes avg size
const target7 = `        avgLikes: { $avg: { $size: '$likes' } },
        avgComments: { $avg: { $size: '$comments' } }`;
const replacement7 = `        avgLikes: { $avg: { $ifNull: ['$likesCount', 0] } },
        avgComments: { $avg: { $size: '$comments' } }`;

if (content.includes(target7)) {
  content = content.replace(target7, replacement7);
  console.log('Successfully replaced getEngagementMetrics target 7.');
} else {
  console.warn('Could not find target 7!');
}

fs.writeFileSync(filePath, content, 'utf8');
console.log('Done refactoring enhancedSuperAdminRoutes.js. New length:', content.length);
