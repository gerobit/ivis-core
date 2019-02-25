'use strict';

const moment = require('moment');
const elasticsearch = require('../elasticsearch');
const {enforce} = require('../helpers');
const interoperableErrors = require('../../../shared/interoperable-errors');
const { SignalType, IndexMethod } = require('../../../shared/signals');
const { getIndexName, getFieldName, createIndex, extendMapping } = require('./elasticsearch-common');
const contextHelpers = require('../context-helpers');

const signalSets = require('../../models/signal-sets');
const em = require('../extension-manager');
const fork = require('child_process').fork;

const handlebars = require('handlebars');
const path = require('path');
const log = require('../log');

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

// Converts an interval into elasticsearch interval
function getElsInterval(duration) {
    const units = ['ms', 's', 'm', 'h'];
    for (const unit of units) {
        if (duration.get(unit) !== 0) {
            return duration.as(unit) + unit;
        }
    }

    return duration.as('d') + 'd';
}

const aggHandlers = {
    min: aggSpec => ({
        id: 'min',
        getAgg: field => ({
            min: field
        }),
        processResponse: resp => resp.value
    }),
    avg: aggSpec => ({
        id: 'avg',
        getAgg: field => ({
            avg: field
        }),
        processResponse: resp => resp.value
    }),
    max: aggSpec => ({
        id: 'max',
        getAgg: field => ({
            max: field
        }),
        processResponse: resp => resp.value
    }),
    percentiles: aggSpec => ({
        id: 'percentiles',
        getAgg: field => ({
            percentiles: {
                percents: aggSpec.percents,
                ...field
            }
        }),
        processResponse: resp => resp.values
    }),
};

function getAggHandler(aggSpec) {
    let aggHandler;

    if (typeof aggSpec === 'string') {
        aggHandler = aggHandlers[aggSpec]

        if (aggHandler) {
            return aggHandler({});
        } else {
            throw new Error(`Invalid aggregation function ${aggSpec}`);
        }
    } else {
        aggHandler = aggHandlers[aggSpec.type];
        if (aggHandler) {
            return aggHandler(aggSpec);
        } else {
            throw new Error(`Invalid aggregation function ${aggSpec.type}`);
        }
    }
}

