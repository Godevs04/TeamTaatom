import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';

const firebaseConfig = {
  apiKey: "AIzaSyDOPVkLmJsOsUeTYz0KrgS_XyjbkjSRkWI",
  authDomain: "taatom-dc9fa.firebaseapp.com",
  projectId: "taatom-dc9fa",
  storageBucket: "taatom-dc9fa.firebasestorage.app",
  messagingSenderId: "522716626735",
  appId: "1:522716626735:web:9c6151cc203d1a3f652bda",
  measurementId: "G-TWL03JXS33"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Firebase services
export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);

export default app;
