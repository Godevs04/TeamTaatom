import React, { useState, useEffect, useRef, useCallback } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Animated } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Audio } from 'expo-av';
import * as FileSystem from 'expo-file-system/legacy';
import { useIsFocused } from '@react-navigation/native';
import { useTheme } from '../context/ThemeContext';
import { PostType } from '../types/post';
import logger from '../utils/logger';
import { audioManager } from '../utils/audioManager';

interface SongPlayerProps {
  post: PostType;
  isVisible?: boolean;
  autoPlay?: boolean;
  showPlayPause?: boolean; // Show play/pause button (for home page)
  /** External mute control — when true, mutes the song (for shorts mute button) */
  externalMuted?: boolean;
  /** Called when this instance becomes the active player or stops (for Shorts to pause on tab/focus change) */
  onPlayingChange?: (sound: Audio.Sound | null) => void;
}

/**
 * Cache remote audio files locally to eliminate network buffering latency on seeks & loops.
 */
const cacheSongLocally = async (remoteUrl: string): Promise<string> => {
  try {
    const cleanUrl = remoteUrl.trim();
    if (!cleanUrl.startsWith('http://') && !cleanUrl.startsWith('https://')) {
      return cleanUrl;
    }
    let filename = cleanUrl.split('/').pop()?.split('?')[0] ?? `song_${Date.now()}.mp3`;
    filename = filename.replace(/[^a-zA-Z0-9._-]/g, '_');
    
    const cacheDir = FileSystem.cacheDirectory;
    if (!cacheDir) return cleanUrl;

    const localPath = `${cacheDir}songs/${filename}`;

    // Check if the file is already cached and valid
    const info = await FileSystem.getInfoAsync(localPath);
    if (info.exists && info.size && info.size > 0) {
      logger.debug(`[AudioCache] Cache hit: ${filename}`);
      return localPath;
    }

    // Ensure directory exists
    await FileSystem.makeDirectoryAsync(`${cacheDir}songs/`, { intermediates: true });

    // Download to local cache
    logger.debug(`[AudioCache] Cache miss. Downloading: ${filename}`);
    const downloadResult = await FileSystem.downloadAsync(cleanUrl, localPath);
    logger.debug(`[AudioCache] Download completed: ${filename} (status: ${downloadResult.status})`);
    
    if (downloadResult.status === 200) {
      return localPath;
    }
    return cleanUrl;
  } catch (error) {
    logger.warn('[AudioCache] Failed to cache song locally, falling back to remote URL:', error);
    return remoteUrl;
  }
};

