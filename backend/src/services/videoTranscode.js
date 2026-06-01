/**
 * Video transcoding service.
 *
 * Re-encodes incoming short videos to H.264 (Baseline/Main profile) + AAC at
 * 720p so the resulting file is universally decodable on every Android and
 * iOS device, including the lower-end Android phones whose hardware decoders
 * crash on HEVC and high-bitrate inputs.
 *
 * This is the permanent server-side fix for the "shorts crash on play /
 * Android heap OOM (240 bytes failed)" class of bugs. iPhones default to
 * recording HEVC (since iOS 11); HEVC decoders allocate 3-4× more heap than
 * H.264 and are not present on every device. Normalizing at upload time
 * eliminates the device-dependent decoder failures.
 *
 * Behavior:
 *  - If the buffer is already H.264 + AAC, it is returned unchanged
 *    (cheap probe via ffprobe — no transcode work).
 *  - Otherwise the buffer is re-encoded to H.264 baseline / AAC, max 720p,
 *    ~2.5Mbps, and the new buffer is returned.
 *  - On ANY failure (ffmpeg missing on host, transcoding error, probe error)
 *    the original buffer is returned unchanged with a logged warning. This
 *    is intentional: we never want a transcoding hiccup to block uploads.
 *
 * Dependencies (must be added to backend/package.json):
 *   "fluent-ffmpeg": "^2.1.3",
 *   "@ffmpeg-installer/ffmpeg": "^1.1.0",
 *   "@ffprobe-installer/ffprobe": "^2.1.2"
 *
 * The two installer packages bundle static binaries so transcoding works on
 * any host without needing apt-get/brew install ffmpeg first.
 */

const fs = require('fs');
const os = require('os');
const path = require('path');
const crypto = require('crypto');
const logger = require('../utils/logger');

// Lazy-load ffmpeg so the rest of the app keeps working if these optional
// deps are missing (e.g. immediately after pulling this change before
// `npm install` runs on the deploy host).
let ffmpeg = null;
let ffmpegLoaded = false;
function tryLoadFfmpeg() {
  if (ffmpegLoaded) return ffmpeg;
  ffmpegLoaded = true;
  try {
    ffmpeg = require('fluent-ffmpeg');
    try {
      const ffmpegInstaller = require('@ffmpeg-installer/ffmpeg');
      ffmpeg.setFfmpegPath(ffmpegInstaller.path);
    } catch (e) {
      logger.warn('[videoTranscode] @ffmpeg-installer/ffmpeg not installed — relying on system ffmpeg');
    }
    try {
      const ffprobeInstaller = require('@ffprobe-installer/ffprobe');
      ffmpeg.setFfprobePath(ffprobeInstaller.path);
    } catch (e) {
      logger.warn('[videoTranscode] @ffprobe-installer/ffprobe not installed — relying on system ffprobe');
    }
  } catch (e) {
    logger.warn('[videoTranscode] fluent-ffmpeg not installed — passthrough mode (uploads will not be transcoded)');
    ffmpeg = null;
  }
  return ffmpeg;
}

function tmpFile(ext) {
  const id = crypto.randomBytes(8).toString('hex');
  return path.join(os.tmpdir(), `taatom-short-${id}.${ext}`);
}

function probe(inputPath) {
  return new Promise((resolve, reject) => {
    const ff = tryLoadFfmpeg();
    if (!ff) return reject(new Error('ffmpeg not available'));
    ff.ffprobe(inputPath, (err, metadata) => {
      if (err) return reject(err);
      resolve(metadata);
    });
  });
}

/**
 * Transcode if needed. Always returns { buffer, mimetype } — either the
 * original or a re-encoded H.264/AAC mp4. Never throws on transcode failure.
 *
 * @param {Buffer} inputBuffer
 * @param {string} inputMimetype
 * @returns {Promise<{ buffer: Buffer, mimetype: string, transcoded: boolean }>}
 */
