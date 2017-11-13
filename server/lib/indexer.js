'use strict';

const em = require('./extension-manager');

const fork = require('child_process').fork;

const path = require('path');
const log = require('npmlog');

const indexerExec = em.get('indexer.exec', path.join(__dirname, '..', 'services', 'indexer.js'));

let indexerProcess;

function start() {
    log.info('Indexer', 'Spawning indexer process');

    indexerProcess = fork(indexerExec, [], {
        cwd: path.join(__dirname, '..'),
        env: {NODE_ENV: process.env.NODE_ENV}
    });

    indexerProcess.on('close', (code, signal) => {
        log.info('Indexer', 'Indexer process exited with code %s signal %s.', code, signal);
    });
}

function index() {
    indexerProcess.send({
        type: 'index'
    });
}

module.exports = {
    start
};