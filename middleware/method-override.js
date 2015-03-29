/*
 * Module dependencies
 */
var methodOverride = require('method-override');

module.exports = function customMethodOverride () {
  return methodOverride(function getter (req, res) {
    if (req.body && typeof req.body === 'object' && '_method' in req.body) {
      // look in urlencoded POST body and delete it
      var method = req.body._method;
      delete req.body._method;
      return method;
    }
  });
};
