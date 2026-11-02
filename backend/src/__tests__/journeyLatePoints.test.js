/**
 * A slow network can deliver a newer batch of GPS points before an older one. The older
 * points used to be read as impossible-speed jumps and dropped, so the saved route drew a
 * straight line across that stretch.
 */

const mockFindById = jest.fn();
jest.mock('../models/Journey', () => ({ findById: (...args) => mockFindById(...args) }));
jest.mock('../models/Post', () => ({}));
jest.mock('../models/User', () => ({}));
jest.mock('../models/Follow', () => ({}));
jest.mock('../services/mediaService', () => ({ generateSignedUrl: jest.fn() }));
jest.mock('../services/tripVisitService', () => ({ recalculateJourneyTripScore: jest.fn().mockResolvedValue(0) }));
jest.mock('../utils/logger', () => ({ info: jest.fn(), debug: jest.fn(), warn: jest.fn(), error: jest.fn() }));
// Snapping returns the points unchanged so the test sees exactly what was stored.
jest.mock('../utils/mapMatcher', () => ({
  matchTrajectory: jest.fn(async (points) => points.map((p) => ({ lat: p.lat, lng: p.lng, source: 'matched', confidence: 1, matchDistance: 0 }))),
}));

const { updateLocation, completeJourney } = require('../controllers/journeyController');

const USER_ID = '658428800000000000000002';
const JOURNEY_ID = '658428800000000000000001';
const START = Date.parse('2026-11-01T13:15:00Z');

// ~20 m north per point, one point every 2 s (~36 km/h): a 30-point straight drive.
const route = Array.from({ length: 30 }, (_, i) => ({
  lat: 51.48 + i * 0.00018,
  lng: -2.55,
  timestamp: new Date(START + i * 2000).toISOString(),
  accuracy: 5,
}));

const makeJourney = () => ({
  _id: JOURNEY_ID,
  user: { toString: () => USER_ID },
  status: 'active',
  raw_polyline: [],
  snapped_polyline: [],
  sessions: [{ startedAt: new Date(START - 1000) }],
  startCoords: { lat: route[0].lat, lng: route[0].lng },
  endCoords: null,
  distanceTraveled: 0,
  lastActiveAt: new Date(START - 1000),
  routeNeedsRebuild: false,
  routeQuality: {},
  waypoints: [],
  save: jest.fn().mockResolvedValue(true),
  populate: jest.fn().mockResolvedValue(true),
  toObject() { return { ...this }; },
});

const mockRes = () => {
  const res = {};
  res.status = jest.fn(() => res);
  res.json = jest.fn(() => res);
  return res;
};

const send = (journey, coordinates) => {
  mockFindById.mockResolvedValue(journey);
  return updateLocation({ params: { journeyId: JOURNEY_ID }, body: { coordinates }, user: { _id: USER_ID } }, mockRes());
};

const storedTimes = (journey) => journey.raw_polyline.map((p) => new Date(p.timestamp).getTime());
const isAscending = (times) => times.every((t, i) => i === 0 || t > times[i - 1]);

describe('journey route with late-arriving GPS points', () => {
  beforeEach(() => jest.clearAllMocks());

  it('keeps every point when an older batch arrives after a newer one', async () => {
    const journey = makeJourney();
    await send(journey, route.slice(0, 5));
    await send(journey, route.slice(20, 30)); // newer batch lands first
    await send(journey, route.slice(5, 20)); // the delayed middle of the trip

    expect(journey.raw_polyline).toHaveLength(30);
    expect(isAscending(storedTimes(journey))).toBe(true);
    expect(journey.routeNeedsRebuild).toBe(true);
    expect(journey.routeQuality.rejectedImpossibleSpeedPoints).toBe(0);
  });

  it('sorts a single out-of-order batch before processing it', async () => {
    const journey = makeJourney();
    await send(journey, [...route.slice(10, 30), ...route.slice(0, 10)]);

    expect(journey.raw_polyline).toHaveLength(30);
    expect(isAscending(storedTimes(journey))).toBe(true);
    expect(journey.routeQuality.rejectedImpossibleSpeedPoints).toBe(0);
  });

  it('recomputes the distance over the full route on completion', async () => {
    const journey = makeJourney();
    await send(journey, route.slice(0, 5));
    await send(journey, route.slice(20, 30));
    await send(journey, route.slice(5, 20));

    mockFindById.mockResolvedValue(journey);
    await completeJourney({ params: { journeyId: JOURNEY_ID }, body: { snapToRoads: false }, user: { _id: USER_ID } }, mockRes());

    // 29 hops of ~20 m.
    expect(journey.distanceTraveled).toBeGreaterThan(29 * 19);
    expect(journey.distanceTraveled).toBeLessThan(29 * 21);
    expect(journey.routeNeedsRebuild).toBe(false);
    expect(journey.status).toBe('completed');
  });

  it('does not duplicate points when a batch is uploaded twice', async () => {
    const journey = makeJourney();
    await send(journey, route.slice(0, 10));
    await send(journey, route.slice(10, 20));
    await send(journey, route.slice(0, 10)); // retry of an already-stored batch

    expect(journey.raw_polyline).toHaveLength(20);
  });
});
