const Song = require('../models/Song');
const { uploadSong, deleteSong } = require('../config/cloudinary');
const { buildMediaKey, uploadObject, deleteObject } = require('../services/storage');
const { sendSuccess, sendError } = require('../utils/errorCodes');
const logger = require('../utils/logger');

// @desc    Get all active songs (for user selection)
// @route   GET /api/v1/songs
// @access  Public
const getSongs = async (req, res) => {
  try {
    const { search, genre, page = 1, limit = 50, includeInactive } = req.query;
    const skip = (page - 1) * limit;

    // For SuperAdmin, allow viewing inactive songs if requested
    const query = includeInactive === 'true' ? {} : { isActive: true };
    
    // Handle search - use regex search (more reliable than text index)
    if (search) {
      query.$or = [
        { title: { $regex: search, $options: 'i' } },
        { artist: { $regex: search, $options: 'i' } }
      ];
    }
    
    if (genre && genre !== 'all') {
      query.genre = genre;
    }

    const songs = await Song.find(query)
      .select('title artist duration cloudinaryUrl s3Url thumbnailUrl genre _id isActive createdAt usageCount uploadDate')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit))
      .lean();
    
    // Map to ensure backward compatibility - use cloudinaryUrl if available, fallback to s3Url
    const mappedSongs = songs.map(song => ({
      ...song,
      s3Url: song.cloudinaryUrl || song.s3Url // Ensure s3Url is populated for backward compatibility
    }));

    const total = await Song.countDocuments(query);

    return sendSuccess(res, 200, 'Songs fetched successfully', {
      songs: mappedSongs,
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(total / limit),
        total,
        limit: parseInt(limit)
      }
    });
  } catch (error) {
    logger.error('Get songs error:', error);
    return sendError(res, 'SRV_6001', 'Error fetching songs');
  }
};

// @desc    Get single song by ID
// @route   GET /api/v1/songs/:id
// @access  Public
const getSongById = async (req, res) => {
  try {
    const song = await Song.findById(req.params.id)
      .select('title artist duration cloudinaryUrl s3Url thumbnailUrl genre _id isActive createdAt usageCount uploadDate')
      .lean();
    
    // Ensure backward compatibility
    if (song) {
      song.s3Url = song.cloudinaryUrl || song.s3Url;
    }

    if (!song) {
      return sendError(res, 'RES_3001', 'Song not found');
    }

    return sendSuccess(res, 200, 'Song fetched successfully', { song });
  } catch (error) {
    logger.error('Get song by ID error:', error);
    return sendError(res, 'SRV_6001', 'Error fetching song');
  }
};

// @desc    Upload new song (SuperAdmin only)
// @route   POST /api/v1/songs/upload
// @access  Private (SuperAdmin)
const uploadSongFile = async (req, res) => {
  try {
    logger.debug('Upload song request received:', {
      hasFile: !!req.file,
      fileMimetype: req.file?.mimetype,
      fileSize: req.file?.size,
      body: req.body
    });

    if (!req.file) {
      logger.error('No file in request');
      return sendError(res, 'FILE_4001', 'Please upload a song file');
    }

    const { title, artist, genre, duration } = req.body;

    if (!title || !artist) {
      logger.error('Missing required fields:', { title: !!title, artist: !!artist });
      return sendError(res, 'VAL_2001', 'Title and artist are required');
    }

    // Validate audio file
    const allowedTypes = ['audio/mpeg', 'audio/mp3', 'audio/wav', 'audio/m4a', 'audio/x-m4a'];
    if (!allowedTypes.includes(req.file.mimetype)) {
      logger.error('Invalid file type:', req.file.mimetype);
      return sendError(res, 'FILE_4002', 'Invalid audio file format. Supported formats: MP3, WAV, M4A');
    }

    // Check storage configuration
    if (!process.env.SEVALLA_STORAGE_BUCKET || !process.env.SEVALLA_STORAGE_ENDPOINT) {
      logger.error('Sevalla storage configuration missing');
      return sendError(res, 'SRV_6002', 'Storage is not configured. Please check environment variables.');
    }

    logger.debug('Uploading to Sevalla Object Storage...');
    // Upload to Sevalla Object Storage
    const extension = req.file.originalname.split('.').pop() || 'mp3';
    const storageKey = buildMediaKey({
      type: 'song',
      filename: req.file.originalname,
      extension
    });
    
    const uploadResult = await uploadObject(req.file.buffer, storageKey, req.file.mimetype);
    logger.debug('Storage upload successful:', { key: storageKey, url: uploadResult.url });

    // Save to database
    const song = new Song({
      title,
      artist,
      duration: parseInt(duration) || 0,
      genre: genre || 'General',
      storageKey: storageKey, // Store storage key
      cloudinaryKey: storageKey, // Backward compatibility
      cloudinaryUrl: uploadResult.url, // Store URL
      uploadedBy: req.superAdmin._id,
      isActive: true // Explicitly set to active
    });

    await song.save();

    // Return song with all fields for frontend
    const songResponse = await Song.findById(song._id)
      .select('title artist duration cloudinaryUrl s3Url thumbnailUrl genre _id isActive createdAt usageCount uploadDate')
      .lean();
    
    // Ensure backward compatibility
    if (songResponse) {
      songResponse.s3Url = songResponse.cloudinaryUrl || songResponse.s3Url;
    }

    return sendSuccess(res, 201, 'Song uploaded successfully', { song: songResponse });
  } catch (error) {
    logger.error('Upload song error:', error);
    logger.error('Upload song error details:', {
      message: error.message,
      code: error.code,
      statusCode: error.statusCode,
      stack: error.stack
    });
    
    // Provide more specific error messages
    if (error.message?.includes('Invalid') || error.message?.includes('credentials')) {
      return sendError(res, 'SRV_6002', 'Storage credentials are invalid. Please check SEVALLA_STORAGE_ACCESS_KEY and SEVALLA_STORAGE_SECRET_KEY.');
    }
    
    if (error.message?.includes('endpoint') || error.message?.includes('ENOTFOUND')) {
      return sendError(res, 'SRV_6002', 'Storage endpoint is invalid or unreachable. Please check SEVALLA_STORAGE_ENDPOINT.');
    }
    
    if (error.name === 'NoSuchBucket' || error.message?.includes('bucket')) {
      return sendError(res, 'SRV_6002', 'Storage bucket not found. Please check SEVALLA_STORAGE_BUCKET.');
    }
    
    return sendError(res, 'SRV_6001', error.message || 'Error uploading song');
  }
};

