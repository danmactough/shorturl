/**
 * Shorty - A url shortener
 */

/**
 * Module dependencies.
 */

var express = require('express')
  , mongoStore = require('connect-mongodb')
  , models = require('./models')
  , routes = require('./routes')
  , auth = require('./scripts/newUser').auth
  , config = require('./config')
  , user = require('./user')
  ;

var red = express.createServer();

red.configure('development', function(){
  red.set('db-uri', models.dbUri.development);
  red.use(express.errorHandler({ dumpExceptions: true, showStack: true }));
});

red.configure('production', function(){
  red.set('db-uri', models.dbUri.production);
  red.use(express.errorHandler());
});

red.configure(function(){
  red.set('views', __dirname + '/views');
  red.set('view engine', 'jade');
  red.set('view options', { pretty: true });
  red.use(express.static(__dirname + '/public'));
  red.use(express.bodyParser());
  red.use(red.router);
});

red.param('format', function (req, res, next){
  if (req.params.format && req.params.format.toLowerCase() === 'json')
    req.getJSON = true;
  else req.getJSON = false;
  next();
});

red.param('info', function (req, res, next){
  if (req.params.info && req.params.info === '+')
    req.getInfo = true;
  else req.getInfo = false;
  next();
});

red.get('/:shorturl([^\+\.]+)', function (req, res){
  models.Url.findOne({ shorturl: req.params.shorturl })
    .run(function (err, doc){
      if (err) res.send(err.message, 500);
      else if (doc) {
        var timestamp = new Date()
          , hit = new models.Hits();
        hit.ip = req.connection['remoteAddress'];
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
          res.redirect(doc.longurl, 301);
        });
      }
      else res.send(404);
    });
});

red.get('/:shorturl([^\+\.]+):info([\+])?.:format?', function (req, res){
  if (!(req.getInfo || req.getJSON)) res.send(400);
  else {
    models.Url.findOne({ shorturl: req.params.shorturl })
      .run(function (err, result){
        if (err) res.send(err.message, 500);
        else if (result) {
          var doc = result.toJSON(config.BaseUrl)
          if (req.getJSON)
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

red.all('*', function (req, res){
  res.send(404);
});

var main;
exports.main = main = express.createServer();

// Configuration

main.set('user', user);

main.configure('development', function(){
  main.set('db-uri', models.dbUri.development);
  main.use(express.errorHandler({ dumpExceptions: true, showStack: true }));
});

main.configure('production', function(){
  main.set('db-uri', models.dbUri.production);
  main.use(express.errorHandler());
});

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
    }
    else {
      var e = new Error('Unauthorized (bad API key)');
      e.status = 403;
      next(e);
    }
  };
}

function debug (){
  return function (req, res, next){
    console.log(req.session);
    console.log(req.body);
    next();
  };
};
main.configure(function(){
  main.set('views', __dirname + '/views');
  main.set('view engine', 'jade');
  main.set('view options', { pretty: true });
  main.use(express.static(__dirname + '/public'));
  main.use(express.query());
  main.use(express.bodyParser());
  main.use(express.methodOverride());
  main.use(express.cookieParser());
  main.use(checkApiKey());
  main.use(express.session({ /*store: new mongoStore({db : main.set('db-uri')}), */ secret: config.SessionSecret }));
  main.use(express.csrf(    { 
      value: function (req){
        return (req.body && req.body._csrf)
          || (req.query && req.query._csrf)
          || (req.headers['x-csrf-token'])
          // Skip the CSRF check for API requests
          || (req.apikey && req.session._csrf);
      }
    }
    ));
  //main.use(debug());
  main.use(main.router);
});

main.dynamicHelpers(
  { csrf: function(req,res){ return req.session && req.session._csrf; }
  }
);

// Routes

var middleware = require('./middleware');

main.get('/signin', function (req, res){
  if (req.session.active) res.redirect('/create');
  else {
    res.render('signin',
      { title: 'Sign In' }
    );
  }
});

main.post('/signin', function (req, res){

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
    res.redirect('back');
  }
});

main.get('/create', middleware.authUser, function (req, res){
  res.render('create',
    { title: 'Create a New Short Url'
    , url: req.query.url || ''
    }
  );
});

function shorten (req, res){

  function respond (doc){
    if (req.params.format && req.params.format.toLowerCase() === 'json')
      res.json(doc);
    else
      res.send(doc.shorturl, { 'Content-Type': 'text/plain' }, 200);
  }

  var url;
  if (req.body && req.body.url) url = req.body.url;
  else if (req.query && req.query.url) url = req.query.url;
  else return res.send(400);
  models.Url.findByUrl(url, function (err, doc){
    if (err) res.send(err.message, 500);
    else if (doc) respond(doc.toJSON(config.BaseUrl));
    else {
      var u = new models.Url({longurl: url });
      u.save(function (err){
        if (err) res.send(err.message, 500);
        else respond(u.toJSON(config.BaseUrl));
      });
    }
  });
}

main.get('/shorten.:format?', middleware.authUser, shorten);
main.post('/shorten.:format?', middleware.authUser, shorten);

main.all('/', function (req, res){
  res.redirect('/signin');
});

main.all('*', function (req, res){
  res.send(404);
});

var app = module.exports = express.createServer();

app.configure('development', function(){
  app.use(express.errorHandler({ dumpExceptions: true, showStack: true }));
});

app.configure('production', function(){
  app.use(express.errorHandler());
});

app.use(express.vhost(config.vhost_redirector, red));
app.use(express.vhost(config.vhost_main, main));

app.listen(config.HTTPPort);
console.log("Express server listening on port %d in %s mode", app.address().port, app.settings.env);
