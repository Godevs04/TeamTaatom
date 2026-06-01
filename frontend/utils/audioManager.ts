import { Audio } from "expo-av";
import { AppState } from "react-native";
import logger from './logger';

class AudioManager {
  currentSound: Audio.Sound | null = null;
  currentPostId: string | null = null;
  /** Session-wide mute for feed post audio (persists across posts until toggled). */
  private sessionMuted = true;
  private sessionMuteListeners: Set<(muted: boolean) => void> = new Set();
  // When frozen, playSound refuses to start playback and unloads the incoming
  // sound instead. Used by screens (e.g. Shorts) during their tab-blur cleanup
  // to defeat the race where an in-flight Audio.Sound.loadAsync resolves AFTER
  // the user has navigated away and would otherwise start playback in the
  // background. The freeze auto-clears after a short window (long enough for
  // any pending load to resolve, short enough to not block legitimate audio
  // on the next screen).
  private frozenUntil = 0;
  private listeners: Set<(postId: string | null) => void> = new Set();

  /**
   * Reject any new playSound calls for `windowMs`. Existing playback is
   * stopped via the regular stopAll() path. Called by Shorts on tab blur.
   */
  freeze(windowMs: number = 400): void {
    this.frozenUntil = Date.now() + windowMs;
  }

  /**
   * Cancel any active freeze. Called by Shorts on focus return so the
   * next song can play immediately after the user comes back to the tab.
   */
  unfreeze(): void {
    this.frozenUntil = 0;
  }

  isFrozen(): boolean {
    return Date.now() < this.frozenUntil;
  }

  getSessionMuted(): boolean {
    return this.sessionMuted;
  }

  setSessionMuted(muted: boolean): void {
    this.sessionMuted = muted;
    this.sessionMuteListeners.forEach((cb) => {
      try { cb(muted); } catch (_) {}
    });
  }

  addSessionMuteListener(callback: (muted: boolean) => void): () => void {
    this.sessionMuteListeners.add(callback);
    return () => { this.sessionMuteListeners.delete(callback); };
  }

  async playSound(sound: Audio.Sound, postId: string) {
    if (this.isFrozen()) {
      // Caller's screen is mid-blur. Don't start playback — just unload the
      // sound the caller already loaded so we don't leak a native player.
      try { await sound.unloadAsync(); } catch (_) {}
      logger.debug('audioManager.playSound bypassed (frozen):', postId);
      return;
    }
    await this.stopAll();
    this.currentSound = sound;
    this.currentPostId = postId;
    await sound.playAsync().catch(() => {});
    this.notifyListeners(postId);
    logger.debug('Playing audio:', postId);
  }

  async stopAll() {
    const sound = this.currentSound;
    this.currentSound = null;
    this.currentPostId = null;
    this.notifyListeners(null);
    if (sound) {
      try {
        const status = await sound.getStatusAsync();
        if (status.isLoaded) {
          if (status.isPlaying) {
            await sound.stopAsync().catch(() => {});
          }
          await sound.unloadAsync().catch(() => {});
        }
      } catch (_) {
        // Sound already gone — safe to ignore
      }
      logger.debug('Stopped all audio');
    }
  }

  async deactivateSession(): Promise<void> {
    await this.stopAll();
    try {
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: false,
        playsInSilentModeIOS: false,
        staysActiveInBackground: false,
        shouldDuckAndroid: true,
        playThroughEarpieceAndroid: false,
      });
      logger.debug('Deactivated audio session');
    } catch (error) {
      logger.warn('Failed to deactivate audio session:', error);
    }
  }

  /**
   * Get currently playing sound instance (for external pause when tab/focus changes)
   */
  getCurrentSound(): Audio.Sound | null {
    return this.currentSound;
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
      
      await this.currentSound.setIsMutedAsync(isMuted).catch(() => {});
      await this.currentSound.setVolumeAsync(isMuted ? 0 : volume).catch(() => {});
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
