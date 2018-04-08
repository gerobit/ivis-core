'use strict';

const em = require('./lib/extension-manager');
const config = require('./lib/config');
const log = require('npmlog');

const cookieParser = require('cookie-parser');
const passport = require('./lib/passport');
const session = require('express-session');

const indexTrusted = require('./routes/index-trusted');
const indexSandbox = require('./routes/index-sandbox');

const usersRest = require('./routes/rest/users');
const sharesRest = require('./routes/rest/shares');
const namespacesRest = require('./routes/rest/namespaces');
const accountRest = require('./routes/rest/account');
const signalSetsRest = require('./routes/rest/signal-sets');
const signalsRest = require('./routes/rest/signals');
const templatesRest = require('./routes/rest/templates');
const workspacesRest = require('./routes/rest/workspaces');
const panelsRest = require('./routes/rest/panels');

const express = require('express');
const bodyParser = require('body-parser');
const path = require('path');
const logger = require('morgan');
const hbs = require('hbs');
const compression = require('compression');
const contextHelpers = require('./lib/context-helpers');

const interoperableErrors = require('../shared/interoperable-errors');


const AppType = {
    TRUSTED: 0,
    SANDBOX: 1,
    API: 2
};


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

    if (type === AppType.TRUSTED || type === AppType.SANDBOX) {
        // view engine setup
        app.set('views', path.join(__dirname, 'views'));
        app.set('view engine', 'hbs');

        const clientDist = em.get('app.clientDist', path.join(__dirname, '..', '..', 'client', 'dist'));
        useWith404Fallback('/client', express.static(clientDist));

        app.all('/rest/*', (req, res, next) => {
            req.needsJSONResponse = true;
            next();
        });

        app.use(cookieParser());

        app.use(session({
            secret: config.www.secret,
            saveUninitialized: false,
            resave: false
        }));

    } else if (type === AppType.API) {
        app.all('/api/*', (req, res, next) => {
            req.needsJSONResponse = true;
            next();
        });
    }

    if (type === AppType.TRUSTED) {
        passport.setupRegularAuth(app);
    } else if (type === AppType.SANDBOX) {
        app.use(passport.tryAuthByRestrictedAccessToken);
    } else if (type === AppType.API) {
        app.use(passport.authBySSLCert);
    }

    app.use((req, res, next) => {
        req.context = contextHelpers.getRequestContext(req);
        next();
    });

    if (type === AppType.TRUSTED || type === AppType.SANDBOX) {
        em.invoke('app.installRoutes', app);

        app.use('/rest', usersRest);
        app.use('/rest', sharesRest);
        app.use('/rest', namespacesRest);
        app.use('/rest', accountRest);
        app.use('/rest', signalSetsRest);
        app.use('/rest', signalsRest);
        app.use('/rest', templatesRest);
        app.use('/rest', workspacesRest);
        app.use('/rest', panelsRest);

        install404Fallback('/rest');

    } else if (type === AppType.API) {
        em.invoke('app.installAPIRoutes', app);
    }

    if (type === AppType.TRUSTED) {
        app.use('/', indexTrusted);
    } else if (type === AppType.SANDBOX) {
        app.use('/', indexSandbox);
    }

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
