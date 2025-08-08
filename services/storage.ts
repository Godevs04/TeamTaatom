import { ref, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage';
import { storage } from './firebase';

export const uploadImage = async (uri: string, path: string): Promise<string> => {
  try {
    const response = await fetch(uri);
    const blob = await response.blob();
    
    const storageRef = ref(storage, path);
    await uploadBytes(storageRef, blob);
    
    const downloadURL = await getDownloadURL(storageRef);
    return downloadURL;
  } catch (error: any) {
    throw new Error(error.message);
  }
};

export const uploadProfileImage = async (uri: string, uid: string): Promise<string> => {
  const path = `profile-images/${uid}/${Date.now()}.jpg`;
  return uploadImage(uri, path);
};

export const uploadPostImage = async (uri: string, postId: string): Promise<string> => {
  const path = `post-images/${postId}/${Date.now()}.jpg`;
  return uploadImage(uri, path);
};

export const deleteImage = async (path: string): Promise<void> => {
  try {
    const storageRef = ref(storage, path);
    await deleteObject(storageRef);
  } catch (error: any) {
    throw new Error(error.message);
  }
};
