/**
 * Shorturl - A url shortener
 */

/**
 * Module dependencies.
 */

var http = require('http'),
    path = require('path'),
    mongoose = require('mongoose'),
    debug = require('debug')('shorturl');

var express = require('express'),
    errorhandler = require('errorhandler'),
    notifier = require('node-notifier'),
    expressMessages = require('express-messages-bootstrap').with({ should_render:true }),
    session = require('express-session'),
    static = require('serve-static'),
    bodyParser = require('body-parser'),
    methodOverride = require('method-override'),
    cookieParser = require('cookie-parser'),
    csrf = require('csurf'),
    MongoStore = require('connect-mongo')(session),
    jade = require('jade'),
    auth = require('./scripts/newUser').auth,
    models = require('./models'),
    user = require('./user');

require('express-app-set-nested');

var env = process.env.NODE_ENV = process.env.NODE_ENV || 'development';
var conf = require('./config')[env];
var pkg = require('./package.json');

var red = express();
Object.keys(pkg).forEach(function (prop) {
  red.set('package.' + prop, pkg[prop]);
});

// Static file server
red.use(static('public', { 'index':  false }));

// Jade templates
red.engine('jade', jade.__express);
red.set('view engine', 'jade');
red.set('views', path.resolve(__dirname, 'views'));

red.use(bodyParser.json());
red.use(bodyParser.urlencoded({ extended: false }));

red.param('format', function (req, res, next){
  req.params.format = req.params.format.toLowerCase();
  next();
});

red.get('/:shorturl([^\+\.]+)', function (req, res){
  models.Url.findByShorturl(req.params.shorturl).exec(function (err, doc){
    if (err) res.send(err.message, 500);
    else if (doc) {
      var timestamp = new Date()
        , hit = new models.Hits();
      hit.ip = req.headers['x-forwarded-for'] || req.connection['remoteAddress'];
      hit.referer = req.headers['referer'];
      hit.useragent = req.headers['user-agent'];
      hit.timestamp = timestamp;
      hit.url = doc._id;
      hit.save(function (err){
        if (err && !/E11000 duplicate key error index/.test(err.err)) console.error(err);
        else if (!err) {
          doc.hits.count++;
          doc.hits.lasttimestamp = timestamp;
          doc.save();
        }
      });
      res.redirect(301, doc.longurl);
    }
    else res.send(404);
  });
});

red.get('/:shorturl([^\+\.]+):info([\+])?.:format?', function (req, res){
  if (!(req.params.info === '+' || req.params.format === 'json')) res.send(400);
  else {
    models.Url.findByShorturl(req.params.shorturl)
      .exec(function (err, result){
        if (err) res.send(err.message, 500);
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
        else res.send(404);
      });
  }
});

red.all('/', function (req, res){ res.redirect(conf.shortener.url); });

red.all('*', function (req, res){
  res.send(404);
});

red.locals = {
  pretty: env === 'development'
};

main = exports.main = express();
Object.keys(pkg).forEach(function (prop) {
  main.set('package.' + prop, pkg[prop]);
});

// Configuration

main.set('user', user); // wut?

function checkApiKey (){
  return function (req, res, next){
    var key = null;
    if (req.body && req.body.apikey) key = req.body.apikey;
    else if (req.query && req.query.apikey) key = req.query.apikey;
    else if (req.headers['x-api-key']) key = req.headers['x-api-key'];
    if (key === null) {
      next();
    } else if (key === main.set('user')['api_key']) {
      req.apikey = key;
      req.session = {}; // Mock the session so it doesn't generate
      next();
    } else {
      var e = new Error('Unauthorized (bad API key)');
      e.status = 403;
      next(e);
    }
  };
}

// Static file server
main.use(static('public', { 'index':  false }));

// Jade templates
main.engine('jade', jade.__express);
main.set('view engine', 'jade');
main.set('views', path.resolve(__dirname, 'views'));

// Static view helpers
// main.locals = require(path.resolve(__dirname, 'locals'));
var middleware = main.middleware = require('./middleware');

main.use(bodyParser.json());
main.use(bodyParser.urlencoded({ extended: false }));
main.use(methodOverride());
main.use(cookieParser());
main.use(checkApiKey());
main.use(session({
  store:             new MongoStore({ url: conf.db.uri }),
  secret:            conf.session_secret,
  resave:            false,
  saveUninitialized: false
}));
main.use(csrf({
  cookie: false, // use session instead of a cookie
  value: function (req) {
    return (req.apikey && req.session._csrf) || // Skip the CSRF check for API requests
      (req.body && req.body._csrf) ||
      (req.query && req.query._csrf) ||
      req.headers['csrf-token'] ||
      req.headers['xsrf-token'] ||
      req.headers['x-csrf-token'] ||
      req.headers['x-xsrf-token'];
  }
}));
main.use(expressMessages);
main.use(function (req, res, next) {
  res.locals.csrfToken = req.csrfToken;
  res.locals.loggedIn = req.session.username || req.cookies.logintoken; // This is not a security function, just a hint that is used for the navbar
  next();
});

