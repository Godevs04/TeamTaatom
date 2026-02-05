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
    let { search, countryCode, stateCode, page = 1, limit = 50, includeInactive, spotType, spotTypes } = req.query;
    
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
    
    // Backend Defensive Guards: Validate stateCode
    if (stateCode && typeof stateCode !== 'string') {
      logger.warn('Invalid stateCode parameter type:', typeof stateCode);
      stateCode = '';
    }
    if (stateCode && stateCode.length > 50) {
      logger.warn('stateCode too long, truncating');
      stateCode = stateCode.substring(0, 50);
    }
    
    // Backend Defensive Guards: Validate spotType (single) or spotTypes (multiple)
    if (spotType && typeof spotType !== 'string') {
      logger.warn('Invalid spotType parameter type:', typeof spotType);
      spotType = '';
    }
    
    // Handle multiple spot types (comma-separated or array)
    let spotTypesArray = [];
    if (spotTypes) {
      if (typeof spotTypes === 'string') {
        // Comma-separated string
        spotTypesArray = spotTypes.split(',').map(s => s.trim()).filter(s => s.length > 0);
      } else if (Array.isArray(spotTypes)) {
        spotTypesArray = spotTypes.map(s => String(s).trim()).filter(s => s.length > 0);
      }
    }
    // If single spotType provided, add it to array
    if (spotType && spotType !== 'all' && !spotTypesArray.includes(spotType)) {
      spotTypesArray.push(spotType);
    }

    // For SuperAdmin, allow viewing inactive locales if requested
    const query = includeInactive === 'true' ? {} : { isActive: true };
    
    // Build search conditions
    const searchConditions = [];
    if (search) {
      searchConditions.push(
        { name: { $regex: search, $options: 'i' } },
        { country: { $regex: search, $options: 'i' } },
        { stateProvince: { $regex: search, $options: 'i' } }
      );
    }
    
    // Build state filter conditions (handle optional state fields)
    const stateConditions = [];
    if (stateCode && stateCode.trim() !== '' && stateCode !== 'all') {
      stateConditions.push(
        { stateCode: stateCode.trim() },
        { stateCode: { $regex: stateCode.trim(), $options: 'i' } },
        { stateProvince: { $regex: stateCode.trim(), $options: 'i' } }
      );
    }
    
    // Combine search and state filters properly
    const andConditions = [];
    
    if (searchConditions.length > 0) {
      andConditions.push({ $or: searchConditions });
    }
    
    if (stateConditions.length > 0) {
      andConditions.push({ $or: stateConditions });
    }
    
    // Apply country filter directly
    if (countryCode && countryCode !== 'all') {
      query.countryCode = countryCode.toUpperCase();
    }
    
    // Apply combined search and state filters
    if (andConditions.length > 0) {
      if (andConditions.length === 1) {
        // Only one condition, merge it directly
        Object.assign(query, andConditions[0]);
      } else {
        // Multiple conditions, use $and
        query.$and = andConditions;
      }
    }
    
    // Backend Defensive Guards: Add spotType filter if provided (supports multiple)
    if (spotTypesArray.length > 0) {
      // Filter locales that have ANY of the selected spot types
      query.spotTypes = { $in: spotTypesArray };
    } else if (spotType && spotType !== 'all') {
      // Backward compatibility: single spotType
      query.spotTypes = { $in: [spotType] };
    }

    // OPTIMIZATION: Use lean() and select only required fields to reduce payload size
    // Exclude large fields that aren't needed: description (can be long), full country name
    // Note: country field removed from select to reduce payload (countryCode is sufficient)
    const locales = await Locale.find(query)
      .select('name countryCode stateProvince stateCode city isActive displayOrder _id createdAt latitude longitude spotTypes travelInfo storageKey cloudinaryKey imageKey')
      .sort({ displayOrder: 1, createdAt: -1 })
      .skip(skip)
      .limit(parsedLimit)
      .lean()
      .maxTimeMS(5000); // Prevent slow queries from hanging (>5s = timeout)
    
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

    // OPTIMIZATION: Use countDocuments with timeout to prevent slow queries
    // Indexes ensure this is fast (<20ms target)
    // NOTE: For very large collections (10k+), consider caching counts or using
    // estimatedDocumentCount() for pagination UI when no filters are applied
    const total = await Locale.countDocuments(query).maxTimeMS(2000);

    // Include statistics for SuperAdmin when includeInactive is true
    // OPTIMIZATION: Use Promise.all for parallel execution (faster than sequential)
    // These queries use indexes and should be fast
    let statistics = null;
    if (includeInactive === 'true') {
      const [totalLocales, activeLocales, inactiveLocales] = await Promise.all([
        Locale.countDocuments({}).maxTimeMS(2000),
        Locale.countDocuments({ isActive: true }).maxTimeMS(2000),
        Locale.countDocuments({ isActive: false }).maxTimeMS(2000)
      ]);
      statistics = {
        total: totalLocales,
        active: activeLocales,
        inactive: inactiveLocales
      };
    }

    const responseData = {
      locales: mappedLocales,
      pagination: {
        currentPage: parsedPage,
        totalPages: Math.ceil(total / parsedLimit),
        total,
        limit: parsedLimit
      }
    };

    // Add statistics if available (for SuperAdmin)
    if (statistics) {
      responseData.statistics = statistics;
    }

    return sendSuccess(res, 200, 'Locales fetched successfully', responseData);
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
      .select('name country countryCode stateProvince stateCode city description isActive displayOrder _id createdAt latitude longitude spotTypes travelInfo storageKey cloudinaryKey imageKey')
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

    const { name, country, countryCode, stateProvince, stateCode, city, description, displayOrder, spotTypes, travelInfo, latitude, longitude } = req.body;

    if (!name || !country || !countryCode || !city) {
      logger.error('Missing required fields:', { name: !!name, country: !!country, countryCode: !!countryCode, city: !!city });
      return sendError(res, 'VAL_2001', 'Name, country, country code, and city are required');
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

    // Display order is optional and can be duplicated - no validation needed
    const requestedOrder = parseInt(displayOrder) || 0;

    // Process spotTypes - ensure it's an array
    let processedSpotTypes = [];
    if (spotTypes) {
      if (typeof spotTypes === 'string') {
        // If it's a JSON string, parse it
        try {
          processedSpotTypes = JSON.parse(spotTypes);
        } catch {
          // If not JSON, treat as comma-separated string
          processedSpotTypes = spotTypes.split(',').map(s => s.trim()).filter(s => s.length > 0);
        }
      } else if (Array.isArray(spotTypes)) {
        processedSpotTypes = spotTypes.map(s => String(s).trim()).filter(s => s.length > 0);
      }
    }

    // Process travelInfo - validate against enum
    const validTravelInfo = ['Drivable', 'Walkable', 'Public Transport', 'Flight Required', 'Not Accessible'];
    const processedTravelInfo = travelInfo && validTravelInfo.includes(travelInfo.trim()) 
      ? travelInfo.trim() 
      : 'Drivable';

    // Validate city
    const cityTrimmed = city.trim();
    if (!cityTrimmed || cityTrimmed.length === 0 || cityTrimmed.length > 50) {
      return sendError(res, 'VAL_2001', 'City is required and must be between 1 and 50 characters');
    }

    // Validate and process coordinates
    let processedLatitude = null;
    let processedLongitude = null;
    
    if (latitude !== undefined && longitude !== undefined) {
      const lat = parseFloat(latitude);
      const lng = parseFloat(longitude);
      
      if (!isNaN(lat) && !isNaN(lng)) {
        if (lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180) {
          processedLatitude = lat;
          processedLongitude = lng;
        } else {
          logger.warn('Invalid coordinates provided:', { latitude: lat, longitude: lng });
        }
      }
    }

    // Save to database - ONLY store storage key, NOT signed URL
    const locale = new Locale({
      name: name.trim(),
      country: country.trim(),
      countryCode: countryCode.trim().toUpperCase(),
      stateProvince: stateProvince ? stateProvince.trim() : '',
      stateCode: stateCode ? stateCode.trim() : '',
      city: cityTrimmed,
      description: description ? description.trim() : '',
      storageKey: storageKey, // Store ONLY storage key
      cloudinaryKey: storageKey, // Backward compatibility
      imageKey: storageKey, // Set imageKey for backward compatibility (prevents null duplicate key error)
      // DO NOT store cloudinaryUrl or imageUrl - they will be generated dynamically
      createdBy: req.superAdmin._id,
      displayOrder: requestedOrder,
      isActive: true, // Explicitly set to active
      spotTypes: processedSpotTypes,
      travelInfo: processedTravelInfo,
      latitude: processedLatitude,
      longitude: processedLongitude
    });

    await locale.save();

    // Return locale with dynamically generated signed URL
    const localeResponse = await Locale.findById(locale._id)
      .select('name country countryCode stateProvince stateCode city description isActive displayOrder _id createdAt latitude longitude spotTypes travelInfo storageKey cloudinaryKey imageKey')
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
    const { name, country, countryCode, stateProvince, stateCode, city, description, displayOrder, spotTypes, travelInfo, latitude, longitude } = req.body;

    const locale = await Locale.findById(id);
    if (!locale) {
      return sendError(res, 'SRV_6001', 'Locale not found');
    }

    // Preserve storage keys - check storageKey first (new), then fallback to legacy fields
    // Priority: storageKey > cloudinaryKey > imageKey
    const hasStorageKey = locale.storageKey || locale.cloudinaryKey || locale.imageKey;
    
    if (!hasStorageKey) {
      logger.error(`Locale ${id} is missing storage key (storageKey, cloudinaryKey, or imageKey)`);
      return sendError(res, 'SRV_6001', 'Locale is missing required image data. Please contact support.');
    }

    // Populate legacy fields for backward compatibility if they don't exist
    if (!locale.cloudinaryKey && locale.storageKey) {
      locale.cloudinaryKey = locale.storageKey;
    }
    if (!locale.cloudinaryKey && locale.imageKey) {
      locale.cloudinaryKey = locale.imageKey;
    }
    if (!locale.storageKey && locale.cloudinaryKey) {
      locale.storageKey = locale.cloudinaryKey;
    }
    if (!locale.storageKey && locale.imageKey) {
      locale.storageKey = locale.imageKey;
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

    if (city !== undefined) {
      if (typeof city !== 'string' || city.trim().length === 0 || city.length > 50) {
        return sendError(res, 'VAL_2001', 'City is required and must be between 1 and 50 characters');
      }
      locale.city = city.trim();
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
      
      // Display order can be duplicated - no uniqueness validation needed
      locale.displayOrder = orderNum;
    }

    // Handle spotTypes update
    if (spotTypes !== undefined) {
      let processedSpotTypes = [];
      if (spotTypes) {
        if (typeof spotTypes === 'string') {
          try {
            processedSpotTypes = JSON.parse(spotTypes);
          } catch {
            processedSpotTypes = spotTypes.split(',').map(s => s.trim()).filter(s => s.length > 0);
          }
        } else if (Array.isArray(spotTypes)) {
          processedSpotTypes = spotTypes.map(s => String(s).trim()).filter(s => s.length > 0);
        }
      }
      locale.spotTypes = processedSpotTypes;
    }

    // Handle travelInfo update
    if (travelInfo !== undefined) {
      const validTravelInfo = ['Drivable', 'Walkable', 'Public Transport', 'Flight Required', 'Not Accessible'];
      if (validTravelInfo.includes(travelInfo.trim())) {
        locale.travelInfo = travelInfo.trim();
      } else {
        return sendError(res, 'VAL_2001', `Invalid travelInfo. Must be one of: ${validTravelInfo.join(', ')}`);
      }
    }

    // Handle latitude and longitude update
    if (latitude !== undefined && longitude !== undefined) {
      const lat = parseFloat(latitude);
      const lng = parseFloat(longitude);
      
      if (!isNaN(lat) && !isNaN(lng)) {
        if (lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180) {
          locale.latitude = lat;
          locale.longitude = lng;
        } else {
          logger.warn('Invalid coordinates provided for update:', { latitude: lat, longitude: lng });
          // Don't fail the update, just log the warning
        }
      } else if (latitude === null && longitude === null) {
        // Allow explicitly setting to null to clear coordinates
        locale.latitude = null;
        locale.longitude = null;
      }
    }

    // Also update legacy fields for backward compatibility
    // Ensure all storage key fields are synchronized
    const primaryStorageKey = locale.storageKey || locale.cloudinaryKey || locale.imageKey;
    if (primaryStorageKey) {
      if (!locale.storageKey) locale.storageKey = primaryStorageKey;
      if (!locale.cloudinaryKey) locale.cloudinaryKey = primaryStorageKey;
      if (!locale.imageKey) locale.imageKey = primaryStorageKey;
    }

    await locale.save();

    logger.info(`Locale ${id} updated successfully`);

    // Generate signed URL for the updated locale
    const storageKeyForUrl = locale.storageKey || locale.cloudinaryKey || locale.imageKey;
    let signedUrl = null;
    
    if (storageKeyForUrl) {
      try {
        signedUrl = await generateSignedUrl(storageKeyForUrl, 'LOCALE');
      } catch (error) {
        logger.warn('Failed to generate signed URL for updated locale:', { 
          localeId: locale._id, 
          storageKey: storageKeyForUrl, 
          error: error.message 
        });
      }
    }

    return sendSuccess(res, 200, 'Locale updated successfully', {
      locale: {
        _id: locale._id,
        name: locale.name,
        country: locale.country,
        countryCode: locale.countryCode,
        stateProvince: locale.stateProvince,
        stateCode: locale.stateCode,
        city: locale.city,
        description: locale.description,
        displayOrder: locale.displayOrder,
        isActive: locale.isActive,
        spotTypes: locale.spotTypes || [],
        travelInfo: locale.travelInfo || 'Drivable',
        latitude: locale.latitude,
        longitude: locale.longitude,
        imageUrl: signedUrl,
        cloudinaryUrl: signedUrl
      }
    });
  } catch (error) {
    logger.error('Update locale error:', error);
    return sendError(res, 'SRV_6001', 'Error updating locale');
  }
};

