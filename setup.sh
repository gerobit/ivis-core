#!/bin/sh

cd server
npm install

sudo sh setup/install.sh

cd certs/test
sh setup.sh
cd ../..

cd knex
NODE_ENV=development ../node_modules/.bin/knex migrate:latest
NODE_ENV=development ../node_modules/.bin/knex seed:run
cd ..

cd ..

cd shared
npm install
cd ..


cd client
npm install
npm run build
cd ..

echo Run server by executing "NODE_ENV=development node index.js" in "server" directory
echo Then navigate to https://localhost:8443
echo Credentials are admin/test
