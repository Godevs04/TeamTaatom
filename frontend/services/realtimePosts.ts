import { socketService } from './socket';
import logger from '../utils/logger';

export interface PostLikeUpdate {
  postId: string;
  isLiked: boolean;
  likesCount: number;
  userId: string;
  timestamp: Date;
}

export interface PostCommentUpdate {
  postId: string;
  comment: any;
  commentsCount: number;
  userId: string;
  timestamp: Date;
}

export interface PostSaveUpdate {
  postId: string;
  isSaved: boolean;
  userId: string;
  timestamp: Date;
}

type PostLikeListener = (data: PostLikeUpdate) => void;
type PostCommentListener = (data: PostCommentUpdate) => void;
type PostSaveListener = (data: PostSaveUpdate) => void;

class RealtimePostsService {
  private likeListeners: Set<PostLikeListener> = new Set();
  private commentListeners: Set<PostCommentListener> = new Set();
  private saveListeners: Set<PostSaveListener> = new Set();
  private isInitialized = false;
  private initializationPromise: Promise<void> | null = null;
  private lastLikeEvent: { postId: string; timestamp: Date } | null = null;

  async initialize() {
    // If already initialized, return immediately
    if (this.isInitialized) return;
    
    // If initialization is in progress, wait for it
    if (this.initializationPromise) {
      return this.initializationPromise;
    }
    
    // Start initialization
    this.initializationPromise = this._doInitialize();
    await this.initializationPromise;
  }

  private async _doInitialize() {
    if (this.isInitialized) return;
    
    if (process.env.NODE_ENV === 'development') {
      logger.debug('Initializing real-time posts service...');
    }
    
    // Subscribe to WebSocket events
    await socketService.subscribe('post:like:update', (data: PostLikeUpdate) => {
      if (process.env.NODE_ENV === 'development') {
        logger.debug('Real-time like update received:', data);
      }
      
      // Deduplicate events - ignore if we've already processed this exact event
      const eventKey = `${data.postId}-${data.timestamp}`;
      const eventTimestamp = new Date(data.timestamp);
      if (this.lastLikeEvent && 
          this.lastLikeEvent.postId === data.postId && 
          this.lastLikeEvent.timestamp.getTime() === eventTimestamp.getTime()) {
        if (process.env.NODE_ENV === 'development') {
          logger.debug('Ignoring duplicate like event:', eventKey);
        }
        return;
      }
      
      this.lastLikeEvent = { postId: data.postId, timestamp: eventTimestamp };
      if (process.env.NODE_ENV === 'development') {
        logger.debug('Processing like event:', eventKey);
        logger.debug('Active like listeners:', this.likeListeners.size);
      }
      
      // Use setTimeout to batch updates and prevent synchronous state updates
      setTimeout(() => {
        this.likeListeners.forEach(listener => {
          try {
            listener(data);
          } catch (error) {
            if (process.env.NODE_ENV === 'development') {
              logger.error('Error in like listener:', error);
            }
          }
        });
      }, 0);
    });

    await socketService.subscribe('post:comment:update', (data: PostCommentUpdate) => {
      logger.debug('Real-time comment update received:', data);
      this.commentListeners.forEach(listener => {
        try {
          listener(data);
        } catch (error) {
          logger.error('Error in comment listener:', error);
        }
      });
    });

    await socketService.subscribe('post:save:update', (data: PostSaveUpdate) => {
      logger.debug('Real-time save update received:', data);
      this.saveListeners.forEach(listener => {
        try {
          listener(data);
        } catch (error) {
          logger.error('Error in save listener:', error);
        }
      });
    });

    this.isInitialized = true;
    if (process.env.NODE_ENV === 'development') {
      logger.info('Real-time posts service initialized successfully');
    }
  }

  // Subscribe to post like updates
  subscribeToLikes(listener: PostLikeListener): () => void {
    // Ensure service is initialized before subscribing
    this.initialize().catch(() => {
      // Silently fail if initialization fails
    });
    
    if (process.env.NODE_ENV === 'development') {
      logger.debug('Adding like listener. Total listeners:', this.likeListeners.size + 1);
    }
    this.likeListeners.add(listener);
    return () => {
      if (process.env.NODE_ENV === 'development') {
        logger.debug('Removing like listener. Remaining listeners:', this.likeListeners.size - 1);
      }
      this.likeListeners.delete(listener);
    };
  }

  // Subscribe to post comment updates
  subscribeToComments(listener: PostCommentListener): () => void {
    // Ensure service is initialized before subscribing
    this.initialize().catch(() => {
      // Silently fail if initialization fails
    });
    
    this.commentListeners.add(listener);
    return () => {
      this.commentListeners.delete(listener);
    };
  }

  // Subscribe to post save updates
  subscribeToSaves(listener: PostSaveListener): () => void {
    // Ensure service is initialized before subscribing
    this.initialize().catch(() => {
      // Silently fail if initialization fails
    });
    
    this.saveListeners.add(listener);
    return () => {
      this.saveListeners.delete(listener);
    };
  }

  // Emit like event to WebSocket (for real-time updates)
  async emitLike(postId: string, isLiked: boolean, likesCount: number) {
    try {
      await socketService.emit('post:like', { postId, isLiked, likesCount });
      logger.debug('Emitted like event:', { postId, isLiked, likesCount });
    } catch (error) {
      logger.error('Error emitting like event:', error);
    }
  }

  // Emit comment event to WebSocket (for real-time updates)
  async emitComment(postId: string, comment: any, commentsCount: number) {
    try {
      await socketService.emit('post:comment', { postId, comment, commentsCount });
      logger.debug('Emitted comment event:', { postId, comment, commentsCount });
    } catch (error) {
      logger.error('Error emitting comment event:', error);
    }
  }

  // Emit save event to WebSocket (for real-time updates)
  async emitSave(postId: string, isSaved: boolean) {
    try {
      await socketService.emit('post:save', { postId, isSaved });
      logger.debug('Emitted save event:', { postId, isSaved });
    } catch (error) {
      logger.error('Error emitting save event:', error);
    }
  }
}

export const realtimePostsService = new RealtimePostsService();
