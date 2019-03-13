'use strict';

require('../lib/config');

const config = require('../lib/config');
console.log('mysql in config of knex', config.mysql.database);

module.exports = config;
