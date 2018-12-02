'use strict';

const moment = require('moment');
const elasticsearch = require('../elasticsearch');
const {enforce} = require('../helpers');
const interoperableErrors = require('../../../shared/interoperable-errors');
const { SignalType } = require('../../../shared/signals');
const { getIndexName, getFieldName, createIndex, extendMapping } = require('./elasticsearch-common');

const em = require('../extension-manager');
const fork = require('child_process').fork;

const handlebars = require('handlebars');
const path = require('path');
const log = require('../log');

const insertBatchSize = 1000;

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

const maxPoints = 5000;

const allowedAggs = new Set(['min', 'max', 'avg']);

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

    function createElsAggs(aggs) {
        const elsAggs = {};
        let aggNo = 0;
        for (const agg of aggs) {
            const field = signalMap[agg.sigCid];
            if (!field) {
                throw new Error(`Unknown signal ${agg.sigCid}`);
            }

            const elsAgg = {
                aggs: {}
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
                for (const sig in agg.signals) {
                    for (const aggFn of agg.signals[sig]) {
                        if (allowedAggs.has(aggFn)) {
                            const sigFld = signalMap[sig];

                            if (!sigFld) {
                                throw new Error(`Unknown signal ${sig}`);
                            }

                            const sigFldName = getFieldName(sigFld.id);

                            elsAgg.aggs[`${aggFn}_${sigFldName}`] = {
                                [aggFn]: getField(sigFld)
                            };
                        } else {
                            throw new Error(`Invalid aggregation function ${aggFn}`);
                        }
                    }
                }
            } else if (agg.aggs) {
                elsAgg.aggs = createElsAggs(agg.aggs);
            }

            if (agg.order || agg.limit) {
                elsAgg.aggs.sort = {
                    bucket_sort: {
                    }
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

        elsQry.sort = createElsSort(query.docs.sort);

    } else if (query.sample) {
        // TODO

    } else {
        throw new Error('None of "aggs", "docs", "sample" query part has been specified');
    }



    return elsQry;
}

function processElsQueryResult(query, elsResp) {
    const signalMap = query.signalMap;

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
                    const bucketValues = {};
                    buckets[bucketIdx].values = bucketValues;

                    for (const sig in agg.signals) {
                        const sigBucket = {};
                        bucketValues[sig] = sigBucket;

                        const sigFldName = getFieldName(signalMap[sig].id);

                        for (const aggFn of agg.signals[sig]) {
                            if (allowedAggs.has(aggFn)) {
                                sigBucket[aggFn] = elsBucket[`${aggFn}_${sigFldName}`].value;
                            }
                        }
                    }

                    bucketIdx += 1;
                }

            } else if (agg.aggs) {
                let bucketIdx = 0;
                for (const elsBucket of elsAggResp.buckets) {
                // FIXME - not implemented !!!

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

        for (const hit of elsResp.hits.hits) {
            const doc = {};

            for (const sig of query.docs.signals) {
                const sigFld = signalMap[sig];
                doc[sig] = getFieldName(sigFld.id);
            }

            result.docs.push(doc);
        }

    } else if (query.sample) {
        // TODO

    } else {
        throw new Error('None of "aggs", "docs", "sample" query part has been specified');
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

    const errorResponses = [];
    for (const response of msearchResult.responses) {
        if (response.error) {
            errorResponses.push(JSON.stringify(response.error));
        }
    }
    if (errorResponses.length > 0) {
        log.error("Indexer", "Elasticsearch queries failed");
        lot.verbose(errorResponses);
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
    cancelReindex(sigSet);
    return {reindexRequired: true};
}

async function onRemoveStorage(sigSet) {
    cancelReindex(sigSet);
    await elasticsearch.indices.delete({index: getIndexName(sigSet)});
    
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

// Cancel possible pending or running reindex of this signal set
function cancelReindex(sigSet) {
    indexerProcess.send({
        type: 'cancel-index',
        cid: sigSet.cid
    });
}

function reindex(sigSet) {
    indexerProcess.send({
        type: 'index',
        cid: sigSet.cid
    });
}

module.exports = {
    query,
    onCreateStorage,
    onExtendSchema,
    onRemoveField,
    onRemoveStorage,
    onInsertRecords,
    reindex,
    startProcess
};
