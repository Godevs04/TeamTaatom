const fs = require('fs');
const path = require('path');

const filePath = 'h:/Ganesh Files/RootedAI/taatom/TeamTaatom/backend/src/controllers/profileController.js';
let content = fs.readFileSync(filePath, 'utf8');

console.log('Original content length:', content.length);

// Normalize to LF for matching
content = content.replace(/\r\n/g, '\n');

// 1. toggleFollow counts return when cancelling request
const target1 = `            followersCount: targetUser.followers.filter(followerId => followerId.toString() !== id.toString()).length,
            followingCount: currentUser.following.filter(followingId => followingId.toString() !== currentUserId.toString()).length,`;
const replacement1 = `            followersCount: targetUser.followersCount || 0,
            followingCount: currentUser.followingCount || 0,`;

if (content.includes(target1)) {
  content = content.replace(target1, replacement1);
  console.log('Successfully replaced toggleFollow counts return.');
} else {
  console.warn('Could not find toggleFollow counts return target!');
}

// 2. searchUsers projection
const target2 = `            followers: 1,
            following: 1,
            totalLikes: 1,`;
const replacement2 = `            followersCount: 1,
            followingCount: 1,
            totalLikes: 1,`;

if (content.includes(target2)) {
  content = content.replace(target2, replacement2);
  console.log('Successfully replaced searchUsers projection.');
} else {
  console.warn('Could not find searchUsers projection target!');
}

// 3. searchUsers follow mapping
const target3 = `    const currentUserId = req.user?._id?.toString();
    const usersWithFollowStatus = usersWithProfilePics.map(user => {
      const visibility = user.settings?.privacy?.profileVisibility || 'public';
      const showEmail = user.settings?.privacy?.showEmail !== false;
      const isOwner = currentUserId && user._id?.toString() === currentUserId;
      const isFollower = currentUserId && user.followers
        ? user.followers.some(f => f.toString() === currentUserId)
        : false;
      const canSeeDetails = isOwner || visibility === 'public' || isFollower;

      const result = {
        _id: user._id?.toString() || user._id,
        username: user.username,
        fullName: user.fullName,
        profilePic: user.profilePic,
        followersCount: user.followers ? user.followers.length : 0,
        followingCount: user.following ? user.following.length : 0,
        isFollowing: currentUserId && user.followers
          ? user.followers.some(follower => follower.toString() === currentUserId)
          : false,
        profileVisibility: visibility
      };

      // Only expose email if showEmail is true and viewer can see details
      if (showEmail && canSeeDetails) {
        result.email = user.email;
      }
      // Only expose totalLikes for accessible profiles
      if (canSeeDetails) {
        result.totalLikes = user.totalLikes;
      }

      return result;
    });`;

const replacement3 = `    const currentUserId = req.user?._id?.toString();
    const userIds = users.map(u => u._id);
    
    let followingSet = new Set();
    let followerSet = new Set();
    
    if (currentUserId) {
      const [followings, followers] = await Promise.all([
        Follow.find({ follower: currentUserId, following: { $in: userIds } }).select('following').lean(),
        Follow.find({ follower: { $in: userIds }, following: currentUserId }).select('follower').lean()
      ]);
      followingSet = new Set(followings.map(f => f.following.toString()));
      followerSet = new Set(followers.map(f => f.follower.toString()));
    }

    const usersWithFollowStatus = usersWithProfilePics.map(user => {
      const visibility = user.settings?.privacy?.profileVisibility || 'public';
      const showEmail = user.settings?.privacy?.showEmail !== false;
      const isOwner = currentUserId && user._id?.toString() === currentUserId;
      const isFollower = currentUserId ? followerSet.has(user._id?.toString()) : false;
      const canSeeDetails = isOwner || visibility === 'public' || isFollower;

      const result = {
        _id: user._id?.toString() || user._id,
        username: user.username,
        fullName: user.fullName,
        profilePic: user.profilePic,
        followersCount: user.followersCount || 0,
        followingCount: user.followingCount || 0,
        isFollowing: currentUserId ? followingSet.has(user._id?.toString()) : false,
        profileVisibility: visibility
      };

      // Only expose email if showEmail is true and viewer can see details
      if (showEmail && canSeeDetails) {
        result.email = user.email;
      }
      // Only expose totalLikes for accessible profiles
      if (canSeeDetails) {
        result.totalLikes = user.totalLikes;
      }

      return result;
    });`;