main.locals = {
  pretty: env === 'development'
};

// Params

main.param('format', function (req, res, next){
  req.params.format = req.params.format.toLowerCase();
  next();
});

// Routes

var middleware = require('./middleware');

main.get('/signin', function (req, res){
  if (req.session.username || req.cookies.logintoken) res.redirect('/create');
  else {
    res.render('signin',
      { title: 'Sign In' }
    );
  }
});

main.post('/sessions', function (req, res){

  if ((req.body.username === user.username) &&
      (req.body.password && auth(req.body.password, user.hashed_password, user.salt))) {
    var redirect_url = req.session.originalUrl;
    req.session.regenerate(function (){
      // Add the user data to the session variable for convenience
      req.session.user = user;
      req.session.username = user.username;

      // Store the user's primary key
      // in the session store to be retrieved,
      var loginToken = new models.LoginToken({ username: user.username });
      loginToken.save(function () {
        // Remember me
        if (req.body.rememberme) {
          res.cookie('logintoken', loginToken.cookieValue, { expires: new Date(Date.now() + 2 * 604800000), path: '/' }); // 2 weeks
        } else {
          res.cookie('logintoken', loginToken.cookieValue, { expires: false });
        }
        res.redirect(redirect_url || '/create');
      });
    });
  } else {
    req.error('Your username and password did not match. Please try again.');
    res.redirect('back');
  }
});

main.delete('/sessions', middleware.authUser, function (req, res){
  // destroy the user's session to log them out
  // will be re-created next request
  if (req.session) {
    models.LoginToken.remove({ username: req.session.username }, function() {} );
    req.session.destroy(function(){
      res.clearCookie('logintoken');
      res.redirect('/signin');
    });
  }
});

main.get('/create', middleware.authUser, middleware.validateLongUrl, function (req, res){
  res.render('create',
    { title: 'Create a New Short Url'
    , url: req.params.url || ''
    }
  );
});

function shorten (req, res){

  function respond (doc){
    if (req.params.format === 'json')
      res.json(doc);
    else
      res.send(doc.shorturl, { 'Content-Type': 'text/plain' }, 200);
  }

  if (!(req.params && req.params.url))
    return res.send(400);

  models.Url.findByUrl(req.params.url, function (err, doc){
    if (err) res.send(err.message, 500);
    else if (doc) respond(doc.toJSON());
    else {
      var u = new models.Url({longurl: req.params.url });
      u.save(function (err){
        if (err) res.send(err.message, 500);
        else respond(u.toJSON());
      });
    }
  });
}

main.get('/shorten.:format?', middleware.authUser, middleware.validateLongUrl, shorten);
main.post('/shorten.:format?', middleware.authUser, middleware.validateLongUrl, shorten);

main.get('/info.:format?', middleware.authUser, function (req, res){
  var query = {};
  if (req.query && req.query.since) query = { 'hits.lasttimestamp': { '$gte': new Date(+req.query.since) } };
  models.Url.find(query)
    .sort('hits.lasttimestamp', -1)
    .exec(function (err, docs){
      if (err) res.send(err.message, 500);
      else res.json(docs.map(function (u){return u.toJSON();}));
    });
});

main.all('/', function (req, res){
  res.redirect('/signin');
});

main.all('*', function (req, res){
  res.send(404);
});

if (env === 'development') {
  red.use(errorhandler({log: errorHandler}));
  main.use(errorhandler({log: errorHandler}));
}

/* Only listen on $ node app.js */
if (!module.parent) {

  mongoose.connect( conf.db.uri );

  http.createServer(red).listen(conf.redirector.port, conf.redirector.hostname || '0.0.0.0', function (err) {
    debug("%s v%s redirector listening on port %d in %s mode", red.get('package.name'), red.get('package.version'), this.address().port, red.settings.env);
  });

  http.createServer(main).listen(conf.shortener.port, conf.shortener.hostname || '0.0.0.0', function (err) {
    debug("%s v%s shortener app listening on port %d in %s mode", main.get('package.name'), main.get('package.version'), this.address().port, main.settings.env);
  });
}

function errorHandler (err, str, req, res) {
  debug(err);
  var title = 'Error in ' + req.method + ' ' + req.url;
  errorNotification(title, str);
}

function errorNotification (title, str) {
  notifier.notify({
    title: title,
    message: str
  });
}

process.on('uncaughtException', function (err) {
  var title = require('util').format('%s - Uncaught exception', new Date());
  debug(title);
  errorNotification(title, err.message);
  throw(err);
});
