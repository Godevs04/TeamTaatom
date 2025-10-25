// Utility to set authentication token
export const setAuthToken = (token) => {
  if (token) {
    localStorage.setItem('founder_token', token);
    console.log('✅ Auth token set successfully');
    console.log('Token:', token);
    return true;
  } else {
    console.error('❌ No token provided');
    return false;
  }
};

// Utility to check if token exists
export const checkAuthToken = () => {
  const token = localStorage.getItem('founder_token');
  console.log('Current token in localStorage:', token ? 'Present' : 'Not found');
  return !!token;
};

// Utility to clear token
export const clearAuthToken = () => {
  localStorage.removeItem('founder_token');
  console.log('🗑️ Auth token cleared');
};

// Test token for immediate use
export const TEST_TOKEN = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6IjY4ZjM5YjEyMWQ3NjJhODRmMjZhMDE0MSIsImVtYWlsIjoia2thdmlua3VtYXIyNEBnbWFpbC5jb20iLCJpYXQiOjE3NjExNjA1MDEsImV4cCI6MTc2MTI0NjkwMX0.SbDnvlt1e2i-WdboSK5N1HyC-vrFDw-rQeqCOS-MTEs';

// Auto-set token function
export const autoSetToken = () => {
  if (!checkAuthToken()) {
    setAuthToken(TEST_TOKEN);
    console.log('🚀 Auto-set test token for immediate access');
    return true;
  }
  return false;
};
