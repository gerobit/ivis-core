'use strict';

const { getDSName, RecordType } = require('../../../shared/signals');
const elasticsearch = require('../elasticsearch');
const {enforce} = require('../helpers');

// FIXME - this should use distributed cache
const existingIndexes = new Set();
const allowedAttrs = new Set(['min', 'max', 'avg']);

const aggDocumentType = {
    properties: {
        ts: { // (firstTS - lastTS) / 2
            type: 'date'
        },
        firstTS: {
            type: 'date'
        },
        lastTS: {
            type: 'date'
        },
        max: {
            type: 'double'
        },
        min: {
            type: 'double'
        },
        avg: {
            type: 'double'
        }
    }
};

const valDocumentType = {
    properties: {
        ts: {
            type: 'date'
        },
        val: {
            type: 'double'
        }
    }
};

function getElsInterval(aggregationInterval) {
    const units = ['ms', 's', 'm', 'h'];
    for (const unit of units) {
        console.log(unit);
        console.log(aggregationInterval.get(unit));
        if (aggregationInterval.get(unit) !== 0) {
            return aggregationInterval.as(unit) + unit;
        }
    }

    return aggregationInterval.as('d') + 'd';
}

async function ensureIndex(indexName, documentType) {
    if (existingIndexes.has(indexName)) {
        return;
    }

    let indexExists = await elasticsearch.indices.exists({ index: indexName });

    if (!indexExists) {
        await elasticsearch.indices.create({
            index: indexName,
            body: {
                mappings: {
                    record: documentType
                }
            }
        });

        existingIndexes.add(indexName);
    }
}


async function insertVals(cid, vals) {
    const bulk = [];

    const indexName = getDSName(cid, RecordType.VAL);
    await ensureIndex(indexName, valDocumentType);

    for (const val of vals) {
        bulk.push({
            index: {
                _index: indexName,
                _type: RecordType.VAL
            }
        });

        bulk.push(val);
    }

    if (bulk.length > 0) {
        await elasticsearch.bulk({ body: bulk });
    }
}

async function insertAggs(cid, aggs) {
    const bulk = [];

    const indexName = getDSName(cid, RecordType.AGG);
    await ensureIndex(indexName, aggDocumentType);

    for (const agg of aggs) {
        bulk.push({
            index: {
                _index: indexName,
                _type: RecordType.AGG
            }
        });

        bulk.push(agg);
    }

    if (bulk.length > 0) {
        await elasticsearch.bulk({ body: bulk });
    }
}

async function remove(cid) {
    // FIXME
}

async function query(qry) { // FIXME - add support for vals
    const msearch = [];

    for (const entry of qry) {
        const from = entry.interval.from;
        const to = entry.interval.to;
        const aggregationInterval = entry.interval.aggregationInterval;

        const aggs = {};
        for (const attr of entry.attrs) {
            enforce(allowedAttrs.has(attr), 'Unknown attribute ' + attr);
            aggs[attrId] = {
                [attrId]: {
                    field: attr
                }
            }
        }

        msearch.push({
            index: getDSName(entry.cid, RecordType.AGG)
        });

        msearch.push({
            size: 0,
            query: {
                bool: {
                    must: [
                        {
                            range: {
                                time: { gte: from.valueOf(), lte: to.valueOf() }
                            }
                        }
                    ]
                }
            },

            aggs: {
                buckets: {
                    date_histogram: {
                        field: 'firstTS',
                        interval: getElsInterval(aggregationInterval),
                        offset: from.valueOf() % aggregationInterval.asMilliseconds()
                    },
                    aggs
                }
            },
            sort: {firstTS: 'asc'}
        });
    }

    console.log(JSON.stringify(msearch));
    /*
     const searchResults = await elasticsearch.msearch({
     body: msearch
     });

     // FIXME: add count, prev, next

     const results = searchResults.responses[0].aggregations.buckets.buckets.map(bucket => ({t: bucket.key, v: bucket.value_avg.value})));

    return results;
     */
}


module.exports = {
    insertVals,
    insertAggs,
    remove,
    query
};