async function transcodeIfNeeded(inputBuffer, inputMimetype) {
  const ff = tryLoadFfmpeg();
  if (!ff) {
    return { buffer: inputBuffer, mimetype: inputMimetype, transcoded: false };
  }

  const inputPath = tmpFile('in.mp4');
  const outputPath = tmpFile('out.mp4');
  let inputWritten = false;
  let outputWritten = false;

  try {
    fs.writeFileSync(inputPath, inputBuffer);
    inputWritten = true;

    // Probe to decide whether re-encoding is needed.
    let needsTranscode = true;
    try {
      const meta = await probe(inputPath);
      const videoStream = (meta.streams || []).find((s) => s.codec_type === 'video');
      const audioStream = (meta.streams || []).find((s) => s.codec_type === 'audio');
      const videoOk = videoStream && (videoStream.codec_name === 'h264' || videoStream.codec_name === 'avc1');
      const audioOk = !audioStream || audioStream.codec_name === 'aac';
      const heightOk = !videoStream || !videoStream.height || videoStream.height <= 1080;
      
      // Calculate input frame rate
      let fps = 30;
      if (videoStream && videoStream.r_frame_rate) {
        const parts = videoStream.r_frame_rate.split('/');
        if (parts.length === 2 && parseFloat(parts[1]) > 0) {
          fps = parseFloat(parts[0]) / parseFloat(parts[1]);
        } else if (!isNaN(parseFloat(videoStream.r_frame_rate))) {
          fps = parseFloat(videoStream.r_frame_rate);
        }
      }
      
      // Calculate input bitrate
      const bitrate = videoStream && videoStream.bit_rate ? parseInt(videoStream.bit_rate) : 0;
      const fpsOk = Math.abs(fps - 30) < 0.1;
      const bitrateOk = bitrate > 0 && bitrate <= 5000000; // Capped at 5Mbps

      if (videoOk && audioOk && heightOk && fpsOk && bitrateOk) {
        needsTranscode = false;
        logger.info('[videoTranscode] Input is already H.264/AAC ≤1080p, 30fps, ≤5Mbps — passthrough', {
          videoCodec: videoStream && videoStream.codec_name,
          audioCodec: audioStream && audioStream.codec_name,
          height: videoStream && videoStream.height,
          fps: fps.toFixed(2),
          bitrate: (bitrate / 1000000).toFixed(2) + ' Mbps',
        });
      } else {
        logger.info('[videoTranscode] Input needs transcoding', {
          videoCodec: videoStream && videoStream.codec_name,
          audioCodec: audioStream && audioStream.codec_name,
          height: videoStream && videoStream.height,
          fps: fps.toFixed(2),
          bitrate: bitrate ? (bitrate / 1000000).toFixed(2) + ' Mbps' : 'unknown',
          reason: !videoOk ? 'video codec' : !audioOk ? 'audio codec' : !heightOk ? 'resolution' : !fpsOk ? 'framerate' : 'bitrate',
        });
      }
    } catch (probeErr) {
      logger.warn('[videoTranscode] Probe failed — proceeding with transcode anyway:', probeErr && probeErr.message);
    }

    if (!needsTranscode) {
      return { buffer: inputBuffer, mimetype: inputMimetype, transcoded: false };
    }

    // Transcode: H.264 Main profile, 720p max height (preserves portrait
    // aspect via -2 width), CRF 23, constant 30fps, 5Mbps bitrate cap, AAC 128k.
    // The +faststart movflag puts the moov atom up front so the file is
    // streamable from byte 0 — important for our R2-hosted playback.
    const transcodeStart = Date.now();
    await new Promise((resolve, reject) => {
      ff(inputPath)
        .videoCodec('libx264')
        .audioCodec('aac')
        .outputOptions([
          '-preset veryfast',
          '-profile:v main',
          '-level 4.0',
          '-pix_fmt yuv420p',
          '-crf 23',
          '-b:v 5M',
          '-maxrate 5M',
          '-bufsize 10M',
          '-vf scale=-2:min(1080\\,ih)',
          '-r 30',
          '-b:a 128k',
          '-movflags +faststart',
        ])
        .format('mp4')
        .on('end', resolve)
        .on('error', reject)
        .save(outputPath);
    });
    outputWritten = true;
    const transcodeMs = Date.now() - transcodeStart;

    const outputBuffer = fs.readFileSync(outputPath);
    logger.info('[videoTranscode] Transcoded successfully', {
      inputBytes: inputBuffer.length,
      outputBytes: outputBuffer.length,
      durationMs: transcodeMs,
      ratio: (outputBuffer.length / inputBuffer.length).toFixed(2),
    });

    return { buffer: outputBuffer, mimetype: 'video/mp4', transcoded: true };
  } catch (err) {
    // FAIL-OPEN: never block an upload due to a transcode error. Log loudly
    // and return the original buffer; client-side codec preset (the
    // VideoExportPreset.MediumQuality fix) plus mounted-Video reduction is
    // the second line of defense.
    logger.error('[videoTranscode] Transcode failed — falling back to passthrough', {
      error: err && err.message,
      stack: err && err.stack,
    });
    return { buffer: inputBuffer, mimetype: inputMimetype, transcoded: false };
  } finally {
    if (inputWritten) {
      try { fs.unlinkSync(inputPath); } catch (_) { /* tempfile may already be gone */ }
    }
    if (outputWritten) {
      try { fs.unlinkSync(outputPath); } catch (_) { /* tempfile may already be gone */ }
    }
  }
}

