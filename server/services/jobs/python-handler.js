'use strict';
const path = require('path');
const fs = require('fs-extra-promise');
const spawn = require('child_process').spawn;
const {TaskType} = require('../../../shared/tasks');
const readline = require('readline');
const config = require('../../lib/config');

// File name of every build output
const JOB_FILE_NAME = 'job.py';
// Directory name where virtual env is saved for task
const ENV_NAME = 'env';

const packagesForType = new Map();
packagesForType.set(TaskType.NUMPY, ['elasticsearch', 'numpy']);

const runningProc = new Map();

/**
 * Run job
 * @param id Job id
 * @param params Parameters for the task
 * @param runId Run ID, will be used by stop command
 * @param state
 * @param taskDir Directory with the task
 * @param onRequest Callback for handling request msgs from job.
 * @param onSuccess Callback on successful run
 * @param onFail callback on failed run
 * @returns {Promise<void>}
 */
async function run(id, runId, params, entities, state, taskDir, onRequest, onSuccess, onFail) {
    try {
        let output = '';
        let errOutput = '';

        const dataInput = {};
        dataInput.params = params || {};
        dataInput.entities = entities;
        dataInput.state = state;
        dataInput.es = {
            host: `${config.elasticsearch.host}`,
            port: `${config.elasticsearch.port}`
        };

        const pythonExec = path.join(taskDir, ENV_NAME, 'bin', 'python');
        const jobProc = spawn(`${pythonExec} ${JOB_FILE_NAME}`, {
            cwd: taskDir,
            shell: '/bin/bash',
            stdio: ['pipe', 'pipe', 'pipe', 'pipe']
        });

        const jobOutStream = readline.createInterface({
            input: jobProc.stdio[3]
        });

        jobOutStream.on('line', (input) => {
            onRequest(input)
                .then(msg => {
                    jobProc.stdin.write(JSON.stringify(msg) + '\n');
                })
                .catch(err => {
                    errOutput += err;
                });
        });

        runningProc.set(runId, jobProc);
        let storeConfig = null;

        // Send all configs and params to process on stdin in json format
        jobProc.stdin.write(JSON.stringify(dataInput) + '\n');

        // Error output is just gathered throughout the run and stored after run is done
        jobProc.stderr.on('data', (data) => {
            errOutput += data + '\n';
        });

        // Same as with error output
        jobProc.stdout.on('data', (data) => {
            output += data;
        });

        const pipeErrHandler = (err) => {
            errOutput += err;
        };

        jobProc.stdin.on('error', pipeErrHandler);
        jobProc.stderr.on('error', pipeErrHandler);
        jobProc.stdout.on('error', pipeErrHandler);
        jobProc.stdio[3].on('error', pipeErrHandler);

        jobProc.on('error', (err) => {
            runningProc.delete(runId);
            const failMsg = [err.toString(), 'Log:\n' + output, 'Error log:\n' + errOutput].join('\n\n');
            onFail(failMsg);
        });

        jobProc.on('exit', (code, signal) => {
            runningProc.delete(runId);
            if (code === 0) {
                onSuccess(output, storeConfig);
            } else {
                const failMsg = [`Run failed with code ${code}`, 'Log:\n' + output, 'Error log:\n' + errOutput].join('\n\n');
                onFail(failMsg);
            }
        });
    } catch (error) {
        onFail([error.toString()]);
    }
}


/**
 * Remove job
 * @param id
 * @returns {Promise<void>}
 */
async function remove(id) {
    // Nothing
}

function getPackages(type) {
    const packages = [];
    const pckgs = packagesForType.get(type);
    if (pckgs) {
        packages.push(...pckgs);
    } else {
        packages.push('elasticsearch');
    }
    return packages;
}

/**
 * Build task
 * @param id Task id
 * @param code Code to build
 * @param destDir Output dir
 * @param onSuccess Callback on success
 * @param onFail Callback on failed build
 * @returns {Promise<void>}
 */
async function build(id, code, destDir, onSuccess, onFail) {
    let buildDir;
    try {
        buildDir = path.join(destDir, '..', 'build');
        await fs.emptyDirAsync(buildDir);
        const filePath = path.join(buildDir, JOB_FILE_NAME);
        await fs.writeFileAsync(filePath, code);
        await fs.moveAsync(filePath, path.join(destDir, JOB_FILE_NAME), {overwrite: true});
        await fs.removeAsync(buildDir);
        await onSuccess(null);
    } catch (error) {
        if (buildDir) {
            await fs.remove(buildDir);
        }
        onFail(null, [error.toString()]);
    }
}

async function init(id, code, destDir, onSuccess, onFail) {
    await initType(null, id, code, destDir, onSuccess, onFail);
}

/**
 * Initialize and build task.
 * @param type type of task being init
 * @param id Task id
 * @param code Code to build after init
 * @param destDir Output dir
 * @param onSuccess Callback on success
 * @param onFail Callback on failed attempt
 * @returns {Promise<void>}
 */
async function initType(type, id, code, destDir, onSuccess, onFail) {

    try {
        const packages = getPackages(type);
        const buildDir = path.join(destDir, '..', 'build');
        await fs.emptyDirAsync(buildDir);

        const filePath = path.join(buildDir, JOB_FILE_NAME);
        await fs.writeFileAsync(filePath, code);

        const envDir = path.join(buildDir, ENV_NAME);

        const virtDir = path.join(envDir, 'bin', 'activate');
        const virtEnv = spawn(
            `${config.tasks.python.venvCmd} ${envDir} && source ${virtDir} && pip install ${packages.join(' ')} && deactivate`,
            {
                shell: '/bin/bash'
            }
        );

        virtEnv.on('error', async (error) => {
            console.log(error);
            onFail(null, [error.toString()]);
            await fs.removeAsync(buildDir);
        });

        let output = '';
        virtEnv.stderr.setEncoding('utf8');
        virtEnv.stderr.on('data', data => {
            output += data.toString();
        });

        virtEnv.stdout.setEncoding('utf8');
        virtEnv.stdout.on('data', data => {
            output += data.toString();
        });

        virtEnv.on('exit', async (code, signal) => {
            if (code === 0) {
                await fs.moveAsync(buildDir, destDir, {overwrite: true});
                await onSuccess(null);
            } else {
                await onFail(null, [`Init ended with code ${code} and the following error:\n${output}`]);
            }
            await fs.removeAsync(buildDir);
        });
    } catch (error) {
        console.log(error);
        onFail(null, [error.toString()]);
    }
}

/**
 * Stop running job
 * @param runId
 * @returns {Promise<void>}
 */
async function stop(runId) {
    const proc = runningProc.get(runId);
    if (proc) {
        proc.kill('SIGINT');
    }
    // TODO check the possibilty of run being on event loop
    // meaning that there is no runningProc registered on that id, but the run is in wait
    // as run is async function and job-handler doest not await on it

}

module.exports = {
    run,
    remove,
    build,
    init,
    initType,
    stop
};

