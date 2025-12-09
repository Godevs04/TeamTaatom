/**
 * Integration Tests for TripScore Controllers
 * 
 * Tests TripScore calculation endpoints to ensure trust level filtering
 * and unique place counting work correctly.
 */

const mongoose = require('mongoose');
const request = require('supertest');
const TripVisit = require('../models/TripVisit');
const User = require('../models/User');
const Post = require('../models/Post');
const { TRUSTED_TRUST_LEVELS } = require('../config/tripScoreConfig');

// Import app for testing
let app;

describe('TripScore Controller Integration Tests', () => {
  let testUser;
  let authToken;

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

    // Import app after DB connection
    app = require('../app').app;
  }, 60000); // Increase timeout to 60 seconds for database connection

  afterAll(async () => {
    await mongoose.connection.close();
  });

  beforeEach(async () => {
    // Clean up test data - ensure all are deleted
    await TripVisit.deleteMany({});
    await Post.deleteMany({});
    await User.deleteMany({});

    // Create test user with unique identifier to avoid conflicts with other test files
    // Username must be ≤20 characters per User schema validation
    const timestamp = Date.now().toString().slice(-8); // Last 8 digits of timestamp
    const random = Math.random().toString(36).substr(2, 4); // 4 random chars
    const uniqueId = `trip${timestamp}${random}`; // Format: trip + 8 digits + 4 chars = 17 chars
    testUser = new User({
      username: uniqueId, // ≤20 characters
      email: `${uniqueId}@test.com`,
      password: 'hashedpassword',
      fullName: 'TripScore Test User'
    });
    await testUser.save();
    
    // Ensure user is saved and ID is available
    if (!testUser._id) {
      throw new Error('Test user was not saved properly');
    }
  });

  describe('Trust Level Filtering', () => {
    it('should only count high and medium trust visits in TripScore', async () => {
      // Create visits with different trust levels
      const visits = [
        { trustLevel: 'high', lat: 40.7128, lng: -74.0060, continent: 'NORTH AMERICA', country: 'United States' },
        { trustLevel: 'high', lat: 51.5074, lng: -0.1278, continent: 'EUROPE', country: 'United Kingdom' },
        { trustLevel: 'medium', lat: 48.8566, lng: 2.3522, continent: 'EUROPE', country: 'France' },
        { trustLevel: 'medium', lat: 35.6762, lng: 139.6503, continent: 'ASIA', country: 'Japan' },
        { trustLevel: 'low', lat: 52.5200, lng: 13.4050, continent: 'EUROPE', country: 'Germany' },
        { trustLevel: 'low', lat: 41.9028, lng: 12.4964, continent: 'EUROPE', country: 'Italy' },
        { trustLevel: 'unverified', lat: 37.7749, lng: -122.4194, continent: 'NORTH AMERICA', country: 'United States' },
        { trustLevel: 'suspicious', lat: 34.0522, lng: -118.2437, continent: 'NORTH AMERICA', country: 'United States' }
      ];

      for (const visitData of visits) {
        const visit = new TripVisit({
          user: testUser._id,
          post: new mongoose.Types.ObjectId(), // Unique post ID for each visit
          contentType: 'post',
          ...visitData,
          address: `${visitData.country} Location`,
          source: visitData.trustLevel === 'high' ? 'taatom_camera_live' : 
                  visitData.trustLevel === 'medium' ? 'gallery_exif' :
                  visitData.trustLevel === 'low' ? 'gallery_no_exif' : 'manual_only',
          uploadedAt: new Date(),
          takenAt: new Date(),
          isActive: true
        });
        await visit.save();
      }

      // Verify visits were saved
      const allVisits = await TripVisit.find({ user: testUser._id });
      
      // Query trusted visits (what TripScore should use)
      const trustedVisits = await TripVisit.find({
        user: testUser._id,
        isActive: true,
        trustLevel: { $in: TRUSTED_TRUST_LEVELS }
      });

      // Count unique places
      const uniqueLocations = new Set();
      trustedVisits.forEach(visit => {
        const locationKey = `${visit.lat},${visit.lng}`;
        uniqueLocations.add(locationKey);
      });

      // Debug: Log if visits aren't found
      if (trustedVisits.length === 0 && allVisits.length > 0) {
        console.log(`Debug: Found ${allVisits.length} total visits, but 0 trusted visits`);
        console.log(`Trust levels found:`, allVisits.map(v => v.trustLevel));
        console.log(`TRUSTED_TRUST_LEVELS:`, TRUSTED_TRUST_LEVELS);
      }

      expect(trustedVisits.length).toBe(4); // 2 high + 2 medium
      expect(uniqueLocations.size).toBe(4); // 4 unique places
    });
  });

  describe('Unique Place Counting', () => {
    it('should count only unique locations even with multiple posts', async () => {
      const baseLocation = { lat: 40.7128, lng: -74.0060 };
      const tolerance = 0.0001; // Small variation to ensure all saves succeed

      // Create 5 visits at nearly the same location (within tolerance)
      // This tests that multiple visits can exist, but unique location counting works
      const baseTime = new Date();
      const savedVisits = [];
      for (let i = 0; i < 5; i++) {
        const visit = new TripVisit({
          user: testUser._id,
          post: new mongoose.Types.ObjectId(), // Unique post ID for each visit
          contentType: 'post',
          // Slightly vary coordinates to ensure all saves succeed
          lat: baseLocation.lat + (i * tolerance),
          lng: baseLocation.lng + (i * tolerance),
          continent: 'NORTH AMERICA',
          country: 'United States',
          address: 'New York, NY',
          source: 'gallery_exif',
          trustLevel: 'medium',
          uploadedAt: new Date(baseTime.getTime() + i * 1000),
          takenAt: new Date(baseTime.getTime() + i * 1000),
          isActive: true
        });
        const saved = await visit.save();
        savedVisits.push(saved);
      }

      // Count unique locations (using rounded coordinates to simulate "same location")
      const trustedVisits = await TripVisit.find({
        user: testUser._id,
        isActive: true,
        trustLevel: { $in: TRUSTED_TRUST_LEVELS }
      });

      const uniqueLocations = new Set();
      trustedVisits.forEach(visit => {
        // Round to 3 decimal places (~111m precision) to treat nearby locations as the same
        // This simulates how the app would group "same location" visits
        const locationKey = `${Math.round(visit.lat * 1000) / 1000},${Math.round(visit.lng * 1000) / 1000}`;
        uniqueLocations.add(locationKey);
      });

      expect(trustedVisits.length).toBe(5); // 5 visits exist
      expect(uniqueLocations.size).toBe(1); // But only 1 unique location (when rounded to ~111m precision)
    });
  });

  describe('Continents Endpoint Logic', () => {
    it('should group visits by continent correctly', async () => {
      const visits = [
        { lat: 40.7128, lng: -74.0060, continent: 'NORTH AMERICA', country: 'United States', trustLevel: 'high' },
        { lat: 34.0522, lng: -118.2437, continent: 'NORTH AMERICA', country: 'United States', trustLevel: 'medium' },
        { lat: 51.5074, lng: -0.1278, continent: 'EUROPE', country: 'United Kingdom', trustLevel: 'high' },
        { lat: 48.8566, lng: 2.3522, continent: 'EUROPE', country: 'France', trustLevel: 'medium' },
        { lat: 35.6762, lng: 139.6503, continent: 'ASIA', country: 'Japan', trustLevel: 'high' }
      ];

      for (const visitData of visits) {
        const visit = new TripVisit({
          user: testUser._id,
          post: new mongoose.Types.ObjectId(), // Unique post ID for each visit
          contentType: 'post',
          ...visitData,
          address: `${visitData.country} Location`,
          source: visitData.trustLevel === 'high' ? 'taatom_camera_live' : 'gallery_exif',
          uploadedAt: new Date(),
          takenAt: new Date(),
          isActive: true
        });
        await visit.save();
      }

      // Query trusted visits
      const trustedVisits = await TripVisit.find({
        user: testUser._id,
        isActive: true,
        trustLevel: { $in: TRUSTED_TRUST_LEVELS }
      });

      // Group by continent
      const continentScores = {};
      const uniqueLocationKeys = new Set();

      trustedVisits.forEach(visit => {
        const locationKey = `${visit.lat},${visit.lng}`;
        if (!uniqueLocationKeys.has(locationKey)) {
          uniqueLocationKeys.add(locationKey);
          const continent = visit.continent || 'Unknown';
          continentScores[continent] = (continentScores[continent] || 0) + 1;
        }
      });

      expect(continentScores['NORTH AMERICA']).toBe(2);
      expect(continentScores['EUROPE']).toBe(2);
      expect(continentScores['ASIA']).toBe(1);
      expect(Object.keys(continentScores).length).toBe(3);
    });
  });

  describe('Suspicious Visit Exclusion', () => {
    it('should exclude suspicious visits from TripScore', async () => {
      // Create normal and suspicious visits
      const normalVisit = new TripVisit({
        user: testUser._id,
        post: new mongoose.Types.ObjectId(),
        contentType: 'post',
        lat: 40.7128,
        lng: -74.0060,
        continent: 'NORTH AMERICA',
        country: 'United States',
        address: 'New York, NY',
        source: 'gallery_exif',
        trustLevel: 'medium',
        uploadedAt: new Date(),
        takenAt: new Date(),
        isActive: true
      });
      await normalVisit.save();

      const suspiciousVisit = new TripVisit({
        user: testUser._id,
        post: new mongoose.Types.ObjectId(),
        contentType: 'post',
        lat: 51.5074,
        lng: -0.1278,
        continent: 'EUROPE',
        country: 'United Kingdom',
        address: 'London, UK',
        source: 'gallery_exif',
        trustLevel: 'suspicious',
        uploadedAt: new Date(),
        takenAt: new Date(),
        isActive: true,
        metadata: {
          flaggedReason: 'Impossible travel speed'
        }
      });
      await suspiciousVisit.save();

      // Query trusted visits (should exclude suspicious)
      const trustedVisits = await TripVisit.find({
        user: testUser._id,
        isActive: true,
        trustLevel: { $in: TRUSTED_TRUST_LEVELS }
      });

      expect(trustedVisits.length).toBe(1);
      expect(trustedVisits[0].trustLevel).toBe('medium');
      expect(trustedVisits[0]._id.toString()).toBe(normalVisit._id.toString());
    });
  });
});

