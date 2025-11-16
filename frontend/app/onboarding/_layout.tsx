import React from 'react';
import { Stack } from 'expo-router';

export default function OnboardingLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        gestureEnabled: false, // Prevent back navigation during onboarding
      }}
    >
      <Stack.Screen name="welcome" />
      <Stack.Screen name="interests" />
      <Stack.Screen name="suggested-users" />
    </Stack>
  );
}

