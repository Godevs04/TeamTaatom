type SavedListener = () => void;
type PostActionListener = (postId: string, action: 'like' | 'unlike' | 'save' | 'unsave' | 'comment', data?: any) => void;

class SavedEvents {
  private savedListeners: Set<SavedListener> = new Set();
  private postActionListeners: Set<PostActionListener> = new Set();

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

  emitChanged() {
    this.savedListeners.forEach((l) => {
      try { l(); } catch {}
    });
  }

  emitPostAction(postId: string, action: 'like' | 'unlike' | 'save' | 'unsave' | 'comment', data?: any) {
    this.postActionListeners.forEach((l) => {
      try { l(postId, action, data); } catch {}
    });
  }
}

export const savedEvents = new SavedEvents();


