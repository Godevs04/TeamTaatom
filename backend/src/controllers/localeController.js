const Locale = require('../models/Locale');
const { uploadLocaleImage, deleteLocaleImage } = require('../config/cloudinary');
const { buildMediaKey, uploadObject, deleteObject } = require('../services/storage');
const { generateSignedUrl } = require('../services/mediaService');
const { sendSuccess, sendError } = require('../utils/errorCodes');
const logger = require('../utils/logger');

// @desc    Get all active locales (for mobile app)
// @route   GET /api/v1/locales
// @access  Public
const getLocales = async (req, res) => {
  try {
    // Backend Defensive Guards: Validate and sanitize query params
    let { search, countryCode, page = 1, limit = 50, includeInactive, spotType } = req.query;
    
    // Validate and cap limit (max 50)
    const parsedLimit = Math.min(Math.max(parseInt(limit) || 50, 1), 50);
    const parsedPage = Math.max(parseInt(page) || 1, 1);
    const skip = (parsedPage - 1) * parsedLimit;

    // Backend Defensive Guards: Validate search query (prevent injection)
    if (search && typeof search !== 'string') {
      logger.warn('Invalid search parameter type:', typeof search);
      search = '';
    }
    if (search) {
      search = search.trim().substring(0, 100); // Cap search length
    }
    
    // Backend Defensive Guards: Validate countryCode
    if (countryCode && typeof countryCode !== 'string') {
      logger.warn('Invalid countryCode parameter type:', typeof countryCode);
      countryCode = '';
    }
    if (countryCode && countryCode.length > 10) {
      logger.warn('countryCode too long, truncating');
      countryCode = countryCode.substring(0, 10);
    }
    
    // Backend Defensive Guards: Validate spotType
    if (spotType && typeof spotType !== 'string') {
      logger.warn('Invalid spotType parameter type:', typeof spotType);
      spotType = '';
    }

    // For SuperAdmin, allow viewing inactive locales if requested
    const query = includeInactive === 'true' ? {} : { isActive: true };
    
    // Handle search - use regex search (sanitized)
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { country: { $regex: search, $options: 'i' } },
        { stateProvince: { $regex: search, $options: 'i' } }
      ];
    }
    
    if (countryCode && countryCode !== 'all') {
      query.countryCode = countryCode.toUpperCase();
    }
    
    // Backend Defensive Guards: Add spotType filter if provided
    if (spotType && spotType !== 'all') {
      query.spotTypes = { $in: [spotType] };
    }

    const locales = await Locale.find(query)
      .select('name country countryCode stateProvince stateCode description isActive displayOrder _id createdAt latitude longitude spotTypes storageKey cloudinaryKey imageKey')
      .sort({ displayOrder: 1, createdAt: -1 })
      .skip(skip)
      .limit(parsedLimit)
      .lean();
    
    // Generate signed URLs dynamically for all locales
    const mappedLocales = await Promise.all(locales.map(async (locale) => {
      const storageKey = locale.storageKey || locale.cloudinaryKey || locale.imageKey;
      let signedUrl = null;
      
      if (storageKey) {
        try {
          signedUrl = await generateSignedUrl(storageKey, 'LOCALE');
        } catch (error) {
          logger.warn('Failed to generate signed URL for locale:', { 
            localeId: locale._id, 
            storageKey, 
            error: error.message 
          });
        }
      } else {
        logger.warn('Locale missing storage key:', { localeId: locale._id });
      }
      
      return {
        ...locale,
        imageUrl: signedUrl, // Dynamically generated URL
        cloudinaryUrl: signedUrl // Backward compatibility
      };
    }));

    const total = await Locale.countDocuments(query);

    return sendSuccess(res, 200, 'Locales fetched successfully', {
      locales: mappedLocales,
      pagination: {
        currentPage: parsedPage,
        totalPages: Math.ceil(total / parsedLimit),
        total,
        limit: parsedLimit
      }
    });
  } catch (error) {
    logger.error('Get locales error:', error);
    return sendError(res, 'SRV_6001', 'Error fetching locales');
  }
};

