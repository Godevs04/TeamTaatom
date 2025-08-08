import { registerRootComponent } from 'expo';
import { ExpoRoot } from 'expo-router';
import React from 'react';

export function App() {
  return React.createElement(ExpoRoot, { context: require.context('./app') });
}

registerRootComponent(App);
