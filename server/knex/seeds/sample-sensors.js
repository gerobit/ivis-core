"use strict";

const moment = require('moment');

const insertLimit = 10000;

exports.seed = (knex, Promise) => (async() => {
    async function generateSignal(cid, name, startTs, endTs, step, aggSize, generateVal, generateAgg) {
        await knex.schema.dropTableIfExists('val_' + cid);
        await knex.schema.dropTableIfExists('agg_' + cid);

        await knex('signals').where({cid}).del();
        await knex('signals').insert({cid, name, has_agg: generateAgg, has_val: generateVal, namespace: 1});

        if (generateVal) {
            await knex.schema.createTable('val_' + cid, table => {
                table.specificType('ts', 'datetime(6)').notNullable().index();
                table.double('val').notNullable();
            });
        }

        if (generateAgg) {
            await knex.schema.createTable('agg_' + cid, table => {
                table.specificType('ts', 'datetime(6)').notNullable().index();
                table.specificType('first_ts', 'datetime(6)').notNullable().index();
                table.specificType('last_ts', 'datetime(6)').notNullable().index();
                table.double('max').notNullable();
                table.double('min').notNullable();
                table.double('avg').notNullable();
            });
        }

        let ts = startTs;

        const randomWalkSteps = 6;
        const randomWalkStepsRemaining = new Array(randomWalkSteps).fill(0);
        const randomWalkIncrement = new Array(randomWalkSteps);

        let val = 0;

        let aggRows = [];
        let valRows = [];

        while (ts < endTs) {
            const firstTS = moment(ts);
            let lastTS;
            let sum = 0;
            let max = -Number.MAX_VALUE;
            let min = Number.MAX_VALUE;

            for (let aggIdx = 0; aggIdx < aggSize; aggIdx++) {
                for (let stepIdx = 0; stepIdx < randomWalkSteps; stepIdx++) {
                    let increment = randomWalkIncrement[stepIdx];

                    if (randomWalkStepsRemaining[stepIdx] === 0) {
                        randomWalkStepsRemaining[stepIdx] = Math.floor(Math.random() * Math.pow(2, stepIdx)) + 1;
                        increment = randomWalkIncrement[stepIdx] = (Math.random() - 0.5) * 0.2;
                        // console.log(`step ${stepIdx} ${randomWalkStepsRemaining[stepIdx]} ${increment}`);
                    }

                    randomWalkStepsRemaining[stepIdx] -= 1;

                    val += increment;
                }

                if (generateVal) {
                    valRows.push({ts: ts.toDate(), val});
                }

                if (generateAgg) {
                    sum += val;
                    max = Math.max(max, val);
                    min = Math.min(min, val);
                }

                ts.add(step);
            }

            if (generateVal) {
                if (valRows.length >= insertLimit) {
                    await knex('val_' + cid).insert(valRows);
                    valRows = [];
                }
            }

            if (generateAgg) {
                lastTS = moment(ts);
                lastTS.subtract(step);

                const aggRow = {
                    ts: moment.utc((firstTS + lastTS) / 2).toDate(),
                    first_ts: firstTS.toDate(),
                    last_ts: lastTS.toDate(),
                    max,
                    min,
                    avg: sum / aggSize
                };

                aggRows.push(aggRow);

                if (aggRows.length >= insertLimit) {
                    await knex('agg_' + cid).insert(aggRows);
                    aggRows = [];
                }
            }
        }

        if (generateVal && valRows.length > 0) {
            await knex('val_' + cid).insert(valRows);
        }

        if (generateAgg && aggRows.length > 0) {
            await knex('agg_' + cid).insert(aggRows);
        }
    }

    await generateSignal(
        'sensor1',
        'Sensor 1',
        moment.utc('2016-01-01 00:00:00.000'),
        moment.utc('2017-01-01 00:00:00.000'),
        moment.duration(1, 's'),
        60,
        false,
        true
    );

    await generateSignal(
        'sensor2',
        'Sensor 2',
        moment.utc('2016-01-01 00:00:00.000'),
        moment.utc('2016-02-01 00:00:00.000'),
        moment.duration(1, 's'),
        60,
        true,
        true
    );

})();