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

const mockAddView = jest.fn();
jest.mock('../utils/viewAggregator', () => ({
  addView: (...args) => mockAddView(...args),
}));

const { trackEvents } = require('../controllers/analyticsController');

describe('Views Cooldown & 2.5-Second Rule Tracking', () => {
  let mockRes;

  beforeEach(() => {
    jest.clearAllMocks();
    mockRes = {
      json: jest.fn(),
      status: jest.fn().mockReturnThis(),
    };
  });

  it('should queue view event in aggregator for a fresh view event', async () => {
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
    expect(mockAddView).toHaveBeenCalledWith(mockPostId);
    expect(mockRes.json).toHaveBeenCalledWith(expect.objectContaining({ success: true }));
  });

  it('should ignore the view if it is within the 24-hour cooldown period', async () => {
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
    };

    const mockExistingView = {
      event: 'post_view',
      userId: mockUserId,
      properties: { post_id: mockPostId },
      timestamp: new Date(Date.now() - 12 * 60 * 60 * 1000), // 12 hours ago (within 24h cooldown)
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
    expect(mockAddView).not.toHaveBeenCalled();
    expect(mockRes.json).toHaveBeenCalledWith(expect.objectContaining({ success: true }));
  });

  const cooldownWindowMsFor = async (postType) => {
    const mockPostId = '658428800000000000000001';
    const timestamp = new Date('2026-11-02T12:00:00.000Z');
    mockInsertMany.mockResolvedValue([]);
    mockFindById.mockResolvedValue({ _id: mockPostId, type: postType, views: 0 });
    mockFindOne.mockResolvedValue(null);

    await trackEvents(
      {
        body: { events: [{ event: 'post_view', properties: { post_id: mockPostId }, timestamp }] },
        user: { id: '658428800000000000000002' },
      },
      mockRes
    );

    const { timestamp: range } = mockFindOne.mock.calls[0][0];
    return range.$lt.getTime() - range.$gte.getTime();
  };

  it('uses an 8-hour per-viewer window for long videos', async () => {
    expect(await cooldownWindowMsFor('long_video')).toBe(8 * 60 * 60 * 1000);
  });

  it('keeps the 24-hour per-viewer window for photo posts and shorts', async () => {
    expect(await cooldownWindowMsFor('short')).toBe(24 * 60 * 60 * 1000);
  });

  it('counts a long video view again once the 8-hour window has passed', async () => {
    const mockPostId = '658428800000000000000001';
    mockInsertMany.mockResolvedValue([]);
    mockFindById.mockResolvedValue({ _id: mockPostId, type: 'long_video', views: 3 });
    // A view 9h ago falls outside the 8h query range, so the lookup finds nothing.
    mockFindOne.mockResolvedValue(null);

    await trackEvents(
      {
        body: { events: [{ event: 'post_view', properties: { post_id: mockPostId }, timestamp: new Date() }] },
        user: { id: '658428800000000000000002' },
      },
      mockRes
    );

    expect(mockAddView).toHaveBeenCalledWith(mockPostId);
  });
});
