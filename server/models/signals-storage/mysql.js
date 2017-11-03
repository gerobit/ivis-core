'use strict';

const { SignalType } = require('../../lib/signals-helpers');
const knex = require('../../lib/knex');
const {enforce} = require('../../lib/helpers');
const interoperableErrors = require('../../../shared/interoperable-errors');
const { getMinAggregationInterval } = require('../../../shared/signals');

const maxPoints = 5000;

// FIXME - This should use Redis if paralelized
const existingTables = new Set();
const allowedAggs = new Set(['min', 'max', 'avg']);

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

async function createStorage(cid, aggs) {
    await knex.schema.createTable(getTableName(cid), table => {
        table.specificType('ts', 'datetime(6)').notNullable().index();
        if (aggs) {
            table.specificType('first_ts', 'datetime(6)').notNullable().index();
            table.specificType('last_ts', 'datetime(6)').notNullable().index();
        }
    });

    existingTables.add(cid);
}

async function extendSchema(cid, aggs, fields) {
    await knex.schema.table(getTableName(cid), table => {
        for (const fieldCid in fields) {
            if (aggs) {
                for (const agg of allowedAggs) {
                    table.specificType(agg + '_' + fieldCid, fieldTypes[schema[fieldCid]]);
                }
            } else {
                table.specificType(fieldCid, fieldTypes[schema[fieldCid]]);
            }
        }
    });
}

async function renameField(cid, aggs, oldFieldCid, newFieldCid) {
    await knex.schema.table(getTableName(cid), table => {
        if (aggs) {
            for (const agg of allowedAggs) {
                table.renameColumn(agg + '_' + oldFieldCid, agg + '_' + newFieldCid);
            }
        } else {
            table.renameColumn(oldFieldCid, newFieldCid);
        }
    });
}

async function removeField(cid, aggs, fieldCid) {
    await knex.schema.table(getTableName(cid), table => {
        if (aggs) {
            for (const agg of allowedAggs) {
                table.dropColumn(agg + '_' + fieldCid);
            }
        } else {
            table.dropColumn(fieldCid);
        }
    });
}

async function removeStorage(cid) {
    await knex.schema.dropTableIfExists(getTableName(cid));
    existingTables.delete(cid);
}

async function insertRecords(cid, records) {
    await knex(getTableName(cid)).insert(records);
}

function _convertResultRow(entry, row) {
    if (!row) {
        return;
    }

    const newRow = {
        ts: row.ts
    };

    if (row.count !== undefined) {
        newRow.count = row.count;
    }

    for (const signalCid in entry.signals) {
        const newCol = {};
        newRow[signalCid] = newCol;

        const signalAggs = entry.signals[signalCid];
        for (const agg of signalAggs) {
            newCol[agg] = row[agg + '_' + signalCid];
        }
    }

    return newRow;
}

