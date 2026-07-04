/* eslint-disable no-console */
// backend/src/utils/mapMatcher.js
const Road = require('../models/Road');
const ImportedRegion = require('../models/ImportedRegion');
const { projectPointToSegment, calculateHaversine } = require('./projection');

// Use dynamic import for node-fetch (ESM module in CommonJS context)
const fetch = (...args) => import('node-fetch').then(({ default: f }) => f(...args));

/**
 * Dynamically queries OpenStreetMap (OSM) via Overpass API for road geometries
 * inside a bounding box, then stores them in MongoDB's Road collection as a cache.
 */
async function fetchAndImportOsmRoads(minLat, minLng, maxLat, maxLng) {
  try {
    const latSpan = maxLat - minLat;
    const lngSpan = maxLng - minLng;
    // Bounding box safety gate to prevent querying too large areas (max ~10km x 10km)
    if (latSpan > 0.1 || lngSpan > 0.1) {
      console.warn(`[OSM Import] Bounding box too large (latSpan: ${latSpan.toFixed(3)}, lngSpan: ${lngSpan.toFixed(3)}), skipping JIT import`);
      return;
    }

    const query = `[out:json][timeout:25];
way["highway"](${minLat},${minLng},${maxLat},${maxLng});
out geom;`;

    const url = 'https://overpass-api.de/api/interpreter';
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'User-Agent': 'TeamTaatomBackend/1.0 (Journey road-snapping; +https://openstreetmap.org)'
      },
      body: `data=${encodeURIComponent(query)}`
    });

    if (!response.ok) {
      throw new Error(`Overpass API status ${response.status}`);
    }

    const data = await response.json();
    const elements = data.elements || [];
    const roadsToInsert = [];

    for (const el of elements) {
      if (el.type === 'way' && Array.isArray(el.geometry) && el.geometry.length >= 2) {
        roadsToInsert.push({
          osm_id: el.id.toString(),
          name: el.tags?.name || 'Unnamed Road',
          highway: el.tags?.highway || 'road',
          oneWay: el.tags?.oneway === 'yes' || el.tags?.junction === 'roundabout',
          geometry: {
            type: 'LineString',
            coordinates: el.geometry.map(g => [g.lon, g.lat]) // [lng, lat]
          }
        });
      }
    }

    // Save imported region coordinates to database to register cache hit
    await ImportedRegion.create({
      geometry: {
        type: 'Polygon',
        coordinates: [[
          [minLng, minLat],
          [maxLng, minLat],
          [maxLng, maxLat],
          [minLng, maxLat],
          [minLng, minLat]
        ]]
      }
    });

    if (roadsToInsert.length > 0) {
      try {
        // Skip duplicate keys (ordered: false) to gracefully ignore already imported roads
        await Road.insertMany(roadsToInsert, { ordered: false });
        console.log(`[OSM Import] Successfully imported ${roadsToInsert.length} roads to cache`);
      } catch (insertErr) {
        const isDuplicateKeyError =
          insertErr.code === 11000 ||
          insertErr.name === 'BulkWriteError' ||
          insertErr.name === 'MongoServerError' ||
          (insertErr.writeErrors && insertErr.writeErrors.some(e => e.code === 11000));
        
        if (isDuplicateKeyError) {
          console.log(`[OSM Import] Successfully imported ${roadsToInsert.length} roads (some duplicates ignored)`);
        } else {
          throw insertErr;
        }
      }
    } else {
      console.log('[OSM Import] No roads found in bounding box, region marked as cached');
    }
  } catch (err) {
    console.error('[OSM Import] JIT road import failed:', err.message);
  }
}

// Configuration parameters for HMM & Viterbi MapSnapping
const SIGMA_Z = 8.0;          // GPS accuracy noise standard deviation in meters
const BETA = 35.0;            // Transition scale parameter in meters
const MAX_SEARCH_RADIUS = 45.0; // Max radius (meters) to query candidate road segments
const MIN_PROBABILITY = 1e-12;

/**
 * Calculates straight-line compass bearing between two points in degrees (0-360).
 */
function calculateSegmentBearing(aLat, aLng, bLat, bLng) {
  const avgLat = (aLat + bLat) / 2.0;
  const radLat = (avgLat * Math.PI) / 180.0;
  const cosLat = Math.cos(radLat);

  const dx = (bLng - aLng) * 111320.0 * cosLat;
  const dy = (bLat - aLat) * 111320.0;

  let bearing = Math.atan2(dx, dy) * (180.0 / Math.PI);
  if (bearing < 0) {
    bearing += 360.0;
  }
  return bearing;
}

