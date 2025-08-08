import { 
  collection, 
  doc, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  getDocs, 
  getDoc,
  query, 
  orderBy, 
  onSnapshot,
  arrayUnion,
  arrayRemove,
  serverTimestamp
} from 'firebase/firestore';
import { db } from './firebase';
import { PostType, CommentType } from '../types/post';

// Posts
export const createPost = async (postData: Omit<PostType, 'postId' | 'timestamp'>): Promise<string> => {
  try {
    const docRef = await addDoc(collection(db, 'posts'), {
      ...postData,
      timestamp: serverTimestamp()
    });
    return docRef.id;
  } catch (error: any) {
    throw new Error(error.message);
  }
};

export const getPosts = (callback: (posts: PostType[]) => void) => {
  const q = query(collection(db, 'posts'), orderBy('timestamp', 'desc'));
  
  return onSnapshot(q, (querySnapshot) => {
    const posts: PostType[] = [];
    querySnapshot.forEach((doc) => {
      posts.push({
        postId: doc.id,
        ...doc.data()
      } as PostType);
    });
    callback(posts);
  });
};

export const likePost = async (postId: string, uid: string): Promise<void> => {
  try {
    const postRef = doc(db, 'posts', postId);
    await updateDoc(postRef, {
      likes: arrayUnion(uid)
    });
  } catch (error: any) {
    throw new Error(error.message);
  }
};

export const unlikePost = async (postId: string, uid: string): Promise<void> => {
  try {
    const postRef = doc(db, 'posts', postId);
    await updateDoc(postRef, {
      likes: arrayRemove(uid)
    });
  } catch (error: any) {
    throw new Error(error.message);
  }
};

export const deletePost = async (postId: string): Promise<void> => {
  try {
    await deleteDoc(doc(db, 'posts', postId));
  } catch (error: any) {
    throw new Error(error.message);
  }
};

// Comments
export const addComment = async (postId: string, commentData: Omit<CommentType, 'commentId' | 'timestamp'>): Promise<string> => {
  try {
    const docRef = await addDoc(collection(db, 'posts', postId, 'comments'), {
      ...commentData,
      timestamp: serverTimestamp()
    });
    return docRef.id;
  } catch (error: any) {
    throw new Error(error.message);
  }
};

export const getComments = (postId: string, callback: (comments: CommentType[]) => void) => {
  const q = query(collection(db, 'posts', postId, 'comments'), orderBy('timestamp', 'asc'));
  
  return onSnapshot(q, (querySnapshot) => {
    const comments: CommentType[] = [];
    querySnapshot.forEach((doc) => {
      comments.push({
        commentId: doc.id,
        ...doc.data()
      } as CommentType);
    });
    callback(comments);
  });
};

export const deleteComment = async (postId: string, commentId: string): Promise<void> => {
  try {
    await deleteDoc(doc(db, 'posts', postId, 'comments', commentId));
  } catch (error: any) {
    throw new Error(error.message);
  }
};

// User data
export const updateUserProfile = async (uid: string, data: Partial<{ fullName: string; profilePic: string }>): Promise<void> => {
  try {
    const userRef = doc(db, 'users', uid);
    await updateDoc(userRef, data);
  } catch (error: any) {
    throw new Error(error.message);
  }
};

export const followUser = async (currentUserId: string, targetUserId: string): Promise<void> => {
  try {
    const currentUserRef = doc(db, 'users', currentUserId);
    const targetUserRef = doc(db, 'users', targetUserId);
    
    await updateDoc(currentUserRef, {
      following: arrayUnion(targetUserId)
    });
    
    await updateDoc(targetUserRef, {
      followers: arrayUnion(currentUserId)
    });
  } catch (error: any) {
    throw new Error(error.message);
  }
};

export const unfollowUser = async (currentUserId: string, targetUserId: string): Promise<void> => {
  try {
    const currentUserRef = doc(db, 'users', currentUserId);
    const targetUserRef = doc(db, 'users', targetUserId);
    
    await updateDoc(currentUserRef, {
      following: arrayRemove(targetUserId)
    });
    
    await updateDoc(targetUserRef, {
      followers: arrayRemove(currentUserId)
    });
  } catch (error: any) {
    throw new Error(error.message);
  }
};