// @desc    Get all unique countries from locales (for filter dropdown)
// @route   GET /api/v1/locales/countries
// @access  Public
const getUniqueCountries = async (req, res) => {
  try {
    // OPTIMIZATION: Filter by isActive to use index and reduce dataset
    // Only show countries that have active locales
    const uniqueCountries = await Locale.aggregate([
      {
        $match: {
          isActive: true, // Use index: isActive_1_countryCode_1_displayOrder_1_createdAt_-1
          countryCode: { $exists: true, $ne: null, $ne: '' }
        }
      },
      {
        $group: {
          _id: '$countryCode',
          country: { $first: '$country' },
          count: { $sum: 1 }
        }
      },
      {
        $project: {
          _id: 0,
          code: '$_id',
          name: {
            $cond: {
              if: { $and: [{ $ne: ['$country', null] }, { $ne: ['$country', ''] }] },
              then: '$country',
              else: '$_id'
            }
          },
          localeCount: '$count'
        }
      },
      {
        $sort: { name: 1 }
      }
    ]).allowDiskUse(true).maxTimeMS(5000); // Allow disk use for large collections, timeout after 5s

    return sendSuccess(res, 200, 'Countries fetched successfully', {
      countries: uniqueCountries
    });
  } catch (error) {
    logger.error('Get unique countries error:', error);
    return sendError(res, 'SRV_6001', 'Error fetching countries');
  }
};

module.exports = {
  getLocales,
  getLocaleById,
  uploadLocale,
  deleteLocaleById,
  toggleLocaleStatus,
  updateLocale,
  getUniqueCountries
};

