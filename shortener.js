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
    errorLogger = require('./error-logger'),
    auth = require('./scripts/newUser').auth,
    models = require('./models'),
    user = require('./user');

require('express-app-set-nested');

var env = process.env.NODE_ENV = process.env.NODE_ENV || 'development';
var conf = require('./config')[env];

var app = module.exports = express();

app.locals = require('./locals')(app);

// Configuration

app.set('user', user); // wut?

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

app.delete('/sessions', require('./middleware/authenticate'), function (req, res){
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

app.get('/create', require('./middleware/authenticate'), require('./middleware/validate-longurl'), function (req, res){
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

app.get('/shorten.:format?', require('./middleware/authenticate'), require('./middleware/validate-longurl'), shorten);
app.post('/shorten.:format?', require('./middleware/authenticate'), require('./middleware/validate-longurl'), shorten);

app.get('/info.:format?', require('./middleware/authenticate'), function (req, res, next) {
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
