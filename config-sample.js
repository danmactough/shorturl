var urlFormat = require('url').format;
var _ = require('lodash');

var config = module.exports = {
  development: {
    session_secret: '',
    db : {
      uri : 'mongodb://localhost/shorturl-development'
    }
  },
  test: {
    session_secret: '',
    db : {
      uri : 'mongodb://localhost/shorturl-test'
    }
  },
  production: {
    session_secret: '',
    db : {
      uri : 'mongodb://localhost/shorturl'
    }
  }
};

Object.keys(config).forEach(function (environment) {
  ['redirector', 'shortener'].forEach(function (service) {
    var conf = config[environment][service];
    if (!(conf && typeof conf === 'object')) {
      conf = config[environment][service] = {};
    }
    var defaults = {
      protocol: 'http',
      hostname: 'localhost',
      port: service === 'redirector' ? 3000 : 3001
    };
    conf.url || (conf.url = urlFormat(_.defaults(conf, defaults)));
  });
});
