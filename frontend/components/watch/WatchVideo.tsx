import React, { forwardRef, useEffect, useImperativeHandle, useRef } from 'react';
import { StyleSheet } from 'react-native';
import Constants from 'expo-constants';
import { useVideoPlayer, VideoView, type VideoContentFit } from 'expo-video';

/**
 * Expo Go does not ship the react-native-video native view (RCTVideo).
 * Store and dev-client builds do, so those keep the existing player.
 */
const isExpoGo = Constants.appOwnership === 'expo';
const NativeVideo = isExpoGo ? null : require('react-native-video').default;

type VideoSource = { uri?: string; type?: string } | null;

export type WatchVideoProps = {
  source?: VideoSource;
  style?: object;
  resizeMode?: 'contain' | 'cover' | 'stretch';
  paused?: boolean;
  poster?: string;
  controls?: boolean;
  repeat?: boolean;
  playInBackground?: boolean;
  playWhenInactive?: boolean;
  ignoreSilentSwitch?: 'ignore' | 'obey' | 'inherit';
  progressUpdateInterval?: number;
  onLoad?: (meta: { duration?: number }) => void;
  onReadyForDisplay?: () => void;
  onProgress?: (progress: { currentTime: number }) => void;
  onEnd?: () => void;
  onError?: (error: unknown) => void;
};

function isHls(source?: VideoSource): boolean {
  const uri = source?.uri || '';
  return source?.type === 'm3u8' || uri.includes('.m3u8') || uri.includes('hls=');
}

const ExpoWatchVideo = forwardRef<{ seek: (seconds: number) => void }, WatchVideoProps>(
  function ExpoWatchVideo(props, ref) {
    const uri = props.source?.uri || '';
    const callbacks = useRef(props);
    callbacks.current = props;
    const loaded = useRef(false);

    const player = useVideoPlayer(
      uri
        ? { uri, contentType: isHls(props.source) ? ('hls' as const) : ('progressive' as const) }
        : null,
      (created) => {
        created.loop = false;
        created.timeUpdateEventInterval = 0.25;
        created.audioMixingMode = 'doNotMix';
      }
    );

    useImperativeHandle(
      ref,
      () => ({
        seek(seconds: number) {
          player.currentTime = Math.max(0, seconds || 0);
        },
      }),
      [player]
    );

    useEffect(() => {
      loaded.current = false;
    }, [uri]);

    useEffect(() => {
      if (!uri) return;
      if (props.paused) player.pause();
      else player.play();
    }, [player, props.paused, uri]);

    useEffect(() => {
      const subscriptions = [
        player.addListener('statusChange', ({ status, error }) => {
          if (status === 'readyToPlay' && !loaded.current) {
            loaded.current = true;
            callbacks.current.onLoad?.({ duration: player.duration });
            callbacks.current.onReadyForDisplay?.();
          }
          if (status === 'error') callbacks.current.onError?.(error);
        }),
        player.addListener('timeUpdate', ({ currentTime }) => {
          callbacks.current.onProgress?.({ currentTime });
        }),
        player.addListener('playToEnd', () => {
          callbacks.current.onEnd?.();
        }),
      ];
      return () => subscriptions.forEach((subscription) => subscription.remove());
    }, [player]);

    if (!uri) return null;
    const contentFit: VideoContentFit =
      props.resizeMode === 'cover' ? 'cover' : props.resizeMode === 'stretch' ? 'fill' : 'contain';
    return (
      <VideoView
        player={player}
        style={props.style || StyleSheet.absoluteFill}
        contentFit={contentFit}
        nativeControls={false}
      />
    );
  }
);

const WatchVideo = forwardRef<unknown, WatchVideoProps>(function WatchVideo(props, ref) {
  if (!isExpoGo && NativeVideo) {
    return <NativeVideo ref={ref} {...props} />;
  }
  return <ExpoWatchVideo ref={ref as React.Ref<{ seek: (seconds: number) => void }>} {...props} />;
});

export default WatchVideo;