if (content.includes(target3)) {
  content = content.replace(target3, replacement3);
  console.log('Successfully replaced searchUsers follow mapping.');
} else {
  console.warn('Could not find searchUsers follow mapping target!');
}

// 4. getFollowersList implementation
const target4 = `    // First get the user to check if it exists and get total count
    const user = await User.findById(id).select('followers');
    if (!user) return sendError(res, 'RES_3001', 'User does not exist');
    
    const totalFollowers = user.followers.filter(followerId => followerId.toString() !== id.toString()).length;
    
    // Get paginated followers IDs (exclude self)
    const paginatedFollowersIds = user.followers
      .filter(followerId => followerId.toString() !== id.toString())
      .slice(skip, skip + limit);
    
    // Populate the paginated followers users
    const followers = await User.find({ _id: { $in: paginatedFollowersIds } })
      .select('fullName profilePic profilePicStorageKey email followers following totalLikes isVerified followRequests settings.privacy');

    const currentUserId = req.user ? req.user._id.toString() : null;

    // Generate signed URLs for profile pictures
    const followersWithStatus = await Promise.all(followers.map(async (f) => {
      let profilePicUrl = null;

      // Special handling for Taatom Official user
      const isTaatomOfficial = f._id.toString() === TAATOM_OFFICIAL_USER_ID;
      if (isTaatomOfficial) {
        profilePicUrl = TAATOM_OFFICIAL_USER.profilePic;
      } else {
        profilePicUrl = await resolveProfilePic(f);
      }

      const isFollowing = currentUserId ? f.followers.map(String).includes(currentUserId) : false;
      const followRequestSent = currentUserId && !isFollowing
        ? (f.followRequests || []).some(req => req.user.toString() === currentUserId && req.status === 'pending')
        : false;
      return {
        _id: f._id,
        fullName: f.fullName,
        email: f.email,
        profilePic: profilePicUrl,
        totalLikes: f.totalLikes,
        isVerified: f.isVerified,
        followers: f.followers,
        following: f.following,
        isFollowing,
        followRequestSent,
      };
    }));`;

const replacement4 = `    // Check if the user exists
    const userExists = await User.exists({ _id: id });
    if (!userExists) return sendError(res, 'RES_3001', 'User does not exist');

    // Get total count of followers
    const totalFollowers = await Follow.countDocuments({ following: id, follower: { $ne: id } });
    
    // Get paginated followers IDs
    const followDocs = await Follow.find({ following: id, follower: { $ne: id } })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean();
    
    const paginatedFollowersIds = followDocs.map(doc => doc.follower);
    
    // Populate the paginated followers users
    const followers = await User.find({ _id: { $in: paginatedFollowersIds } })
      .select('fullName profilePic profilePicStorageKey email followersCount followingCount totalLikes isVerified followRequests settings.privacy');

    const currentUserId = req.user ? req.user._id.toString() : null;

    // Get following status for these users in batch
    let followedByUserIds = new Set();
    if (currentUserId) {
      const followings = await Follow.find({
        follower: currentUserId,
        following: { $in: paginatedFollowersIds }
      }).select('following').lean();
      followedByUserIds = new Set(followings.map(f => f.following.toString()));
    }

    // Generate signed URLs for profile pictures
    const followersWithStatus = await Promise.all(followers.map(async (f) => {
      let profilePicUrl = null;

      // Special handling for Taatom Official user
      const isTaatomOfficial = f._id.toString() === TAATOM_OFFICIAL_USER_ID;
      if (isTaatomOfficial) {
        profilePicUrl = TAATOM_OFFICIAL_USER.profilePic;
      } else {
        profilePicUrl = await resolveProfilePic(f);
      }

      const isFollowing = currentUserId ? followedByUserIds.has(f._id.toString()) : false;
      const followRequestSent = currentUserId && !isFollowing
        ? (f.followRequests || []).some(req => req.user.toString() === currentUserId && req.status === 'pending')
        : false;
      return {
        _id: f._id,
        fullName: f.fullName,
        email: f.email,
        profilePic: profilePicUrl,
        totalLikes: f.totalLikes,
        isVerified: f.isVerified,
        followers: f.followersCount || 0,
        following: f.followingCount || 0,
        isFollowing,
        followRequestSent,
      };
    }));`;

