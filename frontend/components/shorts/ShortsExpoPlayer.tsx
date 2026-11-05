import React, { useEffect, useImperativeHandle, useMemo, useRef } from "react";
import { StyleSheet } from "react-native";
import { useVideoPlayer, VideoView, type VideoContentFit } from "expo-video";
import type { AvPlaybackHandle } from "../../utils/expoAv";

type PlaybackStatus = {
  isLoaded: boolean;
  isPlaying: boolean;
  isBuffering: boolean;
  isMuted: boolean;
  volume: number;
  positionMillis: number;
  durationMillis: number;
  didJustFinish: boolean;
};

type Props = {
  source?: { uri?: string } | string | null;
  style?: any;
  resizeMode?: string;
  shouldPlay?: boolean;
  isLooping?: boolean;
  isMuted?: boolean;
  volume?: number;
  onLoadStart?: () => void;
  onLoad?: (status: PlaybackStatus) => void;
  onReadyForDisplay?: () => void;
  onError?: (error: unknown) => void;
  // Callers still type this with expo-av's AVPlaybackStatus; the emitted shape is the loaded-status subset.
  onPlaybackStatusUpdate?: (status: any) => void;
};

function sourceUri(source: Props["source"]): string {
  if (!source) return "";
  if (typeof source === "string") return source;
  return source.uri || "";
}

function isHls(uri: string): boolean {
  const value = uri.toLowerCase();
  return value.includes(".m3u8") || value.includes("hls=") || value.includes("hls%3d");
}

function statusOf(player: {
  status: string;
  playing: boolean;
  muted: boolean;
  volume: number;
  currentTime: number;
  duration: number;
}, isPlaying = player.playing): PlaybackStatus {
  return {
    isLoaded: player.status !== "error",
    isPlaying,
    isBuffering: player.status === "loading",
    isMuted: player.muted,
    volume: player.volume,
    positionMillis: (player.currentTime || 0) * 1000,
    durationMillis: (player.duration || 0) * 1000,
    didJustFinish: false,
  };
}

