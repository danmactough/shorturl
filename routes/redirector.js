/**
 * Module dependencies.
 */

var path = require('path'),
    debug = require('debug')('shorturl:routes:redirector');

module.exports = function (app) {
  app.get('/:shorturl([^\+\.]+)', redirectHandler);
  app.get('/:shorturl([^\+\.]+):info([\+])?.:format?', infoHandler);

  var models = require(path.resolve(app.get('root'), 'models'));

  function redirectHandler (req, res, next) {
    models.Url.findByShorturl(req.params.shorturl).exec(function (err, doc){
      if (err) return next(err);
      else if (doc) {
        var timestamp = new Date(),
            hit = new models.Hit();

        hit.ip = req.headers['x-forwarded-for'] || req.connection['remoteAddress'];
        hit.referer = req.headers['referer'];
        hit.useragent = req.headers['user-agent'];
        hit.timestamp = timestamp;
        hit.url = doc._id;
        hit.save(function (err){
          if (err && !/E11000 duplicate key error index/.test(err.err)) {
            debug(err);
          }
          else if (!err) {
            // This should be atomic
            doc.hits.count++;
            doc.hits.lasttimestamp = timestamp;
            doc.save(function (err) {
              if (err) debug(err);
            });
          }
        });
        res.redirect(301, doc.longurl);
     }
     else res.sendStatus(404);
   });
  }

  function infoHandler (req, res, next) {
    if (!(req.params.info === '+' || req.params.format === 'json')) {
      res.sendStatus(400);
    }
    else {
      models.Url.findByShorturl(req.params.shorturl)
        .exec(function (err, result){
          if (err) return next(err);
          else if (result) {
            var doc = result.toJSON();
            if (req.params.format === 'json')
              res.json(doc);
            else {
              res.render('info', {
                title: 'Info about ' + doc.shorturl,
                doc: doc
              });
            }
          }
          else res.sendStatus(404);
        });
    }
  }
};
