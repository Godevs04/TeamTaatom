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
    type: String,
    required: true
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
const migrateShortsVideoUrl = async () => {
  try {
    console.log('Starting shorts videoUrl migration...');
    
    // Find all shorts without videoUrl field
    const shortsWithoutVideoUrl = await Post.find({
      type: 'short',
      $or: [
        { videoUrl: { $exists: false } },
        { videoUrl: null },
        { videoUrl: undefined }
      ]
    });
    
    console.log(`Found ${shortsWithoutVideoUrl.length} shorts without videoUrl field`);
    
    if (shortsWithoutVideoUrl.length === 0) {
      console.log('No shorts need migration. All shorts already have videoUrl field.');
      return;
    }
    
    // Update all shorts to have videoUrl = imageUrl
    const updateResult = await Post.updateMany(
      {
        type: 'short',
        $or: [
          { videoUrl: { $exists: false } },
          { videoUrl: null },
          { videoUrl: undefined }
        ]
      },
      {
        $set: { videoUrl: '$imageUrl' }
      }
    );
    
    console.log(`Successfully updated ${updateResult.modifiedCount} shorts with videoUrl field`);
    
    // Verify the update
    const remainingWithoutVideoUrl = await Post.countDocuments({
      type: 'short',
      $or: [
        { videoUrl: { $exists: false } },
        { videoUrl: null },
        { videoUrl: undefined }
      ]
    });
    console.log(`Remaining shorts without videoUrl: ${remainingWithoutVideoUrl}`);
    
    // Show final statistics
    const totalShorts = await Post.countDocuments({ type: 'short' });
    const shortsWithVideoUrl = await Post.countDocuments({ 
      type: 'short', 
      videoUrl: { $exists: true, $ne: null } 
    });
    
    console.log('\\n=== FINAL STATISTICS ===');
    console.log('Total shorts:', totalShorts);
    console.log('Shorts with videoUrl:', shortsWithVideoUrl);
    
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
    await migrateShortsVideoUrl();
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

module.exports = { migrateShortsVideoUrl };