if (content.includes(target4)) {
  content = content.replace(target4, replacement4);
  console.log('Successfully replaced getFollowersList implementation.');
} else {
  console.warn('Could not find getFollowersList target!');
}

// 5. getFollowingList implementation
const target5 = `    // First get the user to check if it exists and get total count
    const user = await User.findById(id).select('following');
    if (!user) return sendError(res, 'RES_3001', 'User does not exist');
    
    const totalFollowing = user.following.filter(followingId => followingId.toString() !== id.toString()).length;
    
    // Get paginated following IDs (exclude self)
    const paginatedFollowingIds = user.following
      .filter(followingId => followingId.toString() !== id.toString())
      .slice(skip, skip + limit);
    
    // Populate the paginated following users
    const following = await User.find({ _id: { $in: paginatedFollowingIds } })
      .select('fullName profilePic profilePicStorageKey email followers following totalLikes isVerified followRequests settings.privacy');

    const currentUserId = req.user ? req.user._id.toString() : null;

    // Generate signed URLs for profile pictures
    const followingWithStatus = await Promise.all(following.map(async (f) => {
      let profilePicUrl = null;

      // Special handling for Taatom Official user
      const isTaatomOfficial = f._id.toString() === TAATOM_OFFICIAL_USER_ID;
      if (isTaatomOfficial) {
        profilePicUrl = TAATOM_OFFICIAL_USER.profilePic;
      } else {
        profilePicUrl = await resolveProfilePic(f);
      }

      const isFollowing = currentUserId ? f.followers.map(String).includes(currentUserId) : false;
      const followRequestSent = currentUserId && !isFollowing
        ? (f.followRequests || []).some(req => req.user.toString() === currentUserId && req.status === 'pending')
        : false;
      return {
        _id: f._id,
        fullName: f.fullName,
        email: f.email,
        profilePic: profilePicUrl,
        totalLikes: f.totalLikes,
        isVerified: f.isVerified,
        followers: f.followers,
        following: f.following,
        isFollowing,
        followRequestSent,
      };
    }));`;

const replacement5 = `    // Check if the user exists
    const userExists = await User.exists({ _id: id });
    if (!userExists) return sendError(res, 'RES_3001', 'User does not exist');

    // Get total count of following
    const totalFollowing = await Follow.countDocuments({ follower: id, following: { $ne: id } });
    
    // Get paginated following IDs
    const followDocs = await Follow.find({ follower: id, following: { $ne: id } })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean();
    
    const paginatedFollowingIds = followDocs.map(doc => doc.following);
    
    // Populate the paginated following users
    const following = await User.find({ _id: { $in: paginatedFollowingIds } })
      .select('fullName profilePic profilePicStorageKey email followersCount followingCount totalLikes isVerified followRequests settings.privacy');

    const currentUserId = req.user ? req.user._id.toString() : null;

    // Get following status for these users in batch
    let followedByUserIds = new Set();
    if (currentUserId) {
      const followings = await Follow.find({
        follower: currentUserId,
        following: { $in: paginatedFollowingIds }
      }).select('following').lean();
      followedByUserIds = new Set(followings.map(f => f.following.toString()));
    }

    // Generate signed URLs for profile pictures
    const followingWithStatus = await Promise.all(following.map(async (f) => {
      let profilePicUrl = null;

      // Special handling for Taatom Official user
      const isTaatomOfficial = f._id.toString() === TAATOM_OFFICIAL_USER_ID;
      if (isTaatomOfficial) {
        profilePicUrl = TAATOM_OFFICIAL_USER.profilePic;
      } else {
        profilePicUrl = await resolveProfilePic(f);
      }

      const isFollowing = currentUserId ? followedByUserIds.has(f._id.toString()) : false;
      const followRequestSent = currentUserId && !isFollowing
        ? (f.followRequests || []).some(req => req.user.toString() === currentUserId && req.status === 'pending')
        : false;
      return {
        _id: f._id,
        fullName: f.fullName,
        email: f.email,
        profilePic: profilePicUrl,
        totalLikes: f.totalLikes,
        isVerified: f.isVerified,
        followers: f.followersCount || 0,
        following: f.followingCount || 0,
        isFollowing,
        followRequestSent,
      };
    }));`;

