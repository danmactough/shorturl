/**
 * Module dependencies.
 */
var path = require('path');

module.exports = function (app) {
  app.get('/info.:format?',
          require(path.resolve(app.get('root'), 'middleware', 'authenticate')),
          infoHandler);

  var models = require(path.resolve(app.get('root'), 'models'));

  function infoHandler (req, res, next) {
    var query = {};
    if (req.query && req.query.since) {
      query = {
        'hits.lasttimestamp': {
          '$gte': new Date(+req.query.since)
        }
      };
    }
    models.Url.find(query)
      .sort('hits.lasttimestamp', -1)
      .exec(function (err, docs) {
        if (err) return next(err);
        else res.json(docs.map(function (u) { return u.toJSON(); }));
      });
  }
};