// @desc    Get single locale by ID
// @route   GET /api/v1/locales/:id
// @access  Public
const getLocaleById = async (req, res) => {
  try {
    const locale = await Locale.findById(req.params.id)
      .select('name country countryCode stateProvince stateCode description isActive displayOrder _id createdAt storageKey cloudinaryKey imageKey')
      .lean();

    if (!locale) {
      return sendError(res, 'RES_3001', 'Locale not found');
    }

    // Generate signed URL dynamically
    const storageKey = locale.storageKey || locale.cloudinaryKey || locale.imageKey;
    let signedUrl = null;
    
    if (storageKey) {
      try {
        signedUrl = await generateSignedUrl(storageKey, 'LOCALE');
      } catch (error) {
        logger.warn('Failed to generate signed URL for locale:', { 
          localeId: locale._id, 
          storageKey, 
          error: error.message 
        });
      }
    } else {
      logger.warn('Locale missing storage key:', { localeId: locale._id });
    }
    
    // Add dynamically generated URLs
    locale.imageUrl = signedUrl;
    locale.cloudinaryUrl = signedUrl; // Backward compatibility

    return sendSuccess(res, 200, 'Locale fetched successfully', { locale });
  } catch (error) {
    logger.error('Get locale by ID error:', error);
    return sendError(res, 'SRV_6001', 'Error fetching locale');
  }
};

