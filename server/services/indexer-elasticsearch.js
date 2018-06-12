'use strict';

const config = require('../lib/config');
const elasticsearch = require('../lib/elasticsearch');
const knex = require('../lib/knex');
const { getIndexName, getTableName, getColumnMap, convertRecordsToBulk } = require('../lib/indexers/elasticsearch-common');
const { IndexingStatus } = require('../../shared/signals');
const log = require('npmlog');

log.level = config.log.level;

// Elasticsearch indexer process
// Handles reindex requests
// Message 'index' starts reindexing. If reindexing is currently in progress,
// it is aborted and started again.
// Message 'cancel' aborts reindexing if it is in progress.

// Indexer state
// 'idle': waiting for command
// 'interrupt': current indexing will be aborted
// 'indexing': currently indexing
let state = 'idle';

// Number of elements fetched from the database in one query.
const batchSize = 10000;

async function changeIndexingStatus(cid, status){
    await knex.transaction(async tx => {
        const existing = await tx('signal_sets').where('cid', cid).first();
        const indexing = JSON.parse(existing.indexing);
        indexing.status = status;
        await tx('signal_sets').where('cid', cid).update('indexing', JSON.stringify(indexing));
    });
}

async function reindex(cid){
    log.info('Indexer', 'Reindexing ' + cid);

    await changeIndexingStatus(cid, IndexingStatus.RUNNING);

    try{
        const indexName = getIndexName(cid);

        // Delete the old index
        await elasticsearch.indices.delete({index: indexName, ignore_unavailable:true});

        await knex.transaction(async tx => {
            const columnMap = await getColumnMap(tx, cid);

            let last = null;
            const tableName = getTableName(cid);
            const queryBase = tx(tableName).orderBy('ts','asc').limit(batchSize);

            while(state === 'indexing'){
                // Select items from the signal set  
                let query = queryBase.clone();
                if(last !== null){
                    query = query.where('ts', '>', last);
                }
                const items = await query.select();

                if(items.length == 0)
                    break;

                log.info('Indexer', 'Indexing ' + items.length + ' items');

                const bulk = convertRecordsToBulk(items, indexName, columnMap);
                await elasticsearch.bulk({body:bulk});

                last = items[items.length - 1].ts;
            }
        });
    }
    catch(err){
        // In case of error, require reindexing
        await changeIndexingStatus(cid, IndexingStatus.REQUIRED);
        log.info('Indexer', 'Failed ' + cid);
        throw err;
    }

    const success = (state === 'indexing');
    await changeIndexingStatus(cid, success ? IndexingStatus.READY : IndexingStatus.REQUIRED);
    log.info('Indexer', (success ? 'Indexed ' : 'Interrupted ') + cid);
}

const workQueue = [];
let currentWork = null;

async function perform(){
    log.info('Indexer', 'Indexing started');

    while(workQueue.length > 0){
        state = 'indexing';    
        currentWork = workQueue.pop();
        try{
            await reindex(currentWork);
        }
        catch(err){
            log.error('Indexer', err);
        }
        currentWork = null;
    }
    log.info('Indexer', 'Indexing finished');
    state = 'idle';
}

process.on('message', msg => {
    if (msg) {
        const type = msg.type;
        if (type === 'index') {
            const cid = msg.cid;
            // If the work item is already in queue, no need to do anything
            if(workQueue.indexOf(cid) === -1){
                // Enqueue the signal set
                log.info('Indexer', 'Scheduled reindex ' + cid);
                workQueue.push(cid);
                // If it is currently being indexed, restart
                if(currentWork === cid){
                    state = 'interrupt';
                    log.info('Indexer', 'Restarting reindex');
                }
                else if (state === 'idle'){
                    state = 'start';
                    // Perform the reindexing asynchronously
                    perform();
                }
            }
        }
        else if (type === 'cancel-index'){
            const cid = msg.cid;
            // If the work is in queue, remove it
            const indexInQueue = workQueue.indexOf(cid);
            if(indexInQueue !== -1){
                // Remove entry from the queue
                log.info('Indexer', 'Unscheduled reindex ' + cid);
                workQueue.splice(indexInQueue, 1);
            }
            else if(currentWork === cid){
                state = 'interrupt';
                log.info('Indexer', 'Cancelling reindex');
            }
        }
        else if(type === 'cancel-all'){
            // Cancel current operation, empty queue
            log.info('Indexer', 'Cancelling all reindexing');
            workQueue.length = 0;
            if(currentWork !== null){
                state = 'interrupt';
            }
        }
        
    }
});

log.info('Indexer', 'Indexer process started');
