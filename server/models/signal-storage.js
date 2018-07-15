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

async function createStorage(cid) {
    await knex.schema.dropTableIfExists(getTableName(cid));
    await knex.schema.createTable(getTableName(cid), table => {
        table.specificType('ts', 'datetime(6)').notNullable().index();
    });

    existingTables.add(cid);

    return await indexer.onCreateStorage(cid);
}

async function extendSchema(cid, fields) {
    await knex.schema.table(getTableName(cid), table => {
        for (const fieldCid in fields) {
            table.specificType(valPrefix + fieldCid, fieldTypes[fields[fieldCid]]);
        }
    });

    return await indexer.onExtendSchema(cid, fields);
}

async function renameField(cid, oldFieldCid, newFieldCid) {
    await knex.schema.table(getTableName(cid), table => {
        table.renameColumn(valPrefix + oldFieldCid, valPrefix + newFieldCid);
    });

    return await indexer.onRenameField(cid, oldFieldCid, newFieldCid);
}

async function removeField(cid, fieldCid) {
    await knex.schema.table(getTableName(cid), table => {
        table.dropColumn(valPrefix + fieldCid);
    });

    return await indexer.onRemoveField(cid, fieldCid);
}

async function removeStorage(cid) {
    await knex.schema.dropTableIfExists(getTableName(cid));
    existingTables.delete(cid);

    return await indexer.onRemoveStorage(cid);
}

async function insertRecords(cid, records) {
    const rows = [];
    for (const record of records) {
        const row = {};

        row.ts = record.ts;

        for (const fieldCid in record.signals) {
            row[valPrefix + fieldCid] = record.signals[fieldCid];
        }

        rows.push(row);
    }

    await knex(getTableName(cid)).insert(rows);

    return await indexer.onInsertRecords(cid, records, rows);
}

async function getLastTs(cid) {
    const tsField = 'ts';

    const row = await knex(getTableName(cid)).orderBy(tsField, 'desc').first(tsField);

    if (row) {
        return row[tsField];
    } else {
        return null;
    }
}

module.exports = {
    createStorage,
    extendSchema,
    renameField,
    removeField,
    removeStorage,
    insertRecords,
    getLastTs
};
