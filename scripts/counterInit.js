var models = require('../models')

if (!module.parent) {
  var c = +process.argv[2] || 59;
  models.CounterInit(c, function(e){
console.log(c)
    if (e) {
      console.error(e);
      process.nextTick(function(){
        process.exit(1)
      });
    }
    else process.nextTick(process.exit);
  });
}
