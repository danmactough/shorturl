#!/bin/bash

# Start up the app
echo `date` "Starting the shorturl app" | tee -a log/app.log
NODE_ENV=${NODE_ENV} nohup node app.js >> log/app.log 2>> log/error.log < /dev/null &
echo -n $! > log/app.pid
