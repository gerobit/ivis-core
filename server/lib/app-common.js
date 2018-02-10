'use strict';

const em = require('../lib/extension-manager');
const config = require('./config');
const log = require('npmlog');

const express = require('express');
const bodyParser = require('body-parser');
const path = require('path');
const logger = require('morgan');
const hbs = require('hbs');
const compression = require('compression');
const contextHelpers = require('./context-helpers');

const interoperableErrors = require('../../shared/interoperable-errors');

function createApp() {
    const app = express();

    // view engine setup
    app.set('views', path.join(__dirname, '..', 'views'));
    app.set('view engine', 'hbs');

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

    const clientDist = em.get('app.clientDist', path.join(__dirname, '..', '..', 'client', 'dist'));
    app.use('/client', express.static(clientDist));

    app.use(bodyParser.json({
        limit: config.www.postsize
    }));

    app.all('/rest/*', (req, res, next) => {
        req.needsJSONResponse = true;
        next();
    });

    app.all('/api/*', (req, res, next) => {
        req.needsJSONResponse = true;
        next();
    });

    return app;
}

function installPreRoutes(app) {
    app.use((req, res, next) => {
        req.context = contextHelpers.getRequestContext(req);
        next();
    });
}

function installErrorHandlers(app) {
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
}

module.exports = {
    createApp,
    installErrorHandlers,
    installPreRoutes
};
