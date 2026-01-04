import { Audio } from "expo-av";
import { AppState } from "react-native";
import logger from './logger';

class AudioManager {
  currentSound: Audio.Sound | null = null;
  currentPostId: string | null = null;
  private listeners: Set<(postId: string | null) => void> = new Set();

  async playSound(sound: Audio.Sound, postId: string) {
    await this.stopAll();
    this.currentSound = sound;
    this.currentPostId = postId;
    await sound.playAsync().catch(() => {});
    this.notifyListeners(postId);
    logger.debug('Playing audio:', postId);
  }

  async stopAll() {
    if (this.currentSound) {
      await this.currentSound.stopAsync().catch(() => {});
      await this.currentSound.unloadAsync().catch(() => {});
      this.currentSound = null;
      this.currentPostId = null;
      this.notifyListeners(null);
      logger.debug('Stopped all audio');
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
   * Toggle mute for current sound
   */
  async toggleMute(isMuted: boolean, volume: number = 0.5): Promise<void> {
    if (!this.currentSound) {
      logger.debug('toggleMute: No current sound, skipping');
      return;
    }
    
    try {
      // Check if sound is loaded before attempting to set volume
      const status = await this.currentSound.getStatusAsync();
      if (!status.isLoaded) {
        logger.debug('toggleMute: Sound not loaded, skipping');
        return;
      }
      
      await this.currentSound.setVolumeAsync(isMuted ? 0 : volume);
    } catch (error) {
      logger.error('Error toggling mute:', error);
      // Don't re-throw, just log the error
    }
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

export const audioManager = new AudioManager();

// Ensure audio stops when app goes background
AppState.addEventListener("change", (state) => {
  if (state !== "active") {
    audioManager.stopAll();
  }
});
