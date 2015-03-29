/*
 * Module dependencies
 */
var debug = require('debug')('shorturl:middleware:is-logged-in');

module.exports = function isLoggedIn (req, res, next){
  if (req.session.user) {
    debug('user has a session - username %s', req.session.user.username);
    next();
  }
  else {
    debug('user has no session - redirecting to signin');
    res.redirect('/signin');
  }
};