// @desc    Upload new locale (SuperAdmin only)
// @route   POST /api/v1/locales/upload
// @access  Private (SuperAdmin)
const uploadLocale = async (req, res) => {
  try {
    logger.debug('Upload locale request received:', {
      hasFile: !!req.file,
      fileMimetype: req.file?.mimetype,
      fileSize: req.file?.size,
      body: req.body
    });

    if (!req.file) {
      logger.error('No file in request');
      return sendError(res, 'FILE_4001', 'Please upload an image file');
    }

    const { name, country, countryCode, stateProvince, stateCode, description, displayOrder } = req.body;

    if (!name || !country || !countryCode) {
      logger.error('Missing required fields:', { name: !!name, country: !!country, countryCode: !!countryCode });
      return sendError(res, 'VAL_2001', 'Name, country, and country code are required');
    }

    // Validate image file
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif'];
    if (!allowedTypes.includes(req.file.mimetype)) {
      logger.error('Invalid file type:', req.file.mimetype);
      return sendError(res, 'FILE_4002', 'Invalid image file format. Supported formats: JPEG, PNG, WebP, GIF');
    }

    // Check storage configuration
    if (!process.env.SEVALLA_STORAGE_BUCKET || !process.env.SEVALLA_STORAGE_ENDPOINT) {
      logger.error('Sevalla storage configuration missing');
      return sendError(res, 'SRV_6002', 'Storage is not configured. Please check environment variables.');
    }

    logger.debug('Uploading to Sevalla Object Storage...');
    // Upload to Sevalla Object Storage
    const extension = req.file.originalname.split('.').pop() || 'jpg';
    const storageKey = buildMediaKey({
      type: 'locale',
      filename: req.file.originalname,
      extension
    });
    
    await uploadObject(req.file.buffer, storageKey, req.file.mimetype);
    logger.debug('Storage upload successful:', { key: storageKey });

    // Validate displayOrder - check for conflicts
    const requestedOrder = parseInt(displayOrder) || 0;
    if (requestedOrder > 0) {
      const existingLocale = await Locale.findOne({ 
        displayOrder: requestedOrder, 
        isActive: true 
      });
      
      if (existingLocale) {
        return sendError(res, 'VAL_2001', `Display order ${requestedOrder} is already assigned to another locale. Please choose a different order.`);
      }
    }

    // Save to database - ONLY store storage key, NOT signed URL
    const locale = new Locale({
      name: name.trim(),
      country: country.trim(),
      countryCode: countryCode.trim().toUpperCase(),
      stateProvince: stateProvince ? stateProvince.trim() : '',
      stateCode: stateCode ? stateCode.trim() : '',
      description: description ? description.trim() : '',
      storageKey: storageKey, // Store ONLY storage key
      cloudinaryKey: storageKey, // Backward compatibility
      imageKey: storageKey, // Set imageKey for backward compatibility (prevents null duplicate key error)
      // DO NOT store cloudinaryUrl or imageUrl - they will be generated dynamically
      createdBy: req.superAdmin._id,
      displayOrder: requestedOrder,
      isActive: true // Explicitly set to active
    });

    await locale.save();

    // Return locale with dynamically generated signed URL
    const localeResponse = await Locale.findById(locale._id)
      .select('name country countryCode stateProvince stateCode description isActive displayOrder _id createdAt storageKey cloudinaryKey imageKey')
      .lean();
    
    // Generate signed URL dynamically
    if (localeResponse) {
      const storageKeyForUrl = localeResponse.storageKey || localeResponse.cloudinaryKey || localeResponse.imageKey;
      if (storageKeyForUrl) {
        try {
          const signedUrl = await generateSignedUrl(storageKeyForUrl, 'LOCALE');
          localeResponse.imageUrl = signedUrl;
          localeResponse.cloudinaryUrl = signedUrl; // Backward compatibility
        } catch (error) {
          logger.warn('Failed to generate signed URL for locale response:', { 
            localeId: locale._id, 
            error: error.message 
          });
          localeResponse.imageUrl = null;
          localeResponse.cloudinaryUrl = null;
        }
      } else {
        logger.warn('Locale missing storage key:', { localeId: locale._id });
        localeResponse.imageUrl = null;
        localeResponse.cloudinaryUrl = null;
      }
    }

    return sendSuccess(res, 201, 'Locale uploaded successfully', { locale: localeResponse });
  } catch (error) {
    logger.error('Upload locale error:', error);
    logger.error('Upload locale error details:', {
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
    
    if (error.message?.includes('expiration') || error.message?.includes('presigned')) {
      return sendError(res, 'SRV_6002', 'Invalid URL expiration. Presigned URLs must expire within 7 days.');
    }
    
    return sendError(res, 'SRV_6001', error.message || 'Error uploading locale');
  }
};

// @desc    Delete locale (SuperAdmin only)
// @route   DELETE /api/v1/locales/:id
// @access  Private (SuperAdmin)
const deleteLocaleById = async (req, res) => {
  try {
    const locale = await Locale.findById(req.params.id);
    
    if (!locale) {
      return sendError(res, 'RES_3001', 'Locale not found');
    }

    // Delete from storage (Sevalla R2)
    try {
      const keyToDelete = locale.storageKey || locale.cloudinaryKey || locale.imageKey; // Priority: storageKey > cloudinaryKey > imageKey
      if (keyToDelete) {
        await deleteObject(keyToDelete);
      }
    } catch (storageError) {
      logger.error('Error deleting from storage:', storageError);
      // Try legacy Cloudinary delete as fallback
      try {
        const legacyKey = locale.cloudinaryKey || locale.imageKey;
        if (legacyKey) {
          await deleteLocaleImage(legacyKey);
        }
      } catch (cloudinaryError) {
        logger.error('Error deleting from Cloudinary (legacy):', cloudinaryError);
      }
      // Continue with database deletion even if storage deletion fails
    }

    // Delete from database
    await Locale.findByIdAndDelete(req.params.id);

    return sendSuccess(res, 200, 'Locale deleted successfully');
  } catch (error) {
    logger.error('Delete locale error:', error);
    return sendError(res, 'SRV_6001', 'Error deleting locale');
  }
};

// @desc    Toggle locale active/inactive status
// @route   PATCH /api/v1/locales/:id/toggle
// @access  SuperAdmin only
const toggleLocaleStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { isActive } = req.body;

    if (typeof isActive !== 'boolean') {
      return sendError(res, 'VAL_2001', 'isActive must be a boolean value');
    }

    const locale = await Locale.findById(id);
    if (!locale) {
      return sendError(res, 'SRV_6001', 'Locale not found');
    }

    locale.isActive = isActive;
    await locale.save();

    logger.info(`Locale ${id} status changed to ${isActive ? 'active' : 'inactive'}`);

    return sendSuccess(res, 200, `Locale ${isActive ? 'activated' : 'deactivated'} successfully`, {
      locale: {
        _id: locale._id,
        name: locale.name,
        country: locale.country,
        isActive: locale.isActive
      }
    });
  } catch (error) {
    logger.error('Toggle locale status error:', error);
    return sendError(res, 'SRV_6001', 'Error toggling locale status');
  }
};

