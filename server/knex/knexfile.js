'use strict';

const config = require('../lib/config');

module.exports = {
    client: 'mysql2',
    connection: config.mysql
};
