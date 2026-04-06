// CLEAN CONSOLE TEST SCRIPT
// This script will monitor console logs to ensure they're clean

console.log('🧹 CLEAN CONSOLE TEST SCRIPT');
console.log('=============================');

// Monitor console logs
let logCount = 0;
let repeatedLogs = {};
const originalLog = console.log;
const originalWarn = console.warn;
const originalError = console.error;

function trackLogs(type, ...args) {
  logCount++;
  const message = args.join(' ');
  
  // Track repeated logs
  if (repeatedLogs[message]) {
    repeatedLogs[message]++;
  } else {
    repeatedLogs[message] = 1;
  }
  
  // Show warning for excessive repeated logs
  if (repeatedLogs[message] > 5) {
    console.warn(`⚠️ Excessive repeated log detected: "${message}" (${repeatedLogs[message]} times)`);
  }
  
  // Call original function
  if (type === 'log') originalLog.apply(console, args);
  if (type === 'warn') originalWarn.apply(console, args);
  if (type === 'error') originalError.apply(console, args);
}

// Override console methods
console.log = (...args) => trackLogs('log', ...args);
console.warn = (...args) => trackLogs('warn', ...args);
console.error = (...args) => trackLogs('error', ...args);

// Set token
const TOKEN = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6IjY4ZjM5YjEyMWQ3NjJhODRmMjZhMDE0MSIsImVtYWlsIjoia2thdmlua3VtYXIyNEBnbWFpbC5jb20iLCJpYXQiOjE3NjExNjA1MDEsImV4cCI6MTc2MTI0NjkwMX0.SbDnvlt1e2i-WdboSK5N1HyC-vrFDw-rQeqCOS-MTEs';
localStorage.setItem('founder_token', TOKEN);

// Monitor for 10 seconds
setTimeout(() => {
  console.log('📊 CONSOLE MONITORING RESULTS:');
  console.log('=============================');
  console.log(`Total logs: ${logCount}`);
  console.log('Repeated logs:');
  
  Object.entries(repeatedLogs).forEach(([message, count]) => {
    if (count > 1) {
      console.log(`  "${message}": ${count} times`);
    }
  });
  
  if (logCount < 10) {
    console.log('✅ Console is clean! Very few logs detected.');
  } else if (logCount < 50) {
    console.log('⚠️ Console has moderate activity. Check for repeated logs above.');
  } else {
    console.log('❌ Console is noisy! Too many logs detected.');
  }
  
  // Restore original console methods
  console.log = originalLog;
  console.warn = originalWarn;
  console.error = originalError;
  
}, 10000);

console.log('✅ Monitoring started. Will report results in 10 seconds...');
console.log('=============================');