function SongPlayerComponent({ post, isVisible = true, autoPlay = false, showPlayPause = false, externalMuted, onPlayingChange }: SongPlayerProps) {
  const isFocused = useIsFocused();
  const isEffectiveVisible = isVisible && isFocused;

  if (__DEV__) {
    logger.debug('[SongPlayerComponent Render]', {
      postId: post._id,
      isVisible: isEffectiveVisible,
      autoPlay,
      externalMuted,
    });
  }
  const { theme } = useTheme();
  const [sound, setSound] = useState<Audio.Sound | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  // URL fetched dynamically when getShorts URL generation failed (storage issues, etc.)
  const [fetchedUrl, setFetchedUrl] = useState<string | null>(null);
  const fadeAnim = useRef(new Animated.Value(1)).current;
  const soundRef = useRef<Audio.Sound | null>(null);
  const isInitializedRef = useRef(false);
  const isMountedRef = useRef(true); // Track if component is mounted
  // Mirrors the isVisible prop synchronously so loadAndPlaySong can detect a
  // nav-during-load (tab switch or scroll to next reel) and abort instead of
  // starting playback in the background after the user has already navigated.
  const isVisibleRef = useRef(isEffectiveVisible);
  // Token bumped on every loadAndPlaySong invocation. After awaiting loadAsync
  // we compare the captured token against the current ref — if they differ a
  // newer load was started or the component unmounted, and this stale load
  // should silently unload and bail.
  const loadTokenRef = useRef(0);
  // True after a preload (loadAsync with shouldPlay:false) completes and
  // before audioManager.playSound has been called for this sound. Lets the
  // effect tell apart "loaded but never played" (preload — start it) from
  // "was playing, audioManager stopped externally" (the existing reload path).
  // Without this guard the reload-detection branch would unload our preloaded
  // sound on the very render that flips autoPlay true, defeating the preload.
  const preloadedRef = useRef(false);

  // Get song data from post
  const song = post.song?.songId;
  const startTime = post.song?.startTime || 0;
  const endTime = post.song?.endTime || null;
  const volume = post.song?.volume || 0.5;

  // Debug: Log song data
  useEffect(() => {
    if (post.song && __DEV__) {
      logger.debug('[SONGPLAYER] Mount/update:', {
        postId: String(post._id),
        isVisible: isEffectiveVisible,
        autoPlay,
      });
    }
  }, [post.song, isEffectiveVisible, autoPlay, post._id]);

  // If backend URL generation failed (s3Url/cloudinaryUrl missing), fetch a fresh URL via API
  useEffect(() => {
    const staticUrl = song?.s3Url || (song as any)?.cloudinaryUrl;
    if (staticUrl || !song?._id) return; // already have URL or no song ID to fetch with
    let cancelled = false;
    (async () => {
      try {
        const { getSongById } = await import('../services/songs');
        const freshSong = await getSongById(song._id);
        const url = freshSong?.s3Url || (freshSong as any)?.cloudinaryUrl || null;
        if (!cancelled && url) {
          setFetchedUrl(url);
          logger.debug('SongPlayer - fetched fresh URL for missing song URL:', { songId: song._id });
        }
      } catch (e) {
        logger.warn('SongPlayer - failed to fetch fresh song URL:', e);
      }
    })();
    return () => { cancelled = true; };
  }, [song?._id, song?.s3Url, (song as any)?.cloudinaryUrl]);

  // Audio mode is now set globally in _layout.tsx

  // Track mount status
  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  // Keep isVisibleRef aligned with the prop. Assigned in the render body
  // (NOT a useEffect) so the ref reflects the new value the moment React
  // hands us the new prop — before commit, before child effects run. A
  // useEffect-based sync leaves a brief race window during which an
  // in-flight loadAsync can resolve and decide it's still "visible".
  isVisibleRef.current = isEffectiveVisible;

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      isMountedRef.current = false; // Mark as unmounted
      // Bump the load token so any awaited loadAndPlaySong knows it's stale
      // and unloads its sound instead of playing it on a dead component.
      loadTokenRef.current += 1;
      onPlayingChange?.(null);
      if (soundRef.current) {
        // Silently cleanup - cancellations are expected on unmount
        soundRef.current.stopAsync().catch(() => {});
        soundRef.current.unloadAsync().catch(() => {});
        soundRef.current = null;
        // Note: setSound / setIsPlaying intentionally NOT called here —
        // the component is already unmounted, calling state setters is a no-op
        // at best and a "can't update unmounted" warning at worst.
      }
      preloadedRef.current = false;
      isInitializedRef.current = false;
    };
  }, [post._id, onPlayingChange]);

  // Sync external mute prop → internal mute state + live sound volume
  useEffect(() => {
    if (externalMuted === undefined) return;
    setIsMuted(externalMuted);
    if (soundRef.current) {
      soundRef.current.setVolumeAsync(externalMuted ? 0 : volume).catch(() => {});
    }
  }, [externalMuted, volume]);

  // Helper function to fetch fresh signed URL if needed
  const fetchFreshSignedUrl = useCallback(async (): Promise<string | null> => {
    if (!song?._id) return null;
    
    try {
      const { getSongById } = await import('../services/songs');
      const freshSong = await getSongById(song._id);
      return freshSong.s3Url || (freshSong as any).cloudinaryUrl || null;
    } catch (error) {
      logger.error('Failed to fetch fresh signed URL:', error);
      return null;
    }
  }, [song?._id]);

  const loadAndPlaySong = useCallback(async (forcePlay: boolean = false, retryCount: number = 0) => {
    // Get audio URL - try s3Url first, then cloudinaryUrl, then dynamically fetched URL
    let audioUrlRaw = song?.s3Url || (song as any)?.cloudinaryUrl || fetchedUrl;

    logger.debug('[SONGPLAYER] loadAndPlaySong called:', { postId: String(post._id), hasAudioUrl: !!audioUrlRaw });

    if (!audioUrlRaw) {
      logger.debug('[SONGPLAYER] No URL — cannot play');
      return;
    }

    // Each load attempt gets a fresh token. After every async step we compare
    // the captured token to the current ref — if they differ, a newer load was
    // initiated OR the component unmounted, and this run is stale.
    const myLoadToken = ++loadTokenRef.current;
    const isStale = () => myLoadToken !== loadTokenRef.current || !isMountedRef.current || !isVisibleRef.current;

    try {
      // Check if component is still mounted/visible before starting
      if (!isMountedRef.current || !isVisibleRef.current) {
        return;
      }

      setIsLoading(true);
      
      // Cache song locally first to eliminate network buffering latency on seeks & loops
      const localUri = await cacheSongLocally(audioUrlRaw);

      if (isStale()) {
        setIsLoading(false);
        return;
      }

      // Cleanup old sound (cancellations are expected)
      if (soundRef.current) {
        try {
          await soundRef.current.unloadAsync();
        } catch (e: any) {
          // Ignore cancellation errors (-1102) during cleanup - they're expected
          const errorCode = e?.code;
          const errorDomain = e?.domain;
          const errorMessage = e?.message || '';
          
          if (!(errorCode === -1102 || (errorDomain === 'NSURLErrorDomain' && errorCode === -1102) ||
                errorMessage.includes('-1102') || errorMessage.includes('NSURLErrorCancelled') ||
                errorMessage.includes('operation was cancelled') || errorMessage.includes('operation cancelled'))) {
            // Only log non-cancellation errors
            logger.debug('Error during sound cleanup (non-cancellation):', e);
          }
        }
        soundRef.current = null;
      }

      // Clean and validate URL/path
      let audioUrl = localUri.trim();
      if (!audioUrl.startsWith('http://') && !audioUrl.startsWith('https://') && !audioUrl.startsWith('file://')) {
        logger.error('Invalid audio URI:', audioUrl);
        throw new Error('Invalid audio URI format');
      }

      logger.debug('🎵 Playing audio URI:', audioUrl);
      logger.debug('   URI length:', audioUrl.length);

      // Determine if we should play immediately
      const shouldPlayNow = forcePlay || autoPlay;

      // 🔴 CRITICAL: Use streaming pattern (or local file URI)
      const newSound = new Audio.Sound();

      // Load sound - since it is local, it initializes instantly
      await newSound.loadAsync(
        { uri: audioUrl },
        {
          shouldPlay: shouldPlayNow, // Play immediately if needed
          progressUpdateIntervalMillis: 150,
          isLooping: !endTime,
          volume: isMuted ? 0 : volume,
          positionMillis: startTime * 1000,
        },
        false // Keep false to allow fast initialization
      );

      // ABORT GUARD: If the user navigated away (tab switch / reel scroll)
      // while loadAsync was in flight, this run is stale. Unload the sound
      // immediately rather than letting it play in the background. This is
      // the fix for "song keeps playing after switching to home" and prevents
      // the orphaned-player crash that follows.
      if (isStale()) {
        logger.debug('[SONGPLAYER] Stale load — unloading without play', { postId: String(post._id) });
        try { await newSound.unloadAsync(); } catch (_) {}
        return;
      }

      soundRef.current = newSound;
      setSound(newSound);

      // Use audioManager.playSound to ensure previous audio stops (only if we're going to play)
      if (shouldPlayNow && post._id) {
        // Re-check between awaits — playSound starts native playback and
        // wires the sound into audioManager.currentSound; if we navigated
        // away during the brief window between loadAsync resolving and now,
        // we'd start playback for nothing.
        if (isStale()) {
          try { await newSound.unloadAsync(); } catch (_) {}
          soundRef.current = null;
          if (isMountedRef.current) setSound(null);
          return;
        }
        await audioManager.playSound(newSound, post._id.toString());
        onPlayingChange?.(newSound);
        preloadedRef.current = false;
      } else {
        // Preload path: sound is loaded with shouldPlay:false and is not yet
        // wired into audioManager. The visibility/autoPlay effect uses this
        // flag to skip the reload-detection branch and call playSound on the
        // existing sound the moment autoPlay flips true.
        preloadedRef.current = true;
      }
      
      // Set up playback status listener
      newSound.setOnPlaybackStatusUpdate((status: any) => {
        // Don't update state if component is unmounted
        if (!isMountedRef.current) return;

        if (status.isLoaded) {
          setIsPlaying(status.isPlaying);
          setIsLoading(false);
          
          // Seamless loop: seek slightly before segment end to avoid gap (library assets)
          if (endTime && status.positionMillis >= endTime * 1000 - 80) {
            newSound.setPositionAsync(startTime * 1000).catch(() => {});
          } else if (status.didJustFinish) {
            if (startTime > 0) {
              newSound.setPositionAsync(startTime * 1000).catch(() => {});
            } else {
              newSound.setPositionAsync(0).catch(() => {});
            }
            newSound.playAsync().catch(() => {});
          }
        } else if (status.error) {
          // Check if error is -1102 (operation cancelled) - this is expected and shouldn't be logged
          const errorCode = status.error?.code;
          const errorDomain = status.error?.domain;
          const errorMessage = status.error?.message || '';
          
          // -1102 NSURLErrorCancelled is expected when operation is cancelled (navigation, unmount, etc.)
          if (errorCode === -1102 || (errorDomain === 'NSURLErrorDomain' && errorCode === -1102) ||
              errorMessage.includes('-1102') || errorMessage.includes('NSURLErrorCancelled') ||
              errorMessage.includes('operation was cancelled') || errorMessage.includes('operation cancelled')) {
            // Silently ignore cancelled operations - they're expected behavior
            logger.debug('Audio playback cancelled (expected) - operation was cancelled');
            setIsLoading(false);
          } else {
            // Log actual errors that aren't cancellations
            logger.error('Playback error:', status.error);
            setIsLoading(false);
          }
        }
      });

      setIsLoading(false);
      if (shouldPlayNow) {
        setIsPlaying(true);
      }

      logger.debug('[SONGPLAYER] Sound loaded:', {
        postId: String(post._id),
        shouldPlayNow,
      });
    } catch (error: any) {
      setIsLoading(false);
      setIsPlaying(false);
      
      // Check if error is -1102 (operation cancelled) - this is expected and shouldn't be logged
      const errorCode = error?.code;
      const errorDomain = error?.domain;
      const errorMessage = typeof error === 'string' ? error : error?.message || '';
      
      // -1102 NSURLErrorCancelled is expected when operation is cancelled (navigation, unmount, etc.)
      if (errorCode === -1102 || (errorDomain === 'NSURLErrorDomain' && errorCode === -1102) || 
          errorMessage.includes('-1102') || errorMessage.includes('NSURLErrorCancelled') ||
          errorMessage.includes('operation was cancelled') || errorMessage.includes('operation cancelled')) {
        // Silently ignore cancelled operations - they're expected behavior
        logger.debug('Audio loading cancelled (expected) - operation was cancelled');
        return; // Don't throw error or log to Sentry
      }
      
      // Handle signed URL expiry - retry once with fresh URL
      const isTimeout = errorMessage.includes('timeout') || errorMessage.includes('60');
      const is403 = errorMessage.includes('403') || errorMessage.includes('Forbidden');
      const isExpired = errorMessage.includes('expired') || errorMessage.includes('ExpiredRequest');
      
      if ((isTimeout || is403 || isExpired) && retryCount === 0) {
        logger.debug('🔄 URL may be expired, fetching fresh URL and retrying...');
        const freshUrl = await fetchFreshSignedUrl();
        if (freshUrl) {
          // Update song object with fresh URL
          if (song) {
            (song as any).s3Url = freshUrl;
            (song as any).cloudinaryUrl = freshUrl;
          }
          // Retry once with fresh URL
          return loadAndPlaySong(forcePlay, 1);
        }
      }
      
      // Log error details for debugging (only for actual errors, not cancellations)
      logger.error('[SONGPLAYER] Error loading song:', {
        postId: String(post._id),
        message: errorMessage,
        code: errorCode,
        domain: errorDomain,
        url: audioUrlRaw ? String(audioUrlRaw).substring(0, 80) + '...' : 'NULL',
      });
      
      throw error;
    }
  }, [song?.s3Url, (song as any)?.cloudinaryUrl, fetchedUrl, autoPlay, isMuted, volume, startTime, endTime, onPlayingChange]);

  // Auto-play when component becomes visible and autoPlay is true (for shorts and home page)
  // For home page (showPlayPause=true), don't auto-play
  useEffect(() => {
    // For shorts and home page: sync with visibility and autoPlay prop
    const audioUrl = song?.s3Url || (song as any)?.cloudinaryUrl || fetchedUrl;
    if (isEffectiveVisible && !showPlayPause && audioUrl) {
      if (autoPlay) {
        // Should play - play song
        const currentPostId = audioManager.getCurrentPostId();
        const wasPreloaded = preloadedRef.current;
        preloadedRef.current = false;

        // CRITICAL SYNC FIX: If audio is preloaded and ready, play it IMMEDIATELY
        // This ensures audio/video sync from the very start
        if (soundRef.current && wasPreloaded && post._id) {
          logger.debug('[SONGPLAYER] Playing preloaded audio immediately for sync');
          // Play preloaded sound immediately without any checks
          soundRef.current.playAsync()
            .then(() => {
              setIsPlaying(true);
              audioManager.playSound(soundRef.current!, post._id.toString()).catch(() => {});
            })
            .catch((err) => {
              logger.debug('[SONGPLAYER] Preloaded play failed:', err);
              // Fallback: reload if preloaded play fails
              soundRef.current = null;
              setSound(null);
              loadAndPlaySong();
            });
          return;
        }

        // OPTIMIZATION: If sound exists and is for the same post, resume immediately
        // without any status checks to minimize delay when returning to same short
        if (soundRef.current && post._id && currentPostId === post._id.toString()) {
          logger.debug('[SONGPLAYER] Resuming same post audio immediately (no status check)');
          // Resume immediately without awaiting - fire and forget for speed
          soundRef.current.playAsync().catch((err) => {
            logger.debug('[SONGPLAYER] Immediate resume failed, attempting recovery:', err);
            // Only if immediate resume fails, do a status check
            soundRef.current?.getStatusAsync()
              .then((status) => {
                if (status.isLoaded && !status.isPlaying) {
                  soundRef.current?.playAsync().catch(() => {});
                } else if (!status.isLoaded) {
                  // Sound was unloaded, need to reload
                  soundRef.current = null;
                  setSound(null);
                  loadAndPlaySong();
                }
              })
              .catch(() => {
                // Status check failed, reload
                soundRef.current = null;
                setSound(null);
                loadAndPlaySong();
              });
          });
          setIsPlaying(true);
          return;
        }

        // Critical check: If soundRef exists but audioManager has no current sound,
        // it means stopAll() was called and the sound was unloaded externally.
        // Only reload if the sound was truly unloaded (mute toggle case).
        // Do NOT reload if stopAll() was called as cleanup (leaving screen) —
        // detect this by checking if the sound object is still loaded.
        if (soundRef.current && currentPostId === null && !wasPreloaded) {
          // Check if sound is actually still loaded before reloading
          soundRef.current.getStatusAsync()
            .then((status) => {
              if (isEffectiveVisible && autoPlay) {
                // If the post is visible and should play, reload and play it
                // (handles both the case where it was unloaded natively during mute
                // and the case where it's still loaded but detached from audioManager)
                logger.debug('Sound needs playback but audioManager detached/unloaded. Reloading...');
                soundRef.current = null;
                setSound(null);
                loadAndPlaySong()
                  .then(() => {
                    setIsPlaying(true);
                  })
                  .catch((err) => {
                    logger.error('Error reloading sound after external stop:', err);
                  });
              } else {
                // Not visible or not autoPlay — just clean up references
                logger.debug('Sound stopped externally, clearing refs');
                soundRef.current = null;
                setSound(null);
                setIsPlaying(false);
              }
            })
            .catch(() => {
              // Status check failed — sound is gone, clean up
              soundRef.current = null;
              setSound(null);
              setIsPlaying(false);
            });
          return;
        }
        
        if (!soundRef.current) {
          // Load and play if not already loaded
          loadAndPlaySong();
        } else if (post._id && currentPostId !== post._id.toString()) {
          // Different post is playing, use audioManager to switch
          audioManager.playSound(soundRef.current, post._id.toString())
            .then(() => {
              setIsPlaying(true);
            })
            .catch((err) => {
              logger.error('Error playing sound:', err);
              // If playSound fails (e.g., sound was unloaded), reload
              soundRef.current = null;
              setSound(null);
              loadAndPlaySong();
            });
        } else {
          // Post is not currently playing - need to load and play
          logger.debug('[SONGPLAYER] Post not currently playing, loading and playing');
          loadAndPlaySong()
            .then(() => {
              setIsPlaying(true);
            })
            .catch((err) => {
              logger.error('Error loading and playing sound:', err);
            });
        }
      } else {
        // autoPlay is false - PRELOAD mode
        // For shorts: preload audio in parallel with video buffering
        // This ensures audio is ready to play immediately when video starts
        if (!soundRef.current) {
          // PRELOAD: load the song silently in parallel with the video buffer.
          // shouldPlayNow inside loadAndPlaySong derives from autoPlay (false here),
          // so the sound loads with shouldPlay:false. The moment the video reports
          // isPlaying:true and autoPlay flips, the autoPlay branch above starts
          // playback on this already-loaded sound — within a frame instead of
          // trailing the video by the song's load latency (~200-500ms).
          logger.debug('[SONGPLAYER] Preloading audio for sync with video');
          loadAndPlaySong();
        } else {
          // Sound exists — pause it (muted, paused, or about to lose focus).
          // Check if sound is actually loaded before pausing — loadAsync may
          // still be in-flight, and calling pauseAsync on a loading sound throws.
          soundRef.current.pauseAsync().catch(err => {
            // pauseAsync routinely rejects when the sound was unloaded
            // or when the native op was cancelled (-1102). These are expected.
            const code = err?.code;
            const msg = err?.message || '';
            const isExpected =
              code === -1102 ||
              msg.includes('-1102') ||
              msg.includes('NSURLErrorCancelled') ||
              msg.includes('cancelled') ||
              msg.includes('unloaded') ||
              msg.includes('not loaded');
            if (!isExpected) logger.error('Error pausing:', err);
          });
          setIsPlaying(false);
        }
      }
    }

    // Pause (don't unload) when component becomes invisible — keeps audio for resume
    if (!isEffectiveVisible && (!showPlayPause || !isFocused)) {
      loadTokenRef.current += 1;
      preloadedRef.current = false;
      if (soundRef.current) {
        onPlayingChange?.(null);
        soundRef.current.pauseAsync().catch(() => {});
        setIsPlaying(false);
      }
    }
  }, [isEffectiveVisible, isFocused, autoPlay, showPlayPause, song?.s3Url, (song as any)?.cloudinaryUrl, fetchedUrl, loadAndPlaySong, post._id, onPlayingChange]);

  const togglePlayPause = useCallback(async () => {
    logger.debug('Toggle play/pause - soundRef exists:', !!soundRef.current);
    
    if (!soundRef.current) {
      logger.debug('No sound loaded, loading and playing...');
      await loadAndPlaySong(true); // Force play when user clicks play button
      return;
    }

    try {
      const status = await soundRef.current.getStatusAsync();
      logger.debug('Current playback status:', status);
      
      if (status.isLoaded) {
        const isCurrentlyPlaying = 'isPlaying' in status && status.isPlaying;
        if (isCurrentlyPlaying) {
          logger.debug('Pausing playback...');
          await soundRef.current.pauseAsync();
          setIsPlaying(false);
        } else {
          logger.debug('Starting playback...');
          // Use audioManager.playSound to ensure previous audio stops
          if (post._id) {
            await audioManager.playSound(soundRef.current, post._id.toString());
          }
          // Ensure volume is set correctly - check status first to avoid errors
          try {
            const currentStatus = await soundRef.current.getStatusAsync();
            if (currentStatus.isLoaded) {
              await soundRef.current.setVolumeAsync(isMuted ? 0 : volume);
            } else {
              logger.warn('Sound not loaded when setting volume, skipping volume update');
            }
          } catch (volumeError) {
            logger.warn('Error setting volume (non-critical):', volumeError);
            // Non-critical error, continue with playback
          }
          setIsPlaying(true);
          logger.debug('Playback started');
        }
      } else {
        logger.error('Sound status error, reloading:', status);
        // If there's an error, reload the sound
        await loadAndPlaySong(true);
      }
    } catch (error) {
      logger.error('Error toggling playback:', error);
      // On error, try to reload and play
      try {
        await loadAndPlaySong(true);
      } catch (reloadError) {
        logger.error('Error reloading song:', reloadError);
      }
    }
  }, [loadAndPlaySong, isMuted, volume]);

  const toggleMute = useCallback(async () => {
    if (!soundRef.current) return;

    try {
      // Check if sound is loaded before attempting to set volume
      const status = await soundRef.current.getStatusAsync();
      if (!status.isLoaded) {
        logger.warn('Cannot toggle mute: sound is not loaded');
        return;
      }

      const newMutedState = !isMuted;
      await soundRef.current.setVolumeAsync(newMutedState ? 0 : volume);
      setIsMuted(newMutedState);

      // Animate mute icon
      Animated.sequence([
        Animated.timing(fadeAnim, {
          toValue: 0.5,
          duration: 100,
          useNativeDriver: true,
        }),
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 100,
          useNativeDriver: true,
        }),
      ]).start();
    } catch (error) {
      logger.error('Error toggling mute:', error);
    }
  }, [isMuted, volume, fadeAnim]);

  const stopSong = useCallback(async () => {
    if (soundRef.current) {
      try {
        await soundRef.current.stopAsync();
        await soundRef.current.unloadAsync();
        soundRef.current = null;
        setSound(null);
        setIsPlaying(false);
      } catch (error) {
        logger.error('Error stopping song:', error);
      }
    }
  }, []);

  // Don't render if no song
  if (!song) {
    return null;
  }

  // Check if song has required data - try s3Url, cloudinaryUrl, then dynamically fetched URL
  const audioUrl = song?.s3Url || (song as any)?.cloudinaryUrl || fetchedUrl;
  if (!audioUrl) {
    // No URL yet — if we have a song ID, the fetch useEffect is running; show nothing for now
    if (__DEV__ && song?._id) {
      logger.debug('SongPlayer: Waiting for song URL fetch', { postId: post._id, songId: song._id });
    }
    return null;
  }

  const styles = StyleSheet.create({
    container: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: showPlayPause 
        ? 'rgba(0, 0, 0, 0.25)' // More transparent for home page (glass effect)
        : 'rgba(0, 0, 0, 0.4)', // Less transparent for shorts
      borderRadius: 25,
      paddingHorizontal: 14,
      paddingVertical: 10,
      marginTop: 0,
      minHeight: 44,
      zIndex: 1000,
      width: '100%',
      borderWidth: 1,
      borderColor: showPlayPause 
        ? 'rgba(255, 255, 255, 0.25)' // Lighter border for glass effect
        : 'rgba(255, 255, 255, 0.15)',
      // Glass effect shadows
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: showPlayPause ? 0.15 : 0.2,
      shadowRadius: showPlayPause ? 8 : 6,
      elevation: showPlayPause ? 3 : 5,
    },
    songInfo: {
      flex: 1,
      marginLeft: 10,
    },
    songTitle: {
      color: '#fff',
      fontSize: 13,
      fontWeight: '600',
      textShadowColor: 'rgba(0, 0, 0, 0.5)',
      textShadowOffset: { width: 0, height: 1 },
      textShadowRadius: 2,
    },
    songArtist: {
      color: 'rgba(255, 255, 255, 0.85)',
      fontSize: 11,
      marginTop: 2,
      textShadowColor: 'rgba(0, 0, 0, 0.5)',
      textShadowOffset: { width: 0, height: 1 },
      textShadowRadius: 2,
    },
    controls: {
      flexDirection: 'row',
      alignItems: 'center',
      marginLeft: 8,
    },
    controlButton: {
      padding: 8,
      marginLeft: 4,
      minWidth: 36,
      minHeight: 36,
      justifyContent: 'center',
      alignItems: 'center',
    },
    loadingContainer: {
      width: 16,
      height: 16,
      justifyContent: 'center',
      alignItems: 'center',
    },
  });

  return (
    <View style={styles.container}>
      {/* Play/Pause Button (for home page) or Music Icon (for shorts) */}
      {showPlayPause ? (
        <TouchableOpacity
          style={styles.controlButton}
          onPress={() => {
            logger.debug('Play/Pause button pressed');
            togglePlayPause();
          }}
          disabled={isLoading}
          activeOpacity={0.7}
        >
          {isLoading ? (
            <View style={styles.loadingContainer}>
              <Animated.View
                style={{
                  width: 12,
                  height: 12,
                  borderRadius: 6,
                  backgroundColor: '#fff',
                  opacity: fadeAnim,
                }}
              />
            </View>
          ) : (
            <Ionicons
              name={isPlaying ? 'pause' : 'play'}
              size={18}
              color="#fff"
            />
          )}
        </TouchableOpacity>
      ) : (
        <View style={styles.controlButton}>
          {isLoading ? (
            <View style={styles.loadingContainer}>
              <Animated.View
                style={{
                  width: 12,
                  height: 12,
                  borderRadius: 6,
                  backgroundColor: '#fff',
                  opacity: fadeAnim,
                }}
              />
            </View>
          ) : (
            <Ionicons
              name="musical-notes"
              size={18}
              color="#fff"
            />
          )}
        </View>
      )}

      {/* Song Info */}
      <View style={styles.songInfo} pointerEvents="none">
        <Text style={styles.songTitle} numberOfLines={1}>
          {song.title || 'Unknown Song'}
        </Text>
        <Text style={styles.songArtist} numberOfLines={1}>
          {song.artist || 'Unknown Artist'}
        </Text>
      </View>

      {/* Mute/Unmute Button */}
      <TouchableOpacity
        style={styles.controlButton}
        onPress={() => {
          logger.debug('Mute button pressed');
          toggleMute();
        }}
        disabled={!soundRef.current && !isLoading}
        activeOpacity={0.7}
      >
        <Animated.View style={{ opacity: fadeAnim }}>
          <Ionicons
            name={isMuted ? 'volume-mute' : 'volume-high'}
            size={20}
            color="#fff"
          />
        </Animated.View>
      </TouchableOpacity>
    </View>
  );
}

