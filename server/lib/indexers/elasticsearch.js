'use strict';

const elasticsearch = require('../elasticsearch');
const knex = require('../knex');
const {enforce} = require('../helpers');
const interoperableErrors = require('../../../shared/interoperable-errors');
const { getMinAggregationInterval } = require('../../../shared/signals');
const { getIndexName, getColumnMap, convertRecordsToBulk } = require('./elasticsearch-common');

const em = require('../extension-manager');
const fork = require('child_process').fork;

const path = require('path');
const log = require('npmlog');

const indexerExec = em.get('indexer.elasticsearch.exec', path.join(__dirname, '..', '..', 'services', 'indexer-elasticsearch.js'));

let indexerProcess;

function startProcess() {
    log.info('Indexer', 'Spawning indexer process');

    indexerProcess = fork(indexerExec, [], {
        cwd: path.join(__dirname, '..', '..'),
        env: {NODE_ENV: process.env.NODE_ENV}
    });

    indexerProcess.on('close', (code, signal) => {
        log.info('Indexer', 'Indexer process exited with code %s signal %s.', code, signal);
    });
}

function _index() {
    indexerProcess.send({
        type: 'index'
    });
}

// Converts an interval into elasticsearch interval
function getElsInterval(aggregationInterval) {
    const units = ['ms', 's', 'm', 'h'];
    for (const unit of units) {
        if (aggregationInterval.get(unit) !== 0) {
            return aggregationInterval.as(unit) + unit;
        }
    }

    return aggregationInterval.as('d') + 'd';
}

const maxPoints = 5000;

const allowedAggs = new Set(['min', 'max', 'avg']);

// Process multiple elasticsearch queries
async function msearchHelper(queryGroups){
    const msearchBody = [];

    for(const queryGroup of queryGroups){
        const index = queryGroup.index;
        for(const query of queryGroup.queries){
            msearchBody.push({index});
            msearchBody.push(query);
        }
    }

    const msearchResult = await elasticsearch.msearch({body:msearchBody});

    const results = [];
    let queryIndex = 0;
    for(const queryGroup of queryGroups){
        const items = queryGroup.queries.length;
        results.push(queryGroup.process(...msearchResult.responses.slice(queryIndex, queryIndex + items)));
        queryIndex += items;
    }
    return results;
}

// Check that the requested aggregations are allowed
function checkAggs(signals){
    for (const signalCid in signals) {
        for (const aggKind of signalAggs) {
            enforce(allowedAggs.has(aggKind), 'Unknown agg ' + aggKind);
        }
    }
}

// Build aggregation specification for elasticsearch query
function buildElsAggs(signals, hasAggs, uniqueIds){
    const aggs = {};
    for (const signalCid in signals) {
        const signalAggs = signals[signalCid];
        for (const aggKind of signalAggs) {
            const aggResult = aggKind + '_' + signalCid;
            const aggField = (hasAggs ? aggResult : 'val_' + signalCid) + '_' + uniqueIds[signalCid];
            const aggSpec = {};
            aggSpec[aggKind] = {field: aggField};
            aggs[aggResult] = aggSpec;
        }
    }
    return aggs;
}

// Build elasticsearch filtered query with date_histogram aggregations
function buildAggQuery(filter, histogram, aggs){
    return {
        query: {
            bool: {
                filter: [
                    filter
                ]
            }
        },
        aggs: {
            buckets: {
                date_histogram: histogram,
                aggs
            }
        },
        size: 0
    };
}

// Convert elasticsearch aggregation result to a result row
function cvtAggRow(bucket, signals, tsOffset){
    const data = {};

    for(const signalCid in signals){
        const signalData = {};
        for(const aggKind of signals[signalCid]){
            const aggResult = aggKind + '_' + signalCid;
            signalData[aggKind] = bucket[aggResult].value;
        }
        data[signalCid] = signalData;
    }

    const ts = bucket.doc_count > 1 ? (bucket.key + tsOffset) : bucket.minTs.value;

    return {
        count: bucket.doc_count,
        ts: new Date(ts),
        data
    };
}

