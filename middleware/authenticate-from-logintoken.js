/*
 * Module dependencies
 */
var path = require('path'),
    _ = require('lodash'),
    debug = require('debug')('shorturl:middleware:authenticate-from-logintoken');

var cwd = process.cwd(),
    USER = require(path.resolve(cwd, 'user')),
    LoginToken = require(path.resolve(cwd, 'models')).LoginToken;

module.exports = function authenticateFromLoginToken (req, res, next){
  var cookie = JSON.parse(req.cookies.logintoken);
  var query = _.pick(cookie, 'username', 'series', 'token');
  debug('query: %j', query);

  LoginToken.findOne(query, function (err, token){
    if (err) return next(err);
    debug('token: %j', token || {});
    if (!token) {
      debug('No token found');
      req.error('You must be logged in to use this feature.');
      req.session.redirect_to = req.originalUrl;
      res.redirect('/signin');
    }
    else if (token.username === USER.username) {
      debug('Thumbs up. Regenerating to session to keep it fresh.');
      req.session.regenerate(function (err) {
        if (err) return next(err);
        req.session.user = USER;
        req.session.username = USER.username;
        token.token = token.randomToken();
        token.save(function (){
          res.cookie('logintoken', token.cookieValue, { expires: new Date(Date.now() + 2 * 604800000), path: '/', httpOnly: true }); // 2 weeks
          next();
        });
      });
    }
    else {
      debug('This should never be seen.');
      req.error('It looks like your session expired. You must log back in to use this feature.');
      req.session.redirect_to = req.originalUrl;
      res.redirect('/signin');
    }
  });
};