/**
 * Module dependencies.
 */

var path = require('path'),
    debug = require('debug')('shorturl:redirector');

var express = require('express'),
    errorhandler = require('errorhandler'),
    static = require('serve-static'),
    bodyParser = require('body-parser'),
    jade = require('jade'),
    errorLogger = require('./error-logger'),
    models = require('./models');

require('express-app-set-nested');

var env = process.env.NODE_ENV = process.env.NODE_ENV || 'development';
var conf = require('./config')[env];

var app = module.exports = express();

app.locals = require('./locals')(app);

// Static file server
app.use(static('public', { 'index':  false }));

// Jade templates
app.engine('jade', jade.__express);
app.set('view engine', 'jade');
app.set('views', path.resolve(__dirname, 'views'));

// Middleware
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: false }));

// Params
require('./routes/params')(app);

// Routes

app.get('/:shorturl([^\+\.]+)', function (req, res, next) {
  models.Url.findByShorturl(req.params.shorturl).exec(function (err, doc){
    if (err) return next(err);
    else if (doc) {
      var timestamp = new Date()
        , hit = new models.Hit();
      hit.ip = req.headers['x-forwarded-for'] || req.connection['remoteAddress'];
      hit.referer = req.headers['referer'];
      hit.useragent = req.headers['user-agent'];
      hit.timestamp = timestamp;
      hit.url = doc._id;
      hit.save(function (err){
        if (err && !/E11000 duplicate key error index/.test(err.err)) debug(err);
        else if (!err) {
          doc.hits.count++;
          doc.hits.lasttimestamp = timestamp;
          doc.save();
        }
      });
      res.redirect(301, doc.longurl);
    }
    else res.sendStatus(404);
  });
});

app.get('/:shorturl([^\+\.]+):info([\+])?.:format?', function (req, res, next) {
  if (!(req.params.info === '+' || req.params.format === 'json')) res.sendStatus(400);
  else {
    models.Url.findByShorturl(req.params.shorturl)
      .exec(function (err, result){
        if (err) return next(err);
        else if (result) {
          var doc = result.toJSON();
          if (req.params.format === 'json')
            res.json(doc);
          else {
            res.render('info', {
              title: 'Info about ' + doc.shorturl
            , doc: doc
            });
          }
        }
        else res.sendStatus(404);
      });
  }
});

app.all('/', function (req, res){
  debug('Redirecting to shortener');
  res.redirect(conf.shortener.url);
});

app.all('*', function (req, res){
  debug('Not found');
  res.sendStatus(404);
});

if (env === 'development') {
  app.use(errorhandler({log: errorLogger.log}));
}
