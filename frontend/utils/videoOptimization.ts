import * as FileSystem from 'expo-file-system/legacy';
import logger from './logger';

/**
 * Get the cache directory path
 */
function getCachePath(): string {
  const FileSystemModule = FileSystem as any;
  if (FileSystemModule.cacheDirectory) {
    return FileSystemModule.cacheDirectory;
  }
  const docDir = (FileSystem as any).documentDirectory || '';
  return `${docDir}../Cache/`;
}

/**
 * Check if the video needs compression.
 * We only compress videos that are larger than 8MB.
 * If size is unknown or retrieval fails, we assume it does not need compression to fail safe.
 */
export const shouldCompressVideo = async (videoUri: string): Promise<boolean> => {
  try {
    const info = await FileSystem.getInfoAsync(videoUri);
    if (!info.exists) {
      return false;
    }
    
    // File size in MB
    const sizeMB = (info.size || 0) / (1024 * 1024);
    logger.debug(`[VideoOptimization] File size check for ${videoUri}: ${sizeMB.toFixed(2)} MB`);
    
    // Compress if video is larger than 8MB
    return sizeMB > 8;
  } catch (error) {
    logger.warn('[VideoOptimization] Failed to retrieve video file size, skipping compression:', error);
    return false;
  }
};

/**
 * Compress video using FFmpeg.
 * Targets H.264 video codec, AAC audio codec, max 720p resolution, CRF 28, and ultrafast preset.
 * 
 * @param videoUri - Path to the original video file
 * @param progressCallback - Callback receiving progress percentage (0 to 100)
 */
export const compressVideo = async (
  videoUri: string,
  progressCallback?: (progress: number) => void
): Promise<string> => {
  try {
    // Dynamically import FFmpegKit to prevent build/init issues on unsupported environments
    const { FFmpegKit, ReturnCode, FFmpegKitConfig } = await import('@wokcito/ffmpeg-kit-react-native');
    
    const outputPath = `${getCachePath()}optimized_video_${Date.now()}.mp4`;
    
    // Prepare the command.
    // -y overrides output files without asking.
    // scale='min(720,iw)':-2 ensures we scale width to max 720 (if larger than 720),
    // and let height auto-scale divisible by 2 to prevent H.264 encoding errors.
    const command = [
      '-y',
      `-i "${videoUri}"`,
      '-c:v libx264',
      '-preset ultrafast',
      '-crf 28',
      '-c:a aac',
      '-b:a 128k',
      `-vf "scale='min(720,iw)':-2"`,
      '-movflags +faststart',
      `"${outputPath}"`
    ].join(' ');

    logger.info(`[VideoOptimization] Starting video compression: ${command}`);
    
    // Get total duration of the video to calculate progress percentage
    let totalDurationMs = 0;
    try {
      const { sound } = await require('expo-av').Audio.Sound.createAsync(
        { uri: videoUri },
        { shouldPlay: false }
      );
      const status = await sound.getStatusAsync();
      if (status.isLoaded && status.durationMillis) {
        totalDurationMs = status.durationMillis;
      }
      await sound.unloadAsync().catch(() => {});
    } catch (durationErr) {
      logger.warn('[VideoOptimization] Could not determine video duration for progress tracking:', durationErr);
    }

    // Set up statistics callback to calculate progress
    if (progressCallback && totalDurationMs > 0) {
      FFmpegKitConfig.enableStatisticsCallback((statistics) => {
        const timeInMilliseconds = statistics.getTime();
        if (timeInMilliseconds > 0) {
          const progress = Math.min(
            Math.round((timeInMilliseconds / totalDurationMs) * 100),
            99
          );
          progressCallback(progress);
        }
      });
    }

    const session = await FFmpegKit.execute(command);
    
    // Disable statistics callback after execution
    FFmpegKitConfig.enableStatisticsCallback(undefined);
    
    const returnCode = await session.getReturnCode();

    if (!ReturnCode.isSuccess(returnCode)) {
      const logs = await session.getAllLogsAsString();
      logger.error('[VideoOptimization] FFmpeg compression failed:', logs);
      throw new Error(`FFmpeg compression failed: ${logs}`);
    }

    // Double check that output file exists and is valid
    const outputInfo = await FileSystem.getInfoAsync(outputPath);
    if (!outputInfo.exists || !outputInfo.size || outputInfo.size === 0) {
      throw new Error('Compressed output file is empty or missing');
    }

    const originalInfo = await FileSystem.getInfoAsync(videoUri);
    const sizeBefore = originalInfo.exists ? (originalInfo.size || 0) / (1024 * 1024) : 0;
    const sizeAfter = outputInfo.size / (1024 * 1024);
    
    logger.info(`[VideoOptimization] Compression completed successfully:`, {
      originalSize: `${sizeBefore.toFixed(2)} MB`,
      compressedSize: `${sizeAfter.toFixed(2)} MB`,
      reduction: `${((1 - sizeAfter / Math.max(1, sizeBefore)) * 100).toFixed(1)}%`
    });

    if (progressCallback) {
      progressCallback(100);
    }

    return outputPath;
  } catch (error) {
    logger.error('[VideoOptimization] Error during video compression, falling back to raw:', error);
    throw error; // Let caller fallback to original video
  }
};

/**
 * Cancel any running FFmpeg compression sessions.
 */
export const cancelCompression = async (): Promise<void> => {
  try {
    const { FFmpegKit } = await import('@wokcito/ffmpeg-kit-react-native');
    await FFmpegKit.cancel();
    logger.info('[VideoOptimization] Cancelled all FFmpeg sessions');
  } catch (error) {
    logger.error('[VideoOptimization] Error cancelling FFmpeg sessions:', error);
  }
};
