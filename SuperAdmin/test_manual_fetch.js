// Manual test script to trigger data fetch
console.log('🚀 Starting manual data fetch test...')

// Set the token
localStorage.setItem('founder_token', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6IjY4ZjM5YjEyMWQ3NjJhODRmMjZhMDE0MSIsImVtYWlsIjoia2thdmlua3VtYXIyNEBnbWFpbC5jb20iLCJpYXQiOjE3NjExNjA1MDEsImV4cCI6MTc2MTI0NjkwMX0.SbDnvlt1e2i-WdboSK5N1HyC-vrFDw-rQeqCOS-MTEs')

// Wait for the app to load
setTimeout(() => {
  console.log('🔧 Manually triggering data fetch...')
  
  // Check if functions are available and call them
  if (window.fetchPosts) {
    console.log('✅ Calling fetchPosts...')
    window.fetchPosts()
  }
  
  if (window.fetchReports) {
    console.log('✅ Calling fetchReports...')
    window.fetchReports()
  }
  
  if (window.triggerDataFetch) {
    console.log('✅ Calling triggerDataFetch...')
    window.triggerDataFetch()
  }
  
  console.log('🎯 Manual fetch completed')
}, 2000)
