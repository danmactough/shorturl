/**
 * Module dependencies.
 */

var mongoose = require('mongoose')
  , NewBase60 = require('NewBase60')
  , env = process.env.NODE_ENV || 'development'
  ;

var Schema = mongoose.Schema
  , ObjectId = Schema.ObjectId
  , Counter
  , Url
  , Hits
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
      Counter.collection.findAndModify({ c: { $ne: -1 } }, [], { $inc: { c: 1 } }, { "new": true, upsert: true }, function (err, doc){
        if (err) next(err);
        else {
          self.ct = doc.c;
          self.shorturl = NewBase60.numtosxg(self.ct);
          next();
        }
      });
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

UrlSchema.plugin(shorturlGenerator());

UrlSchema.methods.toJSON = function (host){
  var obj = this.toObject();
  delete obj._id;
  delete obj.ct;
  obj.shorturl = host + this.shorturl;
  return obj;
};

UrlSchema.statics.findByUrl = function findByUrl (url, callback){
  return this.findOne({ longurl: RegExp('^'+url+'$', 'i')}, { ct: 0 }, callback);
};

UrlSchema.pre('save', function (next){
  this.created = new Date();
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

UrlSchema.pre('save', function (next){
  if (!'timestamp' in this) this.timestamp = new Date();
  next();
});

exports.Url = Url   = mongoose.model('Url',  UrlSchema);
exports.Hits = Hits = mongoose.model('Hits', HitSchema);

exports.dbUri = { test:        'mongodb://localhost/shorturl-test'
                , development: 'mongodb://localhost/shorturl-development'
                , production:  'mongodb://localhost/shorturl-production' };

db = mongoose.connect( exports.dbUri[env] ); // db is a GLOBAL