const SongPlayer = React.memo(SongPlayerComponent, (prev, next) => {
  const isIdEqual = prev.post._id === next.post._id;
  const isSongIdEqual = prev.post.song?.songId?._id === next.post.song?.songId?._id;
  const isStartTimeEqual = prev.post.song?.startTime === next.post.song?.startTime;
  const isEndTimeEqual = prev.post.song?.endTime === next.post.song?.endTime;
  const isVisibleEqual = prev.isVisible === next.isVisible;
  const isAutoPlayEqual = prev.autoPlay === next.autoPlay;
  const isMutedEqual = prev.externalMuted === next.externalMuted;

  const shouldMemoize =
    isIdEqual &&
    isSongIdEqual &&
    isStartTimeEqual &&
    isEndTimeEqual &&
    isVisibleEqual &&
    isAutoPlayEqual &&
    isMutedEqual;

  logger.debug('[SONGPLAYER MEMO COMPARATOR]', {
    postId: prev.post._id,
    shouldMemoize,
    isIdEqual,
    isSongIdEqual,
    isStartTimeEqual,
    isEndTimeEqual,
    isVisibleEqual,
    isAutoPlayEqual,
    isMutedEqual,
    prevAutoPlay: prev.autoPlay,
    nextAutoPlay: next.autoPlay,
  });

  return shouldMemoize;
});

export default SongPlayer;

