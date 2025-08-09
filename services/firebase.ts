import { initializeApp } from 'firebase/app';
import { getAuth, initializeAuth } from 'firebase/auth';
import { getFirestore, initializeFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';
import AsyncStorage from '@react-native-async-storage/async-storage';

const firebaseConfig = {
  apiKey: "AIzaSyDOPVkLmJsOsUeTYz0KrgS_XyjbkjSRkWI",
  authDomain: "taatom-dc9fa.firebaseapp.com",
  projectId: "taatom-dc9fa",
  storageBucket: "taatom-dc9fa.appspot.com",
  messagingSenderId: "522716626735",
  appId: "1:522716626735:web:9c6151cc203d1a3f652bda",
  measurementId: "G-TWL03JXS33"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Use long polling in RN to avoid WebChannel transport errors
initializeFirestore(app, { experimentalForceLongPolling: true });

// Initialize Auth with persistence; fallback if already initialized
let authInstance;
try {
  authInstance = initializeAuth(app, {
    persistence: (require('firebase/auth')).getReactNativePersistence(AsyncStorage),
  });
} catch {
  authInstance = getAuth(app);
}

export const auth = authInstance;
export const db = getFirestore(app);
// Explicitly bind to the Firebase-managed bucket
export const storage = getStorage(app, 'gs://taatom-dc9fa.appspot.com');

export default app;