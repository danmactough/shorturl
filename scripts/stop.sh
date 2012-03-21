#!/bin/bash

# Stop up the app
echo `date` "Stopping the shorturl app" | tee -a log/app.log
kill -s SIGINT `cat log/app.pid` && rm log/app.pid
