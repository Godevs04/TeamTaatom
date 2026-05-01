const mongoose = require('mongoose');

/**
 * Single-document cache for INR foreign-exchange rates.
 *
 * Why a model and not just an in-memory cache: the server restarts (deploys,
 * crashes, scaling events) drop in-memory caches. If the FX API is
 * temporarily unreachable right after a deploy we'd silently fall back to
 * hardcoded rates and serve stale prices to fans for hours. Persisting the
 * last-known-good rates means a fresh server can serve real prices
 * immediately, and only falls through to the hardcoded table if the DB
 * itself has never seen rates (first boot).
 *
 * One document, ever. Uses a fixed `_id` so all callers see the same row.
 */
const fxRateCacheSchema = new mongoose.Schema({
  // Fixed key so getInstance() always reads/writes the same doc.
  scope: { type: String, default: 'inr_base', unique: true },
  // Map of { USD: 0.012, EUR: 0.011, ... } — keys are ISO 4217 codes,
  // values are how many target-currency units 1 INR converts to.
  rates: { type: mongoose.Schema.Types.Mixed, default: {} },
  // Where the rates came from. 'api' for live fetch, 'fallback' if the API
  // call failed and we wrote the hardcoded table to bootstrap the cache.
  source: { type: String, enum: ['api', 'fallback'], default: 'fallback' },
  fetchedAt: { type: Date, default: Date.now },
}, { timestamps: true });

fxRateCacheSchema.statics.getInstance = async function () {
  let doc = await this.findOne({ scope: 'inr_base' });
  if (!doc) {
    doc = await this.create({ scope: 'inr_base', rates: {}, source: 'fallback' });
  }
  return doc;
};

module.exports = mongoose.model('FxRateCache', fxRateCacheSchema);
