var pkg = require('./package.json');

module.exports = function (app) {
  return {
    appName: pkg.name,
    version: pkg.version,
    nameAndVersion: pkg.name + ' v' + pkg.version,
    description: pkg.description,
    author: pkg.author.name || pkg.author,
    conf: function (key) {
      return app.get(key);
    },
    // Jade pretty printing
    pretty: process.env.NODE_ENV === 'development'
  };
}