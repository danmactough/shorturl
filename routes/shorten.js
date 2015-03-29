/**
 * Module dependencies.
 */
var path = require('path'),
    debug = require('debug')('shorturl:routes:shorten');

module.exports = function (app) {
  app.get('/shorten.:format?',
          require(path.resolve(app.get('root'), 'middleware', 'authenticate')),
          require(path.resolve(app.get('root'), 'middleware', 'validate-longurl')),
          shorten);
  app.post('/shorten.:format?',
          require(path.resolve(app.get('root'), 'middleware', 'authenticate')),
          require(path.resolve(app.get('root'), 'middleware', 'validate-longurl')),
          shorten);

  var models = require(path.resolve(app.get('root'), 'models'));

  function shorten (req, res, next) {

    function respond (doc) {
      if (req.params.format === 'json')
        res.json(doc);
      else
        res.send(doc.shorturl, { 'Content-Type': 'text/plain' }, 200);
    }

    if (!(req.params && req.params.url)) {
      return res.sendStatus(400);
    }

    models.Url.findByUrl(req.params.url, function (err, doc){
      if (err) return next(err);
      else if (doc) respond(doc.toJSON());
      else {
        var u = new models.Url({longurl: req.params.url });
        u.save(function (err){
          if (err) return next(err);
          else {
            debug('created a new short url: %j', u);
            respond(u.toJSON());
          }
        });
      }
    });
  }


};