// Convert elasticsearch bound aggregation result to a result row
function cvtBoundBucket(searchResult, signals, aggregationIntervalMs){
    const buckets = searchResult.aggregations.buckets.buckets;
    if(buckets.length > 0){
        return cvtAggRow(buckets[0], signals, aggregationIntervalMs/2);
    }
    else
        return null;
}

// Convert elasticsearch main aggregation result to result rows
function cvtMainBuckets(searchResult, signals, aggregationIntervalMs, tsTo){
    const buckets = searchResult.aggregations.buckets.buckets;
    const lastBucket = buckets.length - 1;
    const result = [];

    for(var i = 0; i <= lastBucket; ++i){
        // For the last bucket, shift the timestamp to the middle between start of the bucket and end of the range
        const intervalMs = (i == lastBucket && buckets[lastBucket].key+aggregationIntervalMs > tsTo) ? (tsTo - buckets[lastBucket].key) : aggregationIntervalMs;
        result[i] = cvtAggRow(buckets[i], signals, intervalMs/2);
    }
    
    return result;
}

// Convert elasticsearch main hits to result rows
function cvtMainRows(result, signals, hasAggs, uniqueIds){
    if(result.hits.total > maxPoints) {
        throw new interoperableErrors.TooManyPointsError();
    }

    return result.hits.hits.map(hit => cvtValRow(hit, signals, hasAggs, uniqueIds));
}

// Convert elasticsearch boundary hit to a result row
function cvtBoundRow(result, signals, hasAggs, uniqueIds){
    const hits = result.hits.hits;
    if(hits.length > 0){
        return cvtValRow(hit, signals, hasAggs, uniqueIds);
    }
    else
        return null;
}

// Convert elasticsearch hit to a result row
function cvtValRow(hit, signals, hasAggs, uniqueIds){
    const data = {};

    for(const signalCid in signals){
        const signalData = {};
        for(const aggKind of signals[signalCid]){
            if(hasAggs){
                signalData[aggKind] = hit[aggKind + '_' + signalCid + '_' + uniqueIds[signalCid]];
            }
            else{
                signalData[aggKind] = hit['val_' + signalCid + '_' + uniqueIds[signalCid]];
            }
        }
        data[signalCid] = signalData;
    }

    return {
        count: bucket.doc_count,
        ts: new Date(bucket.key),
        data
    };
}

