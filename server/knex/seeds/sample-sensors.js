"use strict";

const moment = require('moment');

const insertLimit = 10000;

class RandomWalker {
    constructor(randomWalkSteps) {
        this.randomWalkSteps = randomWalkSteps;
        this.stepsRemaining = new Array(randomWalkSteps).fill(0);
        this.increments = new Array(randomWalkSteps);
        this.val = 0;
    }

    next() {
        for (let stepIdx = 0; stepIdx < this.randomWalkSteps; stepIdx++) {
            let increment = this.increments[stepIdx];

            if (this.stepsRemaining[stepIdx] === 0) {
                this.stepsRemaining[stepIdx] = Math.floor(Math.random() * Math.pow(2, stepIdx)) + 1;
                increment = this.increments[stepIdx] = (Math.random() - 0.5) * 0.2;
                // console.log(`step ${stepIdx} ${randomWalkStepsRemaining[stepIdx]} ${increment}`);
            }

            this.stepsRemaining[stepIdx] -= 1;

            this.val += increment;
        }

        return this.val;
    }
}

exports.seed = (knex, Promise) => (async() => {
    async function generateSignalSet(cid, name, fields, startTs, endTs, step, aggSize) {
        const aggs = !!aggSize;
        const signalTable = 'signal_set_' + cid;

        await knex.schema.dropTableIfExists(signalTable);

        await knex('signal_sets').where({cid}).del();
        const ids = await knex('signal_sets').insert({cid, name, aggs, indexing: JSON.stringify({status: 1}), namespace: 1});
        const signalSetId = ids[0];

        for (const fieldCid of fields) {
            await knex('signals').insert({cid: fieldCid, type: 'raw_double', settings: JSON.stringify({}), set: signalSetId, namespace: 1});
        }

        await knex.schema.createTable(signalTable, table => {
            table.specificType('ts', 'datetime(6)').notNullable().index();
            if (aggs) {
                table.specificType('first_ts', 'datetime(6)').notNullable().index();
                table.specificType('last_ts', 'datetime(6)').notNullable().index();
            }

            for (const fieldCid of fields) {
                if (aggs) {
                    table.specificType('max_' + fieldCid, 'double');
                    table.specificType('avg_' + fieldCid, 'double');
                    table.specificType('min_' + fieldCid, 'double');
                } else {
                    table.specificType('val_' + fieldCid, 'double');
                }
            }
        });


        let ts = startTs;

        const walkers = {};
        for (const fieldCid of fields) {
            walkers[fieldCid] = new RandomWalker(6);
        }

        let rows = [];
        while (ts < endTs) {
            const row = {};

            if (aggs) {
                for (const fieldCid of fields) {
                    row['max_' + fieldCid] = -Number.MAX_VALUE;
                    row['min_' + fieldCid] = Number.MAX_VALUE;
                    row['avg_' + fieldCid] = 0;
                }

                const firstTS = moment(ts);

                for (let aggIdx = 0; aggIdx < aggSize; aggIdx++) {
                    for (const fieldCid of fields) {
                        const val = walkers[fieldCid].next();

                        row['max_' + fieldCid] = Math.max(row['max_' + fieldCid], val);
                        row['min_' + fieldCid] = Math.min(row['min_' + fieldCid], val);
                        row['avg_' + fieldCid] += val / aggSize;
                    }

                    ts.add(step);
                }

                const lastTS = moment(ts);
                lastTS.subtract(step);

                row['ts'] = moment.utc((firstTS + lastTS) / 2).toDate();
                row['first_ts'] = firstTS.toDate();
                row['last_ts'] = lastTS.toDate();

            } else {
                for (const fieldCid of fields) {
                    const val = walkers[fieldCid].next();
                    row['val_' + fieldCid] = val;
                }

                row['ts'] = ts.toDate();
                ts.add(step);
            }

            rows.push(row);

            if (rows.length >= insertLimit) {
                await knex(signalTable).insert(rows);
                rows = [];
            }
        }

        if (rows.length) {
            await knex(signalTable).insert(rows);
        }
    }

    await generateSignalSet(
        'process1',
        'Process 1',
        ['s1', 's2', 's3', 's4'],
        moment.utc('2016-01-01 00:00:00.000'),
        moment.utc('2017-01-01 00:00:00.000'),
        moment.duration(10, 's'),
        30
    );

    await generateSignalSet(
        'process2',
        'Process 2',
        ['s1', 's2', 's3', 's4'],
        moment.utc('2016-01-01 00:00:00.000'),
        moment.utc('2017-01-01 00:00:00.000'),
        moment.duration(1, 'm'),
        0
    );

})();