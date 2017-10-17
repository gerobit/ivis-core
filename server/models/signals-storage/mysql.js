'use strict';

const { getDSName, RecordType } = require('../../lib/signals-helpers');
const knex = require('../../lib/knex');
const {enforce} = require('../../lib/helpers');
const interoperableErrors = require('../../../shared/interoperable-errors');
const { getMinAggregationInterval } = require('../../../shared/signals');

const maxPoints = 5000;

// FIXME - this should use distributed cache
const existingTables = new Set();
const allowedAttrs = new Set(['min', 'max', 'avg']);

async function ensureTable(tableName, documentType) {
    if (existingTables.has(tableName)) {
        return;
    }

    let tableExists = await knex.schema.hasTable(tableName);

    if (!tableExists) {
        if (documentType === RecordType.AGG) {
            await knex.schema.createTable(tableName, table => {
                table.specificType('ts', 'datetime(6)').notNullable().index();
                table.specificType('first_ts', 'datetime(6)').notNullable().index();
                table.specificType('last_ts', 'datetime(6)').notNullable().index();
                table.double('max').notNullable();
                table.double('min').notNullable();
                table.double('avg').notNullable();
            });
        } else if (documentType === RecordType.VAL) {
            await knex.schema.createTable(tableName, table => {
                table.specificType('ts', 'datetime(6)').notNullable().index();
                table.double('val').notNullable();
            });
        } else {
            throw new Error(`Uknown record type ${documentType}`);
        }

        existingTables.add(tableName);
    }
}


async function insertVals(cid, vals) {
    const tableName = getDSName(cid, RecordType.VAL);
    await ensureTable(tableName, RecordType.VAL);
    await knex(tableName).insert(vals);
}

async function insertAggs(cid, aggs) {
    const tableName = getDSName(cid, RecordType.AGG);
    await ensureTable(tableName, RecordType.AGG);

    const rows = aggs.map(x => ({ts: x.ts, first_ts: x.firstTS, last_ts: x.lastTS, max: x.max, min: x.min, avg: x.avg}));
    await knex(tableName).insert(rows);
}

async function remove(cid) {
    const valTable = getDSName(cid, RecordType.VAL);
    const aggTable = getDSName(cid, RecordType.AGG);

    await knex.schema.dropTableIfExists(valTable);
    await knex.schema.dropTableIfExists(aggTable);

    existingTables.delete(valTable);
    existingTables.delete(aggTable);
}

async function query(qry) { // FIXME - add support for vals
    return await knex.transaction(async tx => {
        const results = [];

        for (const entry of qry) {
            const tableName = getDSName(entry.cid, RecordType.AGG);

            const from = entry.interval.from;
            const to = entry.interval.to;

            let prev, main, next;

            const mainDbQry = tx(tableName);

            for (const attr of entry.attrs) {
                enforce(allowedAttrs.has(attr), 'Unknown attribute ' + attr);
                mainDbQry.select(knex.raw(`${attr}(${attr}) AS ${attr}`)); // e.g. min(min) as min
            }

            const aggregationIntervalMs = entry.interval.aggregationInterval.asMilliseconds();
            if (aggregationIntervalMs > 0) {

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
                }


                main = await mainDbQry
                    .where('ts', '>=', from.toDate())
                    .where('ts', '<=', to.toDate())
                    .groupByRaw(`floor((unix_timestamp(ts)*1000 - ${offset}) / ${aggregationIntervalMs})`)
                    .orderBy('ts', 'asc')
                    .select(knex.raw('count(*) as count'), knex.raw(`from_unixtime((floor((unix_timestamp(min(ts))*1000 - ${offset}) / ${aggregationIntervalMs}) * ${aggregationIntervalMs} + ${offset} + ${aggregationIntervalMs / 2}) / 1000) as ts`));

                if (main.length > 0) {
                    // Adjust the center of the last interval if it is smaller than aggregationInterval
                    const lastIdx = main.length - 1;
                    const lastTs = main[lastIdx].ts;

                    const lastSlotTs = Math.floor((to - offset) / aggregationIntervalMs) * aggregationIntervalMs + offset;
                    if (lastTs >= lastSlotTs) {
                        main[lastIdx].ts = new Date((lastSlotTs + to) / 2);
                    }
                }

            } else {
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

            results.push({prev, main, next});
        }

        return results;
    });
}


module.exports = {
    insertVals,
    insertAggs,
    remove,
    query
};