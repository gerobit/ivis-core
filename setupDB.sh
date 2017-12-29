#!/bin/sh

cd server
#DBSETUP sudo sh setup/install.sh

cd certs/test
sh setup.sh
cd ../..

cd knex
NODE_ENV=development ../node_modules/.bin/knex migrate:latest
NODE_ENV=development ../node_modules/.bin/knex seed:run
