// TEST STABLE DATA SCRIPT
// This script tests if the data stays stable and doesn't disappear

console.log('🧪 TESTING STABLE DATA SCRIPT');
console.log('=====================================');

// Set token
const TOKEN = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6IjY4ZjM5YjEyMWQ3NjJhODRmMjZhMDE0MSIsImVtYWlsIjoia2thdmlua3VtYXIyNEBnbWFpbC5jb20iLCJpYXQiOjE3NjExNjA1MDEsImV4cCI6MTc2MTI0NjkwMX0.SbDnvlt1e2i-WdboSK5N1HyC-vrFDw-rQeqCOS-MTEs';
localStorage.setItem('founder_token', TOKEN);
console.log('✅ Token set');

// Monitor data stability
let lastUserCount = 0;
let stableCount = 0;

function checkDataStability() {
  // Check if data is stable
  if (window.React && window.React.__SECRET_INTERNALS_DO_NOT_USE_OR_YOU_WILL_BE_FIRED) {
    console.log('🔍 React DevTools detected');
  }
  
  // Try to get data from the context
  const currentUserCount = document.querySelector('[data-testid="users-count"]')?.textContent || 'Unknown';
  console.log(`📊 Current user count: ${currentUserCount}`);
  
  if (currentUserCount === lastUserCount && currentUserCount !== 'Unknown' && currentUserCount !== '0') {
    stableCount++;
    console.log(`✅ Data stable for ${stableCount} checks`);
  } else {
    stableCount = 0;
    console.log(`⚠️ Data changed: ${lastUserCount} → ${currentUserCount}`);
  }
  
  lastUserCount = currentUserCount;
  
  if (stableCount >= 3) {
    console.log('🎉 Data is stable! No more flickering.');
    return;
  }
  
  // Continue monitoring
  setTimeout(checkDataStability, 2000);
}

// Start monitoring after a delay
setTimeout(() => {
  console.log('🔍 Starting data stability monitoring...');
  checkDataStability();
}, 3000);

// Also try to trigger data fetch
setTimeout(() => {
  if (window.triggerDataFetch) {
    console.log('🔄 Triggering data fetch...');
    window.triggerDataFetch();
  }
}, 1000);

console.log('=====================================');
console.log('✅ Stability test script started. Monitor the console for results.');