if (content.includes(target5)) {
  content = content.replace(target5, replacement5);
  console.log('Successfully replaced getFollowingList implementation.');
} else {
  console.warn('Could not find getFollowingList target!');
}

// 6. approveFollowRequest idempotency check and status save and Follow creation
// Target 6.1 (idempotency check)
const target6_1 = `    // Check if requester is already a follower (idempotency - allow re-approval)
    const isAlreadyFollower = user.followers.some(followerId => 
      followerId.toString() === requestId.toString()
    );`;

const replacement6_1 = `    // Check if requester is already a follower (idempotency - allow re-approval)
    const isAlreadyFollower = await Follow.exists({ follower: requestId, following: currentUserId });`;

if (content.includes(target6_1)) {
  content = content.replace(target6_1, replacement6_1);
  console.log('Successfully replaced approveFollowRequest idempotency check.');
} else {
  console.warn('Could not find approveFollowRequest idempotency check target!');
}

// Target 6.2 (idempotent response)
const target6_2 = `    // If already a follower, return success (idempotent operation)
    if (isAlreadyFollower) {
      logger.debug('✅ Request already processed - returning success (idempotent)');
      return sendSuccess(res, 200, 'Follow request already approved', {
        followersCount: user.followers.length,
        alreadyProcessed: true
      });
    }`;

const replacement6_2 = `    // If already a follower, return success (idempotent operation)
    if (isAlreadyFollower) {
      logger.debug('✅ Request already processed - returning success (idempotent)');
      return sendSuccess(res, 200, 'Follow request already approved', {
        followersCount: user.followersCount || 0,
        alreadyProcessed: true
      });
    }`;

if (content.includes(target6_2)) {
  content = content.replace(target6_2, replacement6_2);
  console.log('Successfully replaced approveFollowRequest idempotent response.');
} else {
  console.warn('Could not find approveFollowRequest idempotent response target!');
}

