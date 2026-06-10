const { projectPointToSegment } = require('../utils/projection');
const { matchTrajectory } = require('../utils/mapMatcher');
const Road = require('../models/Road');

describe('Map Matching Orthogonal Projection', () => {
  test('projectPointToSegment: snaps to start point when projection factor t <= 0', () => {
    const P = { lat: 12.96, lng: 77.59 };
    const A = { lat: 12.97, lng: 77.59 };
    const B = { lat: 12.98, lng: 77.59 };

    const projection = projectPointToSegment(P.lat, P.lng, A.lat, A.lng, B.lat, B.lng);
    
    expect(projection.lat).toBeCloseTo(A.lat, 5);
    expect(projection.lng).toBeCloseTo(A.lng, 5);
    expect(projection.t).toBe(0);
  });

  test('projectPointToSegment: snaps to end point when projection factor t >= 1', () => {
    const P = { lat: 12.99, lng: 77.59 };
    const A = { lat: 12.97, lng: 77.59 };
    const B = { lat: 12.98, lng: 77.59 };

    const projection = projectPointToSegment(P.lat, P.lng, A.lat, A.lng, B.lat, B.lng);
    
    expect(projection.lat).toBeCloseTo(B.lat, 5);
    expect(projection.lng).toBeCloseTo(B.lng, 5);
    expect(projection.t).toBe(1);
  });

  test('projectPointToSegment: snaps orthogonally onto segment when 0 < t < 1', () => {
    const A = { lat: 12.0, lng: 77.0 };
    const B = { lat: 12.0, lng: 77.01 };
    const P = { lat: 12.0001, lng: 77.005 };

    const projection = projectPointToSegment(P.lat, P.lng, A.lat, A.lng, B.lat, B.lng);
    
    expect(projection.lat).toBeCloseTo(12.0, 5);
    expect(projection.lng).toBeCloseTo(77.005, 5);
    expect(projection.t).toBeCloseTo(0.5, 2);
    expect(projection.distance).toBeGreaterThan(5.0);
  });
});

describe('Map Matching HMM & Viterbi Decoder', () => {
  let findSpy;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterEach(() => {
    if (findSpy) {
      findSpy.mockRestore();
    }
  });

  test('matchTrajectory: snaps coordinates to closest road candidates', async () => {
    const mockRoads = [
      {
        _id: 'road_main_id',
        osm_id: '111',
        name: 'Main Street',
        geometry: {
          type: 'LineString',
          coordinates: [[77.0, 12.0], [77.1, 12.0]]
        }
      },
      {
        _id: 'road_alley_id',
        osm_id: '222',
        name: 'Parallel Alley',
        geometry: {
          type: 'LineString',
          coordinates: [[77.0, 12.0002], [77.1, 12.0002]] // ~22m away
        }
      }
    ];

    // Mock Road.find().limit() using jest.spyOn
    findSpy = jest.spyOn(Road, 'find').mockImplementation(() => {
      return {
        limit: jest.fn().mockResolvedValue(mockRoads)
      };
    });

    const rawPoints = [
      { lat: 12.00001, lng: 77.001, timestamp: new Date() },
      { lat: 12.00002, lng: 77.005, timestamp: new Date() },
      { lat: 12.00001, lng: 77.009, timestamp: new Date() }
    ];

    const matched = await matchTrajectory(rawPoints);

    expect(matched.length).toBe(3);
    // Should snap to Main Street
    expect(matched[0].lat).toBeCloseTo(12.0, 5);
    expect(matched[0].lng).toBeCloseTo(77.001, 5);
    expect(matched[1].lat).toBeCloseTo(12.0, 5);
    expect(matched[1].lng).toBeCloseTo(77.005, 5);
  });

  test('matchTrajectory: falls back to raw coordinates when no candidates are found', async () => {
    findSpy = jest.spyOn(Road, 'find').mockImplementation(() => {
      return {
        limit: jest.fn().mockResolvedValue([])
      };
    });

    const rawPoints = [
      { lat: 15.0, lng: 80.0, timestamp: new Date() }
    ];

    const matched = await matchTrajectory(rawPoints);
    expect(matched.length).toBe(1);
    expect(matched[0].lat).toBe(15.0);
    expect(matched[0].lng).toBe(80.0);
  });

  test('matchTrajectory: selects candidate aligning with GPS heading when intersecting roads are near', async () => {
    const mockRoads = [
      {
        _id: 'road_ns_id',
        osm_id: '333',
        name: 'North-South Boulevard',
        geometry: {
          type: 'LineString',
          coordinates: [[77.005, 12.0], [77.005, 12.1]] // Bearing 0 / 180 degrees
        },
        oneWay: false
      },
      {
        _id: 'road_ew_id',
        osm_id: '444',
        name: 'East-West Highway',
        geometry: {
          type: 'LineString',
          coordinates: [[77.0, 12.005], [77.1, 12.005]] // Bearing 90 / 270 degrees
        },
        oneWay: false
      }
    ];

    findSpy = jest.spyOn(Road, 'find').mockImplementation(() => {
      return {
        limit: jest.fn().mockResolvedValue(mockRoads)
      };
    });

    // GPS points moving North (heading: 0) near the intersection, slightly closer to the East-West road
    // Point 1: slightly closer to EW road (distance ~22m) than NS road (distance ~33m)
    // But since heading is 0, it should align and choose the NS road.
    const rawPoints = [
      { lat: 12.0048, lng: 77.0047, timestamp: new Date(), heading: 0 },
      { lat: 12.0052, lng: 77.0047, timestamp: new Date(), heading: 0 }
    ];

    const matched = await matchTrajectory(rawPoints);

    expect(matched.length).toBe(2);
    // Should snap to North-South Boulevard (road_ns_id) rather than East-West Highway
    expect(matched[0].roadId).toBe('road_ns_id');
    expect(matched[1].roadId).toBe('road_ns_id');
  });
});
