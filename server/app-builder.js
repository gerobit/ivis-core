'use strict';

const em = require('./lib/extension-manager');
const config = require('./lib/config');
const log = require('./lib/log');

const cookieParser = require('cookie-parser');
const passport = require('./lib/passport');
const session = require('express-session');

const index = require('./routes/index');
const files = require('./routes/files');

const usersRest = require('./routes/rest/users');
const sharesRest = require('./routes/rest/shares');
const namespacesRest = require('./routes/rest/namespaces');
const accountRest = require('./routes/rest/account');
const signalSetsRest = require('./routes/rest/signal-sets');
const signalsRest = require('./routes/rest/signals');
const templatesRest = require('./routes/rest/templates');
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

    if (type === AppType.TRUSTED) {
        passport.setupRegularAuth(app);
    } else if (type === AppType.SANDBOXED) {
        app.use(passport.tryAuthByRestrictedAccessToken);
    } else if (type === AppType.API) {
        app.use(passport.authBySSLCert);
    }

    app.use((req, res, next) => {
        req.context = contextHelpers.getRequestContext(req);
        next();
    });

    if (type === AppType.TRUSTED || type === AppType.SANDBOXED) {
        const clientDist = em.get('app.clientDist', path.join(__dirname, '..', 'client', 'dist'));
        useWith404Fallback('/client', express.static(clientDist));

        app.all('/rest/*', (req, res, next) => {
            req.needsJSONResponse = true;
            next();
        });

        em.invoke('app.installRoutes', app);

        useWith404Fallback('/files', files);

        app.use('/rest', usersRest);
        app.use('/rest', sharesRest);
        app.use('/rest', namespacesRest);
        app.use('/rest', accountRest);
        app.use('/rest', signalSetsRest);
        app.use('/rest', signalsRest);
        app.use('/rest', templatesRest);
        app.use('/rest', workspacesRest);
        app.use('/rest', filesRest);
        app.use('/rest', panelsRest);
        app.use('/rest', settingsRest);

        if (type === AppType.SANDBOXED) {
            app.use('/rest', embedRest);
        }

        install404Fallback('/rest');

    } else if (type === AppType.API) {
        app.all('/api/*', (req, res, next) => {
            req.needsJSONResponse = true;
            next();
        });

        em.invoke('app.installAPIRoutes', app);

        app.use('/api', embedApi);
    }

    app.use('/', index.getRouter(type));

    // catch 404 and forward to error handler
    app.use((req, res, next) => {
        let err = new Error('Not Found');
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

module.exports = {
    AppType,
    createApp
};
