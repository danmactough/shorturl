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
      if (err) res.error(err);
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
  if (!(req.getInfo || req.getJSON)) res.error(400);
  else {
    models.Url.findOne({ shorturl: req.params.shorturl })
      .run(function (err, result){
        if (err) res.error(err);
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

main.configure(function(){
  main.set('views', __dirname + '/views');
  main.set('view engine', 'jade');
  main.set('view options', { pretty: true });
  main.use(express.static(__dirname + '/public'));
  main.use(express.bodyParser());
  main.use(express.methodOverride());
  main.use(express.cookieParser());
  main.use(express.session({ store: mongoStore(main.set('db-uri')), secret: config.SessionSecret }));
  main.use(express.csrf());
  main.use(main.router);
});

main.dynamicHelpers(
  { csrf: function(req,res){ return req.session._csrf; }
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
        res.redirect('/create');
      });
    });
  } else {
    res.redirect('back');
  }
});

main.get('/create', middleware.authUser, function (req, res){
  res.render('create',
    { title: 'Create a New Short Url' }
  );
});

main.post('/create', middleware.authUser, function (req, res){
  models.Url.findByUrl(req.body.url, function (err, doc){
    if (err) res.error(err);
    else if (doc) res.json(doc.toJSON(config.BaseUrl));
    else {
      var u = new models.Url({longurl: req.body.url });
      u.save(function (err){
        if (err) res.error(err);
        else res.json(u.toJSON(config.BaseUrl));
      });
    }
  });
});

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