function createElsQuery(query) {
    const signalMap = query.signalMap;

    function createElsScript(field) {
        const fieldNamesMap = {};
        for (const sigCid in signalMap) {
            fieldNamesMap[sigCid] = getFieldName(signalMap[sigCid].id);
        }

        const scriptSource = field.settings.painlessScript;

        // Handlebars replaces {{cid}} by the unique id of the signal
        const scriptTemplate = handlebars.compile(scriptSource, {noEscape:true});
        const scriptSubstituted = scriptTemplate(fieldNamesMap);
        return {source: scriptSubstituted};
    }

    function getField(field) {
        if (field.type === SignalType.PAINLESS) {
            return { script: createElsScript(field) };
        } else {
            return { field: getFieldName(field.id) };
        }
    }

    function createSignalAggs(signals) {
        const aggs = {};

        for (const sig in signals) {
            for (const aggSpec of signals[sig]) {
                const aggHandler = getAggHandler(aggSpec)
                const sigFld = signalMap[sig];

                if (!sigFld) {
                    throw new Error(`Unknown signal ${sig}`);
                }

                const sigFldName = getFieldName(sigFld.id);

                aggs[`${aggHandler.id}_${sigFldName}`] = aggHandler.getAgg(getField(sigFld));
            }
        }

        return aggs;
    }

    function createElsAggs(aggs) {
        const elsAggs = {};
        let aggNo = 0;
        for (const agg of aggs) {
            const field = signalMap[agg.sigCid];
            if (!field) {
                throw new Error(`Unknown signal ${agg.sigCid}`);
            }

            const elsAgg = {
            };

            if (field.type === SignalType.DATE_TIME) {
                // TODO: add processing of range buckets

                elsAgg.date_histogram = {
                    ...getField(field),
                    interval: getElsInterval(moment.duration(agg.step)),
                    offset: getElsInterval(moment.duration(agg.offset)),
                    min_doc_count: agg.minDocCount
                };

            } else if (field.type === SignalType.INTEGER || field.type === SignalType.LONG || field.type === SignalType.FLOAT || field.type === SignalType.DOUBLE) {
                elsAgg.histogram = {
                    ...getField(field),
                    interval: agg.step,
                    offset: aggs.offset,
                    min_doc_count: agg.minDocCount
                };

            } else {
                throw new Error('Type of ' + agg.sigCid + ' (' + field.type + ') is not supported in aggregations');
            }

            if (agg.signals) {
                elsAgg.aggs = createSignalAggs(agg.signals);
            } else if (agg.aggs) {
                elsAgg.aggs = createElsAggs(agg.aggs);
            }

            if (agg.order || agg.limit) {
                elsAgg.aggs.sort = {
                    bucket_sort: {}
                };

                if (agg.order) {
                    elsAgg.aggs.sort.bucket_sort.sort = [
                        {
                            _key: {
                                order: agg.order
                            }
                        }
                    ];
                }

                if (agg.limit) {
                    elsAgg.aggs.sort.bucket_sort.size = agg.limit;
                }
            }

            elsAggs['agg_' + aggNo] = elsAgg;

            aggNo += 1;
        }

        return elsAggs;
    }

    function createElsSort(sort) {
        const elsSort = [];
        for (const srt of sort) {
            const field = signalMap[srt.sigCid];

            if (!field) {
                throw new Error('Unknown field ' + srt.sigCid);
            }

            elsSort.push({
                [getFieldName(field.id)]: {
                    order: srt.order
                }
            })
        }

        return elsSort;
    }


    const elsQry = {
    };

    const filter = [];
    for (const range of query.ranges) {
        const field = signalMap[range.sigCid];

        if (!field) {
            throw new Error('Unknown field ' + range.sigCid);
        }

        const rng = {};
        const rngAttrs = ['gte', 'gt', 'lte', 'lt'];
        for (const rngAttr of rngAttrs) {
            if (range[rngAttr]) {
                rng[rngAttr] = range[rngAttr];
            }
        }

        filter.push({
            range: {
                [getFieldName(field.id)]: rng
            }
        });
    }

    elsQry.query = {
        bool: {
            filter
        }
    };


    if (query.aggs) {
        elsQry.size = 0;
        elsQry.aggs = createElsAggs(query.aggs);

    } else if (query.docs) {
        if ('limit' in query.docs) {
            elsQry.size = query.docs.limit;
        }

        elsQry._source = [];
        elsQry.script_fields = {};
        for (const sig of query.docs.signals) {
            const sigFld = signalMap[sig];

            if (!sigFld) {
                throw new Error(`Unknown signal ${sig}`);
            }

            const sigFldName = getFieldName(sigFld.id);

            const elsFld = getField(sigFld);
            if (elsFld.field) {
                elsQry._source.push(elsFld.field);
            } else if (elsFld.script) {
                elsQry.script_fields[sigFldName] = elsFld;
            }
        }

        if (query.docs.sort) {
            elsQry.sort = createElsSort(query.docs.sort);
        }

    } else if (query.sample) {
        // TODO

    } else if (query.summary) {
        elsQry.size = 0;
        elsQry.aggs = createSignalAggs(query.summary.signals);

    } else {
        throw new Error('None of "aggs", "docs", "sample", "summary" query part has been specified');
    }

    return elsQry;
}

