/*
 * Module dependencies
 */
var path = require('path'),
    debug = require('debug')('shorturl:middleware:check-apikey');

var cwd = process.cwd(),
    USER = require(path.resolve(cwd, 'user'));

module.exports = function checkApiKey () {
  return function (req, res, next){
    var key = null;
    if (req.body && req.body.apikey) key = req.body.apikey;
    else if (req.query && req.query.apikey) key = req.query.apikey;
    else if (req.headers['x-api-key']) key = req.headers['x-api-key'];
    if (key === null) {
      next();
    }
    else if (key === USER.api_key) {
      debug('Valid API key: %s', key);
      req.apikey = key;
      next();
    }
    else {
      debug('Invalid API key: %s', key);
      var e = new Error('Unauthorized (bad API key)');
      e.status = 403;
      next(e);
    }
  };
};