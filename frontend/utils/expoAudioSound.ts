import { createAudioPlayer, setAudioModeAsync, type AudioPlayer, type AudioStatus } from "expo-audio";

/**
 * The subset of expo-av's Sound methods that SongPlayer and audioManager already call.
 * Backed by expo-audio, which Expo Go includes on SDK 57.
 */
export type SongSound = {
  playAsync: () => Promise<SongStatus>;
  pauseAsync: () => Promise<SongStatus>;
  stopAsync: () => Promise<SongStatus>;
  unloadAsync: () => Promise<SongStatus>;
  getStatusAsync: () => Promise<SongStatus>;
  setPositionAsync: (positionMillis: number) => Promise<SongStatus>;
  setIsMutedAsync: (muted: boolean) => Promise<SongStatus>;
  setVolumeAsync: (volume: number) => Promise<SongStatus>;
  setOnPlaybackStatusUpdate: (callback: ((status: SongStatus) => void) | null) => void;
};

export type SongStatus = {
  isLoaded: boolean;
  isPlaying: boolean;
  isMuted: boolean;
  positionMillis: number;
  durationMillis: number;
  didJustFinish: boolean;
  error?: unknown;
};

let audioModeReady: Promise<void> | null = null;

function ensurePlaybackMode(): Promise<void> {
  if (!audioModeReady) {
    audioModeReady = setAudioModeAsync({
      playsInSilentMode: true,
      interruptionMode: "mixWithOthers",
      shouldPlayInBackground: false,
    }).catch((error) => {
      audioModeReady = null;
      throw error;
    });
  }
  return audioModeReady;
}

function statusOf(player: AudioPlayer, overrides: Partial<SongStatus> = {}): SongStatus {
  return {
    isLoaded: player.isLoaded,
    isPlaying: player.playing,
    isMuted: player.muted,
    positionMillis: (player.currentTime || 0) * 1000,
    durationMillis: (player.duration || 0) * 1000,
    didJustFinish: false,
    ...overrides,
  };
}

function waitUntilLoaded(player: AudioPlayer): Promise<void> {
  if (player.isLoaded) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      subscription.remove();
      reject(new Error("Audio load timed out"));
    }, 8000);
    const subscription = player.addListener("playbackStatusUpdate", (status: AudioStatus) => {
      if (status.isLoaded) {
        clearTimeout(timeout);
        subscription.remove();
        resolve();
      }
    });
  });
}

export async function createSongSound(
  uri: string,
  options: {
    shouldPlay: boolean;
    isLooping: boolean;
    isMuted: boolean;
    volume: number;
    positionMillis: number;
  }
): Promise<SongSound> {
  await ensurePlaybackMode();
  const player = createAudioPlayer({ uri }, { updateInterval: 150 });
  let released = false;
  let statusCallback: ((status: SongStatus) => void) | null = null;

  const release = () => {
    if (released) return;
    released = true;
    statusListener.remove();
    try {
      player.remove();
    } catch {
      // Already released.
    }
  };

  const statusListener = player.addListener("playbackStatusUpdate", (status: AudioStatus) => {
    statusCallback?.(statusOf(player, {
      isPlaying: status.playing,
      didJustFinish: status.didJustFinish,
      isLoaded: status.isLoaded,
    }));
  });

  try {
    await waitUntilLoaded(player);
    player.loop = options.isLooping;
    player.muted = options.isMuted;
    player.volume = options.isMuted ? 0 : options.volume;
    if (options.positionMillis > 0) {
      await player.seekTo(options.positionMillis / 1000);
    }
    if (options.shouldPlay) {
      player.play();
    }
  } catch (error) {
    release();
    throw error;
  }

  const handle: SongSound = {
    async playAsync() {
      player.play();
      return statusOf(player, { isPlaying: true });
    },
    async pauseAsync() {
      player.pause();
      return statusOf(player, { isPlaying: false });
    },
    async stopAsync() {
      player.pause();
      return statusOf(player, { isPlaying: false });
    },
    async unloadAsync() {
      release();
      return { isLoaded: false, isPlaying: false, isMuted: true, positionMillis: 0, durationMillis: 0, didJustFinish: false };
    },
    async getStatusAsync() {
      if (released) {
        return { isLoaded: false, isPlaying: false, isMuted: true, positionMillis: 0, durationMillis: 0, didJustFinish: false };
      }
      return statusOf(player);
    },
    async setPositionAsync(positionMillis: number) {
      await player.seekTo((positionMillis || 0) / 1000);
      return statusOf(player);
    },
    async setIsMutedAsync(muted: boolean) {
      player.muted = muted;
      if (muted) player.volume = 0;
      return statusOf(player, { isMuted: muted });
    },
    async setVolumeAsync(volume: number) {
      player.volume = volume;
      return statusOf(player);
    },
    setOnPlaybackStatusUpdate(callback) {
      statusCallback = callback;
    },
  };

  return handle;
}