// Target 6.3 (status updates and retry logic block)
const target6_3 = `    // Add to followers/following (prevent duplicates)
    if (!user.followers.some(followerId => followerId.toString() === requesterId.toString())) {
      user.followers.push(requesterId);
    }
    if (!requester.following.some(followingId => followingId.toString() === currentUserId.toString())) {
      requester.following.push(currentUserId);
    }

    // Update request status
    request.status = 'approved';
    
    // Update requester's sent request status
    const sentRequest = requester.sentFollowRequests.find(
      req => req.user.toString() === currentUserId.toString()
    );
    if (sentRequest) {
      sentRequest.status = 'approved';
    }

    // Save with retry logic to handle version conflicts
    let retryCount = 0;
    const maxRetries = 3;
    
    while (retryCount < maxRetries) {
      try {
        await Promise.all([user.save(), requester.save()]);
        logger.debug('Successfully saved user and requester');
        break;
      } catch (error) {
        if (error.name === 'VersionError' && retryCount < maxRetries - 1) {
          logger.debug(\`Version conflict, retrying... (\${retryCount + 1}/\${maxRetries})\`);
          // Reload the documents to get the latest version
          const freshUser = await User.findById(currentUserId);
          const freshRequester = await User.findById(requesterId);
          
          // Re-apply the changes (check for duplicates first)
          if (!freshUser.followers.some(followerId => followerId.toString() === requesterId.toString())) {
            freshUser.followers.push(requesterId);
          }
          if (!freshRequester.following.some(followingId => followingId.toString() === currentUserId.toString())) {
            freshRequester.following.push(currentUserId);
          }
          
          // Find the request by requester ID (not by _id)
          const freshRequest = freshUser.followRequests.find(req => 
            req.user.toString() === requestId.toString() && req.status === 'pending'
          );
          if (freshRequest) {
            freshRequest.status = 'approved';
          }
          
          const freshSentRequest = freshRequester.sentFollowRequests.find(
            req => req.user.toString() === currentUserId.toString() && req.status === 'pending'
          );
          if (freshSentRequest) {
            freshSentRequest.status = 'approved';
          }
          
          user = freshUser;
          requester = freshRequester;
          retryCount++;
        } else {
          throw error;
        }
      }
    }`;

const replacement6_3 = `    // Update request status
    request.status = 'approved';
    
    // Update requester's sent request status
    const sentRequest = requester.sentFollowRequests.find(
      req => req.user.toString() === currentUserId.toString()
    );
    if (sentRequest) {
      sentRequest.status = 'approved';
    }

    // Save with retry logic to handle version conflicts
    let retryCount = 0;
    const maxRetries = 3;
    
    while (retryCount < maxRetries) {
      try {
        await Promise.all([user.save(), requester.save()]);
        logger.debug('Successfully saved user and requester');
        break;
      } catch (error) {
        if (error.name === 'VersionError' && retryCount < maxRetries - 1) {
          logger.debug(\`Version conflict, retrying... (\${retryCount + 1}/\${maxRetries})\`);
          // Reload the documents to get the latest version
          const freshUser = await User.findById(currentUserId);
          const freshRequester = await User.findById(requesterId);
          
          // Find the request by requester ID (not by _id)
          const freshRequest = freshUser.followRequests.find(req => 
            req.user.toString() === requestId.toString() && req.status === 'pending'
          );
          if (freshRequest) {
            freshRequest.status = 'approved';
          }
          
          const freshSentRequest = freshRequester.sentFollowRequests.find(
            req => req.user.toString() === currentUserId.toString() && req.status === 'pending'
          );
          if (freshSentRequest) {
            freshSentRequest.status = 'approved';
          }
          
          user = freshUser;
          requester = freshRequester;
          retryCount++;
        } else {
          throw error;
        }
      }
    }

    // Create Follow relationship and increment counts if not already exists
    const followExists = await Follow.exists({ follower: requesterId, following: currentUserId });
    if (!followExists) {
      await Follow.create({ follower: requesterId, following: currentUserId });
      await User.findByIdAndUpdate(currentUserId, { $inc: { followersCount: 1 } });
      await User.findByIdAndUpdate(requesterId, { $inc: { followingCount: 1 } });
      // Reload user so we have the updated followersCount
      user = await User.findById(currentUserId);
    }`;

if (content.includes(target6_3)) {
  content = content.replace(target6_3, replacement6_3);
  console.log('Successfully replaced approveFollowRequest status and retry logic.');
} else {
  console.warn('Could not find approveFollowRequest status and retry logic target!');
}

// Target 6.4 (success response)
const target6_4 = `    return sendSuccess(res, 200, 'Follow request approved', {
      followersCount: user.followers.length
    });`;

const replacement6_4 = `    return sendSuccess(res, 200, 'Follow request approved', {
      followersCount: user.followersCount || 0
    });`;

