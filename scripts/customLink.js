
/*
 * Module dependencies
 */

var models = require('../models')
  ;

function customLink (longurl, stub, callback){
  var u = new models.Url({ longurl: longurl, shorturl: stub });
  u.save(callback);
}
exports.customLink = customLink;

if (!module.parent) {
  if (process.argv.length !== 4) {
    console.error('You must provide a url and stub');
    process.exit(1);
  } else {
    var longurl = process.argv[2]
      , stub = process.argv[3];
    customLink(longurl, stub, function (e, doc){
      if (e) {
        console.error(e);
        process.exit(2);
      } else {
        console.log(doc);
        process.nextTick(process.exit);
      }
    });
  }
}
