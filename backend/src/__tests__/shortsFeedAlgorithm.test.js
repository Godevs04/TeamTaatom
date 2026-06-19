// Mock Models

const mockPostFind = jest.fn();
const mockPostFindById = jest.fn();
const mockPostSave = jest.fn();
const mockUserInteractionFindOne = jest.fn();
const mockUserInteractionSave = jest.fn();

jest.mock('../models/Post', () => {
  const PostMock = function(data) {
    Object.assign(this, data);
    this.save = mockPostSave;
  };
  PostMock.find = (...args) => {
    const query = {
      populate: jest.fn().mockReturnThis(),
      sort: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis(),
      lean: jest.fn().mockImplementation(() => {
        return Promise.resolve(mockPostFind(...args) || []);
      })
    };
    return query;
  };
  PostMock.findById = (...args) => {
    return {
      populate: jest.fn().mockReturnThis(),
      exec: jest.fn().mockImplementation(() => Promise.resolve(mockPostFindById(...args))),
      then: function(resolve, reject) {
        return Promise.resolve(mockPostFindById(...args)).then(resolve, reject);
      }
    };
  };
  return PostMock;
});

jest.mock('../models/UserInteraction', () => {
  const UserInteractionMock = function(data) {
    Object.assign(this, data);
    this.save = mockUserInteractionSave;
  };
  UserInteractionMock.findOne = (...args) => {
    return mockUserInteractionFindOne(...args);
  };
  return UserInteractionMock;
});

jest.mock('../models/User', () => {
  return {
    find: jest.fn().mockReturnValue({
      select: jest.fn().mockReturnValue({
        lean: jest.fn().mockResolvedValue([])
      })
    })
  };
});
jest.mock('../models/Like', () => {
  return {
    find: jest.fn().mockReturnValue({
      lean: jest.fn().mockResolvedValue([])
    }),
    exists: jest.fn().mockResolvedValue(false)
  };
});

jest.mock('../models/Follow', () => {
  return {
    find: jest.fn().mockReturnValue({
      lean: jest.fn().mockResolvedValue([])
    }),
    exists: jest.fn().mockResolvedValue(false)
  };
});

jest.mock('../utils/logger', () => ({
  info: jest.fn(),
  error: jest.fn().mockImplementation((...args) => console.log('LOGGER ERROR:', ...args)),
  warn: jest.fn(),
  debug: jest.fn()
}));

jest.mock('../utils/cache', () => ({
  deleteCacheByPattern: jest.fn().mockResolvedValue(true),
  deleteCache: jest.fn().mockResolvedValue(true),
  CacheKeys: {
    userPosts: (userId, page, limit) => `user-posts:${userId}:${page}:${limit}`
  }
}));

// Mock other dependencies of postController
jest.mock('../services/tripVisitService', () => ({
  createTripVisitFromShort: jest.fn().mockResolvedValue(true)
}));

jest.mock('../utils/errorCodes', () => ({
  sendSuccess: (res, status, message, data) => res.status(status).json({ success: true, message, ...data }),
  sendError: (res, code, message) => res.status(400).json({ success: false, error: { code, message } })
}));

// Import modules to test
const { extractAITags } = require('../utils/aiTagExtractor');
const { getShorts } = require('../controllers/postController');
const { recordInteraction } = require('../controllers/telemetryController');

// Mock Express response
const mockRes = () => {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
};