if (content.includes(target6_4)) {
  content = content.replace(target6_4, replacement6_4);
  console.log('Successfully replaced approveFollowRequest success response.');
} else {
  console.warn('Could not find approveFollowRequest success response target!');
}

// 7. getTravelMapData privacy check
const target7 = `    // Privacy check: respect showLocation toggle and profileVisibility
    const targetUser = await User.findById(id).select('settings.privacy followers following').lean();
    if (!targetUser) {
      return sendError(res, 'RES_3001', 'User does not exist');
    }
    const isOwnProfile = req.user ? req.user._id.toString() === id : false;
    if (!isOwnProfile) {
      const showLocation = targetUser.settings?.privacy?.showLocation !== false;
      const profileVisibility = targetUser.settings?.privacy?.profileVisibility || 'public';
      const emptyResponse = { locations: [], statistics: { totalLocations: 0, totalDistance: 0, totalDays: 0 } };

      if (!showLocation) {
        return sendSuccess(res, 200, 'Travel map data fetched successfully', emptyResponse);
      }
      if (profileVisibility === 'followers') {
        // Followers: requester must be in the profile owner's followers list
        if (!req.user) {
          return sendSuccess(res, 200, 'Travel map data fetched successfully', emptyResponse);
        }
        const requesterId = req.user._id.toString();
        const isFollower = (targetUser.followers || []).some(f => {
          const fId = typeof f === 'object' && f._id ? f._id.toString() : f.toString();
          return fId === requesterId;
        });
        if (!isFollower) {
          return sendSuccess(res, 200, 'Travel map data fetched successfully', emptyResponse);
        }
      } else if (profileVisibility === 'private') {
        // Private: requester must be in the profile owner's followers list
        if (!req.user) {
          return sendSuccess(res, 200, 'Travel map data fetched successfully', emptyResponse);
        }
        const requesterId = req.user._id.toString();
        const isFollower = (targetUser.followers || []).some(f => {
          const fId = typeof f === 'object' && f._id ? f._id.toString() : f.toString();
          return fId === requesterId;
        });
        if (!isFollower) {
          return sendSuccess(res, 200, 'Travel map data fetched successfully', emptyResponse);
        }
      }
    }`;

const replacement7 = `    // Privacy check: respect showLocation toggle and profileVisibility
    const targetUser = await User.findById(id).select('settings.privacy').lean();
    if (!targetUser) {
      return sendError(res, 'RES_3001', 'User does not exist');
    }
    const isOwnProfile = req.user ? req.user._id.toString() === id : false;
    if (!isOwnProfile) {
      const showLocation = targetUser.settings?.privacy?.showLocation !== false;
      const profileVisibility = targetUser.settings?.privacy?.profileVisibility || 'public';
      const emptyResponse = { locations: [], statistics: { totalLocations: 0, totalDistance: 0, totalDays: 0 } };

      if (!showLocation) {
        return sendSuccess(res, 200, 'Travel map data fetched successfully', emptyResponse);
      }
      if (profileVisibility === 'followers' || profileVisibility === 'private') {
        if (!req.user) {
          return sendSuccess(res, 200, 'Travel map data fetched successfully', emptyResponse);
        }
        const requesterId = req.user._id.toString();
        const isFollower = await Follow.exists({ follower: requesterId, following: id });
        if (!isFollower) {
          return sendSuccess(res, 200, 'Travel map data fetched successfully', emptyResponse);
        }
      }
    }`;

if (content.includes(target7)) {
  content = content.replace(target7, replacement7);
  console.log('Successfully replaced getTravelMapData privacy check.');
} else {
  console.warn('Could not find getTravelMapData privacy check target!');
}

// 8. toggleBlockUser array manipulations removal
const target8 = `      // Remove from following/followers if exists
      currentUser.following.pull(id);
      currentUser.followers.pull(id);
      targetUser.following.pull(currentUserId);
      targetUser.followers.pull(currentUserId);`;

