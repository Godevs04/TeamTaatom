import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

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
    authTokenPromise = AsyncStorage.getItem('authToken')
      .then((token) => {
        cachedAuthToken = token;
        return token;
      })
      .finally(() => {
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

  if (token) {
    await AsyncStorage.setItem('authToken', token);
  } else {
    await AsyncStorage.removeItem('authToken');
  }
};

export const clearCachedAuthToken = async (): Promise<void> => {
  await setCachedAuthToken(null);
};
