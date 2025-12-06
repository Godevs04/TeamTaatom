const Locale = require('../models/Locale');
const { uploadLocaleImage, deleteLocaleImage } = require('../config/cloudinary');
const { sendSuccess, sendError } = require('../utils/errorCodes');
const logger = require('../utils/logger');

// @desc    Get all active locales (for mobile app)
// @route   GET /api/v1/locales
// @access  Public
const getLocales = async (req, res) => {
  try {
    const { search, countryCode, page = 1, limit = 50, includeInactive } = req.query;
    const skip = (page - 1) * limit;

    // For SuperAdmin, allow viewing inactive locales if requested
    const query = includeInactive === 'true' ? {} : { isActive: true };
    
    // Handle search - use regex search
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

    const locales = await Locale.find(query)
      .select('name country countryCode stateProvince stateCode description cloudinaryUrl imageUrl isActive displayOrder _id createdAt')
      .sort({ displayOrder: 1, createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit))
      .lean();
    
    // Map to ensure backward compatibility - use cloudinaryUrl if available, fallback to imageUrl
    const mappedLocales = locales.map(locale => ({
      ...locale,
      imageUrl: locale.cloudinaryUrl || locale.imageUrl // Ensure imageUrl is populated for backward compatibility
    }));

    const total = await Locale.countDocuments(query);

    return sendSuccess(res, 200, 'Locales fetched successfully', {
      locales: mappedLocales,
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(total / limit),
        total,
        limit: parseInt(limit)
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
      .select('name country countryCode stateProvince stateCode description cloudinaryUrl imageUrl isActive displayOrder _id createdAt')
      .lean();
    
    // Ensure backward compatibility
    if (locale) {
      locale.imageUrl = locale.cloudinaryUrl || locale.imageUrl;
    }

    if (!locale) {
      return sendError(res, 'RES_3001', 'Locale not found');
    }

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

    // Check Cloudinary configuration
    if (!process.env.CLOUDINARY_CLOUD_NAME || !process.env.CLOUDINARY_API_KEY || !process.env.CLOUDINARY_API_SECRET) {
      logger.error('Cloudinary configuration missing');
      return sendError(res, 'SRV_6002', 'Cloudinary is not configured. Please check environment variables.');
    }

    logger.debug('Uploading to Cloudinary...');
    // Upload to Cloudinary
    const cloudinaryResult = await uploadLocaleImage(
      req.file.buffer,
      req.file.originalname,
      req.file.mimetype
    );
    logger.debug('Cloudinary upload successful:', { key: cloudinaryResult.key, url: cloudinaryResult.url });

    // Save to database
    const locale = new Locale({
      name: name.trim(),
      country: country.trim(),
      countryCode: countryCode.trim().toUpperCase(),
      stateProvince: stateProvince ? stateProvince.trim() : '',
      stateCode: stateCode ? stateCode.trim() : '',
      description: description ? description.trim() : '',
      cloudinaryKey: cloudinaryResult.key, // Store Cloudinary public_id
      cloudinaryUrl: cloudinaryResult.url, // Store Cloudinary secure_url
      createdBy: req.superAdmin._id,
      displayOrder: parseInt(displayOrder) || 0,
      isActive: true // Explicitly set to active
    });

    await locale.save();

    // Return locale with all fields for frontend
    const localeResponse = await Locale.findById(locale._id)
      .select('name country countryCode stateProvince stateCode description cloudinaryUrl imageUrl isActive displayOrder _id createdAt')
      .lean();
    
    // Ensure backward compatibility
    if (localeResponse) {
      localeResponse.imageUrl = localeResponse.cloudinaryUrl || localeResponse.imageUrl;
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
    if (error.message?.includes('Invalid API key') || error.message?.includes('Invalid credentials')) {
      return sendError(res, 'SRV_6002', 'Cloudinary credentials are invalid. Please check CLOUDINARY_API_KEY and CLOUDINARY_API_SECRET.');
    }
    
    if (error.message?.includes('Cloud name') || error.message?.includes('cloud_name')) {
      return sendError(res, 'SRV_6002', 'Cloudinary cloud name is invalid. Please check CLOUDINARY_CLOUD_NAME.');
    }
    
    if (error.http_code === 401 || error.http_code === 403) {
      return sendError(res, 'SRV_6002', 'Cloudinary authentication failed. Please verify your API credentials.');
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

    // Delete from Cloudinary
    try {
      const keyToDelete = locale.cloudinaryKey || locale.imageKey; // Use new field if available, fallback to legacy
      if (keyToDelete) {
        await deleteLocaleImage(keyToDelete);
      }
    } catch (cloudinaryError) {
      logger.error('Error deleting from Cloudinary:', cloudinaryError);
      // Continue with database deletion even if Cloudinary deletion fails
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
      locale.displayOrder = orderNum;
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

