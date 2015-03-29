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
    methodOverride = require('method-override'),
    cookieParser = require('cookie-parser'),
    csrf = require('csurf'),
    MongoStore = require('connect-mongo')(session),
    jade = require('jade'),
    errorLogger = require('./error-logger'),
    auth = require('./scripts/newUser').auth,
    models = require('./models'),
    user = require('./user');

require('express-app-set-nested');

var env = process.env.NODE_ENV = process.env.NODE_ENV || 'development';
var conf = require('./config')[env];
var pkg = require('./package.json');

var app = module.exports = express();

app.locals = require('./locals')(app);

// Configuration

app.set('user', user); // wut?

function checkApiKey (){
  return function (req, res, next){
    var key = null;
    if (req.body && req.body.apikey) key = req.body.apikey;
    else if (req.query && req.query.apikey) key = req.query.apikey;
    else if (req.headers['x-api-key']) key = req.headers['x-api-key'];
    if (key === null) {
      next();
    } else if (key === app.set('user')['api_key']) {
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
app.use(static('public', { 'index':  false }));

// Jade templates
app.engine('jade', jade.__express);
app.set('view engine', 'jade');
app.set('views', path.resolve(__dirname, 'views'));

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: false }));
app.use(methodOverride());
app.use(cookieParser());
app.use(checkApiKey());
app.use(session({
  store:             new MongoStore({ url: conf.db.uri }),
  secret:            conf.session_secret,
  resave:            false,
  saveUninitialized: false
}));
app.use(csrf({
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
app.use(expressMessages);
app.use(function (req, res, next) {
  res.locals.csrfToken = req.csrfToken;
  res.locals.loggedIn = req.session.username || req.cookies.logintoken; // This is not a security function, just a hint that is used for the navbar
  next();
});

// Params

app.param('format', function (req, res, next){
  req.params.format = req.params.format.toLowerCase();
  next();
});

// Routes

var middleware = require('./middleware');

app.get('/signin', function (req, res){
  if (req.session.username || req.cookies.logintoken) res.redirect('/create');
  else {
    res.render('signin',
      { title: 'Sign In' }
    );
  }
});

app.post('/sessions', function (req, res){

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

app.delete('/sessions', middleware.authUser, function (req, res){
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

app.get('/create', middleware.authUser, middleware.validateLongUrl, function (req, res){
  res.render('create',
    { title: 'Create a New Short Url'
    , url: req.params.url || ''
    }
  );
});

function shorten (req, res, next){

  function respond (doc){
    if (req.params.format === 'json')
      res.json(doc);
    else
      res.send(doc.shorturl, { 'Content-Type': 'text/plain' }, 200);
  }

  if (!(req.params && req.params.url))
    return res.sendStatus(400);

  models.Url.findByUrl(req.params.url, function (err, doc){
    if (err) return next(err);
    else if (doc) respond(doc.toJSON());
    else {
      var u = new models.Url({longurl: req.params.url });
      u.save(function (err){
        if (err) return next(err);
        else respond(u.toJSON());
      });
    }
  });
}

app.get('/shorten.:format?', middleware.authUser, middleware.validateLongUrl, shorten);
app.post('/shorten.:format?', middleware.authUser, middleware.validateLongUrl, shorten);

app.get('/info.:format?', middleware.authUser, function (req, res){
  var query = {};
  if (req.query && req.query.since) query = { 'hits.lasttimestamp': { '$gte': new Date(+req.query.since) } };
  models.Url.find(query)
    .sort('hits.lasttimestamp', -1)
    .exec(function (err, docs){
      if (err) return next(err);
      else res.json(docs.map(function (u){return u.toJSON();}));
    });
});

app.all('/', function (req, res){
  debug('Redirecting to signin');
  res.redirect('/signin');
});

app.all('*', function (req, res){
  debug('Not found');
  res.sendStatus(404);
});

if (env === 'development') {
  app.use(errorhandler({log: errorLogger.log}));
}
