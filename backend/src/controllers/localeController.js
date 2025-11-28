const Locale = require('../models/Locale');
const { uploadLocaleImage, deleteLocaleImage } = require('../config/s3');
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
      .select('name country countryCode stateProvince stateCode description imageUrl isActive displayOrder _id createdAt')
      .sort({ displayOrder: 1, createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit))
      .lean();

    const total = await Locale.countDocuments(query);

    return sendSuccess(res, 200, 'Locales fetched successfully', {
      locales,
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
      .select('name country countryCode stateProvince stateCode description imageUrl isActive displayOrder _id createdAt')
      .lean();

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

    // Check AWS configuration
    if (!process.env.AWS_ACCESS_KEY_ID || !process.env.AWS_SECRET_ACCESS_KEY || !process.env.AWS_S3_BUCKET_NAME) {
      logger.error('AWS configuration missing');
      return sendError(res, 'SRV_6002', 'AWS S3 is not configured. Please check environment variables.');
    }

    logger.debug('Uploading to S3...');
    // Upload to S3
    const s3Result = await uploadLocaleImage(
      req.file.buffer,
      req.file.originalname,
      req.file.mimetype
    );
    logger.debug('S3 upload successful:', { key: s3Result.key, url: s3Result.url });

    // Save to database
    const locale = new Locale({
      name: name.trim(),
      country: country.trim(),
      countryCode: countryCode.trim().toUpperCase(),
      stateProvince: stateProvince ? stateProvince.trim() : '',
      stateCode: stateCode ? stateCode.trim() : '',
      description: description ? description.trim() : '',
      imageKey: s3Result.key,
      imageUrl: s3Result.url,
      createdBy: req.superAdmin._id,
      displayOrder: parseInt(displayOrder) || 0,
      isActive: true // Explicitly set to active
    });

    await locale.save();

    // Return locale with all fields for frontend
    const localeResponse = await Locale.findById(locale._id)
      .select('name country countryCode stateProvince stateCode description imageUrl isActive displayOrder _id createdAt')
      .lean();

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
    if (error.code === 'AccessControlListNotSupported') {
      return sendError(res, 'SRV_6002', 'S3 bucket does not allow ACLs. The bucket must use "Bucket owner enforced" (ACLs disabled). Please check bucket settings and ensure upload code does not use ACL parameters.');
    }
    
    if (error.code === 'ENOENT' || error.message?.includes('NoSuchBucket')) {
      return sendError(res, 'SRV_6002', 'S3 bucket configuration error. Please check AWS credentials and bucket name.');
    }
    
    if (error.code === 'InvalidAccessKeyId' || error.code === 'SignatureDoesNotMatch') {
      return sendError(res, 'SRV_6002', 'AWS credentials are invalid. Please check AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY.');
    }
    
    if (error.code === 'NoSuchBucket' || error.message?.includes('bucket')) {
      return sendError(res, 'SRV_6002', `S3 bucket "${process.env.AWS_S3_BUCKET_NAME}" not found. Please check AWS_S3_BUCKET_NAME.`);
    }
    
    if (error.message?.includes('AWS_CLOUDFRONT_URL')) {
      return sendError(res, 'SRV_6002', 'CloudFront URL is required for private bucket access. Please set AWS_CLOUDFRONT_URL in environment variables.');
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

    // Delete from S3
    try {
      await deleteLocaleImage(locale.imageKey);
    } catch (s3Error) {
      logger.error('Error deleting from S3:', s3Error);
      // Continue with database deletion even if S3 deletion fails
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