// @desc    Delete song (SuperAdmin only)
// @route   DELETE /api/v1/songs/:id
// @access  Private (SuperAdmin)
const deleteSongById = async (req, res) => {
  try {
    const song = await Song.findById(req.params.id);
    
    if (!song) {
      return sendError(res, 'RES_3001', 'Song not found');
    }

    // Delete from storage (Sevalla R2)
    try {
      const keyToDelete = song.storageKey || song.cloudinaryKey || song.s3Key; // Priority: storageKey > cloudinaryKey > s3Key
      if (keyToDelete) {
        await deleteObject(keyToDelete);
      }
    } catch (storageError) {
      logger.error('Error deleting from storage:', storageError);
      // Try legacy Cloudinary delete as fallback
      try {
        const legacyKey = song.cloudinaryKey || song.s3Key;
        if (legacyKey) {
          await deleteSong(legacyKey);
        }
      } catch (cloudinaryError) {
        logger.error('Error deleting from Cloudinary (legacy):', cloudinaryError);
      }
      // Continue with database deletion even if storage deletion fails
    }

    // Delete from database
    await Song.findByIdAndDelete(req.params.id);

    return sendSuccess(res, 200, 'Song deleted successfully');
  } catch (error) {
    logger.error('Delete song error:', error);
    return sendError(res, 'SRV_6001', 'Error deleting song');
  }
};

// @desc    Toggle song active/inactive status
// @route   PATCH /api/v1/songs/:id/toggle
// @access  SuperAdmin only
const toggleSongStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { isActive } = req.body;

    if (typeof isActive !== 'boolean') {
      return sendError(res, 'VAL_2001', 'isActive must be a boolean value');
    }

    const song = await Song.findById(id);
    if (!song) {
      return sendError(res, 'SRV_6001', 'Song not found');
    }

    song.isActive = isActive;
    await song.save();

    logger.info(`Song ${id} status changed to ${isActive ? 'active' : 'inactive'}`);

    return sendSuccess(res, 200, `Song ${isActive ? 'activated' : 'deactivated'} successfully`, {
      song: {
        _id: song._id,
        title: song.title,
        artist: song.artist,
        isActive: song.isActive
      }
    });
  } catch (error) {
    logger.error('Toggle song status error:', error);
    return sendError(res, 'SRV_6001', 'Error toggling song status');
  }
};

// @desc    Update song details
// @route   PUT /api/v1/songs/:id
// @access  SuperAdmin only
const updateSong = async (req, res) => {
  try {
    const { id } = req.params;
    const { title, artist, genre, duration } = req.body;

    const song = await Song.findById(id);
    if (!song) {
      return sendError(res, 'SRV_6001', 'Song not found');
    }

    // Update fields if provided
    if (title !== undefined) {
      if (typeof title !== 'string' || title.trim().length === 0 || title.length > 200) {
        return sendError(res, 'VAL_2001', 'Title must be between 1 and 200 characters');
      }
      song.title = title.trim();
    }

    if (artist !== undefined) {
      if (typeof artist !== 'string' || artist.trim().length === 0 || artist.length > 200) {
        return sendError(res, 'VAL_2001', 'Artist must be between 1 and 200 characters');
      }
      song.artist = artist.trim();
    }

    if (genre !== undefined) {
      if (typeof genre !== 'string' || genre.length > 50) {
        return sendError(res, 'VAL_2001', 'Genre must be less than 50 characters');
      }
      song.genre = genre.trim();
    }

    if (duration !== undefined) {
      const durationNum = parseInt(duration);
      if (isNaN(durationNum) || durationNum < 0) {
        return sendError(res, 'VAL_2001', 'Duration must be a positive number');
      }
      song.duration = durationNum;
    }

    await song.save();

    logger.info(`Song ${id} updated successfully`);

    return sendSuccess(res, 200, 'Song updated successfully', {
      song: {
        _id: song._id,
        title: song.title,
        artist: song.artist,
        genre: song.genre,
        duration: song.duration,
        isActive: song.isActive
      }
    });
  } catch (error) {
    logger.error('Update song error:', error);
    return sendError(res, 'SRV_6001', 'Error updating song');
  }
};

module.exports = {
  getSongs,
  getSongById,
  uploadSongFile,
  deleteSongById,
  toggleSongStatus,
  updateSong
};

