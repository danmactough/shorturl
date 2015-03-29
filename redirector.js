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
    errorLogger = require('./error-logger');

require('express-app-set-nested');

var env = process.env.NODE_ENV = process.env.NODE_ENV || 'development';

var app = module.exports = express();
app.set('root', __dirname);
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
require('./routes/redirector')(app);
require('./routes/index')(app);

if (env === 'development') {
  app.use(errorhandler({log: errorLogger.log}));
}
