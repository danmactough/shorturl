/*
 * Module dependencies
 */
var csrf = require('csurf');

module.exports = function customCsrf () {
  return csrf({
    cookie: false, // use session instead of a cookie
    value: function (req) {
      return (req.apikey && req.session._csrf) || // Skip the CSRF check for API requests
        (req.body && req.body._csrf) ||
        (req.query && req.query._csrf) ||
        req.headers['csrf-token'] ||
        req.headers['xsrf-token'] ||
        req.headers['x-csrf-token'] ||
        req.headers['x-xsrf-token'];
    }
  });
};
