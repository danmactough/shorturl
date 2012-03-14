var myUrl;
if (process.argv.length !== 3) process.exit(1);
else myUrl = process.argv[2];

var models = require('./models')

function getShorty (longurl, callback){
  models.Url.findByUrl(longurl, function (err, doc){
    if (err) callback(err);
    else if (doc) callback(null, doc)
    else {
      var u = new models.Url({'longurl': longurl})
      u.save(callback);
    }
  });
};

getShorty(myUrl, function (e, doc){
  console.log(doc);
});
