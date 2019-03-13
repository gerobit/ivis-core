    'use strict';

const config = require('./config');
const path = require('path');

const knexConstructor = require('knex');
console.log('knex in core', config.mysql.database);

const knex = require('knex')({
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
    //, debug: true
});
``
knex.migrateExtension = (extensionName, migrationsDir, seedsDir) => {
    console.log('migrateExtension', config.mysql.database);

    const extKnex = knexConstructor({
        client: 'mysql2',
        connection: config.mysql,
        migrations: {
            directory: migrationsDir,
            tableName: 'knex_migrations_extension_' + extensionName
        },
        seeds: {
            directory: seedsDir,
            tableName: 'knex_seeds_extension_' + extensionName
        }
        , debug: false
    });

    return extKnex.migrate;
};


module.exports = knex;