function processElsQueryResult(query, elsResp) {
    const signalMap = query.signalMap;

    function processSignalAggs(signals, elsSignalsResp) {
        const result = {};

        for (const sig in signals) {
            const sigBucket = {};
            result[sig] = sigBucket;

            const sigFldName = getFieldName(signalMap[sig].id);

            for (const aggSpec of signals[sig]) {
                const aggHandler = getAggHandler(aggSpec);
                sigBucket[aggHandler.id] = aggHandler.processResponse(elsSignalsResp[`${aggHandler.id}_${sigFldName}`]);
            }
        }

        return result;
    }

    function processElsAggs(aggs, elsAggsResp) {
        const result = [];

        let aggNo = 0;
        for (const agg of aggs) {
            const elsAggResp = elsAggsResp['agg_' + aggNo];

            const buckets = [];

            const field = signalMap[agg.sigCid];
            if (field.type === SignalType.DATE_TIME) {
                // TODO: add processing of range buckets

                for (const elsBucket of elsAggResp.buckets) {
                    buckets.push({
                        key: moment.utc(elsBucket.key).toISOString(),
                        count: elsBucket.doc_count
                    });
                }

            } else if (field.type === SignalType.INTEGER || field.type === SignalType.LONG || field.type === SignalType.FLOAT || field.type === SignalType.DOUBLE) {
                for (const elsBucket of elsAggResp.buckets) {
                    buckets.push({
                        key: elsBucket.key,
                        count: elsBucket.doc_count
                    });
                }

            } else {
                throw new Error('Type of ' + agg.sigCid + ' (' + field.type + ') is not supported in aggregations');
            }

            if (agg.signals) {
                let bucketIdx = 0;
                for (const elsBucket of elsAggResp.buckets) {
                    buckets[bucketIdx].values = processSignalAggs(agg.signals, elsBucket);
                    bucketIdx += 1;
                }

            } else if (agg.aggs) {
                let bucketIdx = 0;
                for (const elsBucket of elsAggResp.buckets) {
                    buckets[bucketIdx].aggs = processElsAggs(agg.aggs, elsBucket);
                    bucketIdx += 1;
                }
            }

            result.push(buckets);

            aggNo += 1;
        }

        return result;
    }

    const result = {};

    if (query.aggs) {
        result.aggs = processElsAggs(query.aggs, elsResp.aggregations);

    } else if (query.docs) {
        result.docs = [];
        result.total = elsResp.hits.total;

        for (const hit of elsResp.hits.hits) {
            const doc = {};

            for (const sig of query.docs.signals) {
                const sigFld = signalMap[sig];

                if (sigFld.type === SignalType.PAINLESS) {
                    doc[sig] = hit.fields[getFieldName(sigFld.id)];
                } else {
                    doc[sig] = hit._source[getFieldName(sigFld.id)];
                }
            }

            result.docs.push(doc);
        }

    } else if (query.sample) {
        // TODO

    } else if (query.summary) {
        result.summary = processSignalAggs(query.summary.signals, elsResp.aggregations);

    } else {
        throw new Error('None of "aggs", "docs", "sample", "summary" query part has been specified');
    }

    return result;
}


async function query(queries) {
    const msearchBody = [];

    for (const sigSetQry of queries) {
        const indexName = getIndexName(sigSetQry.sigSet);

        msearchBody.push({index: indexName});
        msearchBody.push(createElsQuery(sigSetQry));
    }

    const msearchResult = await elasticsearch.msearch({body:msearchBody});

    // FIXME - process errors caused by asking for too many data points - this should throw interoperableErrors.TooManyPointsError

    const errorResponses = [];
    for (const response of msearchResult.responses) {
        if (response.error) {
            errorResponses.push(JSON.stringify(response.error));
        }
    }
    if (errorResponses.length > 0) {
        log.error("Indexer", "Elasticsearch queries failed");
        log.verbose(errorResponses);
        throw new Error("Elasticsearch queries failed");
    }

    const result = [];

    for (let idx = 0; idx < queries.length; idx++) {
        result.push(processElsQueryResult(queries[idx], msearchResult.responses[idx]));
    }

    return result;
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
