import { Audio } from 'expo-av';
import logger from './logger';

/**
 * Global Audio Manager
 * Ensures only one audio instance plays at a time across the app
 */
class AudioManager {
  private currentSound: Audio.Sound | null = null;
  private currentPostId: string | null = null;
  private listeners: Set<(postId: string | null) => void> = new Set();

  /**
   * Register a new audio instance
   * If another audio is playing, it will be paused
   */
  async registerAudio(sound: Audio.Sound, postId: string): Promise<void> {
    // If there's already a sound playing (and it's not the same post), pause it
    if (this.currentSound && this.currentPostId !== postId) {
      try {
        const status = await this.currentSound.getStatusAsync();
        if (status.isLoaded && 'isPlaying' in status && status.isPlaying) {
          logger.debug('Pausing previous audio:', this.currentPostId);
          await this.currentSound.pauseAsync();
        }
      } catch (error) {
        logger.error('Error pausing previous audio:', error);
      }
    }

    this.currentSound = sound;
    this.currentPostId = postId;
    this.notifyListeners(postId);
    logger.debug('Registered new audio:', postId);
  }

  /**
   * Unregister an audio instance
   */
  unregisterAudio(postId: string): void {
    if (this.currentPostId === postId) {
      this.currentSound = null;
      this.currentPostId = null;
      this.notifyListeners(null);
      logger.debug('Unregistered audio:', postId);
    }
  }

  /**
   * Pause all currently playing audio
   */
  async pauseAll(): Promise<void> {
    if (this.currentSound) {
      try {
        const status = await this.currentSound.getStatusAsync();
        if (status.isLoaded && 'isPlaying' in status && status.isPlaying) {
          await this.currentSound.pauseAsync();
          logger.debug('Paused all audio');
        }
      } catch (error) {
        logger.error('Error pausing all audio:', error);
      }
    }
    this.notifyListeners(null);
  }

  /**
   * Stop and unload all audio
   */
  async stopAll(): Promise<void> {
    if (this.currentSound) {
      try {
        await this.currentSound.stopAsync();
        await this.currentSound.unloadAsync();
        logger.debug('Stopped all audio');
      } catch (error) {
        logger.error('Error stopping all audio:', error);
      }
      this.currentSound = null;
      this.currentPostId = null;
      this.notifyListeners(null);
    }
  }

  /**
   * Get currently playing post ID
   */
  getCurrentPostId(): string | null {
    return this.currentPostId;
  }

  /**
   * Check if a specific post is currently playing
   */
  isPostPlaying(postId: string): boolean {
    return this.currentPostId === postId;
  }

  /**
   * Add a listener for audio changes
   */
  addListener(callback: (postId: string | null) => void): () => void {
    this.listeners.add(callback);
    return () => {
      this.listeners.delete(callback);
    };
  }

  /**
   * Notify all listeners
   */
  private notifyListeners(postId: string | null): void {
    this.listeners.forEach(callback => {
      try {
        callback(postId);
      } catch (error) {
        logger.error('Error in audio manager listener:', error);
      }
    });
  }
}

// Export singleton instance
export const audioManager = new AudioManager();

