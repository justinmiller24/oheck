#!/bin/bash

# Connect to server
#chmod 400 ~/.ssh/oheck.pem
#ssh -i ~/.ssh/oheck.pem ubuntu@ec2-x-x-x-x.compute-1.amazonaws.com
#sudo su

# Copy git library
#git clone https://github.com/justinmiller24/oheck.git
#cd oheck
#bash setup.sh

# Install packages
#https://www.digitalocean.com/community/tutorials/how-to-install-node-js-on-an-ubuntu-14-04-server
apt-get update -y
apt-get upgrade -y
apt-get install nodejs-legacy npm -y
npm install express socket.io forever -g
npm install

# Start app
forever start index.js
