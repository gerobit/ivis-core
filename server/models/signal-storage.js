'use strict';

const config = require('../lib/config');
const knex = require('../lib/knex');
const { SignalType, serializeToDb } = require('../../shared/signals');
const indexer = require('../lib/indexers/' + config.indexer);
const { enforce } = require('../lib/helpers');
const signalSets = require('./signal-sets');
const dtHelpers = require('../lib/dt-helpers');

// FIXME - This should use Redis if paralelized
const existingTables = new Set();
const insertBatchSize = 1000;
const deleteBatchSize = 10000;

const getTableName = (sigSet) => 'signal_set_' + sigSet.id;
const getColumnName = (fieldId) => 's' + fieldId;

const fieldTypes = {
    [SignalType.INTEGER]: 'int',
    [SignalType.LONG]: 'bigint',
    [SignalType.FLOAT]: 'float',
    [SignalType.DOUBLE]: 'double',
    [SignalType.BOOLEAN]: 'tinyint',
    [SignalType.KEYWORD]: 'varchar',
    [SignalType.DATE_TIME]: 'datetime(6)'
};

async function createStorage(sigSet) {
    const tblName = getTableName(sigSet);
    await knex.schema.dropTableIfExists(tblName);

    await knex.schema.raw('CREATE TABLE `' + tblName + '` (\n' +
        '  `id` VARCHAR(255) CHARACTER SET ascii NOT NULL,\n' +
        '  PRIMARY KEY (`id`)\n' +
        ') ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;\n');

    existingTables.add(sigSet.id);

    return await indexer.onCreateStorage(sigSet);
}

async function extendSchema(sigSet, fields) {
    await knex.schema.table(getTableName(sigSet), table => {
        for (const fieldId in fields) {
            table.specificType(getColumnName(fieldId), fieldTypes[fields[fieldId]]);
        }
    });

    return await indexer.onExtendSchema(sigSet, fields);
}

async function removeField(sigSet, fieldId) {
    await knex.schema.table(getTableName(sigSet), table => {
        table.dropColumn(getColumnName(fieldId));
    });

    return await indexer.onRemoveField(sigSet, fieldId);
}

async function removeStorage(sigSet) {
    await knex.schema.dropTableIfExists(getTableName(sigSet));
    existingTables.delete(sigSet.id);

    return await indexer.onRemoveStorage(sigSet);
}

async function listRecordsDTAjaxTx(tx, sigSet, fieldIds, params) {
    return await dtHelpers.ajaxListTx(
        tx,
        params,
        builder => builder.from(getTableName(sigSet)),
        fieldIds.map(id => getColumnName(id))
    );
}


async function insertRecords(sigSetWithSigMap, records) {
    const tblName = getTableName(sigSetWithSigMap);
    const signalByCidMap = sigSetWithSigMap.signalByCidMap;

    let isAppend = true;
    const lastId = await getLastId(sigSetWithSigMap);

    const recordIdTemplate = signalSets.getRecordIdTemplate(sigSetWithSigMap) || (() => { throw new Exception("Missing record id"); });

    let rows = [];
    for (const record of records) {
        const row = {};

        if (record.id === undefined || record.id === null) {
            row.id = recordIdTemplate(record.signals);
        } else {
            row.id = record.id;
        }

        if (row.id <= lastId) {
            isAppend = false;
        }

        for (const fieldCid in record.signals) {
            const field = signalByCidMap[fieldCid];
            const fieldId = field.id;
            row[getColumnName(fieldId)] = serializeToDb[field.type](record.signals[fieldCid]);
        }

        rows.push(row);

        if (rows.length >= insertBatchSize) {
            await knex(tblName).insert(rows);
            rows = [];
        }
    }

    if (rows.length > 0) {
        await knex(tblName).insert(rows);
    }

    await indexer.onInsertRecords(sigSetWithSigMap, records, isAppend);
}

async function updateRecord(sigSetWithSigMap, record) {
    const tblName = getTableName(sigSetWithSigMap);
    await knex(tblName).where('id', record.id).update(record);

    await indexer.onUpdateRecord(sigSetWithSigMap, record);
}

async function removeRecord(sigSet, recordId) {
    const tblName = getTableName(sigSet);
    await knex(tblName).where('id', recordId).del();

    await indexer.onRemoveRecord(sigSet, recordId);
}

async function getLastId(sigSet) {
    const row = await knex(getTableName(sigSet)).orderBy('id', 'desc').first('id');

    if (row) {
        return row['id'];
    } else {
        return null;
    }
}

module.exports.createStorage = createStorage;
module.exports.extendSchema = extendSchema;
module.exports.removeField = removeField;
module.exports.removeStorage = removeStorage;
module.exports.insertRecords = insertRecords;
module.exports.updateRecord = updateRecord;
module.exports.removeRecord = removeRecord;
module.exports.getLastId = getLastId;
module.exports.getTableName = getTableName;
module.exports.getColumnName = getColumnName;
module.exports.listRecordsDTAjaxTx = listRecordsDTAjaxTx;