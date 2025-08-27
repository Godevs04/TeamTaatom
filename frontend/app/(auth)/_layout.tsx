import React from 'react';
import { Stack } from 'expo-router';

export default function AuthLayout() {
  const linking = {
    prefixes: [
      "myapp://",                // Dev custom scheme
      "https://taatom.com",      // Prod universal link
      "http://localhost:3000"    // Dev LAN URL for backend links
    ],
    config: {
      screens: {
        signin: 'signin',
        signup: 'signup',
        verifyOtp: 'verify-otp',
        forgot: 'reset-password'
      }
    }
  };

  return (
    <Stack
      screenOptions={{
        headerShown: false,
      }}
    >
      <Stack.Screen name="signin" />
      <Stack.Screen name="signup" />
      <Stack.Screen name="verifyOtp" />
      <Stack.Screen name="forgot" />
    </Stack>
  );
}