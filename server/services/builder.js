'use strict';

const config = require('config');
const knex = require('../lib/knex');
const webpack = require('webpack');
const path = require('path');
const { BuildState } = require('../../shared/build');
const fs = require('fs-extra-promise');
const log = require('npmlog');
const webpackShared = require('../../shared/webpack');

const buildDir = path.join(__dirname, '..', 'files', 'build');
const outputDir = path.join(buildDir, 'output');

log.level = config.log.level;


async function setState(stateId, state, output) {
    await knex(stateId.table).where('id', stateId.rowId).update({state, output: JSON.stringify(output)});
}



const externals = {};
externals.ivisConfig = 'ivisConfig';
for (const lib of webpackShared.libs) {
    externals[lib.lib] = lib.id;
}

function getWebpackConfig(moduleId) {
    return {
        entry: {
            index: path.join(buildDir, 'index.js')
        },
        output: {
            filename: 'module.js',
                path: outputDir,
                library: moduleId
        },
        module: {
            rules: [
                {
                    test: /\.(js|jsx)$/,
                    exclude: path.join(__dirname, '..', 'node_modules'),
                    use: [
                        {
                            loader: 'babel-loader',
                            options: {
                                presets: [
                                    ['env', {
                                        targets: {
                                            modules: false,
                                            browsers: ['> 10%']
                                        }
                                    }],
                                    'stage-1'
                                ],
                                plugins: ['transform-react-jsx', 'transform-decorators-legacy', 'transform-function-bind']
                            }
                        }
                    ]
                },
                {
                    test: /\.css$/,
                    use: [ 'style-loader', 'css-loader' ]
                },
                {
                    test: /\.(png|jpg|gif|woff2?|svg)$/,
                    use: [
                        {
                            loader: 'url-loader',
                            options: {
                                limit: 8192 // inline base64 URLs for <=8k images, direct URLs for the rest
                            }
                        }
                    ]
                },
                {
                    test: /\.scss$/,
                    exclude: path.join(__dirname, '..', 'node_modules'),
                    use: [
                        'style-loader',
                        {
                            loader: 'css-loader',
                            options: {
                                modules: true,
                                localIdentName: '[path][name]__[local]--[hash:base64:5]'
                            }
                        },
                        'sass-loader' ]
                },
                {
                    test: /bootstrap\/dist\/js\//,
                    use: [
                        {
                            loader: 'imports-loader',
                            options: {
                                jQuery: 'jquery'
                            }
                        }
                    ]
                },
                {
                    test: /\.(png|jpg|gif)$/,
                    use: [
                        {
                            loader: 'url-loader',
                            options: {
                                limit: 8192 // inline base64 URLs for <=8k images, direct URLs for the rest
                            }
                        }
                    ]
                },
                {
                    test: /\.(ttf|eot)$/,
                    use: [ 'file-loader' ]
                }
            ]
        },
        externals,
        plugins: [
  //          new webpack.optimize.UglifyJsPlugin()
        ]
    };
}


const workQueue = [];
let running = false;

async function build(workEntry) {
    try {
        const compiler = webpack(getWebpackConfig(workEntry.moduleId));

        const compile = () => new Promise((resolve, fail) => {
            compiler.run((err, stats) => {
                if (err) {
                    fail(err);
                } else {
                    resolve(stats);
                }
            })
        });

        await setState(workEntry.stateId, BuildState.PROCESSING);

        await fs.emptyDirAsync(buildDir);
        await fs.writeFileAsync(path.join(buildDir, 'index.js'), workEntry.indexJs);
        await fs.writeFileAsync(path.join(buildDir, 'styles.scss'), workEntry.stylesScss);
        await fs.emptyDirAsync(outputDir);

        const stats = await compile();

        const errs = stats.toJson('errors-only');

        if (errs.errors.length > 0) {
            await fs.remove(workEntry.destDir);
            await setState(workEntry.stateId, BuildState.FAILED, errs);
        } else {
            await fs.moveAsync(outputDir, workEntry.destDir, { overwrite: true });
            await setState(workEntry.stateId, BuildState.FINISHED, errs);
        }

        await fs.remove(buildDir);
    } catch (err) {
        log.error(err);
        await setState(workEntry.stateId, BuildState.FAILED);
    }
}

async function buildAll() {
    while (workQueue.length > 0) {
        const workEntry = workQueue.shift();
        try {
            await build(workEntry);
        } catch (err) {
            log.error(err);
        }
    }

    running = false;
}

function startIfNotRunning() {
    if (running) {
        return;
    }

    running = true;

    buildAll();
}

process.on('message', msg => {
    if (msg) {
        const type = msg.type;

        if (type === 'schedule-build') {
            workQueue.push(msg.buildSpec);

            startIfNotRunning();
        }
    }
});

log.info('Builder', 'Builder process started');
