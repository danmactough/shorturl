/*
 * Module dependencies
 */
var csrf = require('csurf');

module.exports = function customCsrf () {
  var csrfValidate = csrf({
    cookie: false // use session instead of a cookie
  });
  return function (req, res, next) {
    if (req.apikey) next();
    else csrfValidate(req, res, next);
  };
};
