// SuperAdmin Debug Console Script
// Copy and paste this into your browser console

console.log('🔧 SuperAdmin Debug Console Script');
console.log('=====================================');

// Test token
const TEST_TOKEN = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6IjY4ZjM5YjEyMWQ3NjJhODRmMjZhMDE0MSIsImVtYWlsIjoia2thdmlua3VtYXIyNEBnbWFpbC5jb20iLCJpYXQiOjE3NjExNjA1MDEsImV4cCI6MTc2MTI0NjkwMX0.SbDnvlt1e2i-WdboSK5N1HyC-vrFDw-rQeqCOS-MTEs';

// Check current token
const currentToken = localStorage.getItem('founder_token');
console.log('Current token:', currentToken ? 'Present' : 'Not found');

// Set token
localStorage.setItem('founder_token', TEST_TOKEN);
console.log('✅ Token set successfully');

// Test API call
fetch('http://localhost:3000/api/superadmin/users', {
  headers: {
    'Authorization': `Bearer ${TEST_TOKEN}`,
    'Content-Type': 'application/json'
  }
})
.then(response => response.json())
.then(data => {
  console.log('✅ API Test successful:', data);
  console.log('Users count:', data.users?.length || 0);
})
.catch(error => {
  console.error('❌ API Test failed:', error);
});

// Auto-refresh page after 2 seconds
setTimeout(() => {
  console.log('🔄 Refreshing page...');
  window.location.reload();
}, 2000);

console.log('=====================================');
console.log('✅ Debug script completed. Page will refresh in 2 seconds.');
