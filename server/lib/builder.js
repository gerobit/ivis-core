'use strict';

const fork = require('child_process').fork;

const webpack = require('webpack');
const path = require('path');
const log = require('npmlog');

let builderProcess;

function start() {
    log.info('Builder', 'Spawning builder process');

    builderProcess = fork(path.join(__dirname, '..', 'services', 'builder.js'), [], {
        cwd: path.join(__dirname, '..'),
        env: {NODE_ENV: process.env.NODE_ENV}
    });

    builderProcess.on('close', (code, signal) => {
        log.info('Builder', 'Builder process exited with code %s signal %s.', code, signal);
    });
}

function scheduleBuild(moduleId, indexJs, stylesScss, destDir, stateId) {
    builderProcess.send({
        type: 'schedule-build',
        buildSpec: {
            moduleId,
            indexJs,
            stylesScss,
            destDir,
            stateId
        }
    });
}

module.exports = {
    start,
    scheduleBuild
};