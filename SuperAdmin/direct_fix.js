// DIRECT FIX SCRIPT FOR SUPERADMIN EMPTY DATA
// Copy and paste this ENTIRE script into your SuperAdmin browser console

console.log('🚀 DIRECT FIX SCRIPT STARTING...');
console.log('=====================================');

// Step 1: Set the authentication token
const TOKEN = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6IjY4ZjM5YjEyMWQ3NjJhODRmMjZhMDE0MSIsImVtYWlsIjoia2thdmlua3VtYXIyNEBnbWFpbC5jb20iLCJpYXQiOjE3NjExNjA1MDEsImV4cCI6MTc2MTI0NjkwMX0.SbDnvlt1e2i-WdboSK5N1HyC-vrFDw-rQeqCOS-MTEs';
localStorage.setItem('founder_token', TOKEN);
console.log('✅ Token set in localStorage');

// Step 2: Test API connectivity
async function testAPI() {
  try {
    console.log('🔍 Testing API connectivity...');
    
    const response = await fetch('http://localhost:3000/api/superadmin/users', {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${TOKEN}`,
        'Content-Type': 'application/json'
      }
    });
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    
    const data = await response.json();
    console.log('✅ API Test SUCCESS!');
    console.log('📊 Users found:', data.users?.length || 0);
    console.log('📊 Sample user:', data.users?.[0]?.fullName || 'No users');
    
    return true;
  } catch (error) {
    console.error('❌ API Test FAILED:', error.message);
    return false;
  }
}

// Step 3: Force trigger data fetch in the app
function forceDataFetch() {
  console.log('🔄 Forcing data fetch in the app...');
  
  // Try to trigger the RealTimeContext fetch functions
  if (window.React && window.React.__SECRET_INTERNALS_DO_NOT_USE_OR_YOU_WILL_BE_FIRED) {
    console.log('🔍 React DevTools detected, trying to trigger context...');
  }
  
  // Dispatch a custom event that the app might listen to
  window.dispatchEvent(new CustomEvent('forceDataRefresh'));
  
  // Try to find and trigger the fetch functions
  setTimeout(() => {
    console.log('🔄 Attempting to trigger fetch functions...');
    
    // Look for any global fetch functions
    if (window.fetchUsers) {
      window.fetchUsers();
      console.log('✅ Called window.fetchUsers()');
    }
    
    if (window.fetchPosts) {
      window.fetchPosts();
      console.log('✅ Called window.fetchPosts()');
    }
    
    if (window.fetchReports) {
      window.fetchReports();
      console.log('✅ Called window.fetchReports()');
    }
  }, 1000);
}

// Step 4: Main execution
async function main() {
  console.log('🚀 Starting direct fix...');
  
  // Test API first
  const apiWorking = await testAPI();
  
  if (apiWorking) {
    console.log('✅ API is working! Now forcing data fetch...');
    forceDataFetch();
    
    console.log('🔄 Reloading page in 3 seconds to apply changes...');
    setTimeout(() => {
      window.location.reload();
    }, 3000);
  } else {
    console.log('❌ API is not working. Please check if backend server is running on port 3000');
  }
}

// Execute the main function
main();

console.log('=====================================');
console.log('✅ Direct fix script completed. Check the results above.');
