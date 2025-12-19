# Running Tests

This guide explains how to run the backend tests, specifically the TripVisit service tests.

## Prerequisites

1. **MongoDB**: You need a MongoDB instance running (local or remote)
2. **Node.js**: Node.js 16+ installed
3. **Dependencies**: All npm packages installed (`npm install`)

## Setup

### 1. Install Test Dependencies

Test dependencies (Jest and supertest) should already be installed. If not:

```bash
cd backend
npm install --save-dev jest supertest
```

### 2. Configure Test Database

The tests use a separate test database. Set the `MONGODB_TEST_URI` environment variable in your `.env` file:

```env
MONGODB_TEST_URI=mongodb://localhost:27017/taatom_test
```

Or for MongoDB Atlas:
```env
MONGODB_TEST_URI=mongodb+srv://username:password@cluster.mongodb.net/taatom_test
```

**Important**: The test database will be cleaned before each test run. Make sure you're using a test database, not your production database!

### 3. Environment Variables

Make sure your `.env` file has the necessary environment variables. The test setup will load them automatically.

## Running Tests

### Run All Tests

```bash
cd backend
npm test
```

### Run Specific Test File

To run only the TripVisit service tests:

```bash
npm run test:tripVisit
```

Or directly with Jest:

```bash
npx jest src/__tests__/tripVisitService.test.js
```

### Run Tests in Watch Mode

To automatically re-run tests when files change:

```bash
npm run test:watch
```

### Run Tests with Coverage

To see code coverage:

```bash
npm run test:coverage
```

## Test Structure

The test file (`src/__tests__/tripVisitService.test.js`) includes:

1. **determineSource Tests**: Tests for determining the source type (camera, gallery with EXIF, etc.)
2. **assignTrustLevel Tests**: Tests for trust level assignment and fraud detection
3. **createTripVisitFromPost Tests**: Tests for creating TripVisit records from posts
4. **Trust Level Filtering Tests**: Tests that only high/medium trust visits count towards TripScore
5. **Unique Place Counting Tests**: Tests that duplicate locations are handled correctly

## Troubleshooting

### MongoDB Connection Issues

If you see connection errors:

1. **Check MongoDB is running**:
   ```bash
   # For local MongoDB
   mongosh
   
   # Or check if MongoDB service is running
   # macOS: brew services list
   # Linux: sudo systemctl status mongod
   ```

2. **Verify connection string**: Check your `MONGODB_TEST_URI` in `.env`

3. **Check network/firewall**: If using MongoDB Atlas, ensure your IP is whitelisted

### Test Timeout Issues

If tests are timing out:

1. **Increase timeout**: Tests have a 30-second timeout by default. You can increase it in `jest.config.js`:
   ```javascript
   testTimeout: 60000 // 60 seconds
   ```

2. **Check database performance**: Slow database queries can cause timeouts

### Module Not Found Errors

If you see "Cannot find module" errors:

1. **Reinstall dependencies**:
   ```bash
   rm -rf node_modules package-lock.json
   npm install
   ```

2. **Check file paths**: Ensure all imports use correct relative paths

### Test Data Cleanup Issues

Tests clean up data before each run. If you see duplicate key errors:

1. **Check previous test run**: Make sure previous tests completed successfully
2. **Manually clean database**: Connect to test database and clean collections:
   ```javascript
   use taatom_test
   db.tripvisits.deleteMany({})
   db.posts.deleteMany({})
   db.users.deleteMany({})
   ```

## Example Output

When tests run successfully, you should see:

```
PASS  src/__tests__/tripVisitService.test.js
  TripVisit Service
    determineSource
      ✓ should return "taatom_camera_live" when fromCamera is true (5ms)
      ✓ should return "gallery_exif" when hasExifGps is true (3ms)
      ...
    assignTrustLevel
      ✓ should assign "high" trust for taatom_camera_live source (2ms)
      ...
    createTripVisitFromPost
      ✓ should create high trust visit for camera post (15ms)
      ...

Test Suites: 1 passed, 1 total
Tests:       12 passed, 12 total
Snapshots:   0 total
Time:        3.456 s
```

## Next Steps

After running tests successfully:

1. **Fix any failing tests**: Review error messages and fix issues
2. **Add more tests**: Expand test coverage for edge cases
3. **Integration tests**: Run integration tests for API endpoints
4. **CI/CD**: Set up automated test runs in your CI/CD pipeline

