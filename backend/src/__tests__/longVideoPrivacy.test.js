/**
 * Long videos must follow the same profileVisibility rules as posts and shorts:
 * public → anyone; followers/private → followers (and the owner) only.
 */

const mockPostFind = jest.fn();
const mockPostFindOne = jest.fn();
const mockPostCount = jest.fn();
jest.mock('../models/Post', () => ({
  find: (...args) => mockPostFind(...args),
  findOne: (...args) => mockPostFindOne(...args),
  countDocuments: (...args) => mockPostCount(...args),
}));

const mockUserFindById = jest.fn();
jest.mock('../models/User', () => ({
  findById: (...args) => mockUserFindById(...args),
}));

const mockFollowExists = jest.fn();
jest.mock('../models/Follow', () => ({
  exists: (...args) => mockFollowExists(...args),
}));

jest.mock('../models/Like', () => ({
  find: jest.fn().mockReturnValue({ select: () => ({ lean: () => Promise.resolve([]) }) }),
  exists: jest.fn().mockResolvedValue(null),
}));

const mockGetAllowedPostAuthorIds = jest.fn();
const mockGetBidirectionalBlockedIds = jest.fn();
jest.mock('../controllers/postController', () => ({
  getAllowedPostAuthorIds: (...args) => mockGetAllowedPostAuthorIds(...args),
  getBidirectionalBlockedIds: (...args) => mockGetBidirectionalBlockedIds(...args),
}));

jest.mock('../utils/cache', () => ({
  deleteCache: jest.fn().mockResolvedValue(true),
  deleteCacheByPattern: jest.fn().mockResolvedValue(0),
  claimKey: jest.fn().mockResolvedValue(true),
  CacheKeys: { post: (id) => `post:${id}` },
}));

jest.mock('../services/viewWindow', () => ({
  findRecentView: jest.fn().mockResolvedValue(null),
  LONG_VIDEO_VIEW_WINDOW_MS: 8 * 60 * 60 * 1000,
}));

jest.mock('../socket', () => ({ getIO: () => null }));
jest.mock('../utils/socketBus', () => ({ getFollowers: jest.fn().mockResolvedValue([]) }));
jest.mock('../utils/logger', () => ({
  info: jest.fn(),
  debug: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
}));

const { listLongVideos, getLongVideo } = require('../controllers/longVideoController');

const OWNER_ID = '658428800000000000000002';
const VIEWER_ID = '658428800000000000000003';
const VIDEO_ID = '658428800000000000000001';

const makeRes = () => ({
  status: jest.fn().mockReturnThis(),
  json: jest.fn().mockReturnThis(),
});

const emptyListQuery = () => ({
  sort: () => ({
    skip: () => ({
      limit: () => ({
        populate: () => ({ lean: () => Promise.resolve([]) }),
      }),
    }),
  }),
});

const authorLean = (profileVisibility = 'private', blockedUsers = []) => ({
  select: () => ({
    lean: () =>
      Promise.resolve({
        _id: OWNER_ID,
        settings: { privacy: { profileVisibility } },
        blockedUsers,
      }),
  }),
});

describe('Videos feed privacy', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockPostFind.mockReturnValue(emptyListQuery());
    mockPostCount.mockResolvedValue(0);
    mockGetBidirectionalBlockedIds.mockResolvedValue([]);
  });

  it('only queries authors the viewer is allowed to see', async () => {
    mockGetAllowedPostAuthorIds.mockResolvedValue([OWNER_ID]);
    const res = makeRes();

    await listLongVideos({ query: {}, user: { _id: VIEWER_ID } }, res);

    expect(mockGetAllowedPostAuthorIds).toHaveBeenCalledWith(VIEWER_ID);
    const match = mockPostFind.mock.calls[0][0];
    expect(match.user.$in).toHaveLength(1);
    expect(String(match.user.$in[0])).toBe(OWNER_ID);
    expect(res.status).toHaveBeenCalledWith(200);
  });

  it('excludes blocked authors from the feed', async () => {
    mockGetAllowedPostAuthorIds.mockResolvedValue([OWNER_ID, VIEWER_ID]);
    mockGetBidirectionalBlockedIds.mockResolvedValue([OWNER_ID]);
    const res = makeRes();

    await listLongVideos({ query: {}, user: { _id: VIEWER_ID } }, res);

    const match = mockPostFind.mock.calls[0][0];
    expect(match.user.$in.map(String)).not.toContain(OWNER_ID);
  });
});

describe('Single long video privacy', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('hides a private creator video from non-followers', async () => {
    mockPostFindOne.mockReturnValue({
      populate: () => ({
        populate: () => ({
          lean: () =>
            Promise.resolve({
              _id: VIDEO_ID,
              type: 'long_video',
              user: { _id: OWNER_ID },
            }),
        }),
      }),
    });
    mockUserFindById.mockReturnValue(authorLean('private'));
    mockFollowExists.mockResolvedValue(null);
    const res = makeRes();

    await getLongVideo({ params: { id: VIDEO_ID }, user: { _id: VIEWER_ID } }, res);

    expect(res.status).not.toHaveBeenCalledWith(200);
    expect(res.json.mock.calls[0][0].success).toBe(false);
  });

  it('lets followers watch a followers-only creator video', async () => {
    mockPostFindOne.mockReturnValue({
      populate: () => ({
        populate: () => ({
          lean: () =>
            Promise.resolve({
              _id: VIDEO_ID,
              type: 'long_video',
              user: { _id: OWNER_ID, username: 'creator' },
              caption: 'Trail',
              durationSeconds: 12,
            }),
        }),
      }),
    });
    mockUserFindById.mockReturnValue(authorLean('followers'));
    mockFollowExists.mockResolvedValue({ _id: 'follow1' });
    const res = makeRes();

    await getLongVideo({ params: { id: VIDEO_ID }, user: { _id: VIEWER_ID } }, res);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json.mock.calls[0][0].video._id).toBe(VIDEO_ID);
  });

  it('always lets the creator open their own video', async () => {
    mockPostFindOne.mockReturnValue({
      populate: () => ({
        populate: () => ({
          lean: () =>
            Promise.resolve({
              _id: VIDEO_ID,
              type: 'long_video',
              user: { _id: OWNER_ID },
              caption: 'Mine',
              durationSeconds: 9,
            }),
        }),
      }),
    });
    const res = makeRes();

    await getLongVideo({ params: { id: VIDEO_ID }, user: { _id: OWNER_ID } }, res);

    expect(mockFollowExists).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(200);
  });
});
