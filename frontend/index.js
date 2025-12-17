import { registerRootComponent } from 'expo';
import { ExpoRoot } from 'expo-router';
import React from 'react';
import { registerBackgroundHandler } from './services/fcm';

// Register FCM background message handler (must be at root level)
registerBackgroundHandler();

export function App() {
  return React.createElement(ExpoRoot, { context: require.context('./app') });
}

registerRootComponent(App);
