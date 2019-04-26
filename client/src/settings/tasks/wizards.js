'use strict';


const WizardType = {
    BLANK: 'blank',
    BASIC: 'basic'
};

if (Object.freeze) {
    Object.freeze(WizardType)
}

const wizards = new Map();
wizards.set(WizardType.BASIC, (data) => {
    data.settings = {
        params: [],
        code:
`import sys
import os
import json
from elasticsearch import Elasticsearch

# Get parameters and set up elasticsearch
data = json.loads(sys.stdin.readline())
config = data.get('config')
params = data.get('params')
param_map = params.get('map')
param_ns = params.get('namespaces')
es = Elasticsearch([{'host': data['es']['host'], 'port': int(data['es']['port'])}])

if config is None or config.get('index') is None:
    ns = params_ns['sigSet']

    msg = {}
    msg['type'] = 'sets'
    # Request new signal set creation 
    msg['sigSet'] = {
    "cid" : "test",
    "name" : "test" ,
    "description" : "test" ,
    "namespace" : ns,
    "aggs" :  "0" 
    }

    signals= [] 
    signals.append({
        "cid": "test",
        "name": "test",
       "description": "test",
       "namespace": ns,
        "type": 'raw_double',
        "indexed": False,
        "settings": {}
    })
    msg['sigSet']['signals'] = signals

    ret = os.write(3,json.dumps(msg) + '\\n')
    config = json.loads(sys.stdin.readline())
    error = config.get('error')
    if error:
      sys.stderr.write(error+"\\n")
      sys.exit(1)

doc = {
    config['fields']['test']: 55
}

res = es.index(index=config['index'], doc_type='_doc', body=doc)

# Request to store config
msg={}
msg['type'] = 'store'
msg['config'] = config
ret = os.write(3,json.dumps(msg))
os.close(3)`
    };
});

if (Object.freeze) {
    Object.freeze(wizards);
}

module.exports = {
    wizards,
    WizardType
};