const mongoose = require('mongoose');
require('dotenv').config({ path: './environment.env' });

// Connect to MongoDB
const connectDB = async () => {
  try {
    const conn = await mongoose.connect(process.env.MONGO_URL);
    console.log(`MongoDB Connected: ${conn.connection.host}`);
  } catch (error) {
    console.error('Database connection error:', error);
    process.exit(1);
  }
};

// Post Schema (simplified for migration)
const postSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  caption: {
    type: String,
    required: true
  },
  imageUrl: {
    type: String
  },
  videoUrl: {
    type: String
  },
  cloudinaryPublicId: {
    type: String,
    required: true
  },
  tags: [{
    type: String,
    trim: true
  }],
  type: {
    type: String,
    enum: ['photo', 'short'],
    default: 'photo'
  },
  location: {
    address: {
      type: String,
      default: 'Unknown Location'
    },
    coordinates: {
      latitude: {
        type: Number,
        default: 0
      },
      longitude: {
        type: Number,
        default: 0
      }
    }
  },
  likes: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }],
  comments: [{
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    text: {
      type: String,
      required: true
    },
    createdAt: {
      type: Date,
      default: Date.now
    }
  }],
  isActive: {
    type: Boolean,
    default: true
  }
}, {
  timestamps: true
});

const Post = mongoose.model('Post', postSchema);

// Migration function
const fixShortsUrls = async () => {
  try {
    console.log('Starting shorts URL structure fix...');
    
    // Find all shorts
    const allShorts = await Post.find({ type: 'short' });
    console.log(`Found ${allShorts.length} shorts to process`);
    
    let updatedCount = 0;
    
    for (const short of allShorts) {
      let needsUpdate = false;
      const updateData = {};
      
      // Case 1: Short has videoUrl but also has imageUrl with same value (new format)
      if (short.videoUrl && short.imageUrl && short.videoUrl === short.imageUrl) {
        updateData.imageUrl = '';
        needsUpdate = true;
        console.log(`Short ${short._id}: Removing duplicate imageUrl`);
      }
      // Case 2: Short has imageUrl with video URL but no videoUrl (old format)
      else if (short.imageUrl && !short.videoUrl && short.imageUrl.includes('video/upload')) {
        updateData.videoUrl = short.imageUrl;
        updateData.imageUrl = '';
        needsUpdate = true;
        console.log(`Short ${short._id}: Moving video URL from imageUrl to videoUrl`);
      }
      
      if (needsUpdate) {
        await Post.findByIdAndUpdate(short._id, { $set: updateData });
        updatedCount++;
      }
    }
    
    console.log(`Successfully updated ${updatedCount} shorts`);
    
    // Show final statistics
    const finalShorts = await Post.find({ type: 'short' });
    console.log('\\n=== FINAL STATISTICS ===');
    
    finalShorts.forEach((short, index) => {
      console.log(`Short ${index + 1}:`);
      console.log(`  ID: ${short._id}`);
      console.log(`  Caption: ${short.caption}`);
      console.log(`  imageUrl: ${short.imageUrl || 'empty'}`);
      console.log(`  videoUrl: ${short.videoUrl || 'empty'}`);
      console.log('');
    });
    
    console.log('Migration completed successfully!');
    
  } catch (error) {
    console.error('Migration error:', error);
    throw error;
  }
};

// Main execution
const runMigration = async () => {
  try {
    await connectDB();
    await fixShortsUrls();
    console.log('Migration process completed successfully!');
    process.exit(0);
  } catch (error) {
    console.error('Migration failed:', error);
    process.exit(1);
  }
};

// Run migration if this file is executed directly
if (require.main === module) {
  runMigration();
}

module.exports = { fixShortsUrls };
