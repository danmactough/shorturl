/**
 * Module dependencies.
 */
var path = require('path');

module.exports = function (app) {
  app.get('/create',
          require(path.resolve(app.get('root'), 'middleware', 'authenticate')),
          require(path.resolve(app.get('root'), 'middleware', 'validate-longurl')),
          createHandler);

  function createHandler (req, res) {
    res.render('create', {
      title: 'Create a New Short Url',
      url: req.params.url || ''
    });
  }
};