/**
 * Calculates absolute difference between GPS heading and road segment bearing.
 * Accounts for bidirectional travel on two-way roads.
 */
function getHeadingDifference(gpsHeading, roadBearing, isOneWay) {
  const diff = Math.abs(gpsHeading - roadBearing) % 360;
  const delta = diff > 180 ? 360 - diff : diff;
  
  if (isOneWay) {
    return delta;
  } else {
    return delta > 90 ? 180 - delta : delta;
  }
}

/**
 * Estimates driving routing distance between two snapped candidate locations.
 * If candidates reside on the same OSM road segment, it calculates straight-line distance.
 * If they reside on different roads, it approximates routing distance using a Manhattan/topological scale factor.
 * 
 * @param {object} cPrev Previous candidate point.
 * @param {object} cCurr Current candidate point.
 * @returns {number} Estimated route distance in meters.
 */
function estimateRoutingDistance(cPrev, cCurr) {
  const linearDist = calculateHaversine(cPrev.lat, cPrev.lng, cCurr.lat, cCurr.lng);
  
  if (cPrev.roadId === cCurr.roadId) {
    return linearDist;
  }
  
  // Apply Manhattan grid detour scaling factor (approximates road grid curvature)
  return linearDist * 1.35;
}

function emissionProbability(distance, headingDiff, sigmaZ = SIGMA_Z) {
  let probability = Math.exp(-0.5 * (distance / sigmaZ) ** 2) / (sigmaZ * Math.sqrt(2 * Math.PI));
  if (headingDiff !== null && headingDiff !== undefined) {
    const sigmaHeading = 25.0; // Heading tolerance standard deviation
    probability *= Math.exp(-0.5 * (headingDiff / sigmaHeading) ** 2);
  }
  return Math.max(probability, MIN_PROBABILITY);
}

function transitionProbability(greatCircleDistance, routeDistance, beta = BETA) {
  const distanceDelta = Math.abs(greatCircleDistance - routeDistance);
  const probability = Math.exp(-distanceDelta / beta) / beta;
  return Math.max(probability, MIN_PROBABILITY);
}

function candidateConfidence(candidate) {
  if (!candidate || candidate.roadId === 'fallback') return 0.2;
  const sigma = Math.max(5.0, candidate.accuracy || SIGMA_Z);
  // 1.0 at the road centerline, tapering to ~0.02 near the max search radius.
  return Math.max(0, Math.min(1, Math.exp(-candidate.distance / sigma)));
}

/**
 * Find nearby road segment candidates within a 30m radius of a location.
 * Projects the query point onto road LineString sub-segments.
 * 
 * @param {number} lat Coordinate latitude.
 * @param {number} lng Coordinate longitude.
 * @returns {Promise<Array>} Array of candidate snapped points.
 */
async function findCandidates(lat, lng, accuracy = 8.0) {
  try {
    const searchRadius = Math.max(MAX_SEARCH_RADIUS, accuracy * 1.5);
    const roads = await Road.find({
      geometry: {
        $nearSphere: {
          $geometry: { type: 'Point', coordinates: [lng, lat] },
          $maxDistance: searchRadius
        }
      }
    }).limit(6); // Query up to 6 closest roads to prevent excessive segment calculations

    const candidates = [];
    for (const road of roads) {
      const coords = road.geometry.coordinates; // LineString coords: [[lng, lat], ...]
      
      // Calculate projections for all segment lines in the road geometry
      for (let i = 0; i < coords.length - 1; i++) {
        const aLng = coords[i][0];
        const aLat = coords[i][1];
        const bLng = coords[i+1][0];
        const bLat = coords[i+1][1];

        const projection = projectPointToSegment(lat, lng, aLat, aLng, bLat, bLng);
        const segmentBearing = calculateSegmentBearing(aLat, aLng, bLat, bLng);
        candidates.push({
          lat: projection.lat,
          lng: projection.lng,
          distance: projection.distance,
          roadId: road._id.toString(),
          osmId: road.osm_id,
          roadName: road.name || 'Unnamed Road',
          bearing: segmentBearing,
          oneWay: road.oneWay === true,
          accuracy: accuracy
        });
      }
    }

    // Sort candidates by perpendicular distance and select top 3
    return candidates.sort((a, b) => a.distance - b.distance).slice(0, 3);
  } catch (err) {
    return [];
  }
}

