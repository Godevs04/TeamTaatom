/**
 * Unit Tests for TripVisit Service
 * 
 * Tests TripVisit creation, trust level assignment, and fraud detection logic.
 */

const mongoose = require('mongoose');
const TripVisit = require('../models/TripVisit');
const User = require('../models/User');
const Post = require('../models/Post');
const { 
  createTripVisitFromPost, 
  determineSource, 
  assignTrustLevel 
} = require('../services/tripVisitService');
const { TRUSTED_TRUST_LEVELS } = require('../config/tripScoreConfig');

// Mock logger to avoid console noise during tests
jest.mock('../utils/logger', () => ({
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
}));

describe('TripVisit Service', () => {
  let testUser;
  let testPost;

  beforeAll(async () => {
    // Connect to test database
    if (mongoose.connection.readyState === 0) {
      // Use MONGODB_TEST_URI if set, otherwise use MONGO_URL (the actual backend env var) with _test suffix
      let mongoUri = process.env.MONGODB_TEST_URI;
      
      if (!mongoUri) {
        const baseUri = process.env.MONGO_URL;
        
        if (!baseUri) {
          throw new Error('MONGO_URL is not set in .env file. Please set it to your MongoDB Atlas connection string.');
        }
        
        // Handle MongoDB Atlas URIs (mongodb+srv://) and standard URIs
        // Replace database name with test database
        if (baseUri.includes('/Taatom')) {
          // MongoDB Atlas often uses capital T in database name
          mongoUri = baseUri.replace(/\/Taatom(\?|$)/, '/taatom_test$1');
        } else if (baseUri.includes('/taatom')) {
          mongoUri = baseUri.replace(/\/taatom(\?|$)/, '/taatom_test$1');
        } else if (baseUri.includes('?retryWrites')) {
          // MongoDB Atlas URI with query params but no explicit database
          // Insert database name before query params
          mongoUri = baseUri.replace(/\?retryWrites/, '/taatom_test?retryWrites');
        } else if (baseUri.match(/mongodb(\+srv)?:\/\/[^\/]+$/)) {
          // URI without database name, append test database
          mongoUri = baseUri + '/taatom_test';
        } else {
          // Fallback: try to append /taatom_test
          mongoUri = baseUri.replace(/([^\/])(\?|$)/, '$1/taatom_test$2');
        }
      }
      
      // Debug: Log the URI being used (masked)
      const maskedUri = mongoUri.replace(/\/\/[^:]+:[^@]+@/, '//***:***@');
      console.log('🔗 Connecting to test database:', maskedUri);
      
      try {
        await mongoose.connect(mongoUri);
        console.log('✅ Connected to test database successfully');
      } catch (error) {
        console.error('❌ Failed to connect to test database:', error.message);
        console.error('💡 Make sure MONGO_URL is set correctly in backend/.env file');
        console.error('💡 For MongoDB Atlas, ensure your IP is whitelisted');
        throw error;
      }
    }
  }, 60000); // Increase timeout to 60 seconds for database connection

  afterAll(async () => {
    if (mongoose.connection.readyState !== 0) {
      await mongoose.connection.close();
      console.log('✅ Disconnected from test database');
    }
  });

  beforeEach(async () => {
    // Clean up test data
    await TripVisit.deleteMany({});
    await Post.deleteMany({});
    await User.deleteMany({});

    // Create test user
    testUser = new User({
      username: 'testuser',
      email: 'test@example.com',
      password: 'hashedpassword',
      fullName: 'Test User'
    });
    await testUser.save();

    // Create test post
    testPost = new Post({
      user: testUser._id,
      caption: 'Test post',
      imageUrl: 'https://example.com/image.jpg',
      type: 'photo',
      location: {
        address: 'Test Location, Test Country',
        coordinates: {
          latitude: 40.7128,
          longitude: -74.0060
        }
      }
    });
    await testPost.save();
  });

  describe('determineSource', () => {
    it('should return "taatom_camera_live" when fromCamera is true', () => {
      const metadata = { fromCamera: true };
      const source = determineSource(testPost, metadata);
      expect(source).toBe('taatom_camera_live');
    });

    it('should return "gallery_exif" when hasExifGps is true', () => {
      const metadata = { hasExifGps: true, source: 'gallery_exif' };
      const source = determineSource(testPost, metadata);
      expect(source).toBe('gallery_exif');
    });

    it('should return "gallery_no_exif" when location exists but no EXIF', () => {
      const metadata = { hasExifGps: false, source: 'gallery_no_exif' };
      const source = determineSource(testPost, metadata);
      expect(source).toBe('gallery_no_exif');
    });

    it('should return "manual_only" when no metadata provided', () => {
      // Create a post without coordinates to test manual_only
      const postWithoutCoords = {
        ...testPost.toObject(),
        location: {
          address: 'Test Location',
          coordinates: {
            latitude: 0,
            longitude: 0
          }
        }
      };
      const source = determineSource(postWithoutCoords, {});
      expect(source).toBe('manual_only');
    });
  });

  describe('assignTrustLevel', () => {
    it('should assign "high" trust for taatom_camera_live source', async () => {
      const visitData = {
        source: 'taatom_camera_live',
        lat: 40.7128,
        lng: -74.0060,
        takenAt: new Date(),
        uploadedAt: new Date()
      };
      const trustLevel = await assignTrustLevel(visitData, []);
      expect(trustLevel).toBe('high');
    });

    it('should assign "medium" trust for gallery_exif source', async () => {
      const visitData = {
        source: 'gallery_exif',
        lat: 40.7128,
        lng: -74.0060,
        takenAt: new Date(),
        uploadedAt: new Date()
      };
      const trustLevel = await assignTrustLevel(visitData, []);
      expect(trustLevel).toBe('medium');
    });

    it('should assign "low" trust for gallery_no_exif source', async () => {
      const visitData = {
        source: 'gallery_no_exif',
        lat: 40.7128,
        lng: -74.0060,
        takenAt: new Date(),
        uploadedAt: new Date()
      };
      const trustLevel = await assignTrustLevel(visitData, []);
      expect(trustLevel).toBe('low');
    });

    it('should assign "unverified" trust for manual_only source', async () => {
      const visitData = {
        source: 'manual_only',
        lat: 40.7128,
        lng: -74.0060,
        takenAt: new Date(),
        uploadedAt: new Date()
      };
      const trustLevel = await assignTrustLevel(visitData, []);
      expect(trustLevel).toBe('unverified');
    });

    it('should mark as "suspicious" for impossible travel', async () => {
      // First visit in India
      const firstVisit = {
        lat: 28.6139,
        lng: 77.2090,
        takenAt: new Date('2025-01-01T10:00:00Z'),
        uploadedAt: new Date('2025-01-01T10:00:00Z'),
        trustLevel: 'medium'
      };

      // Second visit in US 30 minutes later (impossible)
      const visitData = {
        source: 'gallery_exif',
        lat: 40.7128,
        lng: -74.0060,
        takenAt: new Date('2025-01-01T10:30:00Z'), // 30 minutes later
        uploadedAt: new Date('2025-01-01T10:30:00Z')
      };

      const trustLevel = await assignTrustLevel(visitData, [firstVisit]);
      expect(trustLevel).toBe('suspicious');
    });
  });

  describe('createTripVisitFromPost', () => {
    it('should create high trust visit for camera post', async () => {
      const metadata = {
        fromCamera: true,
        hasExifGps: true,
        takenAt: new Date(),
        source: 'taatom_camera_live'
      };

      const visit = await createTripVisitFromPost(testPost, metadata);
      
      expect(visit).toBeTruthy();
      expect(visit.user.toString()).toBe(testUser._id.toString());
      expect(visit.post.toString()).toBe(testPost._id.toString());
      expect(visit.source).toBe('taatom_camera_live');
      expect(visit.trustLevel).toBe('high');
      expect(visit.isActive).toBe(true);
    });

    it('should create medium trust visit for gallery EXIF post', async () => {
      const metadata = {
        hasExifGps: true,
        takenAt: new Date(),
        source: 'gallery_exif'
      };

      const visit = await createTripVisitFromPost(testPost, metadata);
      
      expect(visit).toBeTruthy();
      expect(visit.source).toBe('gallery_exif');
      expect(visit.trustLevel).toBe('medium');
    });

    it('should create low trust visit for gallery without EXIF', async () => {
      const metadata = {
        hasExifGps: false,
        source: 'gallery_no_exif'
      };

      const visit = await createTripVisitFromPost(testPost, metadata);
      
      expect(visit).toBeTruthy();
      expect(visit.source).toBe('gallery_no_exif');
      expect(visit.trustLevel).toBe('low');
    });

    it('should create unverified visit for manual-only location', async () => {
      const metadata = {
        source: 'manual_only'
      };

      const visit = await createTripVisitFromPost(testPost, metadata);
      
      expect(visit).toBeTruthy();
      expect(visit.source).toBe('manual_only');
      expect(visit.trustLevel).toBe('unverified');
    });

    it('should not create visit for post without valid location', async () => {
      const postWithoutLocation = new Post({
        user: testUser._id,
        caption: 'No location',
        imageUrl: 'https://example.com/image.jpg',
        type: 'photo',
        location: {
          address: 'Unknown Location',
          coordinates: {
            latitude: 0,
            longitude: 0
          }
        }
      });
      await postWithoutLocation.save();

      const metadata = { source: 'manual_only' };
      const visit = await createTripVisitFromPost(postWithoutLocation, metadata);
      
      expect(visit).toBeNull();
    });
  });

  describe('Trust Level Filtering', () => {
    it('should only count high and medium trust visits in TripScore', async () => {
      // Create visits with different trust levels
      const highVisit = new TripVisit({
        user: testUser._id,
        post: testPost._id,
        contentType: 'post',
        lat: 40.7128,
        lng: -74.0060,
        continent: 'NORTH AMERICA',
        country: 'United States',
        address: 'New York, NY',
        source: 'taatom_camera_live',
        trustLevel: 'high',
        uploadedAt: new Date(),
        isActive: true
      });
      await highVisit.save();

      const mediumVisit = new TripVisit({
        user: testUser._id,
        post: testPost._id,
        contentType: 'post',
        lat: 51.5074,
        lng: -0.1278,
        continent: 'EUROPE',
        country: 'United Kingdom',
        address: 'London, UK',
        source: 'gallery_exif',
        trustLevel: 'medium',
        uploadedAt: new Date(),
        isActive: true
      });
      await mediumVisit.save();

      const lowVisit = new TripVisit({
        user: testUser._id,
        post: testPost._id,
        contentType: 'post',
        lat: 48.8566,
        lng: 2.3522,
        continent: 'EUROPE',
        country: 'France',
        address: 'Paris, France',
        source: 'gallery_no_exif',
        trustLevel: 'low',
        uploadedAt: new Date(),
        isActive: true
      });
      await lowVisit.save();

      const unverifiedVisit = new TripVisit({
        user: testUser._id,
        post: testPost._id,
        contentType: 'post',
        lat: 35.6762,
        lng: 139.6503,
        continent: 'ASIA',
        country: 'Japan',
        address: 'Tokyo, Japan',
        source: 'manual_only',
        trustLevel: 'unverified',
        uploadedAt: new Date(),
        isActive: true
      });
      await unverifiedVisit.save();

      // Query only trusted visits
      const trustedVisits = await TripVisit.find({
        user: testUser._id,
        isActive: true,
        trustLevel: { $in: TRUSTED_TRUST_LEVELS }
      });

      expect(trustedVisits.length).toBe(2);
      expect(trustedVisits.some(v => v.trustLevel === 'high')).toBe(true);
      expect(trustedVisits.some(v => v.trustLevel === 'medium')).toBe(true);
      expect(trustedVisits.some(v => v.trustLevel === 'low')).toBe(false);
      expect(trustedVisits.some(v => v.trustLevel === 'unverified')).toBe(false);
    });
  });

  describe('Unique Place Counting', () => {
    it('should count only unique locations', async () => {
      // Create 5 TripVisits manually at the same location (bypassing deduplication for test)
      // This tests that unique location counting works correctly
      const sameLocation = { lat: 40.7128, lng: -74.0060 };
      
      for (let i = 0; i < 5; i++) {
        const post = new Post({
          user: testUser._id,
          caption: `Post ${i}`,
          imageUrl: `https://example.com/image${i}.jpg`,
          type: 'photo',
          location: {
            address: 'New York, NY',
            coordinates: {
              latitude: sameLocation.lat,
              longitude: sameLocation.lng
            }
          }
        });
        await post.save();

        // Create TripVisit directly to bypass deduplication for testing
        const visit = new TripVisit({
          user: testUser._id,
          post: post._id,
          contentType: 'post',
          lat: sameLocation.lat,
          lng: sameLocation.lng,
          continent: 'NORTH AMERICA',
          country: 'United States',
          address: 'New York, NY',
          source: 'gallery_exif',
          trustLevel: 'medium',
          uploadedAt: new Date(),
          isActive: true
        });
        await visit.save();
      }

      // Count unique locations
      const trustedVisits = await TripVisit.find({
        user: testUser._id,
        isActive: true,
        trustLevel: { $in: TRUSTED_TRUST_LEVELS }
      });

      const uniqueLocations = new Set();
      trustedVisits.forEach(visit => {
        const locationKey = `${visit.lat},${visit.lng}`;
        uniqueLocations.add(locationKey);
      });

      expect(uniqueLocations.size).toBe(1); // Only 1 unique location
      expect(trustedVisits.length).toBe(5); // But 5 visits exist
    });
  });
});