const ShortsExpoPlayer = React.forwardRef<AvPlaybackHandle, Props>(function ShortsExpoPlayer(props, ref) {
  const uri = sourceUri(props.source);
  const callbacks = useRef(props);
  callbacks.current = props;
  const announced = useRef(false);
  const loadAnnounced = useRef(false);
  // What the parent wants right now. Read by the stall-recovery listeners below.
  const wantsPlayRef = useRef(!!props.shouldPlay && !!uri);
  wantsPlayRef.current = !!props.shouldPlay && !!uri;
  // Set by an imperative pause (blur, back, app background) so recovery never fights it.
  const manualPauseRef = useRef(false);
  const lastResumeAtRef = useRef(0);

  // Stable object identity so re-renders never hand useVideoPlayer a "new" source.
  const videoSource = useMemo(
    () => (uri ? { uri, contentType: isHls(uri) ? ("hls" as const) : ("progressive" as const) } : null),
    [uri]
  );

  const player = useVideoPlayer(
    videoSource,
    (created) => {
      created.loop = props.isLooping !== false;
      created.muted = !!props.isMuted;
      created.volume = typeof props.volume === "number" ? props.volume : 1;
      created.timeUpdateEventInterval = 0.25;
      created.audioMixingMode = "doNotMix";
      try {
        // waitsToMinimizeStalling must stay true on iOS: with false, AVPlayer drops its rate to 0
        // when the buffer runs dry and never resumes — the "short pauses by itself" bug.
        created.bufferOptions = {
          preferredForwardBufferDuration: 10,
          waitsToMinimizeStalling: true,
          minBufferForPlayback: 0.5,
        };
      } catch {
        // Web playback has no native buffer control.
      }
      if (props.shouldPlay && uri) created.play();
    }
  );

  const announceFirstFrame = () => {
    if (announced.current) return;
    announced.current = true;
    callbacks.current.onReadyForDisplay?.();
  };

  useEffect(() => {
    announced.current = false;
    loadAnnounced.current = false;
  }, [uri]);

  useEffect(() => {
    player.loop = props.isLooping !== false;
    player.muted = !!props.isMuted;
    if (typeof props.volume === "number") player.volume = props.volume;
  }, [player, props.isLooping, props.isMuted, props.volume]);

  useEffect(() => {
    if (!uri) return;
    if (props.shouldPlay) {
      manualPauseRef.current = false;
      player.play();
    } else {
      player.pause();
    }
  }, [player, props.shouldPlay, uri]);

  useEffect(() => {
    const emit = (isPlaying = player.playing) => {
      callbacks.current.onPlaybackStatusUpdate?.(statusOf(player, isPlaying));
    };
    // Playback stopped although the parent still wants it (buffer underrun, audio-session
    // hiccup, item became ready after a stall): start it again, at most once a second.
    let resumeTimer: ReturnType<typeof setTimeout> | null = null;
    const resumeIfWanted = (delayMs: number) => {
      if (resumeTimer) clearTimeout(resumeTimer);
      resumeTimer = setTimeout(() => {
        resumeTimer = null;
        if (!wantsPlayRef.current || manualPauseRef.current || player.playing) return;
        if (player.status === "error") return;
        const now = Date.now();
        if (now - lastResumeAtRef.current < 1000) return;
        lastResumeAtRef.current = now;
        try {
          player.play();
        } catch {
          // Player was released between the check and the call.
        }
      }, delayMs);
    };
    const subscriptions = [
      player.addListener("statusChange", ({ status, error }) => {
        if (status === "loading") callbacks.current.onLoadStart?.();
        if (status === "error") {
          console.warn("[Shorts] playback failed", error?.message || "unknown error");
          callbacks.current.onError?.(error);
        }
        if (status === "readyToPlay" && !loadAnnounced.current) {
          loadAnnounced.current = true;
          callbacks.current.onLoad?.(statusOf(player, player.playing));
        }
        if (status === "readyToPlay") resumeIfWanted(100);
        emit();
      }),
      player.addListener("playingChange", ({ isPlaying }) => {
        if (!isPlaying) resumeIfWanted(400);
        emit(isPlaying);
      }),
      player.addListener("timeUpdate", ({ currentTime }) => {
        // Fallback for platforms where onFirstFrameRender is not delivered: playback has advanced, so a frame is on screen.
        if (currentTime > 0 && !announced.current) announceFirstFrame();
        emit();
      }),
    ];
    return () => {
      if (resumeTimer) clearTimeout(resumeTimer);
      subscriptions.forEach((subscription) => subscription.remove());
    };
  }, [player]);

  useImperativeHandle(ref, () => ({
    playAsync: async () => {
      manualPauseRef.current = false;
      player.play();
      return statusOf(player, true);
    },
    pauseAsync: async () => {
      manualPauseRef.current = true;
      player.pause();
      return statusOf(player, false);
    },
    stopAsync: async () => {
      manualPauseRef.current = true;
      player.pause();
      return statusOf(player, false);
    },
    unloadAsync: async () => {
      manualPauseRef.current = true;
      player.pause();
      return statusOf(player, false);
    },
    replayAsync: async () => {
      manualPauseRef.current = false;
      player.replay();
      return statusOf(player, true);
    },
    getStatusAsync: async () => statusOf(player),
    setPositionAsync: async (positionMillis: number) => {
      player.currentTime = (positionMillis || 0) / 1000;
      return statusOf(player);
    },
    setVolumeAsync: async (volume: number) => {
      player.volume = volume;
      return statusOf(player);
    },
    setIsMutedAsync: async (muted: boolean) => {
      player.muted = muted;
      return statusOf(player);
    },
    setOnPlaybackStatusUpdate(callback: (status: PlaybackStatus) => void) {
      callbacks.current.onPlaybackStatusUpdate = callback;
    },
  }), [player]);

  const contentFit: VideoContentFit =
    props.resizeMode === "cover" ? "cover" : props.resizeMode === "stretch" ? "fill" : "contain";

  if (!uri) return null;

  // Sized entirely by the parent frame; the parent only mounts this once that frame has a real layout.
  return (
    <VideoView
      player={player}
      style={StyleSheet.absoluteFill}
      contentFit={contentFit}
          nativeControls={false}
          onFirstFrameRender={() => {
            announceFirstFrame();
          }}
    />
  );
});

export default ShortsExpoPlayer;