const replacement8 = `      // Remove follow relationships if they exist
      const deleteResult1 = await Follow.deleteOne({ follower: currentUserId, following: id });
      if (deleteResult1.deletedCount > 0) {
        await User.findByIdAndUpdate(currentUserId, { $inc: { followingCount: -1 } });
        await User.findByIdAndUpdate(id, { $inc: { followersCount: -1 } });
      }
      
      const deleteResult2 = await Follow.deleteOne({ follower: id, following: currentUserId });
      if (deleteResult2.deletedCount > 0) {
        await User.findByIdAndUpdate(id, { $inc: { followingCount: -1 } });
        await User.findByIdAndUpdate(currentUserId, { $inc: { followersCount: -1 } });
      }`;

if (content.includes(target8)) {
  content = content.replace(target8, replacement8);
  console.log('Successfully replaced toggleBlockUser array pull operations.');
} else {
  console.warn('Could not find toggleBlockUser target!');
}

// 9. getSuggestedUsers follows array logic and schema counts
const target9 = `    const currentUser = await User.findById(userId).select('following interests').lean();
    const followingIds = (currentUser.following || []).map(f => f.toString());
    followingIds.push(userId.toString());
    const userInterests = Array.isArray(currentUser.interests) ? currentUser.interests : [];

    let suggestedUsers = [];
    const seenIds = new Set(followingIds);

    // 1. Same interests first (like real apps): users who share at least one interest
    // Note: User model has no isActive; do not filter by it or no users would match
    if (userInterests.length > 0) {
      const sameInterestUsers = await User.find({
        _id: { $nin: followingIds },
        interests: { $in: userInterests },
      })
        .select('username fullName profilePic profilePicStorageKey bio followers isVerified createdAt interests')
        .limit(limit * 2)
        .lean();

      // Sort by how many interests match (most first), then verified, then followers
      const withMatchCount = sameInterestUsers.map((u) => {
        const matchCount = (u.interests || []).filter((i) => userInterests.includes(i)).length;
        return { ...u, _matchCount: matchCount };
      });
      withMatchCount.sort((a, b) => {
        if (b._matchCount !== a._matchCount) return b._matchCount - a._matchCount;
        if (a.isVerified !== b.isVerified) return b.isVerified ? 1 : -1;
        return (b.followers?.length || 0) - (a.followers?.length || 0);
      });
      const chosen = withMatchCount.slice(0, limit).map(({ _matchCount, ...u }) => u);
      suggestedUsers = chosen;
      chosen.forEach((u) => seenIds.add(u._id.toString()));
    }

    // 2. Fill remaining with verified then any active users (no interest filter)
    if (suggestedUsers.length < limit) {
      const excludeIds = [...seenIds];
      const need = limit - suggestedUsers.length;

      let fillUsers = await User.find({
        _id: { $nin: excludeIds },
        isVerified: true,
      })
        .select('username fullName profilePic profilePicStorageKey bio followers isVerified createdAt')
        .limit(need * 2)
        .sort({ followers: -1, createdAt: -1 })
        .lean();

      if (fillUsers.length < need) {
        const more = await User.find({
          _id: { $nin: [...excludeIds, ...fillUsers.map((u) => u._id.toString())] },
        })
          .select('username fullName profilePic profilePicStorageKey bio followers isVerified createdAt')
          .limit(need * 2 - fillUsers.length)
          .sort({ followers: -1, createdAt: -1 })
          .lean();
        fillUsers = fillUsers.concat(more);
      }

      suggestedUsers = suggestedUsers.concat(fillUsers.slice(0, need));
    }

    // Get post counts and final shape
    const usersWithPostCounts = await Promise.all(
      suggestedUsers.slice(0, limit).map(async (user) => {
        const postCount = await Post.countDocuments({
          user: user._id,
          isActive: true,
          isHidden: { $ne: true },
          isArchived: { $ne: true },
          type: { $in: ['photo', 'short'] },
          $or: [{ status: 'active' }, { status: { $exists: false } }]
        });
        user.profilePic = await resolveProfilePic(user);
        const { interests: _i, profilePicStorageKey: _psk, ...rest } = user;
        return {
          ...rest,
          postsCount: postCount,
          followersCount: user.followers?.length || 0,
        };
      })
    );`;

