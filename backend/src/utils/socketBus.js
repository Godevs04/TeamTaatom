const User = require('../models/User');

async function getFollowers(userId) {
  const user = await User.findById(userId).select('followers');
  if (!user || !user.followers) return [];
  return user.followers.map(f => f.toString());
}

module.exports = { getFollowers };
