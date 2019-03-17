'use strict';

const elasticsearch = require('../elasticsearch');
const {enforce} = require('../helpers');
const interoperableErrors = require('../../../shared/interoperable-errors');
const { IndexMethod } = require('../../../shared/signals');
const { getIndexName, getFieldName, createIndex, extendMapping } = require('./elasticsearch-common');
const contextHelpers = require('../context-helpers');

const signalSets = require('../../models/signal-sets');
const em = require('../extension-manager');
const fork = require('child_process').fork;

const path = require('path');
const log = require('../log');

const {query} = require('./elasticsearch-query');

const insertBatchSize = 1000;

const indexerExec = em.get('indexer.elasticsearch.exec', path.join(__dirname, '..', '..', 'services', 'indexer-elasticsearch.js'));

let indexerProcess;

async function init() {
    log.info('Indexer', 'Spawning indexer process');

    indexerProcess = fork(indexerExec, [], {
        cwd: path.join(__dirname, '..', '..'),
        env: {NODE_ENV: process.env.NODE_ENV}
    });

    let startedCallback;
    const startedPromise = new Promise((resolve, reject) => {
        startedCallback = resolve;
    });

    indexerProcess.on('message', msg => {
        if (msg) {
            if (msg.type === 'started') {
                log.info('Indexer', 'Indexer process started');
                return startedCallback();
            }
        }
    });

    indexerProcess.on('close', (code, signal) => {
        log.info('Indexer', 'Indexer process exited with code %s signal %s.', code, signal);
    });

    await startedPromise;

    const sigSets = await signalSets.list();
    for (const sigSet of sigSets) {
        await signalSets.index(contextHelpers.getAdminContext(), sigSet.id, IndexMethod.INCREMENTAL);
    }
}


async function onCreateStorage(sigSet) {
    await createIndex(sigSet, {});
    return {};
}

async function onExtendSchema(sigSet, fields) {
    await extendMapping(sigSet, fields);
    return {};
}

async function onRemoveField(sigSet, fieldCid) {
    // Updating all records in the index is too slow. Instead, we require the user to reindex
    // const params = {field: fieldCid};
    // const script = 'ctx._source.remove(params.field)'
    cancelIndex(sigSet);
    return {reindexRequired: true};
}

async function onRemoveStorage(sigSet) {
    cancelIndex(sigSet);
    try {
        await elasticsearch.indices.delete({index: getIndexName(sigSet)});
    } catch (err) {
        if (err.body && err.body.error && err.body.error.type === 'index_not_found_exception') {
            log.verbose("Indexer", "Index does not exist during removal. Ignoring...");
        } else {
            throw err;
        }
    }

    return {};
}

async function onInsertRecords(sigSetWithSigMap, records) {
    // If currently reindex is in progress, then if it has been already deleted, records will be inserted from here
    // It has not been deleted, then it will reindex the new records as well

    const indexName = getIndexName(sigSetWithSigMap);
    const signalByCidMap = sigSetWithSigMap.signalByCidMap;

    let bulk = [];

    for (const record of records) {
        bulk.push({
            index: {
                _index: indexName,
                _type: '_doc',
                _id: record.id
            }
        });

        const esDoc = {};
        for (const fieldCid in record.signals) {
            const fieldId = signalByCidMap[fieldCid].id;
            enforce(fieldId, `Unknown signal "${fieldCid}"`);

            esDoc[getFieldName(fieldId)] = record.signals[fieldCid];
        }

        bulk.push(esDoc);

        if (bulk.length >= insertBatchSize) {
            await elasticsearch.bulk({body:bulk});
            bulk = [];
        }
    }

    if (bulk.length > 0) {
        await elasticsearch.bulk({body:bulk});
    }

    return {};
}

async function onUpdateRecord(sigSetWithSigMap, existingRecordId, record) {
    const indexName = getIndexName(sigSetWithSigMap);

    const signalByCidMap = sigSetWithSigMap.signalByCidMap;

    const esDoc = {};
    for (const fieldCid in record.signals) {
        const fieldId = signalByCidMap[fieldCid].id;
        enforce(fieldId, `Unknown signal "${fieldCid}"`);

        esDoc[getFieldName(fieldId)] = record.signals[fieldCid];
    }

    try {
        await elasticsearch.delete({
            index: indexName,
            type: '_doc',
            id: existingRecordId
        });
    } catch (err) {
        if (err.status === 404) {
        } else {
            throw err;
        }
    }

    await elasticsearch.create({
        index: indexName,
        type: '_doc',
        id: record.id,
        body: {
            doc: esDoc
        }
    });

    return {};
}

async function onRemoveRecord(sigSet, recordId) {
    const indexName = getIndexName(sigSet);

    try {
        await elasticsearch.delete({
            index: indexName,
            type: '_doc',
            id: recordId
        });
    } catch (err) {
        if (err.status === 404) {
        } else {
            throw err;
        }
    }

    return {};
}


// Cancel possible pending or running reindex of this signal set
function cancelIndex(sigSet) {
    indexerProcess.send({
        type: 'cancel-index',
        cid: sigSet.cid
    });
}

function index(sigSet, method) {
    indexerProcess.send({
        type: 'index',
        method,
        cid: sigSet.cid,
    });
}

module.exports.query = query;
module.exports.onCreateStorage = onCreateStorage;
module.exports.onExtendSchema = onExtendSchema;
module.exports.onRemoveField = onRemoveField;
module.exports.onRemoveStorage = onRemoveStorage;
module.exports.onInsertRecords = onInsertRecords;
module.exports.onUpdateRecord = onUpdateRecord;
module.exports.onRemoveRecord = onRemoveRecord;
module.exports.index = index;
module.exports.init = init;
