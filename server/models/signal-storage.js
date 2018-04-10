'use strict';

const config = require('../lib/config');
const knex = require('../lib/knex');
const { SignalType } = require('../../shared/signals');
const indexer = require('../lib/indexers/' + config.indexer);

// FIXME - This should use Redis if paralelized
const existingTables = new Set();
const allowedAggs = new Set(['min', 'max', 'avg']);
const valPrefix = 'val_';

const getTableName = (signalSetCid) => 'signal_set_' + signalSetCid;

const fieldTypes = {
    [SignalType.INTEGER]: 'int',
    [SignalType.LONG]: 'bigint',
    [SignalType.FLOAT]: 'float',
    [SignalType.DOUBLE]: 'double',
    [SignalType.BOOLEAN]: 'tinyint',
    [SignalType.KEYWORD]: 'varchar',
    [SignalType.DATE]: 'date(6)'
};

async function createStorage(cid, aggs) {
    await knex.schema.dropTableIfExists(getTableName(cid));
    await knex.schema.createTable(getTableName(cid), table => {
        table.specificType('ts', 'datetime(6)').notNullable().index();
        if (aggs) {
            table.specificType('first_ts', 'datetime(6)').notNullable().index();
            table.specificType('last_ts', 'datetime(6)').notNullable().index();
        }
    });

    existingTables.add(cid);

    await indexer.onCreateStorage(cid, aggs);
}

async function extendSchema(cid, aggs, fields) {
    await knex.schema.table(getTableName(cid), table => {
        for (const fieldCid in fields) {
            if (aggs) {
                for (const agg of allowedAggs) {
                    table.specificType(agg + '_' + fieldCid, fieldTypes[fields[fieldCid]]);
                }
            } else {
                table.specificType(valPrefix + fieldCid, fieldTypes[fields[fieldCid]]);
            }
        }
    });

    await indexer.onExtendSchema(cid, aggs, fields);
}

async function renameField(cid, aggs, oldFieldCid, newFieldCid) {
    await knex.schema.table(getTableName(cid), table => {
        if (aggs) {
            for (const agg of allowedAggs) {
                table.renameColumn(agg + '_' + oldFieldCid, agg + '_' + newFieldCid);
            }
        } else {
            table.renameColumn(valPrefix + oldFieldCid, valPrefix + newFieldCid);
        }
    });

    await indexer.onRenameField(cid, aggs, oldFieldCid, newFieldCid);
}

async function removeField(cid, aggs, fieldCid) {
    await knex.schema.table(getTableName(cid), table => {
        if (aggs) {
            for (const agg of allowedAggs) {
                table.dropColumn(agg + '_' + fieldCid);
            }
        } else {
            table.dropColumn(valPrefix + fieldCid);
        }
    });

    await indexer.onRemoveField(cid, aggs, fieldCid);
}

async function removeStorage(cid) {
    await knex.schema.dropTableIfExists(getTableName(cid));
    existingTables.delete(cid);

    await indexer.onRemoveStorage(cid);
}

async function insertRecords(cid, aggs, records) {
    const rows = [];
    for (const record of records) {
        const row = {};

        if (aggs) {
            row.ts = new Date(Math.floor((record.lastTS.valueOf() + record.firstTS.valueOf()) / 2));
            row.first_ts = record.firstTS;
            row.last_ts = record.lastTS;

            for (const fieldCid in record.signals) {
                for (const agg of allowedAggs) {
                    row[agg + '_' + fieldCid] = record.signals[fieldCid][agg];
                }
            }
        } else {
            row.ts = record.ts;

            for (const fieldCid in record.signals) {
                row[valPrefix + fieldCid] = record.signals[fieldCid];
            }
        }

        rows.push(row);
    }
    await knex(getTableName(cid)).insert(rows);

    await indexer.onInsertRecords(cid, aggs, records);
}

module.exports = {
    createStorage,
    extendSchema,
    renameField,
    removeField,
    removeStorage,
    insertRecords
};