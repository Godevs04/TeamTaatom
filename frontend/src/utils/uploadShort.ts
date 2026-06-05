import * as FileSystem from 'expo-file-system/legacy';
import { createLogger } from '../../utils/logger';

const logger = createLogger('UploadShort');

/**
 * Get the cache directory path
 */
function getCachePath(): string {
  // Use the legacy cacheDirectory if available, otherwise construct the path
  const FileSystemModule = FileSystem as any;
  if (FileSystemModule.cacheDirectory) {
    return FileSystemModule.cacheDirectory;
  }
  // Fallback for newer versions - construct cache path
  // documentDirectory is available on the module
  const docDir = (FileSystem as any).documentDirectory || '';
  return `${docDir}../Cache/`;
}

/**
 * Lightweight mux — NO re-encoding of video (c:v copy).
 * Audio encoded to AAC. Fast on device.
 * This runs ONCE during upload, never during playback.
 * 
 * @param videoPath - Path to video file
 * @param audioPath - Path to audio file
 * @returns Path to muxed MP4 file
 */
async function muxForUpload(
  videoPath: string,
  audioPath: string
): Promise<string> {
  try {
    // Dynamically import FFmpegKit only when needed
    const { FFmpegKit, ReturnCode } = await import('@wokcito/ffmpeg-kit-react-native');
    
    const outputPath = `${getCachePath()}upload_mux_${Date.now()}.mp4`;

    const command = [
      `-i ${videoPath}`,
      `-i ${audioPath}`,
      `-map 0:v`,
      `-map 1:a`,
      `-shortest`,
      `-c:v copy`,      // no video re-encode — keeps it fast on device
      `-c:a aac`,       // audio to AAC
      `-movflags +faststart`,  // moov atom at front — better streaming
      outputPath
    ].join(' ');

    logger.debug(`[UploadShort] Starting mux: ${command}`);
    const session = await FFmpegKit.execute(command);
    const returnCode = await session.getReturnCode();

    if (!ReturnCode.isSuccess(returnCode)) {
      const logs = await session.getAllLogsAsString();
      logger.error(`[UploadShort] Mux failed:`, logs);
      throw new Error(`Mux failed: ${logs}`);
    }

    logger.debug(`[UploadShort] Mux completed: ${outputPath}`);
    return outputPath;
  } catch (error) {
    logger.error(`[UploadShort] Mux error:`, error);
    throw error;
  }
}

/**
 * Full upload flow:
 * 1. Mux video + audio into single MP4
 * 2. Upload to server
 * 3. Server handles: compress, transcode, thumbnail, normalize
 * 4. Clean up temp mux file
 * 
 * @param videoPath - Path to video file
 * @param audioPath - Path to audio file
 * @param onProgress - Progress callback (0-100)
 * @returns Upload response with shortId, playbackUrl, thumbnailUrl
 */
export async function uploadShort(
  videoPath: string,
  audioPath: string,
  onProgress?: (pct: number) => void
): Promise<{ shortId: string; playbackUrl: string; thumbnailUrl: string; blurHash?: string }> {
  let muxedPath: string | null = null;

  try {
    onProgress?.(0);

    // Step 1: Mux on device (lightweight)
    logger.debug(`[UploadShort] Starting upload: video=${videoPath}, audio=${audioPath}`);
    muxedPath = await muxForUpload(videoPath, audioPath);
    onProgress?.(20);

    // Step 2: Upload muxed file to backend
    logger.debug(`[UploadShort] Uploading muxed file: ${muxedPath}`);
    const formData = new FormData();
    formData.append('video', {
      uri: muxedPath,
      type: 'video/mp4',
      name: 'short.mp4',
    } as any);

    const apiUrl = process.env.EXPO_PUBLIC_API_URL || 'https://api.taatom.com';
    const uploadEndpoint = `${apiUrl}/shorts/upload`;

    const response = await fetch(uploadEndpoint, {
      method: 'POST',
      body: formData,
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });

    onProgress?.(90);

    if (!response.ok) {
      const errorText = await response.text();
      logger.error(`[UploadShort] Upload failed: ${response.status} ${errorText}`);
      throw new Error(`Upload failed: ${response.status}`);
    }

    const result = await response.json();
    logger.debug(`[UploadShort] Upload successful:`, result);

    // Server returns: optimized playback URL + thumbnail URL
    // Server handles: H264, 720x1280, AAC, 30fps normalization
    onProgress?.(100);
    return result;
  } catch (error) {
    logger.error(`[UploadShort] Upload error:`, error);
    throw error;
  } finally {
    // Step 3: Always clean up temp mux file after upload
    if (muxedPath) {
      try {
        const info = await FileSystem.getInfoAsync(muxedPath);
        if (info.exists) {
          await FileSystem.deleteAsync(muxedPath);
          logger.debug(`[UploadShort] Cleaned up temp file: ${muxedPath}`);
        }
      } catch (err) {
        logger.warn(`[UploadShort] Failed to clean up temp file:`, err);
      }
    }
  }
}

/**
 * Validate that video and audio files exist before upload.
 * 
 * @param videoPath - Path to video file
 * @param audioPath - Path to audio file
 * @returns true if both files exist
 */
export async function validateShortFiles(
  videoPath: string,
  audioPath: string
): Promise<boolean> {
  try {
    const videoInfo = await FileSystem.getInfoAsync(videoPath);
    const audioInfo = await FileSystem.getInfoAsync(audioPath);

    if (!videoInfo.exists) {
      logger.error(`[UploadShort] Video file not found: ${videoPath}`);
      return false;
    }

    if (!audioInfo.exists) {
      logger.error(`[UploadShort] Audio file not found: ${audioPath}`);
      return false;
    }

    logger.debug(`[UploadShort] Files validated: video=${videoInfo.size} bytes, audio=${audioInfo.size} bytes`);
    return true;
  } catch (error) {
    logger.error(`[UploadShort] Validation error:`, error);
    return false;
  }
}

/**
 * Get file size in MB.
 * 
 * @param filePath - Path to file
 * @returns File size in MB
 */
export async function getFileSizeMB(filePath: string): Promise<number> {
  try {
    const info = await FileSystem.getInfoAsync(filePath);
    if (!info.exists || !info.size) {
      return 0;
    }
    return info.size / (1024 * 1024);
  } catch (error) {
    logger.error(`[UploadShort] Error getting file size:`, error);
    return 0;
  }
}
