import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';

let cachedAuthToken: string | null | undefined;
let authTokenPromise: Promise<string | null> | null = null;

export const getCachedAuthToken = async (): Promise<string | null> => {
  if (Platform.OS === 'web') {
    return cachedAuthToken ?? null;
  }

  if (cachedAuthToken !== undefined) {
    return cachedAuthToken;
  }

  if (!authTokenPromise) {
    authTokenPromise = (async () => {
      try {
        let token = await SecureStore.getItemAsync('authToken');
        if (token) {
          cachedAuthToken = token;
          return token;
        }
        
        // Migration check: if old token exists in AsyncStorage, migrate it to SecureStore
        token = await AsyncStorage.getItem('authToken');
        if (token) {
          cachedAuthToken = token;
          await SecureStore.setItemAsync('authToken', token);
          await AsyncStorage.removeItem('authToken');
          return token;
        }
        
        cachedAuthToken = null;
        return null;
      } catch (error) {
        cachedAuthToken = null;
        return null;
      }
    })().finally(() => {
      authTokenPromise = null;
    });
  }

  return authTokenPromise;
};

export const setCachedAuthToken = async (token: string | null): Promise<void> => {
  cachedAuthToken = token;
  authTokenPromise = null;

  if (Platform.OS === 'web') {
    return;
  }

  try {
    if (token) {
      await SecureStore.setItemAsync('authToken', token);
      await AsyncStorage.removeItem('authToken');
    } else {
      await SecureStore.deleteItemAsync('authToken');
      await AsyncStorage.removeItem('authToken');
    }
  } catch (error) {
    // Fallback to AsyncStorage if SecureStore throws/fails
    if (token) {
      await AsyncStorage.setItem('authToken', token);
    } else {
      await AsyncStorage.removeItem('authToken');
    }
  }
};

export const clearCachedAuthToken = async (): Promise<void> => {
  await setCachedAuthToken(null);
};
