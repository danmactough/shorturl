/**
 * Fall-through routes
 */

/**
 * Module dependencies.
 */
var debug = require('debug')('shorturl:routes:index');

module.exports = function (app) {
  app.all('/', function (req, res){
    debug('Redirecting to signin');
    res.redirect('/signin');
  });

  app.all('*', function (req, res){
    debug('Not found');
    res.sendStatus(404);
  });
};
