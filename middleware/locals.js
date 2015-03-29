/*
 * Module dependencies
 */
module.exports = function (req, res, next) {
  res.locals.csrfToken = req.csrfToken;
  // This is not a security function, just a hint that is used for the navbar
  res.locals.loggedIn = req.session.username || req.cookies.logintoken;
  next();
};
