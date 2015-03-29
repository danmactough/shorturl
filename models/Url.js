/**
 * Module dependencies.
 */

var mongoose = require('mongoose'),
    Schema = mongoose.Schema,
    NewBase60 = require('newbase60'),
    urlResolve = require('url').resolve,
    _ = require('lodash'),
    debug = require('debug')('shorturl:models:Url');

var Counter = require('./Counter');

var env = process.env.NODE_ENV || 'development',
    conf = require('../config')[env];

var UrlSchema = new Schema({
  ct: { type: Number }, // Our pseudo-atomic counter id
  shorturl: { type: String },
  longurl: { type: String, required: true },
  title: { type: String },
  created: { type: Date },
  hits: {
    count: { type: Number, default: 0 },
    lasttimestamp: { type: Date }
  }
}, {
  strict: true
});

UrlSchema.index({ ct: -1 }, { unique: true });
UrlSchema.index({ shorturl: -1 }, { unique: true });
UrlSchema.index({ longurl: 1 }, { unique: true });
UrlSchema.index({ 'hits.lasttimestamp': -1 }, { sparse: true });

UrlSchema.plugin(shorturlGenerator());

UrlSchema.methods.toJSON = function () {
  var obj = _.omit(this.toObject(), '_id', 'ct');
  obj.shorturl = urlResolve(conf.redirector.url, this.shorturl);
  return obj;
};

UrlSchema.statics.findByShorturl = function findByShorturl (url, callback){
  return this.findOne({ shorturl: url }, { ct: 0 }, callback);
};

UrlSchema.statics.findByUrl = function findByUrl (url, callback){
  return this.findOne({ longurl: RegExp('^'+url+'$', 'i')}, { ct: 0 }, callback);
};

UrlSchema.pre('save', function (next){
  if (this.isNew) this.created = new Date();
  next();
});

function shorturlGenerator (options) {
  options || (options = {});

  return function (schema) {
    schema.pre('save', function (next) {
      var UrlModel = this;

      if (!UrlModel.isNew) return next();

      if (UrlModel.shorturl && UrlModel.shorturl.length) {
        if (!UrlModel.ct) { // We have the shorturl, but not the ct -- must be importing!
          UrlModel.ct = NewBase60.SxgToInt(UrlModel.shorturl);
          debug('assigned model property ct: %s', UrlModel.ct);
          next();
        }
        else if (UrlModel.ct != NewBase60.SxgToInt(UrlModel.shorturl)) {
          next(new Error('Shorturl does not appear to be valid'));
        }
        else {
          next();
        }
      }
      else {
        Counter.collection.findAndModify({ c: { $ne: -1 } }, [], { $inc: { c: 1 } }, { "new": true, upsert: true }, function (err, doc) {
          if (err) return next(err);
          UrlModel.ct = doc.c;
          UrlModel.shorturl = NewBase60.IntToSxg(UrlModel.ct);
          debug('assigned model properties ct: %s, shorturl: %s', UrlModel.ct, UrlModel.shorturl);
          next();
        });
      }
    });
  };
}

module.exports = mongoose.model('Url', UrlSchema);