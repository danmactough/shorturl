/**
 * Module dependencies.
 */

var mongoose = require('mongoose'),
    Schema = mongoose.Schema;

// // Needs to be loaded first to be a ref
// require('./Url');

var HitSchema = new Schema({
  ip: { type: String, required: true },
  referer: { type: String },
  useragent: { type: String },
  timestamp: { type: Date },
  url: { type: Schema.ObjectId, ref: 'UrlSchema', required: true }
}, {
  strict: true
});

HitSchema.index({ url: 1, ip: 1, referer: 1 }, { unique: true });

HitSchema.virtual('created')
  .get(function () {
    return this._id.generationTime;
  });

HitSchema.pre('save', function (next) {
  if (!('timestamp' in this)) this.timestamp = new Date();
  next();
});

module.exports = mongoose.model('Hit', HitSchema);