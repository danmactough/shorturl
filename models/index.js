/**
 * Module dependencies.
 */

var glob = require('glob'),
    path = require('path'),
    debug = require('debug')('shorturl:models');

module.exports = glob.sync('*.js', { cwd: __dirname, ignore: path.basename(__filename) }).reduce(function (memo, file) {
  var ModelName = path.basename(file, '.js');
  var Model = require('./' + file);
  debug('defining model %s', ModelName);
  memo[ModelName] = Model;
  return memo;
}, {});
