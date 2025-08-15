import * as AuthSession from 'expo-auth-session';
import * as Crypto from 'expo-crypto';
import Constants from 'expo-constants';
import api from './api';
import { UserType } from '../types/user';
import AsyncStorage from '@react-native-async-storage/async-storage';

const GOOGLE_CLIENT_ID = Constants.expoConfig?.extra?.GOOGLE_CLIENT_ID;
const GOOGLE_CLIENT_SECRET = Constants.expoConfig?.extra?.GOOGLE_CLIENT_SECRET;
const PROD_REDIRECT_URI = Constants.expoConfig?.extra?.GOOGLE_REDIRECT_URI;

// Use proxy for local testing
const REDIRECT_URI = AuthSession.makeRedirectUri({ useProxy: true }) || PROD_REDIRECT_URI;

interface GoogleAuthResponse {
  message: string;
  token: string;
  user: UserType;
}

export const signInWithGoogle = async (): Promise<GoogleAuthResponse> => {
  try {
    // Generate state parameter for security
    const state = await Crypto.digestStringAsync(
      Crypto.CryptoDigestAlgorithm.SHA256,
      Math.random().toString(),
      { encoding: Crypto.CryptoEncoding.HEX }
    );

    // Configure the auth request
    const authRequest = new AuthSession.AuthRequest({
      clientId: GOOGLE_CLIENT_ID,
      scopes: ['openid', 'profile', 'email'],
      responseType: AuthSession.ResponseType.Code,
      redirectUri: REDIRECT_URI,
      state,
      extraParams: {
        access_type: 'offline',
      },
      additionalParameters: {},
    });

    // Make the authentication request
    const authResponse = await authRequest.promptAsync({
      authorizationEndpoint: 'https://accounts.google.com/o/oauth2/v2/auth',
    });

    if (authResponse.type === 'success') {
      const { code, state: returnedState } = authResponse.params;
      // Verify state parameter
      if (returnedState !== state) {
        throw new Error('State parameter mismatch');
      }
      // Exchange authorization code for tokens on our backend
      const response = await api.post('/auth/google', {
        code,
        redirectUri: REDIRECT_URI,
      });
      const { token, user } = response.data;
      // Store the JWT token
      await AsyncStorage.setItem('authToken', token);
      await AsyncStorage.setItem('userData', JSON.stringify(user));
      return response.data;
    } else if (authResponse.type === 'cancel') {
      throw new Error('Google sign-in was cancelled by user');
    } else {
      throw new Error('Google sign-in failed');
    }
  } catch (error: any) {
    console.error('Google sign-in error:', error);
    throw new Error(error.message || 'Google sign-in failed');
  }
};

export const signOutGoogle = async (): Promise<void> => {
  try {
    await AsyncStorage.removeItem('authToken');
    await AsyncStorage.removeItem('userData');
  } catch (error) {
    console.error('Error signing out:', error);
  }
};
