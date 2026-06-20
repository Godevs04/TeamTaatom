import AsyncStorage from '@react-native-async-storage/async-storage';

type SavedListener = () => void;
type FeedInvalidateListener = () => void;
type PostActionListener = (postId: string, action: 'like' | 'unlike' | 'save' | 'unsave' | 'comment' | 'archive' | 'unarchive' | 'delete', data?: any) => void;

export type FollowState = 'FOLLOWING' | 'REQUESTED' | 'NOT_FOLLOWING';
export type FollowActionListener = (userId: string, followState: FollowState) => void;

export const normalizeId = (id: any): string => {
  if (!id) return '';
  if (typeof id === 'string') return id;
  if (id._id) return normalizeId(id._id);
  if (typeof id === 'object') {
    if (id.toString && typeof id.toString === 'function') {
      try {
        const str = id.toString();
        if (str && str !== '[object Object]') return str;
      } catch {}
    }
  }
  return String(id);
};

class SavedEvents {
  private savedListeners: Set<SavedListener> = new Set();
  private feedInvalidateListeners: Set<FeedInvalidateListener> = new Set();
  private postActionListeners: Set<PostActionListener> = new Set();
  private followActionListeners: Set<FollowActionListener> = new Set();
  private deletedPostIds: Set<string> = new Set();

  constructor() {
    this.loadDeletedPosts();
  }

  private async loadDeletedPosts() {
    try {
      const stored = await AsyncStorage.getItem('taatom_deleted_post_ids');
      if (stored) {
        const arr = JSON.parse(stored);
        if (Array.isArray(arr)) {
          arr.forEach(id => {
            if (typeof id === 'string') this.deletedPostIds.add(normalizeId(id));
          });
        }
      }
    } catch {}
  }

  private async saveDeletedPosts() {
    try {
      await AsyncStorage.setItem('taatom_deleted_post_ids', JSON.stringify([...this.deletedPostIds]));
    } catch {}
  }

  addDeletedPost(postId: string) {
    const normId = normalizeId(postId);
    if (normId) {
      this.deletedPostIds.add(normId);
      this.saveDeletedPosts();
    }
  }

  isDeleted(postId: string): boolean {
    const normId = normalizeId(postId);
    return normId ? this.deletedPostIds.has(normId) : false;
  }

  filterDeleted<T extends { _id?: any; id?: any }>(posts: T[]): T[] {
    if (!posts) return [];
    return posts.filter(post => {
      if (!post) return false;
      const id1 = post._id ? normalizeId(post._id) : null;
      const id2 = post.id ? normalizeId(post.id) : null;
      return !( (id1 && this.deletedPostIds.has(id1)) || (id2 && this.deletedPostIds.has(id2)) );
    });
  }

  addListener(listener: SavedListener) {
    this.savedListeners.add(listener);
    return () => {
      this.savedListeners.delete(listener);
    };
  }

  addPostActionListener(listener: PostActionListener) {
    this.postActionListeners.add(listener);
    return () => {
      this.postActionListeners.delete(listener);
    };
  }

  addFeedInvalidateListener(listener: FeedInvalidateListener) {
    this.feedInvalidateListeners.add(listener);
    return () => {
      this.feedInvalidateListeners.delete(listener);
    };
  }

  emitFeedInvalidate() {
    this.feedInvalidateListeners.forEach((l) => {
      try { l(); } catch {}
    });
  }

  emitChanged() {
    this.savedListeners.forEach((l) => {
      try { l(); } catch {}
    });
  }

  emitPostAction(postId: string, action: 'like' | 'unlike' | 'save' | 'unsave' | 'comment' | 'archive' | 'unarchive' | 'delete', data?: any) {
    if (action === 'delete') {
      this.addDeletedPost(postId);
    }
    this.postActionListeners.forEach((l) => {
      try { l(postId, action, data); } catch {}
    });
  }

  addFollowActionListener(listener: FollowActionListener) {
    this.followActionListeners.add(listener);
    return () => {
      this.followActionListeners.delete(listener);
    };
  }

  emitFollowAction(userId: string, followState: FollowState) {
    this.followActionListeners.forEach((l) => {
      try { l(userId, followState); } catch {}
    });
  }
}

export const savedEvents = new SavedEvents();



