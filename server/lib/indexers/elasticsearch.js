'use strict';

const {enforce} = require('../lib/helpers');
const interoperableErrors = require('../../shared/interoperable-errors');
const { getMinAggregationInterval } = require('../../shared/signals');

const em = require('./extension-manager');

const fork = require('child_process').fork;

const path = require('path');
const log = require('npmlog');

const indexerExec = em.get('indexer.elasticsearch.exec', path.join(__dirname, '..', 'services', 'indexer-elasticsearch.js'));

let indexerProcess;

function startProcess() {
    log.info('Indexer', 'Spawning indexer process');

    indexerProcess = fork(indexerExec, [], {
        cwd: path.join(__dirname, '..'),
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


const maxPoints = 5000;

const allowedAggs = new Set(['min', 'max', 'avg']);

async function query(aggs, qry) {
}


async function onCreateStorage(cid, aggs) {
}

async function onExtendSchema(cid, aggs, fields) {
}

async function onRenameField(cid, aggs, oldFieldCid, newFieldCid) {
}

async function onRemoveField(cid, aggs, fieldCid) {
}

async function onRemoveStorage(cid) {
}

async function onInsertRecords(cid, aggs, records) {
}

function startProcess() {
}

function reindex() {
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