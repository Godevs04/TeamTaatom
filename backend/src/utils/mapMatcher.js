// backend/src/utils/mapMatcher.js
const Road = require('../models/Road');
const { projectPointToSegment, calculateHaversine } = require('./projection');

// Configuration parameters for HMM & Viterbi MapSnapping
const SIGMA_Z = 8.0;          // GPS accuracy noise standard deviation in meters
const BETA = 25.0;            // Transition scale parameter in meters
const MAX_SEARCH_RADIUS = 30.0; // Max radius (meters) to query candidate road segments
const MIN_PROBABILITY = 1e-12;

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

function emissionProbability(distance) {
  const probability = Math.exp(-0.5 * (distance / SIGMA_Z) ** 2) / (SIGMA_Z * Math.sqrt(2 * Math.PI));
  return Math.max(probability, MIN_PROBABILITY);
}

function transitionProbability(greatCircleDistance, routeDistance) {
  const distanceDelta = Math.abs(greatCircleDistance - routeDistance);
  const probability = Math.exp(-distanceDelta / BETA) / BETA;
  return Math.max(probability, MIN_PROBABILITY);
}

function candidateConfidence(candidate) {
  if (!candidate || candidate.roadId === 'fallback') return 0.2;
  // 1.0 at the road centerline, tapering to ~0.02 near the max search radius.
  return Math.max(0, Math.min(1, Math.exp(-candidate.distance / SIGMA_Z)));
}

/**
 * Find nearby road segment candidates within a 30m radius of a location.
 * Projects the query point onto road LineString sub-segments.
 * 
 * @param {number} lat Coordinate latitude.
 * @param {number} lng Coordinate longitude.
 * @returns {Promise<Array>} Array of candidate snapped points.
 */
async function findCandidates(lat, lng) {
  try {
    const roads = await Road.find({
      geometry: {
        $nearSphere: {
          $geometry: { type: 'Point', coordinates: [lng, lat] },
          $maxDistance: MAX_SEARCH_RADIUS
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
        candidates.push({
          lat: projection.lat,
          lng: projection.lng,
          distance: projection.distance,
          roadId: road._id.toString(),
          osmId: road.osm_id,
          roadName: road.name || 'Unnamed Road'
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
  if (rawPoints.length === 1) {
    const candidates = await findCandidates(rawPoints[0].lat, rawPoints[0].lng);
    return candidates.length > 0 
      ? [{ lat: candidates[0].lat, lng: candidates[0].lng, timestamp: rawPoints[0].timestamp }] 
      : [rawPoints[0]];
  }

  // 1. Retrieve geospatial candidates for each point in sequence
  const timelineCandidates = [];
  for (const pt of rawPoints) {
    const cands = await findCandidates(pt.lat, pt.lng);
    
    // If no roads are indexed within 30m, fallback to raw point as a self-candidate
    if (cands.length === 0) {
      cands.push({
        lat: pt.lat,
        lng: pt.lng,
        distance: 0,
        roadId: 'fallback',
        osmId: 'fallback',
        roadName: 'Raw Path',
        source: 'raw'
      });
    }
    timelineCandidates.push(cands);
  }

  const T = rawPoints.length;
  // Initialize probability matrix and backpointers
  const V = Array.from({ length: T }, () => ({}));
  const backpointers = Array.from({ length: T }, () => ({}));

  // 2. Base Case: Initialization (t = 0)
  timelineCandidates[0].forEach((cand, idx) => {
    V[0][idx] = Math.log(emissionProbability(cand.distance));
    backpointers[0][idx] = null;
  });

  // 3. Recurrence Phase: Run Viterbi Decoder (t = 1 to T-1)
  for (let t = 1; t < T; t++) {
    const prevCands = timelineCandidates[t - 1];
    const currCands = timelineCandidates[t];
    const dGcd = calculateHaversine(rawPoints[t-1].lat, rawPoints[t-1].lng, rawPoints[t].lat, rawPoints[t].lng);

    currCands.forEach((curr, currIdx) => {
      const emissionLog = Math.log(emissionProbability(curr.distance));
      let maxScore = Number.NEGATIVE_INFINITY;
      let bestPrevIdx = 0;

      prevCands.forEach((prev, prevIdx) => {
        const prevScore = Number.isFinite(V[t - 1][prevIdx]) ? V[t - 1][prevIdx] : Number.NEGATIVE_INFINITY;
        
        // Compute Transition Probability (exponential distribution matching relative distances)
        const dRoute = estimateRoutingDistance(prev, curr);
        const transitionLog = Math.log(transitionProbability(dGcd, dRoute));

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
      confidence: candidateConfidence(candidate)
    });
    currIdx = backpointers[t][currIdx];
  }

  return path;
}

module.exports = {
  matchTrajectory,
  findCandidates
};
