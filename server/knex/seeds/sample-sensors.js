"use strict";

const moment = require('moment');
const {getColumnName, getTableName} = require('../../models/signal-storage');
const {SignalType} = require('../../../shared/signals');

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

exports.seed = (knex, Promise) => (async () => {
    async function generateSignalSet(cid, name, fields, startTs, endTs, step) {

        const tsCid = 'ts';

        await knex('signal_sets').where({cid: cid}).del();
        const sigSet = {cid, name, indexing: JSON.stringify({status: 1}), namespace: 1};
        const ids = await knex('signal_sets').insert(sigSet);
        sigSet.id = ids[0];

        const signalTable = getTableName(sigSet);

        const idMap = {};

        idMap[tsCid] = await knex('signals').insert({
            cid: tsCid,
            name: 'Timestamp',
            type: SignalType.DATE_TIME,
            settings: JSON.stringify({}),
            set: sigSet.id,
            namespace: 1
        });

        for (const fieldCid of fields) {
            idMap[fieldCid] = await knex('signals').insert({
                cid: fieldCid,
                name: fieldCid,
                type: SignalType.DOUBLE,
                settings: JSON.stringify({}),
                set: sigSet.id,
                namespace: 1
            });
        }

        await knex.schema.createTable(signalTable, table => {
            table.increments('id').primary();
            table.specificType(getColumnName(idMap[tsCid]), 'datetime(6)').notNullable().index();

            for (const fieldCid of fields) {
                table.specificType(getColumnName(idMap[fieldCid]), 'double');
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

            for (const fieldCid of fields) {
                row[getColumnName(idMap[fieldCid])] = walkers[fieldCid].next();
            }

            row[getColumnName(idMap[tsCid])] = ts.toDate();
            ts.add(step);

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
        moment.utc('2017-01-01 00:00:00.000'),
        moment.utc('2017-01-01 03:00:00.000'),
        moment.duration(10, 's')
    );

    await generateSignalSet(
        'process2',
        'Process 2',
        ['s1', 's2', 's3', 's4'],
        moment.utc('2017-01-01 00:00:00.000'),
        moment.utc('2017-01-02 00:00:00.000'),
        moment.duration(1, 'm'),
    );

})();