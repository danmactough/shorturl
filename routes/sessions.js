/**
 * Module dependencies.
 */
var path = require('path'),
    debug = require('debug')('shorturl:routes:sessions');

module.exports = function (app) {
  app.get('/signin', signinHandler);
  app.post('/sessions', sessionPostHandler);
  app.delete('/sessions',
             require(path.resolve(app.get('root'), 'middleware', 'authenticate')),
             sessionDeleteHandler);

  var USER = require(path.resolve(app.get('root'), 'user')),
      auth = require(path.resolve(app.get('root'), 'scripts', 'newUser')).auth,
      models = require(path.resolve(app.get('root'), 'models'));

  function signinHandler (req, res) {
    if (req.session.username || req.cookies.logintoken) {
      res.redirect('/create');
    }
    else {
      res.render('signin', {
        title: 'Sign In'
      });
    }
  }

  function sessionPostHandler (req, res, next) {

    if (req.body.username === USER.username &&
        req.body.password &&
        auth(req.body.password, USER.hashed_password, USER.salt)) {

      var redirect_url = req.session.originalUrl || '/create';

      req.session.regenerate(function (err) {
        if (err) return next(err);
        // Add the user data to the session variable for convenience
        req.session.user = USER;
        req.session.username = USER.username;

        // Store the user's primary key
        // in the session store to be retrieved,
        var loginToken = new models.LoginToken({ username: USER.username });
        loginToken.save(function (err) {
          if (err) return next(err);
          // Remember me
          if (req.body.rememberme) {
            res.cookie('logintoken', loginToken.cookieValue, { expires: new Date(Date.now() + 2 * 604800000), path: '/', httpOnly: true }); // 2 weeks
          }
          else {
            res.cookie('logintoken', loginToken.cookieValue, { expires: false });
          }
          res.redirect(redirect_url);
        });
      });
    }
    else {
      req.error('Your username and password did not match. Please try again.');
      res.redirect('back');
    }
  }

  function sessionDeleteHandler (req, res) {
    // destroy the user's session to log them out
    // will be re-created next request
    if (req.session) {
      models.LoginToken.remove({ username: req.session.username }, function() {} );
      req.session.destroy(function (err) {
        // Let's try to keep going
        debug(err);
        res.clearCookie('logintoken');
        res.redirect('/signin');
      });
    }
  }
};