'use strict';

const config = require('../lib/config');
const knex = require('../lib/knex');
const { IndexingStatus } = require('../../shared/signals');
const log = require('npmlog');


log.level = config.log.level;


process.on('message', msg => {
    if (msg) {
        const type = msg.type;

        if (type === 'index') {
        }
    }
});

log.info('Indexer', 'Indexer process started');
