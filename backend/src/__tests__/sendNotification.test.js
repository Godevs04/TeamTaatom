/**
 * Unit tests for push notification routing and delivery rules.
 */

const mockUserFindById = jest.fn();
jest.mock('../models/User', () => ({
  findById: (...args) => mockUserFindById(...args),
}));

const mockCountDocuments = jest.fn();
jest.mock('../models/Notification', () => ({
  countDocuments: (...args) => mockCountDocuments(...args),
}));

jest.mock('../config/firebase', () => ({
  getAdmin: () => null,
  isInitialized: () => false,
}));

const mockFetch = jest.fn();
global.fetch = (...args) => mockFetch(...args);

jest.mock('../utils/logger', () => ({
  info: jest.fn(),
  debug: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
}));

const { getScreenForType, isWithinQuietHours, sendNotificationToUser } = require('../utils/sendNotification');

const POST_ID = '658428800000000000000001';
const OWNER_ID = '658428800000000000000002';
const SENDER_ID = '658428800000000000000003';
const EXPO_TOKEN = 'ExponentPushToken[test]';

const userWithSettings = (notifications = {}) => ({
  select: () => ({
    lean: () => Promise.resolve({ _id: OWNER_ID, expoPushToken: EXPO_TOKEN, settings: { notifications } }),
  }),
});

const sentPayload = () => JSON.parse(mockFetch.mock.calls[0][1].body);

describe('getScreenForType', () => {
  it('opens long video comments in the watch screen', () => {
    expect(getScreenForType('comment', { postId: POST_ID, postType: 'long_video' }))
      .toBe(`/watch/${POST_ID}?comments=1`);
  });

  it('opens a liked short in the creator\'s shorts viewer', () => {
    expect(getScreenForType('like', { postId: POST_ID, postType: 'short', postOwnerId: OWNER_ID }))
      .toBe(`/user-shorts/${OWNER_ID}?shortId=${POST_ID}&single=true`);
  });

  it('opens photo posts on the post screen', () => {
    expect(getScreenForType('like', { postId: POST_ID, postType: 'photo' })).toBe(`/post/${POST_ID}`);
  });

  it('opens comments only for comment mentions, not caption mentions', () => {
    expect(getScreenForType('post_mention', { postId: POST_ID, postType: 'photo', commentId: 'c1' }))
      .toBe(`/post/${POST_ID}?comments=1`);
    expect(getScreenForType('post_mention', { postId: POST_ID, postType: 'photo' })).toBe(`/post/${POST_ID}`);
  });

  it('opens the right chat for direct and group messages', () => {
    expect(getScreenForType('message', { chatWith: SENDER_ID })).toBe(`/chat/thread?userId=${SENDER_ID}`);
    expect(getScreenForType('message', { chatId: 'room1' })).toBe('/chat/thread?chatId=room1');
  });

  it('routes requests and profile events to their screens', () => {
    expect(getScreenForType('route_access_request', {})).toBe('/settings/route-access-requests');
    expect(getScreenForType('follow', { fromUserId: SENDER_ID })).toBe(`/profile/${SENDER_ID}`);
    expect(getScreenForType('route_access_approved', { senderId: SENDER_ID })).toBe(`/profile/${SENDER_ID}`);
  });
});

describe('isWithinQuietHours', () => {
  const overnight = {
    enabled: true,
    startTime: '22:00',
    endTime: '08:00',
    days: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'],
    timezone: 'Asia/Kolkata',
  };

  it('silences pushes overnight in the user\'s own timezone', () => {
    // 23:30 IST on a Friday
    expect(isWithinQuietHours(overnight, new Date('2026-11-13T18:00:00Z'))).toBe(true);
    // 06:00 IST the next morning
    expect(isWithinQuietHours(overnight, new Date('2026-11-14T00:30:00Z'))).toBe(true);
  });

  it('allows pushes outside quiet hours', () => {
    // 13:00 IST
    expect(isWithinQuietHours(overnight, new Date('2026-11-14T07:30:00Z'))).toBe(false);
  });

  it('only applies on the selected days, counting overnight ranges from their start day', () => {
    const fridayOnly = { ...overnight, days: ['friday'] };
    // 06:00 IST Saturday belongs to Friday night's range
    expect(isWithinQuietHours(fridayOnly, new Date('2026-11-14T00:30:00Z'))).toBe(true);
    // 23:30 IST Saturday starts a Saturday night range
    expect(isWithinQuietHours(fridayOnly, new Date('2026-11-14T18:00:00Z'))).toBe(false);
  });

  it('does nothing when disabled or when the timezone is unknown', () => {
    const night = new Date('2026-11-13T18:00:00Z');
    expect(isWithinQuietHours({ ...overnight, enabled: false }, night)).toBe(false);
    expect(isWithinQuietHours({ ...overnight, timezone: null }, night)).toBe(false);
  });
});

describe('sendNotificationToUser', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockCountDocuments.mockResolvedValue(3);
    mockFetch.mockResolvedValue({ ok: true, json: () => Promise.resolve({ data: { status: 'ok' } }) });
  });

  it('sends the content-aware screen and unread badge', async () => {
    mockUserFindById.mockReturnValue(userWithSettings());

    const sent = await sendNotificationToUser({
      userId: OWNER_ID,
      title: 'Asha',
      body: 'Commented on your video: nice',
      data: { type: 'comment', postId: POST_ID, postType: 'long_video', entityId: POST_ID, senderId: SENDER_ID },
    });

    expect(sent).toBe(true);
    const payload = sentPayload();
    expect(payload.data.screen).toBe(`/watch/${POST_ID}?comments=1`);
    expect(payload.data.postType).toBe('long_video');
    expect(payload.badge).toBe(3);
  });

  it('respects the push master switch', async () => {
    mockUserFindById.mockReturnValue(userWithSettings({ pushNotifications: false }));

    const sent = await sendNotificationToUser({
      userId: OWNER_ID, title: 't', body: 'b', data: { type: 'like', postId: POST_ID },
    });

    expect(sent).toBe(false);
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('respects the messages switch for chat pushes', async () => {
    mockUserFindById.mockReturnValue(userWithSettings({ messagesNotifications: false }));

    const sent = await sendNotificationToUser({
      userId: OWNER_ID, title: 't', body: 'b', data: { type: 'message', chatWith: SENDER_ID },
    });

    expect(sent).toBe(false);
    expect(mockFetch).not.toHaveBeenCalled();
  });
});
