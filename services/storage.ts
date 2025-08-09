import { ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage';
import { Platform } from 'react-native';
import * as FileSystem from 'expo-file-system'; // ⬅ added
import { storage } from './firebase';
import { getAuth } from 'firebase/auth';

export type UploadProgressState = 'running' | 'paused' | 'success';
export type UploadProgressCallback = (progressPct: number, state: UploadProgressState) => void;

const guessContentType = (uri: string, fallback: string = 'image/jpeg'): string => {
  if (uri.endsWith('.png')) return 'image/png';
  if (uri.endsWith('.jpg') || uri.endsWith('.jpeg')) return 'image/jpeg';
  if (uri.endsWith('.heic')) return 'image/heic';
  return fallback;
};
console.log('Current user:', getAuth().currentUser);

export const uploadImage = async (
  uri: string,
  path: string,
  onProgress?: UploadProgressCallback
): Promise<string> => {
  // Create metadata
  const contentType = guessContentType(uri);
  const metadata: any = { contentType };

  // ✅ Fixed: Read file into Uint8Array instead of Blob
  const base64 = await FileSystem.readAsStringAsync(uri, { encoding: FileSystem.EncodingType.Base64 });
  const byteCharacters = atob(base64);
  const byteNumbers = new Array(byteCharacters.length);
  for (let i = 0; i < byteCharacters.length; i++) {
    byteNumbers[i] = byteCharacters.charCodeAt(i);
  }
  const byteArray = new Uint8Array(byteNumbers);

  // Create ref and start resumable upload
  const storageRef = ref(storage, path);
  const uploadTask = uploadBytesResumable(storageRef, byteArray, metadata);

  await new Promise<void>((resolve, reject) => {
    uploadTask.on(
      'state_changed',
      (snapshot) => {
        const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
        if (onProgress) onProgress(progress, snapshot.state as UploadProgressState);
      },
      (error: any) => {
        switch (error?.code) {
          case 'storage/unauthorized':
            reject(new Error('Unauthorized to upload to this path'));
            break;
          case 'storage/canceled':
            reject(new Error('Upload canceled'));
            break;
          case 'storage/retry-limit-exceeded':
            reject(new Error('Network retry limit exceeded'));
            break;
          default:
            reject(error);
        }
      },
      () => resolve()
    );
  });

  // Get the download URL from the completed task
  return getDownloadURL(uploadTask.snapshot.ref);
};

export const uploadProfileImage = async (uri: string, uid: string): Promise<string> => {
  const path = `profile-images/${uid}/${Date.now()}.jpg`;
  return uploadImage(uri, path);
};

export const uploadPostImage = (
  uri: string,
  postId: string,
  onProgress?: UploadProgressCallback
) => {
  const ext = uri.split('.').pop() || 'jpg';
  const filename = `${Date.now()}.${ext}`;
  const path = `post-images/${postId}/${filename}`;
  return uploadImage(uri, path, onProgress);
};
