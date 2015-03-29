var notifier = require('node-notifier'),
    sprintf = require('util').format,
    debug = require('debug')('shorturl:error-logger');

module.exports = {
  log: function log (err, str, req, res) {
    debug(err);
    var title = sprintf('Error [%s] %s', req.method.toUpperCase(), req.url);
    this.notify(title, str);
  },
  notify: function notify (title, str) {
    notifier.notify({
      title: title,
      message: str
    });
  }
};
