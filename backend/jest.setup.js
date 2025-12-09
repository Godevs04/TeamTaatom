/**
 * Jest Setup File
 * 
 * Runs before all tests to configure the test environment.
 * Loads environment variables and sets up any global test configuration.
 */

const path = require('path');

// Load environment variables from .env file in backend directory
require('dotenv').config({ path: path.resolve(__dirname, '.env') });

// Set test environment variables if not already set
process.env.NODE_ENV = process.env.NODE_ENV || 'test';

// Debug: Log MONGO_URL if available (without credentials)
if (process.env.MONGO_URL) {
  const maskedUri = process.env.MONGO_URL.replace(/\/\/[^:]+:[^@]+@/, '//***:***@');
  console.log('📝 MONGO_URL found:', maskedUri);
} else {
  console.warn('⚠️  MONGO_URL not found in .env file');
}

// Suppress console logs during tests (optional - comment out if you want to see logs)
// global.console = {
//   ...console,
//   log: jest.fn(),
//   debug: jest.fn(),
//   info: jest.fn(),
//   warn: jest.fn(),
//   error: jest.fn(),
// };

// Global test timeout (can be overridden in individual tests)
jest.setTimeout(30000);

