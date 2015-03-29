/**
 * Module dependencies.
 */

var mongoose = require('mongoose'),
    Schema = mongoose.Schema,
    _ = require('lodash');

var LoginTokenSchema = new Schema ({
  username: String,
  series: String,
  token: String
}, {
  strict: true
});

LoginTokenSchema.index({ username: 1 });
LoginTokenSchema.index({ series: 1 });
LoginTokenSchema.index({ token: 1 });

LoginTokenSchema.virtual('cookieValue')
  .get(function () {
    return JSON.stringify(_.pick(this, 'username', 'token', 'series'));
  });

LoginTokenSchema.method('randomToken', function () {
  return Math.round((new Date().valueOf() * Math.random())) + '';
});

LoginTokenSchema.pre('save', function (next) {
  // Automatically create the tokens
  this.token = this.randomToken();
  if (this.isNew) this.series = this.randomToken();
  next();
});

module.exports = mongoose.model('LoginToken', LoginTokenSchema);