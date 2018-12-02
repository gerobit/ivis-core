'use strict';

const elasticsearch = require('../lib/elasticsearch');
const knex = require('../lib/knex');
const {getIndexName, getFieldName, createIndex} = require('../lib/indexers/elasticsearch-common');
const {getTableName, getColumnName} = require('../models/signal-storage');
const {IndexingStatus, deserializeFromDb} = require('../../shared/signals');
const log = require('../lib/log');
const signalSets = require('../models/signal-sets');

// Elasticsearch indexer process
// Handles reindex requests
// Message 'index' starts reindexing. If reindexing is currently in progress,
// it is aborted and started again.
// Message 'cancel' aborts reindexing if it is in progress.

// Indexer state
const State = {
    IDLE: 0,      // waiting for command
    INTERRUPT: 1, // current indexing will be aborted
    INDEXING: 2   // currently indexing
}
let state = State.IDLE;

// Number of elements fetched from the database in one query.
const batchSize = 1000;

async function reindex(cid) {
    let sigSet;
    let signalByCidMap;

    async function fetchSigSetAndChangeIndexingStatus(status) {
        await knex.transaction(async tx => {
            sigSet = await tx('signal_sets').where('cid', cid).first();
            sigSet.indexing = JSON.parse(sigSet.indexing);
            sigSet.indexing.status = status;
            await tx('signal_sets').where('cid', cid).update('indexing', JSON.stringify(sigSet.indexing));
            signalByCidMap = await signalSets.getSignalByCidMapTx(tx, sigSet);
        });
    }

    log.info('Indexer', 'Reindexing ' + cid);

    await fetchSigSetAndChangeIndexingStatus(IndexingStatus.RUNNING);

    try {
        const indexName = getIndexName(sigSet);

        // Delete the old index
        await elasticsearch.indices.delete({
            index: indexName,
            ignore_unavailable: true
        });

        await createIndex(sigSet, signalByCidMap);

        let last = null;
        const tableName = getTableName(cid);

        while (state === State.INDEXING) {
            // Select items from the signal set

            let query = knex(tableName).orderBy('id', 'asc').limit(batchSize);

            if (last !== null) {
                query = query.where('id', '>', last);
            }

            const rows = await query.select();

            if (rows.length == 0)
                break;

            log.info('Indexer', `Indexing ${rows.length} records in id interval ${rows[0].id}..${rows[rows.length - 1].id}`);

            const bulk = [];

            for (const row of rows) {
                bulk.push({
                    index: {
                        _index: indexName,
                        _type: '_doc',
                        _id: row.id
                    }
                });

                const esDoc = {};
                for (const fieldCid in signalByCidMap) {
                    const field = signalByCidMap[fieldCid];
                    esDoc[getFieldName(field.id)] = deserializeFromDb[field.type](row[getColumnName(field.id)]);
                }

                bulk.push(esDoc);
            }

            await elasticsearch.bulk({body: bulk});

            last = rows[rows.length - 1].id;
        }
    }
    catch (err) {
        // In case of error, require reindexing
        await fetchSigSetAndChangeIndexingStatus(IndexingStatus.REQUIRED);
        log.info('Indexer', 'Failed ' + cid);
        throw err;
    }

    const success = (state === State.INDEXING);
    await fetchSigSetAndChangeIndexingStatus(success ? IndexingStatus.READY : IndexingStatus.REQUIRED);
    log.info('Indexer', (success ? 'Indexed ' : 'Interrupted ') + cid);
}

const workQueue = [];
let currentWork = null;

async function perform() {
    log.info('Indexer', 'Indexing started');

    while (workQueue.length > 0) {
        state = State.INDEXING;
        currentWork = workQueue.pop();
        try {
            await reindex(currentWork);
        }
        catch (err) {
            log.error('Indexer', err);
        }
        currentWork = null;
    }
    log.info('Indexer', 'Indexing finished');
    state = State.IDLE;
}

process.on('message', msg => {
    if (msg) {
        const type = msg.type;
        if (type === 'index') {
            const cid = msg.cid;
            // If the work item is already in queue, no need to do anything
            if (workQueue.indexOf(cid) === -1) {
                // Enqueue the signal set
                log.info('Indexer', 'Scheduled reindex ' + cid);
                workQueue.push(cid);
                // If it is currently being indexed, restart
                if (currentWork === cid) {
                    state = State.INTERRUPT;
                    log.info('Indexer', 'Restarting reindex');
                }
                else if (state === State.IDLE) {
                    state = 'start';
                    // Perform the reindexing asynchronously
                    perform();
                }
            }
        }
        else if (type === 'cancel-index') {
            const cid = msg.cid;
            // If the work is in queue, remove it
            const indexInQueue = workQueue.indexOf(cid);
            if (indexInQueue !== -1) {
                // Remove entry from the queue
                log.info('Indexer', 'Unscheduled reindex ' + cid);
                workQueue.splice(indexInQueue, 1);
            }
            else if (currentWork === cid) {
                state = State.INTERRUPT;
                log.info('Indexer', 'Cancelling reindex');
            }
        }
        else if (type === 'cancel-all') {
            // Cancel current operation, empty queue
            log.info('Indexer', 'Cancelling all reindexing');
            workQueue.length = 0;
            if (currentWork !== null) {
                state = State.INTERRUPT;
            }
        }

    }
});

log.info('Indexer', 'Indexer process started');
