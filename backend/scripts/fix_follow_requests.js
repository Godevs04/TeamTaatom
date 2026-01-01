const mongoose = require('mongoose');
const User = require('../src/models/User');

// Connect to MongoDB
mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/teamtaatom', {
  useNewUrlParser: true,
  useUnifiedTopology: true,
});

async function fixFollowRequests() {
  try {
    console.log('🔧 Starting follow request data migration...');
    
    const users = await User.find({});
    let fixedCount = 0;
    
    for (const user of users) {
      let needsUpdate = false;
      
      // Check followRequests array
      for (const request of user.followRequests) {
        // If the request has a user ID that's not in the user's followers, it might be wrong
        const isFollower = user.followers.includes(request.user);
        if (!isFollower && request.status === 'pending') {
          console.log(`🔍 Found potentially incorrect follow request for user ${user.fullName}:`, {
            requestUserId: request.user,
            userFollowers: user.followers.length,
            isFollower: isFollower
          });
          
          // Try to find the correct requester by looking at sentFollowRequests
          const requester = await User.findOne({
            'sentFollowRequests.user': user._id,
            'sentFollowRequests.status': 'pending'
          });
          
          if (requester) {
            console.log(`✅ Found correct requester: ${requester.fullName}`);
            request.user = requester._id;
            needsUpdate = true;
            fixedCount++;
          } else {
            console.log(`❌ Could not find correct requester, removing invalid request`);
            user.followRequests = user.followRequests.filter(req => req._id.toString() !== request._id.toString());
            needsUpdate = true;
          }
        }
      }
      
      if (needsUpdate) {
        await user.save();
        console.log(`✅ Updated user: ${user.fullName}`);
      }
    }
    
    console.log(`🎉 Migration completed! Fixed ${fixedCount} follow requests.`);
    process.exit(0);
    
  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  }
}

fixFollowRequests();