async function query(aggs, qry) {
    return await knex.transaction(async tx => {
        const results = [];

        for (const entry of qry) {
            const tableName = getTableName(entry.cid);

            const from = entry.interval.from;
            const to = entry.interval.to;

            let prev, main, next;

            const mainDbQry = tx(tableName);

            const aggregationIntervalMs = entry.interval.aggregationInterval.asMilliseconds();
            if (aggregationIntervalMs > 0) {

                if (aggs) {
                    for (const signalCid in entry.signals) {
                        const signalAggs = entry.signals[signalCid];
                        for (const agg of signalAggs) {
                            enforce(allowedAggs.has(agg), 'Unknown aggregation ' + agg);
                            mainDbQry.select(knex.raw(`${agg}(${agg}_${signalCid}) AS ${agg}_${signalCid}`)); // e.g. min(min_xxx) as min_xxx
                        }
                    }
                } else {
                    for (const signalCid in entry.signals) {
                        const signalAggs = entry.signals[signalCid];
                        for (const agg of signalAggs) {
                            enforce(allowedAggs.has(agg), 'Unknown aggregation ' + agg);
                            mainDbQry.select(knex.raw(`${agg}(${signalCid}) AS ${agg}_${signalCid}`)); // e.g. min(xxx) as min_xxx
                        }
                    }
                }

                const minAggregationInterval = getMinAggregationInterval(from, to);
                if (aggregationIntervalMs < minAggregationInterval) {
                    throw new interoperableErrors.TooManyPointsError();
                }

                const offset = from.valueOf() % aggregationIntervalMs;

                const prevVal = await tx(tableName)
                    .select('ts')
                    .where('ts', '<', from.toDate())
                    .orderBy('ts', 'desc')
                    .first();

                if (prevVal) {
                    const prevTsStart = Math.floor((prevVal.ts - offset) / aggregationIntervalMs) * aggregationIntervalMs + offset;
                    const prevTsEnd = prevTsStart + aggregationIntervalMs;

                    prev = await mainDbQry.clone()
                        .where('ts', '<', new Date(prevTsEnd))
                        .where('ts', '>=', new Date(prevTsStart))
                        .select(knex.raw('count(*) as count'), knex.raw(`from_unixtime(${(prevTsStart + aggregationIntervalMs / 2) / 1000}) as ts`))
                        .first();

                    // If there is only one value, it looks bad if we report the timestamp in the middle because it's a data point that
                    // does not exist in reality. Thus we better show the timestamp of the single value.
                    if (prev.count === 1) {
                        prev.ts = prevVal.ts;
                    }
                }

                // "to" may be before the end of aggregationInterval, thus we compute the start of the next aggregation interval below
                const alignedTo = Math.ceil((to - offset) / aggregationIntervalMs) * aggregationIntervalMs + offset;

                const nextVal = await tx(tableName)
                    .select('ts')
                    .where('ts', '>=', new Date(alignedTo))
                    .orderBy('ts', 'asc')
                    .first();

                if (nextVal) {
                    const nextTsStart = Math.floor((nextVal.ts - offset) / aggregationIntervalMs) * aggregationIntervalMs + offset;
                    const nextTsEnd = nextTsStart + aggregationIntervalMs;

                    next = await mainDbQry.clone()
                        .where('ts', '<', new Date(nextTsEnd))
                        .where('ts', '>=', new Date(nextTsStart))
                        .select(knex.raw('count(*) as count'), knex.raw(`from_unixtime(${(nextTsStart + aggregationIntervalMs / 2) / 1000}) as ts`))
                        .first();

                    // If there is only one value, it looks bad if we report the timestamp in the middle because it's a data point that
                    // does not exist in reality. Thus we better show the timestamp of the single value.
                    if (next.count === 1) {
                        next.ts = nextVal.ts;
                    }
                }


                main = await mainDbQry
                    .where('ts', '>=', from.toDate())
                    .where('ts', '<=', to.toDate())
                    .groupByRaw(`floor((unix_timestamp(ts)*1000 - ${offset}) / ${aggregationIntervalMs})`)
                    .orderBy('ts', 'asc')
                    .select(
                        knex.raw('count(*) as count'),
                        knex.raw('min(ts) as minTs'),
                        knex.raw(`from_unixtime((floor((unix_timestamp(min(ts))*1000 - ${offset}) / ${aggregationIntervalMs}) * ${aggregationIntervalMs} + ${offset} + ${aggregationIntervalMs / 2}) / 1000) as ts`)
                    );

                if (main.length > 0) {
                    // Adjust the center of the last interval if it is smaller than aggregationInterval
                    const lastIdx = main.length - 1;
                    const lastTs = main[lastIdx].ts;

                    const lastSlotTs = Math.floor((to - offset) / aggregationIntervalMs) * aggregationIntervalMs + offset;
                    if (lastTs >= lastSlotTs) {
                        main[lastIdx].ts = new Date((lastSlotTs + to) / 2);
                    }

                    // If there is only one value in an interval, it looks bad if we report the timestamp in the middle because it's a data point that
                    // does not exist in reality. Thus we better show the timestamp of the single value.
                    for (const point of main) {
                        if (point.count === 1) {
                            point.ts = point.minTs
                        }

                        delete point.minTs;
                    }
                }

            } else {
                if (aggs) {
                    for (const signalCid in entry.signals) {
                        const signalAggs = entry.signals[signalCid];
                        for (const agg of signalAggs) {
                            enforce(allowedAggs.has(agg), 'Unknown aggregation ' + agg);
                            mainDbQry.select(agg + '_' + signalCid); // e.g. min_xxx
                        }
                    }
                } else {
                    for (const signalCid in entry.signals) {
                        const signalAggs = entry.signals[signalCid];
                        for (const agg of signalAggs) {
                            enforce(allowedAggs.has(agg), 'Unknown aggregation ' + agg);
                            mainDbQry.select(knex.raw(`${signalCid} AS ${agg}_${signalCid}`)); // e.g. xxx as min_xxx
                        }
                    }
                }

                const countQuery = mainDbQry.clone();
                countQuery.select(knex.raw('count(*) as count'));
                const countRow = await countQuery;

                if (countRow.count > maxPoints) {
                    throw new interoperableErrors.TooManyPointsError();
                }

                prev = await mainDbQry.clone()
                    .where('ts', '<', from.toDate())
                    .orderBy('ts', 'desc')
                    .first();

                next = await mainDbQry.clone()
                    .where('ts', '>', to.toDate())
                    .orderBy('ts', 'asc')
                    .first();

                main = await mainDbQry
                    .where('ts', '>=', from.toDate())
                    .where('ts', '<=', to.toDate())
                    .orderBy('ts', 'asc')
                    .select('ts');
            }

            prev = _convertResultRow(entry, prev);
            next = _convertResultRow(entry, next);
            main = main.map(row => _convertResultRow(entry, row));

            results.push({prev, main, next});
        }

        return results;
    });
}

module.exports = {
    createStorage,
    extendSchema,
    renameField,
    removeField,
    removeStorage,
    insertRecords,
    query
};