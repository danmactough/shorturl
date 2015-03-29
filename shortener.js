/**
 * Shorturl - A url shortener
 */

/**
 * Module dependencies.
 */

var path = require('path'),
    debug = require('debug')('shorturl:shortener');

var express = require('express'),
    errorhandler = require('errorhandler'),
    expressMessages = require('express-messages-bootstrap').with({ should_render:true }),
    session = require('express-session'),
    static = require('serve-static'),
    bodyParser = require('body-parser'),
    methodOverride = require(path.resolve(__dirname, 'middleware', 'method-override')),
    checkApikey = require(path.resolve(__dirname, 'middleware', 'check-apikey')),
    cookieParser = require('cookie-parser'),
    csrf = require(path.resolve(__dirname, 'middleware', 'csrf')),
    requestLocals = require(path.resolve(__dirname, 'middleware', 'locals')),
    MongoStore = require('connect-mongo')(session),
    jade = require('jade'),
    errorLogger = require('./error-logger');

require('express-app-set-nested');

var env = process.env.NODE_ENV = process.env.NODE_ENV || 'development';
var conf = require('./config')[env];

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
app.use(methodOverride());
app.use(cookieParser());
app.use(checkApikey());
app.use(session({
  store:             new MongoStore({ url: conf.db.uri }),
  secret:            conf.session_secret,
  resave:            false,
  saveUninitialized: false
}));
app.use(csrf());
app.use(expressMessages);
app.use(requestLocals);

// Params
require('./routes/params')(app);

// Routes
require('./routes/sessions')(app);
require('./routes/create')(app);
require('./routes/shorten')(app);
require('./routes/info')(app);
require('./routes/index')(app);

if (env === 'development') {
  app.use(errorhandler({log: errorLogger.log}));
}
