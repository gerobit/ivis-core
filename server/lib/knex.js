'use strict';

const config = require('./config');
const path = require('path');

const knexConstructor = require('knex');

const knex = knexConstructor({
    client: 'mysql2',
    connection: {
        ...config.mysql,

        // DATE and DATETIME types contain no timezone info. The MySQL driver tries to interpret them w.r.t. to local time, which
        // does not work well with assigning these values in UTC and handling them as if in UTC
        dateStrings: [
            'DATE',
            'DATETIME'
        ]
    },
    migrations: {
        directory: path.join(__dirname, '..', 'knex', 'migrations')
    }
    // , debug: true
});

knex.migrateExtension = (extensionName, migrationsDir) => {
    const extKnex = knexConstructor({
        client: 'mysql2',
        connection: config.mysql,
        migrations: {
            directory: migrationsDir,
            tableName: 'knex_migrations_extension_' + extensionName
        }
        , debug: false
    });

    return extKnex.migrate;
};


module.exports = knex;