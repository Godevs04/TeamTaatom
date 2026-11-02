import Constants from 'expo-constants';

/**
 * react-native-video 6.x is built against media3 1.8.0 while expo-video 58 pins media3 1.9.1.
 * With both linked, RCTVideo crashes the app as soon as ExoPlayer starts
 * (NoSuchMethodError: DefaultLoadControl.<init>), so playback uses expo-video instead.
 * Expo Go has no RCTVideo either.
 */
const PREFER_EXPO_VIDEO = true;

export const useExpoVideoPlayer = PREFER_EXPO_VIDEO || Constants.appOwnership === 'expo';
