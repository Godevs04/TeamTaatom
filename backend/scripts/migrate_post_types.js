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
const migratePostTypes = async () => {
  try {
    console.log('Starting post type migration...');
    
    // Find all posts without a type field or with null/undefined type
    const postsWithoutType = await Post.find({
      $or: [
        { type: { $exists: false } },
        { type: null },
        { type: undefined }
      ]
    });
    
    console.log(`Found ${postsWithoutType.length} posts without type field`);
    
    if (postsWithoutType.length === 0) {
      console.log('No posts need migration. All posts already have type field.');
      return;
    }
    
    // Update all posts without type to be 'photo' type
    const updateResult = await Post.updateMany(
      {
        $or: [
          { type: { $exists: false } },
          { type: null },
          { type: undefined }
        ]
      },
      {
        $set: { type: 'photo' }
      }
    );
    
    console.log(`Successfully updated ${updateResult.modifiedCount} posts to type 'photo'`);
    
    // Also check for any posts that might have been created as shorts but don't have the type set
    // This is a safety check - if you have any specific logic to identify shorts, add it here
    
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
    await migratePostTypes();
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

module.exports = { migratePostTypes };