async function query(qry) {
    // Query consists of independent entries
    const queryGroups = [];
    for(const entry of qry){

        const from = entry.interval.from.valueOf();
        const to = entry.interval.to.valueOf();

        const index = getIndexName(entry.cid);
        
        const aggregationInterval = entry.interval.aggregationInterval;
        const aggregationIntervalMs = aggregationInterval.asMilliseconds();

        const offset = from % aggregationIntervalMs;

        const uniqueIds = entry.uniqueIds;

        // Check that aggregations are valid
        checkAggs(entry.aggs);

        if (aggregationIntervalMs > 0) {
            // Re-aggregate the values accorting to this interval
            
            // Specifies what values to aggregate
            const aggs = buildElsAggs(entry.signals, entry.aggs, uniqueIds);
            aggs['minTs'] = {min: {field: 'ts'}};
            
            // Specifies how to aggregate the values by the timestamp
            const aggIntervalEs = getElsInterval(aggregationInterval);
            const histogram = {field: 'ts', interval: aggIntervalEs, offset, min_doc_count: 1};

            // Query aggregated values betwen the bounds
            const mainQuery = buildAggQuery({range: {ts: {gte: from, lte: to}}}, histogram, aggs);

            // To get the previous value, get one bucket with the largest timestamp before the lower bound
            const prevAggs = {
                sort: {
                    bucket_sort: {
                        sort: [
                            {_key: {order: 'desc'}}
                        ],
                        size: 1
                    }
                }
            };
            // Use the same aggregations as for the main query
            Object.assign(prevAggs, aggs);

            const prevQuery = buildAggQuery({range: {ts: {lt: from}}}, histogram, prevAggs);

            const nextAggs = {
                sort: {
                    bucket_sort: {
                        sort: [
                            {_key: {order: 'asc'}}
                        ],
                        size: 1
                    }
                }
            };
            // Use the same aggregations as for the main query
            Object.assign(nextAggs, aggs);

            const nextQuery = buildAggQuery({range: {ts: {gt: to}}}, histogram, nextAggs);

            // Run the 3 queries
            queryGroups.push({
                index,
                queries: [mainQuery, prevQuery, nextQuery],
                process: function(main, prev, next){
                    // Postprocess the query results
                    return {
                        main: cvtMainBuckets(main, entry.signals, aggregationIntervalMs, to),
                        prev: cvtBoundBucket(prev, entry.signals, aggregationIntervalMs),
                        next: cvtBoundBucket(next, entry.signals, aggregationIntervalMs),
                    }
                }
            });

        }
        else{
            // Simply select the aggregated values
            var prevQuery = {
                query: {
                    bool:{
                        filter:[
                            {range: {ts: {le: from}}}
                        ],
                    }
                },
                sort: { ts: {order: 'desc'}},
                size: 1
            };
            const nextQuery = {
                query: {
                    bool:{
                        filter:[
                            {range: {ts: {ge: to}}}
                        ]
                    }
                },
                sort: { ts: {order: 'asc'}},
                size: 1
            };
            const mainQuery = {
                query: {
                    bool:{
                        filter:[
                            {range: {ts: {gte: from, lte: to}}}
                        ]
                    }
                },
                size: maxPoints + 1
            };

            // No aggregation = simply return points in the interval
            // All aggs requested in the query are just the values directly

            queryGroups.push({
                index,
                queries: [prevQuery, nextQuery, mainQuery],
                process: function(prev, next, main){
                    // Postprocess the query results
                    return {
                        prev: cvtBoundRow(prev, entry.signals, entry.aggs, uniqueIds), 
                        next: cvtBoundRow(next, entry.signals, entry.aggs, uniqueIds),
                        main: cvtMainRows(main, entry.signals, entry.aggs, uniqueIds)
                    };
                }
            });
        }
        
    }

    return await msearchHelper(queryGroups);
}


async function onCreateStorage(cid, aggs) {
    await elasticsearch.indices.create({index: getIndexName(cid)});

    return {};
}

async function onExtendSchema(cid, aggs, fields) {
    // No need to explicitly initialize empty columns
    return {};
}

async function onRenameField(cid, aggs, oldFieldCid, newFieldCid) {
    // Updating all records in the index is too slow. Instead, we require the user to reindex
    // const params = {oldField: oldFieldCid, newField: newFieldCid};
    // const script = 'ctx._source[params.newField]=ctx._source[params.oldField];ctx._source.remove(params.oldField)'; // Rename field
    cancelReindex(cid);
    return {reindexRequired: true};
}

async function onRemoveField(cid, aggs, fieldCid) {
    // Updating all records in the index is too slow. Instead, we require the user to reindex
    // const params = {field: fieldCid};
    // const script = 'ctx._source.remove(params.field)'
    cancelReindex(cid);
    return {reindexRequired: true};
}

async function onRemoveStorage(cid) {
    cancelReindex(cid);
    await elasticsearch.indices.delete({index: getIndexName(cid)});
    
    return {};
}

async function onInsertRecords(cid, aggs, records) {
    // If currently reindex is in progress, then if it has been already deleted, records will be inserted from here
    // It has not been deleted, then it will reindex the new records as well
    const indexName = getIndexName(cid);
    const columnMap = getColumnMap(knex, cid);
    const bulk = convertRecordsToBulk(records, indexName, columnMap);
    await elasticsearch.bulk({body:bulk});

    return {};
}

// Cancel possible pending or running reindex of this signal set
function cancelReindex(cid){
    indexerProcess.send({
        type: 'cancel-index',
        cid
    });
}

function reindex(cid) {
    indexerProcess.send({
        type: 'index',
        cid
    });
}

module.exports = {
    query,
    onCreateStorage,
    onExtendSchema,
    onRenameField,
    onRemoveField,
    onRemoveStorage,
    onInsertRecords,
    reindex,
    startProcess
};