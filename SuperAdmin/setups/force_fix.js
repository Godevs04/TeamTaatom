// Force Fix Script for SuperAdmin Empty Data Issue
// Copy and paste this into your browser console

console.log('🔧 FORCE FIX SCRIPT STARTING...');
console.log('=====================================');

// Step 1: Clear any existing token
localStorage.removeItem('founder_token');
console.log('🗑️ Cleared existing token');

// Step 2: Set the correct token
const TOKEN = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6IjY4ZjM5YjEyMWQ3NjJhODRmMjZhMDE0MSIsImVtYWlsIjoia2thdmlua3VtYXIyNEBnbWFpbC5jb20iLCJpYXQiOjE3NjExNjA1MDEsImV4cCI6MTc2MTI0NjkwMX0.SbDnvlt1e2i-WdboSK5N1HyC-vrFDw-rQeqCOS-MTEs';
localStorage.setItem('founder_token', TOKEN);
console.log('✅ Token set successfully');

// Step 3: Test the API call directly
fetch('http://localhost:3000/api/superadmin/users', {
  method: 'GET',
  headers: {
    'Authorization': `Bearer ${TOKEN}`,
    'Content-Type': 'application/json'
  }
})
.then(response => {
  console.log('📡 API Response Status:', response.status);
  return response.json();
})
.then(data => {
  console.log('✅ API Test Result:', data);
  console.log('📊 Users found:', data.users?.length || 0);
  
  if (data.users && data.users.length > 0) {
    console.log('🎉 SUCCESS! API is working, data will now load in the admin panel');
  } else {
    console.log('❌ API returned empty data');
  }
})
.catch(error => {
  console.error('❌ API Test Failed:', error);
});

// Step 4: Force reload the page
console.log('🔄 Reloading page in 3 seconds...');
setTimeout(() => {
  window.location.reload();
}, 3000);

console.log('=====================================');
console.log('✅ Force fix script completed. Page will reload in 3 seconds.');
