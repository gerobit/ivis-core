'use strict';

const em = require('../lib/extension-manager');

const builtinTemplates = {};

/*
Sample builtin template:
'id': {
    name: 'XXX',
    params: 'XXX'
}
 */

em.invoke('builtinTemplates.add', builtinTemplates);

function list() {
    return builtinTemplates;
}

module.exports.list = list;
