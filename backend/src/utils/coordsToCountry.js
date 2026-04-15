/**
 * Coordinate -> Country/Continent lookup using bounding boxes.
 *
 * Used by TripScore reads so that country/continent grouping always matches
 * the global map (which is plotted from lat/lng). The stored TripVisit.country
 * and TripVisit.continent fields were computed via fragile address-substring
 * matching at write time, so they cannot be trusted for grouping.
 *
 * Smallest-area bbox wins on overlap, which gives sensible answers for nested
 * regions (e.g. a Lisbon point lands in Portugal, not Spain or Russia).
 */

// [name, continent, minLat, maxLat, minLng, maxLng]
// Tight bounding boxes for the countries most commonly seen in TeamTaatom data.
const COUNTRY_BBOX = [
  // Asia
  ['India', 'ASIA', 6.5, 35.7, 68.0, 97.5],
  ['Sri Lanka', 'ASIA', 5.8, 9.9, 79.5, 81.9],
  ['Nepal', 'ASIA', 26.3, 30.5, 80.0, 88.3],
  ['Bhutan', 'ASIA', 26.7, 28.4, 88.7, 92.2],
  ['Bangladesh', 'ASIA', 20.5, 26.7, 88.0, 92.7],
  ['Pakistan', 'ASIA', 23.6, 37.1, 60.8, 77.0],
  ['Afghanistan', 'ASIA', 29.3, 38.5, 60.5, 74.9],
  ['Maldives', 'ASIA', -0.7, 7.1, 72.6, 73.8],
  ['Myanmar', 'ASIA', 9.7, 28.5, 92.2, 101.2],
  ['Thailand', 'ASIA', 5.6, 20.5, 97.3, 105.7],
  ['Cambodia', 'ASIA', 10.4, 14.7, 102.3, 107.6],
  ['Laos', 'ASIA', 13.9, 22.5, 100.1, 107.7],
  ['Vietnam', 'ASIA', 8.4, 23.4, 102.1, 109.5],
  ['Malaysia', 'ASIA', 0.8, 7.4, 99.6, 119.3],
  ['Singapore', 'ASIA', 1.2, 1.5, 103.6, 104.1],
  ['Indonesia', 'ASIA', -11.0, 6.1, 95.0, 141.0],
  ['Philippines', 'ASIA', 4.6, 21.1, 116.9, 126.6],
  ['Brunei', 'ASIA', 4.0, 5.1, 114.1, 115.4],
  ['Japan', 'ASIA', 24.0, 45.6, 122.9, 145.8],
  ['South Korea', 'ASIA', 33.1, 38.6, 125.0, 129.6],
  ['North Korea', 'ASIA', 37.7, 43.0, 124.2, 130.7],
  ['China', 'ASIA', 18.2, 53.6, 73.5, 134.8],
  ['Taiwan', 'ASIA', 21.9, 25.3, 120.0, 122.0],
  ['Hong Kong', 'ASIA', 22.1, 22.6, 113.8, 114.5],
  ['Mongolia', 'ASIA', 41.6, 52.2, 87.7, 119.9],
  ['Kazakhstan', 'ASIA', 40.6, 55.4, 46.5, 87.3],
  ['Uzbekistan', 'ASIA', 37.2, 45.6, 56.0, 73.1],
  ['Iran', 'ASIA', 25.1, 39.8, 44.0, 63.3],
  ['Iraq', 'ASIA', 29.1, 37.4, 38.8, 48.6],
  ['Saudi Arabia', 'ASIA', 16.3, 32.2, 34.5, 55.7],
  ['United Arab Emirates', 'ASIA', 22.6, 26.1, 51.5, 56.4],
  ['Qatar', 'ASIA', 24.5, 26.2, 50.7, 51.7],
  ['Kuwait', 'ASIA', 28.5, 30.1, 46.5, 48.4],
  ['Oman', 'ASIA', 16.6, 26.4, 51.9, 59.9],
  ['Bahrain', 'ASIA', 25.7, 26.4, 50.3, 50.8],
  ['Israel', 'ASIA', 29.5, 33.3, 34.2, 35.9],
  ['Jordan', 'ASIA', 29.2, 33.4, 34.9, 39.3],
  ['Lebanon', 'ASIA', 33.0, 34.7, 35.1, 36.6],
  ['Syria', 'ASIA', 32.3, 37.3, 35.7, 42.4],
  ['Turkey', 'ASIA', 35.8, 42.1, 26.0, 44.8],

  // Europe
  ['Portugal', 'EUROPE', 36.8, 42.2, -9.6, -6.1],
  ['Spain', 'EUROPE', 35.9, 43.9, -9.4, 4.4],
  ['France', 'EUROPE', 41.3, 51.1, -5.2, 9.6],
  ['Andorra', 'EUROPE', 42.4, 42.7, 1.4, 1.8],
  ['Monaco', 'EUROPE', 43.7, 43.8, 7.4, 7.5],
  ['Italy', 'EUROPE', 36.6, 47.1, 6.6, 18.6],
  ['Switzerland', 'EUROPE', 45.8, 47.8, 5.9, 10.5],
  ['Germany', 'EUROPE', 47.3, 55.1, 5.9, 15.0],
  ['Austria', 'EUROPE', 46.4, 49.0, 9.5, 17.2],
  ['Belgium', 'EUROPE', 49.5, 51.5, 2.5, 6.4],
  ['Netherlands', 'EUROPE', 50.7, 53.6, 3.4, 7.2],
  ['Luxembourg', 'EUROPE', 49.4, 50.2, 5.7, 6.5],
  ['Denmark', 'EUROPE', 54.5, 57.8, 8.0, 15.2],
  ['United Kingdom', 'EUROPE', 49.9, 60.9, -8.6, 1.8],
  ['Ireland', 'EUROPE', 51.4, 55.4, -10.5, -6.0],
  ['Norway', 'EUROPE', 57.9, 71.2, 4.6, 31.1],
  ['Sweden', 'EUROPE', 55.3, 69.1, 11.0, 24.2],
  ['Finland', 'EUROPE', 59.8, 70.1, 20.5, 31.6],
  ['Iceland', 'EUROPE', 63.3, 66.6, -24.6, -13.5],
  ['Poland', 'EUROPE', 49.0, 54.9, 14.1, 24.2],
  ['Czech Republic', 'EUROPE', 48.5, 51.1, 12.1, 18.9],
  ['Slovakia', 'EUROPE', 47.7, 49.6, 16.8, 22.6],
  ['Hungary', 'EUROPE', 45.7, 48.6, 16.1, 22.9],
  ['Romania', 'EUROPE', 43.6, 48.3, 20.2, 29.7],
  ['Bulgaria', 'EUROPE', 41.2, 44.2, 22.4, 28.6],
  ['Greece', 'EUROPE', 34.8, 41.7, 19.4, 28.3],
  ['Croatia', 'EUROPE', 42.4, 46.5, 13.5, 19.4],
  ['Serbia', 'EUROPE', 42.2, 46.2, 18.8, 23.0],
  ['Slovenia', 'EUROPE', 45.4, 46.9, 13.4, 16.6],
  ['Bosnia and Herzegovina', 'EUROPE', 42.6, 45.3, 15.7, 19.6],
  ['Albania', 'EUROPE', 39.6, 42.7, 19.3, 21.1],
  ['North Macedonia', 'EUROPE', 40.9, 42.4, 20.5, 23.0],
  ['Montenegro', 'EUROPE', 41.9, 43.6, 18.4, 20.4],
  ['Estonia', 'EUROPE', 57.5, 59.7, 21.8, 28.2],
  ['Latvia', 'EUROPE', 55.6, 58.1, 20.9, 28.2],
  ['Lithuania', 'EUROPE', 53.9, 56.4, 20.9, 26.8],
  ['Belarus', 'EUROPE', 51.2, 56.2, 23.2, 32.8],
  ['Ukraine', 'EUROPE', 44.4, 52.4, 22.1, 40.2],
  ['Russia', 'EUROPE', 41.2, 81.9, 19.6, 180.0], // huge — small bboxes win first
  ['Malta', 'EUROPE', 35.8, 36.1, 14.2, 14.6],
  ['Cyprus', 'EUROPE', 34.6, 35.7, 32.3, 34.6],

  // Africa
  ['Morocco', 'AFRICA', 27.7, 35.9, -13.2, -1.0],
  ['Algeria', 'AFRICA', 19.1, 37.1, -8.7, 12.0],
  ['Tunisia', 'AFRICA', 30.2, 37.5, 7.5, 11.6],
  ['Libya', 'AFRICA', 19.5, 33.2, 9.4, 25.2],
  ['Egypt', 'AFRICA', 22.0, 31.7, 24.7, 36.9],
  ['Sudan', 'AFRICA', 8.7, 22.0, 21.8, 38.6],
  ['Ethiopia', 'AFRICA', 3.4, 14.9, 33.0, 48.0],
  ['Kenya', 'AFRICA', -4.7, 5.5, 33.9, 41.9],
  ['Tanzania', 'AFRICA', -11.7, -1.0, 29.3, 40.4],
  ['Uganda', 'AFRICA', -1.5, 4.2, 29.6, 35.0],
  ['Nigeria', 'AFRICA', 4.3, 13.9, 2.7, 14.7],
  ['Ghana', 'AFRICA', 4.7, 11.2, -3.3, 1.2],
  ['South Africa', 'AFRICA', -34.8, -22.1, 16.5, 32.9],
  ['Namibia', 'AFRICA', -28.9, -16.9, 11.7, 25.3],
  ['Zambia', 'AFRICA', -18.1, -8.2, 21.9, 33.7],
  ['Zimbabwe', 'AFRICA', -22.4, -15.6, 25.2, 33.1],
  ['Mozambique', 'AFRICA', -26.9, -10.5, 30.2, 40.8],
  ['Madagascar', 'AFRICA', -25.6, -11.9, 43.2, 50.5],

  // North America
  ['United States', 'NORTH AMERICA', 24.5, 49.4, -125.0, -66.9],
  ['Alaska (US)', 'NORTH AMERICA', 51.2, 71.4, -169.9, -129.9],
  ['Hawaii (US)', 'NORTH AMERICA', 18.9, 22.3, -160.3, -154.8],
  ['Canada', 'NORTH AMERICA', 41.7, 83.1, -141.0, -52.6],
  ['Mexico', 'NORTH AMERICA', 14.5, 32.7, -118.4, -86.7],
  ['Guatemala', 'NORTH AMERICA', 13.7, 17.8, -92.2, -88.2],
  ['Cuba', 'NORTH AMERICA', 19.8, 23.3, -84.9, -74.1],
  ['Jamaica', 'NORTH AMERICA', 17.7, 18.5, -78.4, -76.2],
  ['Dominican Republic', 'NORTH AMERICA', 17.5, 19.9, -72.0, -68.3],
  ['Costa Rica', 'NORTH AMERICA', 8.0, 11.2, -85.9, -82.5],
  ['Panama', 'NORTH AMERICA', 7.2, 9.6, -83.0, -77.2],

  // South America
  ['Brazil', 'SOUTH AMERICA', -33.8, 5.3, -73.9, -34.8],
  ['Argentina', 'SOUTH AMERICA', -55.1, -21.8, -73.6, -53.6],
  ['Chile', 'SOUTH AMERICA', -55.9, -17.5, -75.7, -66.4],
  ['Peru', 'SOUTH AMERICA', -18.4, -0.04, -81.4, -68.7],
  ['Colombia', 'SOUTH AMERICA', -4.2, 12.5, -79.0, -66.9],
  ['Venezuela', 'SOUTH AMERICA', 0.6, 12.2, -73.4, -59.8],
  ['Ecuador', 'SOUTH AMERICA', -5.0, 1.4, -81.1, -75.2],
  ['Bolivia', 'SOUTH AMERICA', -22.9, -9.7, -69.6, -57.5],
  ['Uruguay', 'SOUTH AMERICA', -34.9, -30.1, -58.4, -53.1],
  ['Paraguay', 'SOUTH AMERICA', -27.6, -19.3, -62.6, -54.3],

  // Oceania
  ['Australia', 'AUSTRALIA', -43.7, -10.7, 113.2, 153.6],
  ['New Zealand', 'AUSTRALIA', -47.3, -34.4, 166.4, 178.6],
  ['Fiji', 'AUSTRALIA', -19.2, -16.1, 177.2, 180.0],
  ['Papua New Guinea', 'AUSTRALIA', -11.7, -1.3, 140.8, 156.0],
];

// Pre-compute area for each bbox so the smallest match wins on overlaps.
const ENTRIES = COUNTRY_BBOX.map(([name, continent, minLat, maxLat, minLng, maxLng]) => ({
  name,
  continent,
  minLat,
  maxLat,
  minLng,
  maxLng,
  area: (maxLat - minLat) * (maxLng - minLng),
}));

const NORMALIZED_NAME = (name) => {
  // Strip suffixes like " (US)" so bbox aliases collapse to canonical country.
  const idx = name.indexOf(' (');
  return idx === -1 ? name : name.slice(0, idx);
};

/**
 * Look up the country and continent for a coordinate.
 * Returns { country, continent } or null if no bbox contains the point.
 */
function lookupByCoords(lat, lng) {
  if (typeof lat !== 'number' || typeof lng !== 'number' || isNaN(lat) || isNaN(lng)) {
    return null;
  }

  let best = null;
  for (const e of ENTRIES) {
    if (lat >= e.minLat && lat <= e.maxLat && lng >= e.minLng && lng <= e.maxLng) {
      if (!best || e.area < best.area) {
        best = e;
      }
    }
  }

  if (!best) return null;
  return { country: NORMALIZED_NAME(best.name), continent: best.continent };
}

module.exports = { lookupByCoords };
