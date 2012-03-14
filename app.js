
/**
 * Module dependencies.
 */

var express = require('express')
  , models = require('./models')
  , routes = require('./routes')
  ;

var responder = express.createServer();

responder.use(express.logger());

responder.get('/:shorturl.:format?', function (req, res){
  models.Url.findOne({ shorturl: req.params.shorturl })
    .run(function (err, doc){
      if (err) res.error(err);
      else if (doc) {
        if (req.params.format && req.params.format.toLowerCase() === 'json')
          res.json(doc.toJSON('http://mact.me/'));
        else {
          var timestamp = new Date()
            , hit = new models.Hits();
          ++doc.hits.count;
          doc.hits.lasttimestamp = timestamp;
          doc.save();
          hit.ip = req.connection['remoteAddress'];
          hit.referer = req.headers['referer'];
          hit.useragent = req.headers['user-agent'];
          hit.timestamp = timestamp;
          hit.url = doc._id;
          console.log(hit);
          hit.save(function (err){
            if (err && !/E11000 duplicate key error index/.test(err.err)) console.error(err);
            res.redirect(doc.longurl, 301);
          });
        }
      }
      else res.send(404);
    });
});

responder.all('*', function (req, res){
  res.send(404);
});

var app = module.exports = express.createServer();

// Configuration

app.configure(function(){
  app.set('views', __dirname + '/views');
  app.set('view engine', 'jade');
  app.use(express.bodyParser());
  app.use(express.methodOverride());
  app.use(express.cookieParser());
  app.use(express.session({ secret: 'your secret here' }));
  app.use(app.router);
  app.use(express.static(__dirname + '/public'));
});

app.configure('development', function(){
  app.use(express.errorHandler({ dumpExceptions: true, showStack: true }));
});

app.configure('production', function(){
  app.use(express.errorHandler());
});

// Routes

//app.get('/', routes.index);

app.use(express.vhost('shorturl', responder));

app.listen(3001);
console.log("Express server listening on port %d in %s mode", app.address().port, app.settings.env);