// @desc    Update locale details
// @route   PUT /api/v1/locales/:id
// @access  SuperAdmin only
const updateLocale = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, country, countryCode, stateProvince, stateCode, description, displayOrder } = req.body;

    const locale = await Locale.findById(id);
    if (!locale) {
      return sendError(res, 'SRV_6001', 'Locale not found');
    }

    // Preserve cloudinaryUrl and cloudinaryKey - these are required and should not be changed during update
    // If they don't exist, populate from legacy fields for backward compatibility
    if (!locale.cloudinaryUrl && locale.imageUrl) {
      locale.cloudinaryUrl = locale.imageUrl;
    }
    if (!locale.cloudinaryKey && locale.imageKey) {
      locale.cloudinaryKey = locale.imageKey;
    }

    // Ensure cloudinaryUrl and cloudinaryKey are set (required fields)
    if (!locale.cloudinaryUrl || !locale.cloudinaryKey) {
      logger.error(`Locale ${id} is missing cloudinaryUrl or cloudinaryKey`);
      return sendError(res, 'SRV_6001', 'Locale is missing required image data. Please contact support.');
    }

    // Update fields if provided
    if (name !== undefined) {
      if (typeof name !== 'string' || name.trim().length === 0 || name.length > 200) {
        return sendError(res, 'VAL_2001', 'Name must be between 1 and 200 characters');
      }
      locale.name = name.trim();
    }

    if (country !== undefined) {
      if (typeof country !== 'string' || country.trim().length === 0 || country.length > 200) {
        return sendError(res, 'VAL_2001', 'Country must be between 1 and 200 characters');
      }
      locale.country = country.trim();
    }

    if (countryCode !== undefined) {
      if (typeof countryCode !== 'string' || countryCode.trim().length === 0 || countryCode.length > 10) {
        return sendError(res, 'VAL_2001', 'Country code must be between 1 and 10 characters');
      }
      locale.countryCode = countryCode.trim().toUpperCase();
    }

    if (stateProvince !== undefined) {
      locale.stateProvince = stateProvince ? stateProvince.trim() : '';
    }

    if (stateCode !== undefined) {
      locale.stateCode = stateCode ? stateCode.trim() : '';
    }

    if (description !== undefined) {
      if (typeof description !== 'string' || description.length > 1000) {
        return sendError(res, 'VAL_2001', 'Description must be less than 1000 characters');
      }
      locale.description = description ? description.trim() : '';
    }

    if (displayOrder !== undefined) {
      const orderNum = parseInt(displayOrder);
      if (isNaN(orderNum) || orderNum < 0) {
        return sendError(res, 'VAL_2001', 'Display order must be a positive number');
      }
      
      // Check if another locale already has this displayOrder
      const existingLocale = await Locale.findOne({ 
        displayOrder: orderNum, 
        _id: { $ne: id },
        isActive: true 
      });
      
      if (existingLocale) {
        return sendError(res, 'VAL_2001', `Display order ${orderNum} is already assigned to another locale. Please choose a different order.`);
      }
      
      locale.displayOrder = orderNum;
    }

    // Also update legacy fields for backward compatibility
    if (locale.cloudinaryUrl && !locale.imageUrl) {
      locale.imageUrl = locale.cloudinaryUrl;
    }
    if (locale.cloudinaryKey && !locale.imageKey) {
      locale.imageKey = locale.cloudinaryKey;
    }

    await locale.save();

    logger.info(`Locale ${id} updated successfully`);

    return sendSuccess(res, 200, 'Locale updated successfully', {
      locale: {
        _id: locale._id,
        name: locale.name,
        country: locale.country,
        countryCode: locale.countryCode,
        stateProvince: locale.stateProvince,
        stateCode: locale.stateCode,
        description: locale.description,
        displayOrder: locale.displayOrder,
        isActive: locale.isActive
      }
    });
  } catch (error) {
    logger.error('Update locale error:', error);
    return sendError(res, 'SRV_6001', 'Error updating locale');
  }
};

module.exports = {
  getLocales,
  getLocaleById,
  uploadLocale,
  deleteLocaleById,
  toggleLocaleStatus,
  updateLocale
};