const replacement9 = `    const currentUser = await User.findById(userId).select('interests').lean();
    if (!currentUser) return sendError(res, 'RES_3001', 'User does not exist');
    const userInterests = Array.isArray(currentUser.interests) ? currentUser.interests : [];

    const follows = await Follow.find({ follower: userId }).select('following').lean();
    const followingIds = follows.map(f => f.following.toString());
    followingIds.push(userId.toString());

    let suggestedUsers = [];
    const seenIds = new Set(followingIds);

    // 1. Same interests first (like real apps): users who share at least one interest
    // Note: User model has no isActive; do not filter by it or no users would match
    if (userInterests.length > 0) {
      const sameInterestUsers = await User.find({
        _id: { $nin: followingIds },
        interests: { $in: userInterests },
      })
        .select('username fullName profilePic profilePicStorageKey bio followersCount isVerified createdAt interests')
        .limit(limit * 2)
        .lean();

      // Sort by how many interests match (most first), then verified, then followers
      const withMatchCount = sameInterestUsers.map((u) => {
        const matchCount = (u.interests || []).filter((i) => userInterests.includes(i)).length;
        return { ...u, _matchCount: matchCount };
      });
      withMatchCount.sort((a, b) => {
        if (b._matchCount !== a._matchCount) return b._matchCount - a._matchCount;
        if (a.isVerified !== b.isVerified) return b.isVerified ? 1 : -1;
        return (b.followersCount || 0) - (a.followersCount || 0);
      });
      const chosen = withMatchCount.slice(0, limit).map(({ _matchCount, ...u }) => u);
      suggestedUsers = chosen;
      chosen.forEach((u) => seenIds.add(u._id.toString()));
    }

    // 2. Fill remaining with verified then any active users (no interest filter)
    if (suggestedUsers.length < limit) {
      const excludeIds = [...seenIds];
      const need = limit - suggestedUsers.length;

      let fillUsers = await User.find({
        _id: { $nin: excludeIds },
        isVerified: true,
      })
        .select('username fullName profilePic profilePicStorageKey bio followersCount isVerified createdAt')
        .limit(need * 2)
        .sort({ followersCount: -1, createdAt: -1 })
        .lean();

      if (fillUsers.length < need) {
        const more = await User.find({
          _id: { $nin: [...excludeIds, ...fillUsers.map((u) => u._id.toString())] },
        })
          .select('username fullName profilePic profilePicStorageKey bio followersCount isVerified createdAt')
          .limit(need * 2 - fillUsers.length)
          .sort({ followersCount: -1, createdAt: -1 })
          .lean();
        fillUsers = fillUsers.concat(more);
      }

      suggestedUsers = suggestedUsers.concat(fillUsers.slice(0, need));
    }

    // Get post counts and final shape
    const usersWithPostCounts = await Promise.all(
      suggestedUsers.slice(0, limit).map(async (user) => {
        const postCount = await Post.countDocuments({
          user: user._id,
          isActive: true,
          isHidden: { $ne: true },
          isArchived: { $ne: true },
          type: { $in: ['photo', 'short'] },
          $or: [{ status: 'active' }, { status: { $exists: false } }]
        });
        user.profilePic = await resolveProfilePic(user);
        const { interests: _i, profilePicStorageKey: _psk, ...rest } = user;
        return {
          ...rest,
          postsCount: postCount,
          followersCount: user.followersCount || 0,
        };
      })
    );`;

if (content.includes(target9)) {
  content = content.replace(target9, replacement9);
  console.log('Successfully replaced getSuggestedUsers follows logic.');
} else {
  console.warn('Could not find getSuggestedUsers follows logic target!');
}

fs.writeFileSync(filePath, content, 'utf8');
console.log('Done refactoring profileController.js. New length:', content.length);
