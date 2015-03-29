/*
 * Module dependencies
 */
var debug = require('debug')('shorturl:middleware:authenticate');

module.exports = function authenticate (req, res, next){
  if (req.session && req.session.user && req.session.username) {
    debug('authenticated by session - username: %s', req.session.username);
    next();
  }
  else if (req.apikey) {
    debug('authenticated by apikey - apikey: %s', req.apikey);
    next();
  }
  else if (req.cookies.logintoken) {
    authenticateFromLoginToken(req, res, function (err) {
      if (err) return next(err);
      debug('authenticated by logintoken - username: %s', req.session.username);
      next();
    });
  } else {
    debug('not authenticated');
    debug('Redirecting to signin');
    req.error('You must be logged in to use this feature.');
    req.session.originalUrl = req.originalUrl;
    res.redirect('/signin');
  }
};