function transcodeToHLS(inputPath, outputDir) {
  return new Promise((resolve, reject) => {
    const ff = tryLoadFfmpeg();
    if (!ff) return reject(new Error('ffmpeg not available'));

    ff(inputPath)
      .videoCodec('libx264')
      .audioCodec('aac')
      .outputOptions([
        '-preset veryfast',
        '-profile:v main',
        '-level 4.0',
        '-pix_fmt yuv420p',
        '-crf 23',
        '-b:v 5M',
        '-maxrate 5M',
        '-bufsize 10M',
        '-vf scale=-2:min(1080\\,ih)',
        '-r 30',
        '-b:a 128k',
        '-hls_time 2',
        '-hls_playlist_type vod',
        `-hls_segment_filename ${path.join(outputDir, 'segment_%03d.ts')}`
      ])
      .format('hls')
      .on('end', resolve)
      .on('error', reject)
      .save(path.join(outputDir, 'index.m3u8'));
  });
}

function extractThumbnail(inputPath, outputPath) {
  return new Promise((resolve, reject) => {
    const ff = tryLoadFfmpeg();
    if (!ff) return reject(new Error('ffmpeg not available'));

    ff(inputPath)
      .screenshots({
        timestamps: [1.0],
        filename: path.basename(outputPath),
        folder: path.dirname(outputPath),
        size: '1080x?'
      })
      .on('end', resolve)
      .on('error', reject);
  });
}

