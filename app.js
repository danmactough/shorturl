/**
 * Shorty - A url shortener
 */

/**
 * Module dependencies.
 */

var express = require('express')
  , models = require('./models')
  , routes = require('./routes')
  , config = require('./config')
  ;

var red = express.createServer();

red.use(express.logger());

red.get('/:shorturl.:format?', function (req, res){
  models.Url.findOne({ shorturl: req.params.shorturl })
    .run(function (err, doc){
      if (err) res.error(err);
      else if (doc) {
        if (req.params.format && req.params.format.toLowerCase() === 'json')
          res.json(doc.toJSON(config.BaseUrl));
        else {
          var timestamp = new Date()
            , hit = new models.Hits();
          hit.ip = req.connection['remoteAddress'];
          hit.referer = req.headers['referer'];
          hit.useragent = req.headers['user-agent'];
          hit.timestamp = timestamp;
          hit.url = doc._id;
          //console.log(hit);
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
      }
      else res.send(404);
    });
});

red.all('*', function (req, res){
  res.send(404);
});

var main = express.createServer();

// Configuration

main.configure(function(){
  main.set('views', __dirname + '/views');
  main.set('view engine', 'jade');
  main.use(express.bodyParser());
  main.use(express.methodOverride());
  main.use(express.cookieParser());
  main.use(express.session({ secret: config.SessionSecret }));
  main.use(main.router);
  main.use(express.static(__dirname + '/public'));
});

main.configure('development', function(){
  main.use(express.errorHandler({ dumpExceptions: true, showStack: true }));
});

main.configure('production', function(){
  main.use(express.errorHandler());
});

// Routes

main.post('/getShorty', function (req, res){
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

main.all('*', function (req, res){
  res.send(404);
});

var app = module.exports = express.createServer();
app.use(express.vhost(config.vhost_redirector, red));
app.use(express.vhost(config.vhost_main, main));

app.listen(config.HTTPPort);
console.log("Express server listening on port %d in %s mode", app.address().port, app.settings.env);
