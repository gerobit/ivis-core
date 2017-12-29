#!/bin/sh

cd server
yarn install
cd ..

cd shared
yarn install
cd ..


cd client
yarn install
yarn run build
cd ..

echo Run server by executing "NODE_ENV=development node index.js" in "server" directory
echo Then navigate to https://localhost:8443
echo Credentials are admin/test
