// FINAL FIX TEST SCRIPT
// This script will test if all issues are resolved

console.log('🎯 FINAL FIX TEST SCRIPT');
console.log('==========================');

// Set token
const TOKEN = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6IjY4ZjM5YjEyMWQ3NjJhODRmMjZhMDE0MSIsImVtYWlsIjoia2thdmlua3VtYXIyNEBnbWFpbC5jb20iLCJpYXQiOjE3NjExNjA1MDEsImV4cCI6MTc2MTI0NjkwMX0.SbDnvlt1e2i-WdboSK5N1HyC-vrFDw-rQeqCOS-MTEs';
localStorage.setItem('founder_token', TOKEN);
console.log('✅ Token set');

// Test API directly
async function testAPI() {
  try {
    const response = await fetch('http://localhost:3000/api/superadmin/users?page=1&search=&status=all&sortBy=createdAt&sortOrder=desc', {
      headers: {
        'Authorization': `Bearer ${TOKEN}`,
        'Content-Type': 'application/json'
      }
    });
    
    const data = await response.json();
    console.log('📊 API Response:', data.users?.length || 0, 'users found');
    
    if (data.users && data.users.length > 0) {
      console.log('✅ Backend API is working correctly');
      console.log('📋 Sample user:', data.users[0].fullName || data.users[0].email);
    } else {
      console.log('❌ No users found in API response');
    }
  } catch (error) {
    console.error('❌ API test failed:', error);
  }
}

// Test React app data
function testReactData() {
  // Wait for React to load
  setTimeout(() => {
    console.log('🔍 Testing React app data...');
    
    // Check if data is visible in the UI
    const userCountElement = document.querySelector('[data-testid="users-count"]') || 
                           document.querySelector('h2:contains("Users")') ||
                           document.querySelector('*:contains("Users (")');
    
    if (userCountElement) {
      console.log('📊 UI User count:', userCountElement.textContent);
    }
    
    // Check if table has data
    const tableRows = document.querySelectorAll('tbody tr');
    console.log('📋 Table rows found:', tableRows.length);
    
    if (tableRows.length > 0) {
      console.log('✅ Users are visible in the table');
    } else {
      console.log('⚠️ No users visible in table');
    }
  }, 2000);
}

// Run tests
console.log('🚀 Starting tests...');
testAPI();
testReactData();

// Monitor console for spam
let logCount = 0;
const originalLog = console.log;
console.log = function(...args) {
  logCount++;
  if (logCount > 20) {
    console.warn('⚠️ Too many console logs detected. Possible infinite loop.');
  }
  originalLog.apply(console, args);
};

console.log('==========================');
console.log('✅ Test script completed. Check results above.');
