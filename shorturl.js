/**
 * Shorturl - A url shortener
 */

/**
 * Module dependencies.
 */

var http = require('http'),
    mongoose = require('mongoose'),
    errorLogger = require('./error-logger'),
    debug = require('debug')('shorturl');

var env = process.env.NODE_ENV = process.env.NODE_ENV || 'development';
var conf = require('./config')[env];
var pkg = require('./package.json');

/* Only listen on $ node app.js */
if (!module.parent) {

  var shortener = require('./shortener');
  var redirector = require('./redirector');

  mongoose.connect( conf.db.uri );

  http.createServer(redirector).listen(conf.redirector.port, conf.redirector.hostname || '0.0.0.0', function () {
    debug("%s v%s redirector listening on port %d in %s mode", pkg.name, pkg.version, this.address().port, env);
  });

  http.createServer(shortener).listen(conf.shortener.port, conf.shortener.hostname || '0.0.0.0', function () {
    debug("%s v%s shortener app listening on port %d in %s mode", pkg.name, pkg.version, this.address().port, env);
  });

  process.on('uncaughtException', function (err) {
    var title = require('util').format('%s - Uncaught exception', new Date());
    debug(title);
    errorLogger.notify(title, err.message);
    throw(err);
  });
}
