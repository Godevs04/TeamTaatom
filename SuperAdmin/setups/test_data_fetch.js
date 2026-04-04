// Test script to manually trigger data fetch in SuperAdmin
console.log('🚀 Starting data fetch test...')

// Set the token
localStorage.setItem('founder_token', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6IjY4ZjM5YjEyMWQ3NjJhODRmMjZhMDE0MSIsImVtYWlsIjoia2thdmlua3VtYXIyNEBnbWFpbC5jb20iLCJpYXQiOjE3NjExNjA1MDEsImV4cCI6MTc2MTI0NjkwMX0.SbDnvlt1e2i-WdboSK5N1HyC-vrFDw-rQeqCOS-MTEs')

// Wait for the app to load
setTimeout(() => {
  console.log('🔧 Triggering data fetch...')
  
  // Check if functions are available
  if (window.fetchUsers) {
    console.log('✅ fetchUsers function found')
    window.fetchUsers()
  } else {
    console.log('❌ fetchUsers function not found')
  }
  
  if (window.fetchPosts) {
    console.log('✅ fetchPosts function found')
    window.fetchPosts()
  } else {
    console.log('❌ fetchPosts function not found')
  }
  
  if (window.fetchReports) {
    console.log('✅ fetchReports function found')
    window.fetchReports()
  } else {
    console.log('❌ fetchReports function not found')
  }
  
  if (window.triggerDataFetch) {
    console.log('✅ triggerDataFetch function found')
    window.triggerDataFetch()
  } else {
    console.log('❌ triggerDataFetch function not found')
  }
  
  console.log('🎯 Data fetch test completed')
}, 3000)
