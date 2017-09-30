#!/usr/bin/env bash

openssl req -new -x509 -days 9999 -config ca.cnf -keyout ca-key.pem -out ca-crt.pem

openssl genrsa -out server-key.pem 4096
openssl req -new -config server.cnf -key server-key.pem -out server-csr.pem
openssl x509 -req -extfile server.cnf -days 999 -passin "pass:password" -in server-csr.pem -CA ca-crt.pem -CAkey ca-key.pem -CAcreateserial -out server-crt.pem

touch ca-database.txt
openssl ca -keyfile ca-key.pem -cert ca-crt.pem -config ca.cnf -gencrl -out ca-crl.pem -passin 'pass:password'

for fn in ca-crl.pem ca-crt.pem server-crt.pem server-key.pem; do
	ln -s test/$fn ../$fn
done