/**
 * Match raw trajectory of coordinates to road network using HMM and Viterbi.
 * Runs completely self-hosted without external API requests.
 * 
 * @param {Array} rawPoints Array of { lat, lng, timestamp, segmentBreak } locations.
 * @returns {Promise<Array>} Snapped coordinates { lat, lng, timestamp, segmentBreak }.
 */
async function matchTrajectory(rawPoints) {
  if (!Array.isArray(rawPoints) || rawPoints.length === 0) return [];

  // JIT Road geometry import for the bounding box of raw points
  try {
    const mongoose = require('mongoose');
    if (mongoose.connection.readyState === 1) { // Only run if DB connection is active (skips buffering in offline unit tests)
      let minLat = Infinity, maxLat = -Infinity;
      let minLng = Infinity, maxLng = -Infinity;
      for (const pt of rawPoints) {
        const lat = pt.lat ?? pt.latitude;
        const lng = pt.lng ?? pt.longitude;
        if (lat < minLat) minLat = lat;
        if (lat > maxLat) maxLat = lat;
        if (lng < minLng) minLng = lng;
        if (lng > maxLng) maxLng = lng;
      }
      if (minLat !== Infinity) {
        const padding = 0.0018; // ~200 meters padding around trajectory
        minLat -= padding;
        maxLat += padding;
        minLng -= padding;
        maxLng += padding;

        const roadsExist = await Road.exists({
          geometry: {
            $geoWithin: {
              $box: [
                [minLng, minLat],
                [maxLng, maxLat]
              ]
            }
          }
        });

        if (!roadsExist) {
          const centerLng = (minLng + maxLng) / 2;
          const centerLat = (minLat + maxLat) / 2;

          const alreadyImported = await ImportedRegion.exists({
            geometry: {
              $geoIntersects: {
                $geometry: {
                  type: 'Point',
                  coordinates: [centerLng, centerLat]
                }
              }
            }
          });

          if (!alreadyImported) {
            // Execute in the background to prevent blocking client requests and avoid timeouts
            fetchAndImportOsmRoads(minLat, minLng, maxLat, maxLng).catch(err => {
              console.error('[OSM Import] Background import failed:', err.message);
            });
          }
        }
      }
    }
  } catch (err) {
    console.error('[OSM Import] Bounding box JIT check failed (non-blocking):', err.message);
  }

  if (rawPoints.length === 1) {
    const candidates = await findCandidates(rawPoints[0].lat, rawPoints[0].lng, rawPoints[0].accuracy);
    return candidates.length > 0 
      ? [{
          lat: candidates[0].lat,
          lng: candidates[0].lng,
          timestamp: rawPoints[0].timestamp,
          segmentBreak: rawPoints[0].segmentBreak || false,
          speed: rawPoints[0].speed,
          heading: rawPoints[0].heading
        }] 
      : [rawPoints[0]];
  }

  // 1. Retrieve geospatial candidates for each point in sequence
  const timelineCandidates = [];
  for (const pt of rawPoints) {
    const cands = await findCandidates(pt.lat, pt.lng, pt.accuracy);
    
    // If no roads are indexed within 30m, fallback to raw point as a self-candidate
    if (cands.length === 0) {
      cands.push({
        lat: pt.lat,
        lng: pt.lng,
        distance: 0,
        roadId: 'fallback',
        osmId: 'fallback',
        roadName: 'Raw Path',
        source: 'raw',
        bearing: null,
        oneWay: false
      });
    }
    timelineCandidates.push(cands);
  }

  const T = rawPoints.length;
  // Initialize probability matrix and backpointers
  const V = Array.from({ length: T }, () => ({}));
  const backpointers = Array.from({ length: T }, () => ({}));

  // 2. Base Case: Initialization (t = 0)
  const pt0 = rawPoints[0];
  const sigmaZ0 = Math.max(5.0, (typeof pt0.accuracy === 'number' && pt0.accuracy > 0) ? pt0.accuracy : SIGMA_Z);
  const isHeadingReliable0 = pt0.speed === undefined || pt0.speed === null || (typeof pt0.speed === 'number' && pt0.speed >= 2.5);

  timelineCandidates[0].forEach((cand, idx) => {
    const headingDiff = (isHeadingReliable0 && pt0.heading !== undefined && pt0.heading !== null && cand.bearing !== null && cand.bearing !== undefined)
      ? getHeadingDifference(pt0.heading, cand.bearing, cand.oneWay)
      : null;
    V[0][idx] = Math.log(emissionProbability(cand.distance, headingDiff, sigmaZ0));
    backpointers[0][idx] = null;
  });

  // 3. Recurrence Phase: Run Viterbi Decoder (t = 1 to T-1)
  for (let t = 1; t < T; t++) {
    const prevCands = timelineCandidates[t - 1];
    const currCands = timelineCandidates[t];
    const ptCurr = rawPoints[t];
    const sigmaZ = Math.max(5.0, (typeof ptCurr.accuracy === 'number' && ptCurr.accuracy > 0) ? ptCurr.accuracy : SIGMA_Z);
    const isHeadingReliable = ptCurr.speed === undefined || ptCurr.speed === null || (typeof ptCurr.speed === 'number' && ptCurr.speed >= 2.5);
    const dGcd = calculateHaversine(rawPoints[t-1].lat, rawPoints[t-1].lng, ptCurr.lat, ptCurr.lng);
    const adaptiveBeta = Math.max(BETA, dGcd * 0.15);

    currCands.forEach((curr, currIdx) => {
      const headingDiff = (isHeadingReliable && ptCurr.heading !== undefined && ptCurr.heading !== null && curr.bearing !== null && curr.bearing !== undefined)
        ? getHeadingDifference(ptCurr.heading, curr.bearing, curr.oneWay)
        : null;
      const emissionLog = Math.log(emissionProbability(curr.distance, headingDiff, sigmaZ));
      let maxScore = Number.NEGATIVE_INFINITY;
      let bestPrevIdx = 0;

      prevCands.forEach((prev, prevIdx) => {
        const prevScore = Number.isFinite(V[t - 1][prevIdx]) ? V[t - 1][prevIdx] : Number.NEGATIVE_INFINITY;
        
        // Compute Transition Probability (exponential distribution matching relative distances)
        const dRoute = estimateRoutingDistance(prev, curr);
        let transitionLog = Math.log(transitionProbability(dGcd, dRoute, adaptiveBeta));

        // Topological transition penalty to prevent wiggling/jumping between parallel disconnected roads
        if (prev.roadId !== curr.roadId && prev.roadId !== 'fallback' && curr.roadId !== 'fallback') {
          transitionLog -= 2.0; // Apply transition log penalty
        }

        const totalScore = prevScore + transitionLog + emissionLog;
        if (totalScore > maxScore) {
          maxScore = totalScore;
          bestPrevIdx = prevIdx;
        }
      });

      V[t][currIdx] = maxScore;
      backpointers[t][currIdx] = bestPrevIdx;
    });

    // Normalize log scores per row so long journeys remain numerically stable
    // while preserving the ordering needed by Viterbi.
    let rowMax = Number.NEGATIVE_INFINITY;
    currCands.forEach((_, idx) => {
      if (V[t][idx] > rowMax) rowMax = V[t][idx];
    });
    if (Number.isFinite(rowMax)) {
      currCands.forEach((_, idx) => { V[t][idx] -= rowMax; });
    }
  }

  // 4. Backtrack the highest probability path
  let maxFinalScore = Number.NEGATIVE_INFINITY;
  let bestFinalIdx = 0;
  timelineCandidates[T - 1].forEach((_, idx) => {
    if (V[T - 1][idx] > maxFinalScore) {
      maxFinalScore = V[T - 1][idx];
      bestFinalIdx = idx;
    }
  });

  const path = [];
  let currIdx = bestFinalIdx;
  for (let t = T - 1; t >= 0; t--) {
    const candidate = timelineCandidates[t][currIdx];
    path.unshift({
      lat: candidate.lat,
      lng: candidate.lng,
      timestamp: rawPoints[t].timestamp,
      segmentBreak: rawPoints[t].segmentBreak || false,
      matchDistance: candidate.distance,
      roadId: candidate.roadId,
      osmId: candidate.osmId,
      roadName: candidate.roadName,
      source: candidate.roadId === 'fallback' ? 'raw' : 'matched',
      confidence: candidateConfidence(candidate),
      speed: rawPoints[t].speed,
      heading: rawPoints[t].heading
    });
    currIdx = backpointers[t][currIdx];
  }

  return path;
}

module.exports = {
  matchTrajectory,
  findCandidates
};