async function processJob(job, Post) {
  const { GetObjectCommand } = require('@aws-sdk/client-s3');
  const { s3Client, BUCKET_NAME, uploadObject, deleteObject } = require('./storage');

  const rawKey = job.rawStorageKey;
  const postId = job.post.toString();

  logger.debug(`[transcodeWorker] Downloading raw video: ${rawKey}`);
  const s3Response = await s3Client.send(new GetObjectCommand({
    Bucket: BUCKET_NAME,
    Key: rawKey
  }));

  const tempInPath = tmpFile('raw.mp4');
  const tempOutDir = path.join(os.tmpdir(), `hls-${postId}`);

  await new Promise((resolve, reject) => {
    const writer = fs.createWriteStream(tempInPath);
    s3Response.Body.pipe(writer);
    writer.on('finish', resolve);
    writer.on('error', reject);
  });

  try {
    const postDoc = await Post.findById(postId);
    if (!postDoc) {
      throw new Error(`Post document for ${postId} not found`);
    }

    // Preserve custom thumbnail if one exists in the postDoc's storageKeys
    const customThumbnailKey = postDoc.storageKeys.find(
      (k) => k !== rawKey && (k.endsWith('.jpg') || k.endsWith('.png') || k.endsWith('.jpeg'))
    );

    // Probe downloaded raw video to check compliance
    let needsHLSTranscode = true;
    try {
      const meta = await probe(tempInPath);
      const videoStream = (meta.streams || []).find((s) => s.codec_type === 'video');
      const audioStream = (meta.streams || []).find((s) => s.codec_type === 'audio');
      
      const videoOk = videoStream && (videoStream.codec_name === 'h264' || videoStream.codec_name === 'avc1');
      const audioOk = !audioStream || audioStream.codec_name === 'aac';
      
      const height = videoStream && videoStream.height ? videoStream.height : 0;
      const width = videoStream && videoStream.width ? videoStream.width : 0;
      const resolutionOk = (height <= 1080 && width <= 1920) || (width <= 1080 && height <= 1920);

      // Calculate input frame rate
      let fps = 30;
      if (videoStream && videoStream.r_frame_rate) {
        const parts = videoStream.r_frame_rate.split('/');
        if (parts.length === 2 && parseFloat(parts[1]) > 0) {
          fps = parseFloat(parts[0]) / parseFloat(parts[1]);
        } else if (!isNaN(parseFloat(videoStream.r_frame_rate))) {
          fps = parseFloat(videoStream.r_frame_rate);
        }
      }
      const fpsOk = fps <= 30.5;

      // Calculate input bitrate
      const bitrate = videoStream && videoStream.bit_rate ? parseInt(videoStream.bit_rate) : 0;
      const bitrateOk = bitrate > 0 && bitrate <= 5000000; // Capped at 5Mbps

      if (videoOk && audioOk && resolutionOk && fpsOk && bitrateOk) {
        needsHLSTranscode = false;
        logger.info('[transcodeWorker] Video is compliant (H.264/AAC, ≤1080p, ≤30fps, ≤5Mbps). Bypassing HLS transcoding.', {
          postId,
          videoCodec: videoStream.codec_name,
          audioCodec: audioStream ? audioStream.codec_name : 'none',
          resolution: `${width}x${height}`,
          fps: fps.toFixed(2),
          bitrate: (bitrate / 1000000).toFixed(2) + ' Mbps'
        });
      } else {
        logger.info('[transcodeWorker] Video needs HLS transcoding.', {
          postId,
          videoCodec: videoStream ? videoStream.codec_name : 'none',
          audioCodec: audioStream ? audioStream.codec_name : 'none',
          resolution: videoStream ? `${width}x${height}` : 'unknown',
          fps: fps.toFixed(2),
          bitrate: bitrate ? (bitrate / 1000000).toFixed(2) + ' Mbps' : 'unknown',
          reason: !videoOk ? 'video codec' : !audioOk ? 'audio codec' : !resolutionOk ? 'resolution' : !fpsOk ? 'framerate' : 'bitrate',
        });
      }
    } catch (probeErr) {
      logger.warn('[transcodeWorker] Probe failed. Defaulting to HLS transcode to be safe.', probeErr && probeErr.message);
    }

    if (needsHLSTranscode) {
      if (!fs.existsSync(tempOutDir)) {
        fs.mkdirSync(tempOutDir, { recursive: true });
      }

      logger.debug(`[transcodeWorker] Transcoding raw video to HLS at ${tempOutDir}`);
      await transcodeToHLS(tempInPath, tempOutDir);

      const files = fs.readdirSync(tempOutDir);
      const uploadedKeys = [];
      let masterPlaylistUrl = '';

      for (const file of files) {
        const filePath = path.join(tempOutDir, file);
        const fileBuffer = fs.readFileSync(filePath);
        const fileExt = file.split('.').pop() || '';

        let contentType = 'application/x-mpegURL';
        if (fileExt === 'ts') {
          contentType = 'video/MP2T';
        }

        const s3Key = `shorts/hls/${postId}/${file}`;
        logger.debug(`[transcodeWorker] Uploading HLS file: ${s3Key}`);
        const uploadResult = await uploadObject(fileBuffer, s3Key, contentType);

        uploadedKeys.push(s3Key);
        if (file === 'index.m3u8') {
          masterPlaylistUrl = uploadResult.url;
        }
      }

      if (!masterPlaylistUrl) {
        throw new Error('index.m3u8 not generated or uploaded');
      }

      let finalImageUrl = postDoc.imageUrl || '';
      if (customThumbnailKey) {
        uploadedKeys.push(customThumbnailKey);
        logger.debug(`[transcodeWorker] Preserved custom thumbnail: ${customThumbnailKey}`);
      } else {
        // Auto-extract thumbnail
        const tempThumbPath = tmpFile('thumb.jpg');
        try {
          logger.debug(`[transcodeWorker] Extracting thumbnail from video: ${tempInPath}`);
          await extractThumbnail(tempInPath, tempThumbPath);

          const thumbBuffer = fs.readFileSync(tempThumbPath);
          const thumbS3Key = `shorts/hls/${postId}/thumbnail.jpg`;
          logger.debug(`[transcodeWorker] Uploading auto-generated thumbnail to S3: ${thumbS3Key}`);
          const uploadResult = await uploadObject(thumbBuffer, thumbS3Key, 'image/jpeg');
          uploadedKeys.push(thumbS3Key);
          finalImageUrl = uploadResult.url || '';
        } catch (thumbErr) {
          logger.error('[transcodeWorker] Failed to extract/upload thumbnail:', thumbErr);
        } finally {
          try { fs.unlinkSync(tempThumbPath); } catch (_) {}
        }
      }

      await Post.findByIdAndUpdate(postId, {
        status: 'active',
        videoUrl: masterPlaylistUrl,
        imageUrl: finalImageUrl,
        thumbnailUrl: finalImageUrl,
        storageKey: `shorts/hls/${postId}/index.m3u8`,
        storageKeys: uploadedKeys
      });

      logger.debug(`[transcodeWorker] Deleting S3 raw file: ${rawKey}`);
      await deleteObject(rawKey);
    } else {
      // Passthrough branch: skip HLS transcoding
      let finalImageUrl = postDoc.imageUrl || '';
      const uploadedKeys = [rawKey];

      if (customThumbnailKey) {
        uploadedKeys.push(customThumbnailKey);
        logger.debug(`[transcodeWorker] Preserved custom thumbnail: ${customThumbnailKey}`);
      } else {
        // Auto-extract thumbnail
        const tempThumbPath = tmpFile('thumb.jpg');
        try {
          logger.debug(`[transcodeWorker] Extracting thumbnail from compliant video: ${tempInPath}`);
          await extractThumbnail(tempInPath, tempThumbPath);

          const thumbBuffer = fs.readFileSync(tempThumbPath);
          const thumbS3Key = `shorts/raw/${postId}/thumbnail.jpg`;
          logger.debug(`[transcodeWorker] Uploading auto-generated thumbnail to S3: ${thumbS3Key}`);
          const uploadResult = await uploadObject(thumbBuffer, thumbS3Key, 'image/jpeg');
          uploadedKeys.push(thumbS3Key);
          finalImageUrl = uploadResult.url || '';
        } catch (thumbErr) {
          logger.error('[transcodeWorker] Failed to extract/upload thumbnail:', thumbErr);
        } finally {
          try { fs.unlinkSync(tempThumbPath); } catch (_) {}
        }
      }

      // Update Post to keep rawKey as storageKey
      await Post.findByIdAndUpdate(postId, {
        status: 'active',
        imageUrl: finalImageUrl,
        thumbnailUrl: finalImageUrl,
        storageKeys: uploadedKeys
      });
      logger.info(`[transcodeWorker] Completed compliant video passthrough for post ${postId}`);
    }

  } finally {
    try { fs.unlinkSync(tempInPath); } catch (_) {}
    try {
      if (fs.existsSync(tempOutDir)) {
        const files = fs.readdirSync(tempOutDir);
        for (const file of files) {
          fs.unlinkSync(path.join(tempOutDir, file));
        }
        fs.rmdirSync(tempOutDir);
      }
    } catch (_) {}
  }
}

