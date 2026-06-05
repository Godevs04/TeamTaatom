const mongoose = require('mongoose');

/**
 * Road Segment Schema for Custom MapSnapping.
 * Stores road geometries extracted from OpenStreetMap (OSM) as LineStrings.
 * Indexes spatial geometry using 2dsphere index for $O(\log N)$ R-Tree candidate searches.
 */
const RoadSchema = new mongoose.Schema({
  osm_id: { type: String, required: true, unique: true, index: true },
  name: { type: String, default: 'Unnamed Road' },
  highway: { type: String }, // e.g. 'residential', 'primary', 'service'
  oneWay: { type: Boolean, default: false },
  geometry: {
    type: {
      type: String,
      enum: ['LineString'],
      required: true
    },
    coordinates: {
      type: [[Number]], // Array of [longitude, latitude] arrays
      required: true
    }
  }
});

// Spatial 2dsphere index for geospatial querying
RoadSchema.index({ geometry: '2dsphere' });

module.exports = mongoose.model('Road', RoadSchema);
