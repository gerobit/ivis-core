'use strict';

const em = require('./extension-manager');

const fork = require('child_process').fork;

const path = require('path');
const log = require('./log');

const builderExec = em.get('builder.exec', path.join(__dirname, '..', 'services', 'builder.js'));

let builderProcess;

async function init() {
    log.info('Builder', 'Spawning builder process');

    builderProcess = fork(builderExec, [], {
        cwd: path.join(__dirname, '..'),
        env: {NODE_ENV: process.env.NODE_ENV}
    });

    let startedCallback;
    const startedPromise = new Promise((resolve, reject) => {
        startedCallback = resolve;
    });

    builderProcess.on('message', msg => {
        if (msg) {
            if (msg.type === 'started') {
                log.info('Builder', 'Builder process started');
                return startedCallback();
            }
        }
    });

    builderProcess.on('close', (code, signal) => {
        log.info('Builder', 'Builder process exited with code %s signal %s.', code, signal);
    });

    await startedPromise;
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
    init,
    scheduleBuild
};