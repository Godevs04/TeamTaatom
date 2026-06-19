const Follow = require('../models/Follow');

async function getFollowers(userId) {
  const follows = await Follow.find({ following: userId }).select('follower').lean();
  return follows.map(f => f.follower.toString());
}

module.exports = { getFollowers };
