const mongoose = require('mongoose');

/**
 * ImportedRegion Schema for caching OpenStreetMap (OSM) bounding box queries.
 * Saves the coordinates of successfully queried bounding boxes as Polygons.
 * Prevents repeating Overpass API requests for regions without roads or already cached.
 */
const ImportedRegionSchema = new mongoose.Schema({
  geometry: {
    type: {
      type: String,
      enum: ['Polygon'],
      required: true
    },
    coordinates: {
      type: [[[Number]]], // Array of rings of [longitude, latitude] coordinates
      required: true
    }
  },
  createdAt: { type: Date, default: Date.now }
});

// Spatial 2dsphere index for geoqueries
ImportedRegionSchema.index({ geometry: '2dsphere' });

// TTL index to expire cached regions after 7 days
ImportedRegionSchema.index({ createdAt: 1 }, { expireAfterSeconds: 7 * 24 * 60 * 60 });

module.exports = mongoose.model('ImportedRegion', ImportedRegionSchema);
