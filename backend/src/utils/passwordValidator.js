/**
 * Password strength validator
 * Validates password strength and returns detailed feedback
 */

/**
 * Check password strength
 * @param {string} password - Password to validate
 * @returns {Object} - { isValid: boolean, strength: string, feedback: string[], score: number }
 */
const validatePasswordStrength = (password) => {
  const feedback = [];
  let score = 0;

  // Minimum length check
  if (password.length < 8) {
    feedback.push('Password must be at least 8 characters long');
    return {
      isValid: false,
      strength: 'weak',
      feedback,
      score: 0
    };
  } else {
    score += 1;
  }

  // Check for uppercase letter
  if (!/[A-Z]/.test(password)) {
    feedback.push('Add at least one uppercase letter');
  } else {
    score += 1;
  }

  // Check for lowercase letter
  if (!/[a-z]/.test(password)) {
    feedback.push('Add at least one lowercase letter');
  } else {
    score += 1;
  }

  // Check for number
  if (!/[0-9]/.test(password)) {
    feedback.push('Add at least one number');
  } else {
    score += 1;
  }

  // Check for special character
  if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) {
    feedback.push('Add at least one special character (!@#$%^&*...)');
  } else {
    score += 1;
  }

  // Check for common patterns (optional - can be enhanced)
  const commonPatterns = [
    /123456/,
    /password/i,
    /qwerty/i,
    /abc123/i,
    /admin/i
  ];

  if (commonPatterns.some(pattern => pattern.test(password))) {
    feedback.push('Avoid common passwords');
    score = Math.max(0, score - 1);
  }

  // Determine strength
  let strength = 'weak';
  if (score >= 5 && password.length >= 12) {
    strength = 'strong';
  } else if (score >= 4) {
    strength = 'medium';
  }

  return {
    isValid: feedback.length === 0,
    strength,
    feedback,
    score
  };
};

/**
 * Express validator middleware for password strength
 */
const passwordStrengthValidator = (req, res, next) => {
  const { password } = req.body;

  if (!password) {
    return next(); // Let express-validator handle required check
  }

  const validation = validatePasswordStrength(password);

  if (!validation.isValid) {
    return res.status(400).json({
      error: 'Weak password',
      message: 'Password does not meet security requirements',
      details: validation.feedback,
      strength: validation.strength
    });
  }

  // Attach password strength info to request (optional, for logging)
  req.passwordStrength = validation.strength;
  next();
};

module.exports = {
  validatePasswordStrength,
  passwordStrengthValidator
};

