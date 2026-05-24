/**
 * Unit tests for view tracking cooldown logic.
 */

const mockInsertMany = jest.fn();
const mockFindOne = jest.fn();
jest.mock('../models/AnalyticsEvent', () => {
  return {
    insertMany: (...args) => mockInsertMany(...args),
    findOne: (...args) => mockFindOne(...args)
  };
});

const mockFindById = jest.fn();
jest.mock('../models/Post', () => {
  return {
    findById: (...args) => mockFindById(...args)
  };
});

jest.mock('../utils/logger', () => ({
  info: jest.fn(),
  debug: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
}));

jest.mock('../utils/cache', () => ({
  deleteCache: jest.fn().mockResolvedValue(true),
  CacheKeys: {
    post: (id) => `post:${id}`
  }
}));

const { trackEvents } = require('../controllers/analyticsController');

describe('Views Cooldown & 2-Second Rule Tracking', () => {
  let mockRes;

  beforeEach(() => {
    jest.clearAllMocks();
    mockRes = {
      json: jest.fn(),
      status: jest.fn().mockReturnThis(),
    };
  });

  it('should increment view count and invalidate cache for a fresh view event', async () => {
    const mockPostId = '658428800000000000000001';
    const mockUserId = '658428800000000000000002';
    const mockEvent = {
      event: 'post_view',
      userId: mockUserId,
      properties: { post_id: mockPostId },
      timestamp: new Date(),
    };

    const mockPost = {
      _id: mockPostId,
      views: 10,
      save: jest.fn().mockResolvedValue(true),
    };

    mockInsertMany.mockResolvedValue([mockEvent]);
    mockFindById.mockResolvedValue(mockPost);
    mockFindOne.mockResolvedValue(null); // No existing view in cooldown window

    const mockReq = {
      body: { events: [mockEvent] },
      user: { id: mockUserId },
    };

    await trackEvents(mockReq, mockRes);

    expect(mockFindOne).toHaveBeenCalled();
    expect(mockPost.views).toBe(11);
    expect(mockPost.save).toHaveBeenCalled();
    expect(mockRes.json).toHaveBeenCalledWith(expect.objectContaining({ success: true }));
  });

  it('should ignore the view if it is within the 8-hour cooldown period', async () => {
    const mockPostId = '658428800000000000000001';
    const mockUserId = '658428800000000000000002';
    const mockEvent = {
      event: 'post_view',
      userId: mockUserId,
      properties: { post_id: mockPostId },
      timestamp: new Date(),
    };

    const mockPost = {
      _id: mockPostId,
      views: 10,
      save: jest.fn().mockResolvedValue(true),
    };

    const mockExistingView = {
      event: 'post_view',
      userId: mockUserId,
      properties: { post_id: mockPostId },
      timestamp: new Date(Date.now() - 4 * 60 * 60 * 1000), // 4 hours ago (within 8h cooldown)
    };

    mockInsertMany.mockResolvedValue([mockEvent]);
    mockFindById.mockResolvedValue(mockPost);
    mockFindOne.mockResolvedValue(mockExistingView); // Found existing view in cooldown

    const mockReq = {
      body: { events: [mockEvent] },
      user: { id: mockUserId },
    };

    await trackEvents(mockReq, mockRes);

    expect(mockFindOne).toHaveBeenCalled();
    expect(mockPost.views).toBe(10); // Unchanged
    expect(mockPost.save).not.toHaveBeenCalled();
    expect(mockRes.json).toHaveBeenCalledWith(expect.objectContaining({ success: true }));
  });
});
