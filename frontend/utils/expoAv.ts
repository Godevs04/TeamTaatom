import React from "react";
import { View, type ViewProps } from "react-native";

/**
 * Expo Go no longer includes the ExponentAV native module.
 * Load expo-av when it is linked (development builds) and otherwise
 * export stubs so screens can still render.
 */
type ExpoAvModule = typeof import("expo-av");

let expoAv: ExpoAvModule | null = null;
try {
  expoAv = require("expo-av") as ExpoAvModule;
} catch {
  expoAv = null;
}

type PlaybackStatus = {
  isLoaded: boolean;
  isPlaying?: boolean;
  isBuffering?: boolean;
  isMuted?: boolean;
  volume?: number;
  positionMillis?: number;
  durationMillis?: number;
  didJustFinish?: boolean;
};

const unloaded = (): PlaybackStatus => ({ isLoaded: false, isPlaying: false });

/** Loaded-but-idle so callers do not treat a missing native player as a failed load. */
const idleStatus = (): PlaybackStatus => ({
  isLoaded: true,
  isPlaying: false,
  isBuffering: false,
  isMuted: true,
  volume: 0,
  positionMillis: 0,
  durationMillis: 0,
  didJustFinish: false,
});

function createPlayerHandle() {
  return {
    loadAsync: async () => idleStatus(),
    playAsync: async () => idleStatus(),
    pauseAsync: async () => idleStatus(),
    stopAsync: async () => idleStatus(),
    unloadAsync: async () => unloaded(),
    replayAsync: async () => idleStatus(),
    setStatusAsync: async () => idleStatus(),
    setPositionAsync: async () => idleStatus(),
    setVolumeAsync: async () => idleStatus(),
    setIsMutedAsync: async () => idleStatus(),
    setRateAsync: async () => idleStatus(),
    getStatusAsync: async () => idleStatus(),
    presentFullscreenPlayer: async () => {},
    dismissFullscreenPlayer: async () => {},
    setOnPlaybackStatusUpdate() {},
  };
}

class UnavailableSound {
  static async createAsync() {
    return { sound: new UnavailableSound(), status: idleStatus() };
  }
  async loadAsync() {
    return idleStatus();
  }
  async playAsync() {
    return idleStatus();
  }
  async pauseAsync() {
    return idleStatus();
  }
  async stopAsync() {
    return idleStatus();
  }
  async unloadAsync() {
    return unloaded();
  }
  async replayAsync() {
    return idleStatus();
  }
  async setStatusAsync() {
    return idleStatus();
  }
  async setPositionAsync() {
    return idleStatus();
  }
  async setVolumeAsync() {
    return idleStatus();
  }
  async setIsMutedAsync() {
    return idleStatus();
  }
  async setRateAsync() {
    return idleStatus();
  }
  async getStatusAsync() {
    return idleStatus();
  }
  setOnPlaybackStatusUpdate() {}
}

const UnavailableAudio = {
  Sound: UnavailableSound,
  setAudioModeAsync: async () => {},
};

const UnavailableVideo = React.forwardRef(function UnavailableVideo(
  props: ViewProps,
  ref: React.ForwardedRef<unknown>
) {
  const handle = React.useRef(createPlayerHandle());
  React.useImperativeHandle(ref, () => handle.current, []);
  return React.createElement(View, props);
});

export const Audio = expoAv?.Audio ?? (UnavailableAudio as unknown as ExpoAvModule["Audio"]);
export const Video = expoAv?.Video ?? (UnavailableVideo as unknown as ExpoAvModule["Video"]);

type ResizeModeEnum = ExpoAvModule["ResizeMode"];
export const ResizeMode: ResizeModeEnum = expoAv?.ResizeMode ?? ({
  CONTAIN: "contain",
  COVER: "cover",
  STRETCH: "stretch",
} as ResizeModeEnum);

/** Instance types. The runtime exports are values, so refs cannot use them as types. */
export type AvVideo = InstanceType<ExpoAvModule["Video"]>;
export type AvSound = InstanceType<ExpoAvModule["Audio"]["Sound"]>;
export type AvRecording = InstanceType<ExpoAvModule["Audio"]["Recording"]>;
/** Methods shared by expo-av Video and the Shorts expo-video player handle. */
export type AvPlaybackHandle = {
  playAsync: () => Promise<{ isLoaded?: boolean }>;
  pauseAsync: () => Promise<unknown>;
  unloadAsync: () => Promise<unknown>;
  getStatusAsync: () => Promise<{ isLoaded: boolean }>;
  setPositionAsync: (positionMillis: number, tolerances?: unknown) => Promise<unknown>;
  setIsMutedAsync: (muted: boolean) => Promise<unknown>;
  setVolumeAsync: (volume: number, audioPan?: number) => Promise<unknown>;
};
export type AVPlaybackStatus = import("expo-av").AVPlaybackStatus;
