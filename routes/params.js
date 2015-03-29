module.exports = function (app) {
  app.param('format', function (req, res, next){
    req.params.format = req.params.format.toLowerCase();
    next();
  });
};