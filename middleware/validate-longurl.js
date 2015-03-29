/*
 * Module dependencies
 */
var debug = require('debug')('shorturl:middleware:validate-long-url');

// The regex is merely a test for a valid protocal prefix
module.exports = function validateLongUrl (req, res, next) {
  var longurl;
  if (!('params' in req)) req.params = {};

  if (req.params && req.params.url) longurl = req.params.url;
  else if (req.body && req.body.url) req.params.url = longurl = req.body.url;
  else if (req.query && req.query.url) req.params.url = longurl = req.query.url;

  debug('longurl: %s', longurl);
  if (!longurl) next(); // No need to raise an error here
  else if (!/^[A-Za-z][A-Za-z0-9\+\.\-]+:\/\//.test(longurl)) next(new Error('Invalid URL'));
  else next();
};
