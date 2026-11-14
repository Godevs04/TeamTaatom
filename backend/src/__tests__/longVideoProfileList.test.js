/**
 * Unit tests for listing a user's long videos on their profile.
 */

const mockPostFind = jest.fn();
const mockPostCount = jest.fn();
jest.mock('../models/Post', () => ({
  find: (...args) => mockPostFind(...args),
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

jest.mock('../utils/cache', () => ({
  deleteCache: jest.fn().mockResolvedValue(true),
  deleteCacheByPattern: jest.fn().mockResolvedValue(0),
  claimKey: jest.fn().mockResolvedValue(true),
  CacheKeys: { post: (id) => `post:${id}` },
}));

jest.mock('../socket', () => ({ getIO: () => null }));
jest.mock('../utils/socketBus', () => ({ getFollowers: jest.fn().mockResolvedValue([]) }));
jest.mock('../utils/logger', () => ({
  info: jest.fn(),
  debug: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
}));

const { listUserLongVideos } = require('../controllers/longVideoController');

const OWNER_ID = '658428800000000000000002';
const VIEWER_ID = '658428800000000000000003';

const makeRes = () => ({
  status: jest.fn().mockReturnThis(),
  json: jest.fn().mockReturnThis(),
});

const ownerWithVisibility = (profileVisibility) => ({
  select: () => ({ lean: () => Promise.resolve({ _id: OWNER_ID, settings: { privacy: { profileVisibility } } }) }),
});

const emptyQuery = () => ({
  sort: () => ({ skip: () => ({ limit: () => ({ populate: () => ({ lean: () => Promise.resolve([]) }) }) }) }),
});

const listedVideos = (res) => res.json.mock.calls[0][0].videos;

describe('Profile long video list', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockPostFind.mockReturnValue(emptyQuery());
    mockPostCount.mockResolvedValue(0);
  });

  it('hides a private creator\'s videos from viewers who do not follow them', async () => {
    mockUserFindById.mockReturnValue(ownerWithVisibility('private'));
    mockFollowExists.mockResolvedValue(null);
    const res = makeRes();

    await listUserLongVideos({ params: { userId: OWNER_ID }, query: {}, user: { _id: VIEWER_ID } }, res);

    expect(mockPostFind).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(200);
    expect(listedVideos(res)).toEqual([]);
  });

  it('shows a private creator\'s videos to followers', async () => {
    mockUserFindById.mockReturnValue(ownerWithVisibility('followers'));
    mockFollowExists.mockResolvedValue({ _id: 'follow1' });
    const res = makeRes();

    await listUserLongVideos({ params: { userId: OWNER_ID }, query: {}, user: { _id: VIEWER_ID } }, res);

    expect(mockPostFind).toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(200);
  });

  it('always shows creators their own videos', async () => {
    mockUserFindById.mockReturnValue(ownerWithVisibility('private'));
    const res = makeRes();

    await listUserLongVideos({ params: { userId: OWNER_ID }, query: {}, user: { _id: OWNER_ID } }, res);

    expect(mockFollowExists).not.toHaveBeenCalled();
    expect(mockPostFind).toHaveBeenCalled();
  });
});