describe('Shorts Feed Algorithm & AI Tag Extraction', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('AI Tag Extraction Utility', () => {
    it('should extract correct tags for solo adventure mountain bike ride', () => {
      const caption = "Solo bike ride through the Himalayas trek camping #fun";
      const tags = extractAITags(caption);
      
      expect(tags).toContain('travel');
      expect(tags).toContain('solo');
      expect(tags).toContain('bike');
      expect(tags).toContain('adventure');
      expect(tags).toContain('mountains');
      expect(tags).toContain('hiking');
      expect(tags).toContain('camping');
      expect(tags).toContain('fun'); // extracted from #fun
    });

    it('should extract food and cooking tags from recipe caption', () => {
      const caption = "A delicious recipe for dinner tonight, cooking at home!";
      const tags = extractAITags(caption);
      
      expect(tags).toContain('food');
      expect(tags).toContain('cuisine');
      expect(tags).toContain('cooking');
    });

    it('should return empty array for empty or invalid input', () => {
      expect(extractAITags("")).toEqual([]);
      expect(extractAITags(null)).toEqual([]);
      expect(extractAITags(undefined)).toEqual([]);
    });
  });

  describe('getShorts Controller (Blended Feed Recommendation)', () => {
    let req, res;
    const mockPost1 = {
      _id: 'post11111111111111111111',
      createdAt: new Date(Date.now() - 3600000), // 1 hour ago
      tags: ['travel', 'mountains'],
      likes: [],
      views: 10,
      user: { _id: 'userA', fullName: 'User A', followers: [] },
      videoUrl: 'http://test.com/video1.mp4'
    };
    const mockPost2 = {
      _id: 'post22222222222222222222',
      createdAt: new Date(Date.now() - 7200000), // 2 hours ago
      tags: ['food', 'cuisine'],
      likes: ['someUser'],
      views: 5,
      user: { _id: 'userB', fullName: 'User B', followers: [] },
      videoUrl: 'http://test.com/video2.mp4'
    };

    beforeEach(() => {
      res = mockRes();
      req = {
        query: { limit: 10 },
        user: { _id: 'viewerId123', interests: ['mountains', 'travel'] }
      };
    });

    it('should return blended feed for a personalized user (non-cold-start)', async () => {
      // Mock UserInteraction viewed posts count > 20 to trigger Personalized mode
      const mockUserInteraction = {
        viewedPosts: Array(25).fill({ postId: 'someOldPostId', viewedAt: new Date() }),
        tagAffinities: new Map([['mountains', 10], ['travel', 5]]),
        spotTypeAffinities: new Map(),
        travelInfoAffinities: new Map(),
        creatorAffinities: new Map()
      };
      
      mockUserInteractionFindOne.mockResolvedValue(mockUserInteraction);
      mockPostFind.mockReturnValue([mockPost1, mockPost2]);

      await getShorts(req, res);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalled();
      const responseData = res.json.mock.calls[0][0];
      expect(responseData.shorts).toHaveLength(2);
      expect(responseData.pagination).toBeDefined();
    });

    it('should return cold-start blend if user has viewed < 20 posts', async () => {
      const mockUserInteraction = {
        viewedPosts: Array(5).fill({ postId: 'someOldPostId', viewedAt: new Date() }),
        tagAffinities: new Map(),
        spotTypeAffinities: new Map(),
        travelInfoAffinities: new Map(),
        creatorAffinities: new Map()
      };
      
      mockUserInteractionFindOne.mockResolvedValue(mockUserInteraction);
      mockPostFind.mockReturnValue([mockPost1, mockPost2]);

      await getShorts(req, res);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalled();
    });
  });

  describe('recordInteraction Telemetry Controller', () => {
    let req, res, mockPost;

    beforeEach(() => {
      res = mockRes();
      mockPost = {
        _id: 'post11111111111111111111',
        tags: ['travel', 'mountains'],
        views: 100,
        likes: ['user1'],
        savesCount: 5,
        completionsCount: 20,
        rewatchesCount: 2,
        save: mockPostSave
      };
      req = {
        user: { _id: 'viewerId123' }
      };
    });

    it('should support single interaction object and update affinities', async () => {
      req.body = {
        postId: 'post11111111111111111111',
        interactionType: 'like'
      };

      mockPostFindById.mockResolvedValue(mockPost);
      
      const mockUserInteraction = {
        viewedPosts: [],
        tagAffinities: new Map(),
        spotTypeAffinities: new Map(),
        travelInfoAffinities: new Map(),
        creatorAffinities: new Map(),
        save: mockUserInteractionSave
      };
      mockUserInteractionFindOne.mockResolvedValue(mockUserInteraction);

      await recordInteraction(req, res);

      expect(mockPostFindById).toHaveBeenCalledWith('post11111111111111111111');
      expect(mockUserInteractionSave).toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(200);
      
      // Affinity for 'travel' and 'mountains' should be boosted (like delta is +2)
      expect(mockUserInteraction.tagAffinities.get('travel')).toBe(2);
      expect(mockUserInteraction.tagAffinities.get('mountains')).toBe(2);
    });

    it('should support array interactions and apply multiple actions', async () => {
      req.body = {
        interactions: [
          { postId: 'post11111111111111111111', action: 'view', watchDuration: 30, completionRate: 2.0 }, // view + rewatch
          { postId: 'post11111111111111111111', action: 'share' }
        ]
      };

      mockPostFindById.mockResolvedValue(mockPost);
      
      const mockUserInteraction = {
        viewedPosts: [],
        tagAffinities: new Map(),
        spotTypeAffinities: new Map(),
        travelInfoAffinities: new Map(),
        creatorAffinities: new Map(),
        save: mockUserInteractionSave
      };
      mockUserInteractionFindOne.mockResolvedValue(mockUserInteraction);

      await recordInteraction(req, res);

      expect(mockPostFindById).toHaveBeenCalledTimes(2);
      expect(mockPostSave).toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(200);
    });
  });
});
