/**
 * Orthogonal Point-to-Line Vector Projection.
 * Used to snap raw GPS coordinates orthogonally onto road segment coordinates.
 */

/**
 * Projects a point P orthogonally onto segment AB.
 * Scales dimensions dynamically using cosine of latitude to resolve longitude convergence.
 * Clamps projection factor t to [0, 1] to restrict matches onto segment endpoints.
 * 
 * @param {number} pLat GPS point latitude.
 * @param {number} pLng GPS point longitude.
 * @param {number} aLat Segment start node latitude.
 * @param {number} aLng Segment start node longitude.
 * @param {number} bLat Segment end node latitude.
 * @param {number} bLng Segment end node longitude.
 * @returns {object} { lat: snappedLat, lng: snappedLng, distance: perpendicularDistanceInMetres, t: projectionFactor }
 */
function projectPointToSegment(pLat, pLng, aLat, aLng, bLat, bLng) {
  const avgLat = (aLat + bLat) / 2.0;
  const radLat = (avgLat * Math.PI) / 180.0;
  const cosLat = Math.cos(radLat);

  // 1. Convert degree coordinates to flat Cartesian meter offsets relative to point A
  const apX = (pLng - aLng) * 111320.0 * cosLat;
  const apY = (pLat - aLat) * 111320.0;

  const abX = (bLng - aLng) * 111320.0 * cosLat;
  const abY = (bLat - aLat) * 111320.0;

  const ab2 = abX * abX + abY * abY;
  if (ab2 === 0) {
    return {
      lat: aLat,
      lng: aLng,
      distance: calculateHaversine(pLat, pLng, aLat, aLng),
      t: 0
    };
  }

  // 2. Compute projection factor t and clamp to line segment boundaries
  let t = (apX * abX + apY * abY) / ab2;
  t = Math.max(0, Math.min(1, t));

  // 3. Interpolate snapped coordinates in degrees from A and B
  const snappedLat = aLat + t * (bLat - aLat);
  const snappedLng = aLng + t * (bLng - aLng);

  // 4. Calculate perpendicular distance in meters
  const dx = (pLng - snappedLng) * 111320.0 * cosLat;
  const dy = (pLat - snappedLat) * 111320.0;
  const distance = Math.sqrt(dx * dx + dy * dy);

  return {
    lat: snappedLat,
    lng: snappedLng,
    distance,
    t
  };
}

/**
 * Calculates straight-line great-circle distance between two points in meters using Haversine formula.
 */
function calculateHaversine(lat1, lon1, lat2, lon2) {
  const R = 6371e3; // Earth radius in meters
  const phi1 = (lat1 * Math.PI) / 180;
  const phi2 = (lat2 * Math.PI) / 180;
  const deltaPhi = ((lat2 - lat1) * Math.PI) / 180;
  const deltaLambda = ((lon2 - lon1) * Math.PI) / 180;

  const a =
    Math.sin(deltaPhi / 2) * Math.sin(deltaPhi / 2) +
    Math.cos(phi1) * Math.cos(phi2) * Math.sin(deltaLambda / 2) * Math.sin(deltaLambda / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c;
}

module.exports = {
  projectPointToSegment,
  calculateHaversine
};
