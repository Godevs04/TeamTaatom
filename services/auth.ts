import { 
  createUserWithEmailAndPassword, 
  signInWithEmailAndPassword, 
  sendPasswordResetEmail,
  User,
  signOut,
  initializeAuth
} from 'firebase/auth';
// Some Firebase versions re-export getReactNativePersistence from firebase/auth
// Fall back to requiring from the package path to satisfy TS in this setup
// @ts-ignore
import { getReactNativePersistence } from 'firebase/auth';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { doc, setDoc, getDoc } from 'firebase/firestore';
import { auth as defaultAuth, db } from './firebase';
import { UserType } from '../types/user';

// Ensure persistence
const auth = (() => {
  try {
    return initializeAuth(defaultAuth.app, {
      persistence: getReactNativePersistence(AsyncStorage),
    });
  } catch {
    return defaultAuth;
  }
})();

export const signUp = async (email: string, password: string, fullName: string, gender?: 'male' | 'female'): Promise<User> => {
  const userCredential = await createUserWithEmailAndPassword(auth, email, password);
  const user = userCredential.user;

  // Only include gender if defined
  const userData: any = {
    uid: user.uid,
    fullName,
    email,
    profilePic: '',
    followers: 0,
    following: 0,
    createdAt: new Date().toISOString()
  };
  if (gender) userData.gender = gender;

  await setDoc(doc(db, 'users', user.uid), userData);

  return user;
};

export const signIn = async (email: string, password: string): Promise<User> => {
  const userCredential = await signInWithEmailAndPassword(auth, email, password);
  return userCredential.user;
};

export const forgotPassword = async (email: string): Promise<void> => {
  await sendPasswordResetEmail(auth, email);
};

export const signOutUser = async (): Promise<void> => {
  await signOut(auth);
};

export const getCurrentUser = (): User | null => {
  return auth.currentUser;
};

export const getUserData = async (uid: string): Promise<UserType | null> => {
  const userDoc = await getDoc(doc(db, 'users', uid));
  if (userDoc.exists()) {
    return userDoc.data() as UserType;
  }
  return null;
};
