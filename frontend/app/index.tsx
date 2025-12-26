import { Redirect } from 'expo-router';
import { useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getUserFromStorage } from '../services/auth';

export default function Index() {
  useEffect(() => {
    // Check if user is already authenticated before redirecting
    const checkAuth = async () => {
      try {
        const user = await getUserFromStorage();
        const token = await AsyncStorage.getItem('authToken');
        // If user exists and has token, _layout.tsx will handle navigation
        // Don't redirect to signin if user is authenticated
        if (user && token) {
          return; // Let _layout.tsx handle navigation
        }
      } catch (error) {
        // Error checking auth - let _layout.tsx handle it
      }
    };
    checkAuth();
  }, []);

  // Only redirect to signin if we're sure user is not authenticated
  // _layout.tsx will handle the actual navigation based on auth state
  return null; // Don't redirect here, let _layout.tsx handle it
}
