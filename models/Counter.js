/**
 * Module dependencies.
 */

var mongoose = require('mongoose'),
    Schema = mongoose.Schema;

var CounterSchema = new Schema({
  c: { type: Number, unique: true }
}, {
  strict: true
});

var Counter = mongoose.model('Counter', CounterSchema);
Counter.CounterInit = function (i, cb) {
  Counter.update({}, { $set: { c: i } }, { upsert: true },  cb);
};

module.exports = Counter;