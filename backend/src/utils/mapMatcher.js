// backend/src/utils/mapMatcher.js
const Road = require('../models/Road');
const { projectPointToSegment, calculateHaversine } = require('./projection');

// Configuration parameters for HMM & Viterbi MapSnapping
const SIGMA_Z = 8.0;          // GPS accuracy noise standard deviation in meters
const BETA = 25.0;            // Transition scale parameter in meters
const MAX_SEARCH_RADIUS = 30.0; // Max radius (meters) to query candidate road segments

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
        roadName: 'Raw Path'
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
    const emission = Math.exp(-0.5 * (cand.distance / SIGMA_Z) ** 2) / (SIGMA_Z * Math.sqrt(2 * Math.PI));
    V[0][idx] = emission;
    backpointers[0][idx] = null;
  });

  // 3. Recurrence Phase: Run Viterbi Decoder (t = 1 to T-1)
  for (let t = 1; t < T; t++) {
    const prevCands = timelineCandidates[t - 1];
    const currCands = timelineCandidates[t];
    const dGcd = calculateHaversine(rawPoints[t-1].lat, rawPoints[t-1].lng, rawPoints[t].lat, rawPoints[t].lng);

    currCands.forEach((curr, currIdx) => {
      const emission = Math.exp(-0.5 * (curr.distance / SIGMA_Z) ** 2) / (SIGMA_Z * Math.sqrt(2 * Math.PI));
      let maxProb = -1;
      let bestPrevIdx = 0;

      prevCands.forEach((prev, prevIdx) => {
        const prevV = V[t - 1][prevIdx] || 0;
        
        // Compute Transition Probability (exponential distribution matching relative distances)
        const dRoute = estimateRoutingDistance(prev, curr);
        const distanceDelta = Math.abs(dGcd - dRoute);
        const transition = Math.exp(-distanceDelta / BETA) / BETA;

        const totalProb = prevV * transition * emission;
        if (totalProb > maxProb) {
          maxProb = totalProb;
          bestPrevIdx = prevIdx;
        }
      });

      V[t][currIdx] = maxProb;
      backpointers[t][currIdx] = bestPrevIdx;
    });

    // Renormalize row scaling to prevent floating-point numerical underflow over long sequences
    let rowSum = 0;
    currCands.forEach((_, idx) => { rowSum += V[t][idx]; });
    if (rowSum > 0) {
      currCands.forEach((_, idx) => { V[t][idx] /= rowSum; });
    }
  }

  // 4. Backtrack the highest probability path
  let maxFinalProb = -1;
  let bestFinalIdx = 0;
  timelineCandidates[T - 1].forEach((_, idx) => {
    if (V[T - 1][idx] > maxFinalProb) {
      maxFinalProb = V[T - 1][idx];
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
      segmentBreak: rawPoints[t].segmentBreak || false
    });
    currIdx = backpointers[t][currIdx];
  }

  return path;
}

module.exports = {
  matchTrajectory,
  findCandidates
};
