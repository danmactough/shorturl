/**
 * Module dependencies.
 */

var mongoose = require('mongoose')
  , NewBase60 = require('newbase60')
  , env = process.env.NODE_ENV || 'development'
  , conf = require('./config')[env]
  ;

var Schema = mongoose.Schema
  , ObjectId = Schema.ObjectId
  , Counter
  , Url
  , Hits
  , LoginToken
  ;

var CounterSchema = new Schema({
  'c': { type: Number, unique: true }
}, { strict: true });

exports.Counter = Counter = mongoose.model('Counter', CounterSchema);

exports.CounterInit = function (i, cb){
  Counter.update({}, { $set: { c: i } }, { upsert: true },  cb);
};

function shorturlGenerator (options){
  options = options || {};
  var key = options.key || 'longurl';

  return function (schema){
  schema.pre('save', function (next){
    if (!this.isNew) next();
    else {
      var self = this;
      if (self.shorturl && self.shorturl.length) {
        if (!self.ct) { // We have the shorturl, but not the ct -- must be importing!
          self.ct = NewBase60.SxgToInt(self.shorturl);
          next();
        }
        else if (self.ct != NewBase60.SxgToInt(self.shorturl))
          next(new Error('Shorturl does not appear to be valid'));
      } else {
        Counter.collection.findAndModify({ c: { $ne: -1 } }, [], { $inc: { c: 1 } }, { "new": true, upsert: true }, function (err, doc){
          if (err) next(err);
          else {
            self.ct = doc.c;
            self.shorturl = NewBase60.IntToSxg(self.ct);
            next();
          }
        });
      }
    }
  });
  };
}

var UrlSchema = new Schema({
  'ct': { type: Number } // Our pseudo-atomic counter id
, 'shorturl': { type: String }
, 'longurl': { type: String, required: true }
, 'title': { type: String }
, 'created': { type: Date }
, 'hits': {
    'count': { type: Number, default: 0 }
  , 'lasttimestamp': { type: Date } }
}, { strict: true });

UrlSchema.index({ ct: -1 }, { unique: true });
UrlSchema.index({ shorturl: -1 }, { unique: true });
UrlSchema.index({ longurl: 1 }, { unique: true });
UrlSchema.index({ 'hits.lasttimestamp': -1 }, { sparse: true });

UrlSchema.plugin(shorturlGenerator());

UrlSchema.methods.toJSON = function (host){
  var obj = this.toObject();
  delete obj._id;
  delete obj.ct;
  obj.shorturl = host + this.shorturl;
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

var HitSchema = new Schema({
  'ip': { type: String, required: true }
, 'referer': { type: String }
, 'useragent': { type: String }
, 'timestamp': { type: Date }
, 'url': { type: ObjectId, ref: 'UrlSchema', required: true }
}, { strict: true });

HitSchema.index({ url: 1, ip: 1, referer: 1 }, { unique: true });

HitSchema.virtual('created')
  .get(function() {
    return this._id.generationTime;
  });

HitSchema.pre('save', function (next){
  if (!'timestamp' in this) this.timestamp = new Date();
  next();
});

var LoginTokenSchema = new Schema ({
  'username': String
, 'series': String
, 'token': String
}, { strict: true });

LoginTokenSchema.index({ username: 1 });
LoginTokenSchema.index({ series: 1 });
LoginTokenSchema.index({ token: 1 });

LoginTokenSchema.virtual('cookieValue')
  .get(function() {
    return JSON.stringify({ username: this.username, token: this.token, series: this.series });
  });

LoginTokenSchema.method('randomToken', function() {
  return Math.round((new Date().valueOf() * Math.random())) + '';
});

LoginTokenSchema.pre('save', function(next) {
  // Automatically create the tokens
  this.token = this.randomToken();

  if (this.isNew)
    this.series = this.randomToken();

  next();
});

exports.Url        = Url        = mongoose.model('Url',        UrlSchema);
exports.Hits       = Hits       = mongoose.model('Hits',       HitSchema);
exports.LoginToken = LoginToken = mongoose.model('LoginToken', LoginTokenSchema);

exports.dbUri = conf.db.uri;

db = mongoose.connect( exports.dbUri ); // db is a GLOBAL
