'use strict';

const moment = require('moment');
const elasticsearch = require('../elasticsearch');
const interoperableErrors = require('../../../shared/interoperable-errors');
const { SignalType } = require('../../../shared/signals');
const { getIndexName, getFieldName } = require('./elasticsearch-common');

const handlebars = require('handlebars');
const log = require('../log');

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

function createElsScript(signalMap, field) {
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

function getField(signalMap, field) {
    if (field.type === SignalType.PAINLESS) {
        return { script: createElsScript(signalMap, field) };
    } else {
        return { field: getFieldName(field.id) };
    }
}

function createSignalAggs(signalMap, signals) {
    const aggs = {};

    for (const sig in signals) {
        for (const aggSpec of signals[sig]) {
            const aggHandler = getAggHandler(aggSpec)
            const sigFld = signalMap[sig];

            if (!sigFld) {
                throw new Error(`Unknown signal ${sig}`);
            }

            const sigFldName = getFieldName(sigFld.id);

            aggs[`${aggHandler.id}_${sigFldName}`] = aggHandler.getAgg(getField(signalMap, sigFld));
        }
    }

    return aggs;
}

function createElsSort(signalMap, sort) {
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


function createElsAggs(signalMap, aggs) {
    const elsAggs = {};
    let aggNo = 0;
    for (const agg of aggs) {
        const field = signalMap[agg.sigCid];
        if (!field) {
            throw new Error(`Unknown signal ${agg.sigCid}`);
        }

        const elsAgg = {
        };

        // TODO - process minStep & maxBucketCount (as alternative to step)

        if (field.type === SignalType.DATE_TIME) {
            // TODO: add processing of range buckets

            elsAgg.date_histogram = {
                ...getField(signalMap, field),
                interval: getElsInterval(moment.duration(agg.step)),
                offset: getElsInterval(moment.duration(agg.offset)),
                min_doc_count: agg.minDocCount
            };

        } else if (field.type === SignalType.INTEGER || field.type === SignalType.LONG || field.type === SignalType.FLOAT || field.type === SignalType.DOUBLE) {
            elsAgg.histogram = {
                ...getField(signalMap, field),
                interval: agg.step,
                offset: aggs.offset,
                min_doc_count: agg.minDocCount
            };

        } else {
            throw new Error('Type of ' + agg.sigCid + ' (' + field.type + ') is not supported in aggregations');
        }

        if (agg.signals) {
            elsAgg.aggs = createSignalAggs(signalMap, agg.signals);
        } else if (agg.aggs) {
            elsAgg.aggs = createElsAggs(signalMap, agg.aggs);
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

function processSignalAggs(signalMap, signals, elsSignalsResp) {
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

function processElsAggs(signalMap, aggs, elsAggsResp) {
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
                buckets[bucketIdx].values = processSignalAggs(signalMap, agg.signals, elsBucket);
                bucketIdx += 1;
            }

        } else if (agg.aggs) {
            let bucketIdx = 0;
            for (const elsBucket of elsAggResp.buckets) {
                buckets[bucketIdx].aggs = processElsAggs(signalMap, agg.aggs, elsBucket);
                bucketIdx += 1;
            }
        }

        result.push(buckets);

        aggNo += 1;
    }

    return result;
}

function createElsFilter(signalMap, ranges) {
    const filter = [];
    for (const range of ranges) {
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

    return {
        bool: {
            filter
        }
    };
}


function* processQueryAggs(signalMap, indexName, query) {
    // TODO - traverse through aggs and determine for which signals we need a summary statistics (i.e. which are those that specify minStep & maxBucketCount instead of offset & step
    // TODO - Execute a query that collects the statistics and collect the statistics in a map for use by the createElsAggs

    const elsQry = {
        query: createElsFilter(signalMap, query.ranges),
        size: 0,
        aggs: createElsAggs(signalMap, query.aggs)
    };

    const [elsResp] = yield [{index: indexName, query: elsQry}];

    return {
        aggs: processElsAggs(signalMap, query.aggs, elsResp.aggregations)
    };
}


function* processQueryDocs(signalMap, indexName, query) {
    const elsQry = {
        query: createElsFilter(signalMap, query.ranges),
        _source: [],
        script_fields: {}
    };

    if ('limit' in query.docs) {
        elsQry.size = query.docs.limit;
    }

    for (const sig of query.docs.signals) {
        const sigFld = signalMap[sig];

        if (!sigFld) {
            throw new Error(`Unknown signal ${sig}`);
        }

        const sigFldName = getFieldName(sigFld.id);

        const elsFld = getField(signalMap, sigFld);
        if (elsFld.field) {
            elsQry._source.push(elsFld.field);
        } else if (elsFld.script) {
            elsQry.script_fields[sigFldName] = elsFld;
        }
    }

    if (query.docs.sort) {
        elsQry.sort = createElsSort(signalMap, query.docs.sort);
    }

    const [elsResp] = yield [{index: indexName, query: elsQry}];

    const result = {
        docs: [],
        total: elsResp.hits.total
    };

    for (const hit of elsResp.hits.hits) {
        const doc = {};

        for (const sig of query.docs.signals) {
            const sigFld = signalMap[sig];

            if (sigFld.type === SignalType.PAINLESS) {
                doc[sig] = hit.fields[getFieldName(sigFld.id)][0];
            } else {
                doc[sig] = hit._source[getFieldName(sigFld.id)];
            }
        }

        result.docs.push(doc);
    }

    return result;
}


function* processQuerySummary(signalMap, indexName, query) {
    const elsQry = {
        query: createElsFilter(signalMap, query.ranges),
        size: 0,
        aggs: createSignalAggs(signalMap, query.summary.signals)
    };

    const [elsResp] = yield [{index: indexName, query: elsQry}];

    return {
        summary: processSignalAggs(signalMap, query.summary.signals, elsResp.aggregations)
    };
}


function* processQuery(query) {
    const indexName = getIndexName(query.sigSet);
    const signalMap = query.signalMap;

    if (query.aggs) {
        return yield* processQueryAggs(signalMap, indexName, query);

    } else if (query.docs) {
        return yield* processQueryDocs(signalMap, indexName, query);

    } else if (query.sample) {
        // TODO
        return {};

    } else if (query.summary) {
        return yield* processQuerySummary(signalMap, indexName, query);

    } else {
        throw new Error('None of "aggs", "docs", "sample", "summary" query part has been specified');
    }
}


// Executes a set of queries. It tries to aggregate ELS queries together and execute them at one using msearch.
// The actual queries are built using processQuery (above). The processQuery function may execute several queries
// in series. As such, it is a generator function which either yields a list of queries to be executed or it returns
// the result to be send back to the client.
async function query(queries) {

    const qryGens = queries.map(processQuery);

    const result = new Array(queries.length);
    const lastElsResp = new Array(queries.length);

    const initLastElsResp = () => {
        for (let idx = 0; idx < lastElsResp.length; idx++) {
            lastElsResp[idx] = [];
        }
    };

    initLastElsResp();

    while (true) {
        const msearchBody = [];
        const msearchIdxMapping = new Map();

        let msearchRequestIdx = 0;
        for (let idx = 0; idx < queries.length; idx++) {
            if (!result[idx]) {
                const iterElem = qryGens[idx].next(lastElsResp[idx]);

                if (iterElem.done) {
                    result[idx] = iterElem.value;

                } else {
                    for (const elsQry of iterElem.value) {
                        msearchIdxMapping.set(msearchRequestIdx, idx);
                        msearchRequestIdx += 1;

                        msearchBody.push({index: elsQry.index});
                        msearchBody.push(elsQry.query);
                    }
                }
            }
        }

        if (msearchBody.length === 0) break;

        const msearchResult = await elasticsearch.msearch({body:msearchBody});


        const errorResponses = [];
        for (const response of msearchResult.responses) {
            if (response.error) {
                errorResponses.push(JSON.stringify(response.error));
            }
        }

        // FIXME - process errors caused by asking for too many data points - this should throw interoperableErrors.TooManyPointsError
        if (errorResponses.length > 0) {
            log.error("Indexer", "Elasticsearch queries failed");
            log.verbose(errorResponses);
            throw new Error("Elasticsearch queries failed");
        }


        initLastElsResp();
        for (let msearchResultIdx = 0; msearchResultIdx < msearchResult.responses.length; msearchResultIdx++) {
            const idx = msearchIdxMapping.get(msearchResultIdx);
            lastElsResp[idx].push(msearchResult.responses[msearchResultIdx]);
        }
    }


    return result;
}


module.exports.query = query;
