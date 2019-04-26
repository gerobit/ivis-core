'use strict';

const em = require('./lib/extension-manager');
const config = require('./lib/config');
const log = require('./lib/log');

const cookieParser = require('cookie-parser');
const passport = require('./lib/passport');
const session = require('express-session');

const index = require('./routes/index');
const files = require('./routes/files');
const pdfExport = require('./routes/pdf-export');

const usersRest = require('./routes/rest/users');
const sharesRest = require('./routes/rest/shares');
const namespacesRest = require('./routes/rest/namespaces');
const accountRest = require('./routes/rest/account');
const signalSetsRest = require('./routes/rest/signal-sets');
const signalsRest = require('./routes/rest/signals');
const templatesRest = require('./routes/rest/templates');
const jobsRest = require('./routes/rest/jobs');
const tasksRest = require('./routes/rest/tasks');
const workspacesRest = require('./routes/rest/workspaces');
const panelsRest = require('./routes/rest/panels');
const filesRest = require('./routes/rest/files');
const embedRest = require('./routes/rest/embed');
const settingsRest = require('./routes/rest/settings');

const embedApi = require('./routes/api/embed');

const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const compression = require('compression');

const path = require('path');
const logger = require('morgan');
const hbs = require('hbs');
const contextHelpers = require('./lib/context-helpers');

const interoperableErrors = require('../shared/interoperable-errors');

const { AppType } = require('../shared/app');

let isReady = false;
function setReady() {
    isReady = true;
}



function createApp(type) {
    const app = express();

    function install404Fallback(url) {
        app.use(url, (req, res, next) => {
            next(new interoperableErrors.NotFoundError());
        });

        app.use(url + '/*', (req, res, next) => {
            next(new interoperableErrors.NotFoundError());
        });
    }

    function useWith404Fallback(url, route) {
        app.use(url, route);
        install404Fallback(url);
    }


    // Handle proxies. Needed to resolve client IP
    if (config.www.proxy) {
        app.set('trust proxy', config.www.proxy);
    }

    // Do not expose software used
    app.disable('x-powered-by');

    if (type === AppType.SANDBOXED) {
        app.use(cors());
    }

    app.use(compression());

    app.use(logger(config.www.log, {
        stream: {
            write: message => {
                message = (message || '').toString();
                if (message) {
                    log.info('HTTP', message.replace('\n', '').trim());
                }
            }
        }
    }));

    app.use(bodyParser.json({
        limit: config.www.postsize
    }));

    // view engine setup
    app.set('views', path.join(__dirname, 'views'));
    app.set('view engine', 'hbs');

    if (type === AppType.TRUSTED || type === AppType.SANDBOXED) {
        app.use(cookieParser());

        if (config.redis.enabled) {
            const RedisStore = require('connect-redis')(session);

            app.use(session({
                store: new RedisStore(config.redis),
                secret: config.www.secret,
                saveUninitialized: false,
                resave: false
            }));
        } else {
            app.use(session({
                store: false,
                secret: config.www.secret,
                saveUninitialized: false,
                resave: false
            }));
        }
    }

    app.use((req, res, next) => {
        if (isReady) {
            next();
        } else {
            res.status(500);
            res.render('error', {
                message: em.get('app.title') + ' is starting. Try again after a few seconds.',
                error: {}
            });
        }
    });

    if (type === AppType.TRUSTED) {
        passport.setupRegularAuth(app);

    } else if (type === AppType.SANDBOXED) {
        app.use(passport.tryAuthByRestrictedAccessToken);

    } else if (type === AppType.API) {
        app.all('/api/*', (req, res, next) => {
            req.needsJSONResponse = true;
            next();
        });

        app.use(passport.authBySSLCertOrToken);
    }

    app.use((req, res, next) => {
        req.context = contextHelpers.getRequestContext(req);
        next();
    });

    if (type === AppType.TRUSTED || type === AppType.SANDBOXED) {
        const clientDist = em.get('app.clientDist', path.join(__dirname, '..', 'client', 'dist'));
        useWith404Fallback('/static', express.static(path.join(__dirname, '..', 'client', 'static')));
        useWith404Fallback('/client', express.static(clientDist));

        useWith404Fallback('/static-npm/fontawesome', express.static(path.join(__dirname, '..', 'client', 'node_modules', '@fortawesome', 'fontawesome-free', 'webfonts')));
        useWith404Fallback('/static-npm/jquery.min.js', express.static(path.join(__dirname, '..', 'client', 'node_modules', 'jquery', 'dist', 'jquery.min.js')));
        useWith404Fallback('/static-npm/popper.min.js', express.static(path.join(__dirname, '..', 'client', 'node_modules', 'popper.js', 'dist', 'umd', 'popper.min.js')));
        useWith404Fallback('/static-npm/bootstrap.min.js', express.static(path.join(__dirname, '..', 'client', 'node_modules', 'bootstrap', 'dist', 'js', 'bootstrap.min.js')));
        useWith404Fallback('/static-npm/coreui.min.js', express.static(path.join(__dirname, '..', 'client', 'node_modules', '@coreui', 'coreui', 'dist', 'js', 'coreui.min.js')));

        app.all('/rest/*', (req, res, next) => {
            req.needsJSONResponse = true;
            next();
        });

        em.invoke('app.installRoutes', app);

        useWith404Fallback('/files', files);
        useWith404Fallback('/pdf-export', pdfExport);

        app.use('/rest', usersRest);
        app.use('/rest', sharesRest);
        app.use('/rest', namespacesRest);
        app.use('/rest', accountRest);
        app.use('/rest', signalSetsRest);
        app.use('/rest', signalsRest);
        app.use('/rest', templatesRest);
        app.use('/rest', jobsRest);
        app.use('/rest', tasksRest);
        app.use('/rest', workspacesRest);
        app.use('/rest', filesRest);
        app.use('/rest', panelsRest);
        app.use('/rest', settingsRest);

        if (type === AppType.SANDBOXED) {
            app.use('/rest', embedRest);
        }

        install404Fallback('/rest');

    } else if (type === AppType.API) {
        em.invoke('app.installAPIRoutes', app);

        app.use('/api', embedApi);
    }

    app.use('/', index.getRouter(type));

    // catch 404 and forward to error handler
    app.use((req, res, next) => {
        const err = new Error('Not Found');
        err.status = 404;
        next(err);
    });

    // error handlers
    app.use((err, req, res, next) => {
        if (!err) {
            return next();
        }

        console.log(err);

        if (req.needsJSONResponse) {
            const resp = {
                message: err.message,
                error: {}
            };

            if (err instanceof interoperableErrors.InteroperableError) {
                resp.type = err.type;
                resp.data = err.data;
            }

            res.status(err.status || 500).json(resp);

        } else {
            res.status(err.status || 500);
            res.render('error', {
                message: err.message,
                error: {}
            });
        }
    });

    return app;
}

module.exports.createApp = createApp;
module.exports.setReady = setReady;
