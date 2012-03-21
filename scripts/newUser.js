
/*
 * Module dependencies
 */

var crypto = require('crypto')
  , fs = require('fs')
  , randpass = require('randpass')
  ;

function makeSalt (){
  return Math.round((new Date().valueOf() * Math.random())) + '';
};
exports.makeSalt = makeSalt;

function encryptPassword (password, salt) {
  return crypto.createHmac('sha1', salt).update(password).digest('hex');
};
exports.encryptPassword = encryptPassword;

function createAPIKey (){
  return randpass(32);
};
exports.createAPIKey = createAPIKey;

function auth (password, hashed_password, salt){
  return  hashed_password === crypto.createHmac('sha1', salt).update(password).digest('hex');
};
exports.auth = auth;

function newUser (username, password, outfile){
  if (!(username && password)) throw new Error('You must supply a username and password.');
  else {
  
    var user = {};
    user.username = username;
    user.salt = makeSalt();
    user.hashed_password = encryptPassword(password, user.salt);
    user.api_key = createAPIKey();
    if (outfile) {
      fs.writeFileSync(outfile, 'exports = module.exports = '+JSON.stringify(user));
    }
    return user;
  }
};
exports.newUser = newUser;

if (!module.parent) {
  if (process.argv.length !== 5) {
    console.error('You must provide a username, password, and output filename');
    process.exit(1);
  } else {
    var username = process.argv[2]
      , password = process.argv[3]
      , outfile = process.argv[4];
    console.log(newUser(username, password, outfile));
    process.nextTick(process.exit);
  }
}
