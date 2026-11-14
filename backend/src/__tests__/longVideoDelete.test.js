/**
 * Unit tests for long video deletion (creator + admin).
 */

const mockFindOne = jest.fn();
const mockFindByIdAndDelete = jest.fn();
jest.mock('../models/Post', () => ({
  findOne: (...args) => mockFindOne(...args),
  findByIdAndDelete: (...args) => mockFindByIdAndDelete(...args),
}));

const mockCascadeDeletePost = jest.fn();
jest.mock('../utils/cascadeDelete', () => ({
  cascadeDeletePost: (...args) => mockCascadeDeletePost(...args),
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

const { deleteOwnLongVideo, deleteLongVideo } = require('../controllers/longVideoController');

const VIDEO_ID = '658428800000000000000001';
const OWNER_ID = '658428800000000000000002';
const OTHER_ID = '658428800000000000000003';

const makeRes = () => ({
  status: jest.fn().mockReturnThis(),
  json: jest.fn().mockReturnThis(),
});

const makeVideo = () => ({
  _id: VIDEO_ID,
  type: 'long_video',
  user: { toString: () => OWNER_ID },
});

describe('Long video deletion', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockCascadeDeletePost.mockResolvedValue(undefined);
    mockFindByIdAndDelete.mockResolvedValue(null);
  });

  it('lets the creator permanently delete their own video', async () => {
    mockFindOne.mockResolvedValue(makeVideo());
    const res = makeRes();

    await deleteOwnLongVideo({ params: { id: VIDEO_ID }, user: { _id: OWNER_ID } }, res);

    expect(mockCascadeDeletePost).toHaveBeenCalledWith(VIDEO_ID, expect.anything());
    expect(mockFindByIdAndDelete).toHaveBeenCalledWith(VIDEO_ID);
    expect(res.status).toHaveBeenCalledWith(200);
  });

  it("refuses to delete someone else's video", async () => {
    mockFindOne.mockResolvedValue(makeVideo());
    const res = makeRes();

    await deleteOwnLongVideo({ params: { id: VIDEO_ID }, user: { _id: OTHER_ID } }, res);

    expect(mockCascadeDeletePost).not.toHaveBeenCalled();
    expect(mockFindByIdAndDelete).not.toHaveBeenCalled();
    expect(res.status).not.toHaveBeenCalledWith(200);
  });

  it('returns not found for an invalid id without touching the database', async () => {
    const res = makeRes();

    await deleteOwnLongVideo({ params: { id: 'not-an-id' }, user: { _id: OWNER_ID } }, res);

    expect(mockFindOne).not.toHaveBeenCalled();
    expect(res.status).not.toHaveBeenCalledWith(200);
  });

  it('lets an admin permanently delete any long video', async () => {
    mockFindOne.mockResolvedValue(makeVideo());
    const logSecurityEvent = jest.fn().mockResolvedValue(undefined);
    const res = makeRes();

    await deleteLongVideo(
      {
        params: { id: VIDEO_ID },
        superAdmin: { _id: 'admin1', logSecurityEvent },
        ip: '127.0.0.1',
        get: () => 'jest',
      },
      res
    );

    expect(mockFindByIdAndDelete).toHaveBeenCalledWith(VIDEO_ID);
    expect(logSecurityEvent).toHaveBeenCalledWith(
      'content_deleted',
      `Deleted long video: ${VIDEO_ID}`,
      '127.0.0.1',
      'jest',
      true
    );
    expect(res.status).toHaveBeenCalledWith(200);
  });
});
