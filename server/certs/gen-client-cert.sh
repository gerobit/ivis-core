#!/usr/bin/env bash

CLIENT_NAME=${1:-client}
CNF_FILE=`mktemp gen-client-cert-XXXXXXX --suffix=cnf`

echo "
[ req ]
default_bits           = 4096
days                   = 9999
distinguished_name     = req_distinguished_name
attributes             = req_attributes
prompt                 = no

[ req_distinguished_name ]
C                      = CZ
CN                     = ${CLIENT_NAME}

[ req_attributes ]
challengePassword      = password
" > ${CNF_FILE}

openssl genrsa -out ${CLIENT_NAME}-key.pem 4096
openssl req -new -config ${CNF_FILE} -key ${CLIENT_NAME}-key.pem -out ${CLIENT_NAME}-csr.pem
openssl x509 -req -extfile ${CNF_FILE} -days 999 -passin "pass:password" -in ${CLIENT_NAME}-csr.pem -CA ca-crt.pem -CAkey ca-key.pem -CAserial ca-crt.srl -out ${CLIENT_NAME}-crt.pem

rm -f ${CNF_FILE}
