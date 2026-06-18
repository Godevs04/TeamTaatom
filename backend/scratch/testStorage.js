require('dotenv').config();
const { uploadObject, deleteObject, objectExists } = require('../src/services/storage');
const logger = require('../src/utils/logger');

async function runTest() {
  console.log('Starting Sevalla Object Storage connection test...');
  console.log('Bucket name:', process.env.SEVALLA_STORAGE_BUCKET);
  console.log('Endpoint:', process.env.SEVALLA_STORAGE_ENDPOINT);
  
  const testBuffer = Buffer.from('Hello, World! Sevalla Object Storage test upload.');
  const testKey = `test/upload-test-${Date.now()}.txt`;
  const mimeType = 'text/plain';

  try {
    console.log(`Attempting to upload to key: ${testKey}...`);
    const result = await uploadObject(testBuffer, testKey, mimeType);
    console.log('Upload successful! Result:', result);

    console.log(`Checking if object exists at key: ${testKey}...`);
    const exists = await objectExists(testKey);
    console.log('Object exists check result:', exists);

    if (exists) {
      console.log(`Cleaning up test object: ${testKey}...`);
      await deleteObject(testKey);
      console.log('Cleanup successful!');
    } else {
      console.error('Object was not found after upload!');
    }
  } catch (error) {
    console.error('TEST FAILED with error:', error);
  }
}

runTest();
