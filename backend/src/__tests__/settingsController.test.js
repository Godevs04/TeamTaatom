// Mock User and Activity models before requiring them
jest.mock('../models/User', () => {
  return {
    findByIdAndUpdate: jest.fn(),
    findById: jest.fn()
  };
});
jest.mock('../models/Activity', () => {
  return {
    updateMany: jest.fn()
  };
});
jest.mock('../utils/logger', () => ({
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
  debug: jest.fn()
}));

const { updateSettings, updateSettingCategory } = require('../controllers/settingsController');
const User = require('../models/User');
const Activity = require('../models/Activity');

const mockRes = () => {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
};

describe('Settings Controller Unit Tests', () => {
  let req;
  let res;

  beforeEach(() => {
    jest.clearAllMocks();
    res = mockRes();
    req = {
      user: { _id: 'mockUserId' }
    };
  });

  describe('updateSettings', () => {
    it('should return 400 if settings data is missing', async () => {
      req.body = {};
      await updateSettings(req, res);
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
        success: false,
        error: expect.objectContaining({
          code: 'VAL_2001'
        })
      }));
    });

    it('should filter out invalid settings and update user successfully', async () => {
      req.body = {
        settings: {
          privacy: {
            profileVisibility: 'followers',
            showLocation: true,
            shareActivity: true,
            invalidField: 'ignored'
          },
          notifications: {
            pushNotifications: false,
            emailNotifications: true,
            quietHours: {
              enabled: true,
              startTime: '22:00',
              endTime: '08:00',
              days: ['monday']
            }
          },
          account: {
            theme: 'dark'
          }
        }
      };

      const mockUpdatedUser = {
        settings: {
          privacy: { profileVisibility: 'followers', showLocation: true, shareActivity: true },
          notifications: { pushNotifications: false, emailNotifications: true },
          account: { theme: 'dark' }
        }
      };

      User.findByIdAndUpdate.mockReturnValue({
        select: jest.fn().mockResolvedValue(mockUpdatedUser)
      });
      Activity.updateMany.mockResolvedValue({});

      await updateSettings(req, res);

      expect(User.findByIdAndUpdate).toHaveBeenCalledWith(
        'mockUserId',
        {
          $set: {
            'settings.privacy.profileVisibility': 'followers',
            'settings.privacy.showLocation': true,
            'settings.privacy.shareActivity': true,
            'settings.notifications.pushNotifications': false,
            'settings.notifications.emailNotifications': true,
            'settings.notifications.quietHours.enabled': true,
            'settings.notifications.quietHours.startTime': '22:00',
            'settings.notifications.quietHours.endTime': '08:00',
            'settings.notifications.quietHours.days': ['monday'],
            'settings.account.theme': 'dark'
          }
        },
        { new: true, runValidators: true }
      );

      expect(Activity.updateMany).toHaveBeenCalledWith(
        { user: 'mockUserId' },
        { isPublic: true }
      );

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
        success: true,
        message: 'Settings updated successfully'
      }));
    });

    it('should return early with 200 if no valid settings are provided', async () => {
      req.body = {
        settings: {
          privacy: {
            invalidField: 'ignored'
          }
        }
      };

      const mockCurrentUser = {
        settings: {
          privacy: { profileVisibility: 'public' }
        }
      };

      User.findById.mockReturnValue({
        select: jest.fn().mockResolvedValue(mockCurrentUser)
      });

      await updateSettings(req, res);

      expect(User.findByIdAndUpdate).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
        success: true,
        message: 'Settings unchanged',
        settings: mockCurrentUser.settings
      }));
    });
  });

  describe('updateSettingCategory', () => {
    it('should update specific category and return success', async () => {
      req.params = { category: 'privacy' };
      req.body = {
        profileVisibility: 'private',
        showEmail: true
      };

      const mockCurrentUser = {
        settings: {
          privacy: {
            profileVisibility: 'public',
            showEmail: false
          }
        }
      };

      const mockUpdatedUser = {
        settings: {
          privacy: {
            profileVisibility: 'private',
            showEmail: true
          }
        }
      };

      User.findById.mockReturnValue({
        select: jest.fn().mockResolvedValue(mockCurrentUser)
      });
      User.findByIdAndUpdate.mockReturnValue({
        select: jest.fn().mockResolvedValue(mockUpdatedUser)
      });

      await updateSettingCategory(req, res);

      expect(User.findByIdAndUpdate).toHaveBeenCalledWith(
        'mockUserId',
        {
          $set: {
            'settings.privacy.profileVisibility': 'private',
            'settings.privacy.showEmail': true
          }
        },
        { new: true, runValidators: true }
      );

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
        success: true,
        settings: mockUpdatedUser.settings
      }));
    });
  });
});