let workerRunning = false;
let workerIntervalId = null;

function startTranscodeWorker() {
  if (process.env.NODE_ENV === 'test' || process.env.JEST_WORKER_ID !== undefined) {
    logger.info('[transcodeWorker] Running in test environment - skipping background interval');
    return;
  }
  if (workerIntervalId) return;
  logger.info('[transcodeWorker] Initializing background MongoDB transcode worker');

  workerIntervalId = setInterval(async () => {
    if (workerRunning) return;
    workerRunning = true;

    try {
      const mongoose = require('mongoose');
      require('../models/Post');
      const TranscodeJob = mongoose.model('TranscodeJob');
      const Post = mongoose.model('Post');

      const job = await TranscodeJob.findOneAndUpdate(
        { status: 'pending', attempts: { $lt: 3 } },
        { status: 'processing' },
        { sort: { createdAt: 1 }, new: true }
      );

      if (job) {
        logger.info(`[transcodeWorker] Found pending transcode job for post ${job.post}`);
        try {
          await processJob(job, Post);
          job.status = 'completed';
          await job.save();
          logger.info(`[transcodeWorker] Successfully completed job for post ${job.post}`);
        } catch (jobErr) {
          logger.error(`[transcodeWorker] Error processing job ${job._id}:`, jobErr);
          job.attempts += 1;
          job.error = jobErr.message || String(jobErr);
          job.status = job.attempts >= 3 ? 'failed' : 'pending';
          await job.save();

          if (job.status === 'failed') {
            await Post.findByIdAndUpdate(job.post, { status: 'failed' });
          }
        }
      }
    } catch (err) {
      logger.error('[transcodeWorker] Worker poll error:', err);
    } finally {
      workerRunning = false;
    }
  }, 5000);
}

module.exports = {
  transcodeIfNeeded,
  startTranscodeWorker,
};
