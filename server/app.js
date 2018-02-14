'use strict';

const em = require('./lib/extension-manager');
const config = require('./lib/config');
const log = require('npmlog');

const appCommon = require('./lib/app-common');

const cookieParser = require('cookie-parser');
const passport = require('./lib/passport');
const session = require('express-session');

const routes = require('./routes/index');

const usersRest = require('./routes/rest/users');
const sharesRest = require('./routes/rest/shares');
const namespacesRest = require('./routes/rest/namespaces');
const accountRest = require('./routes/rest/account');
const signalSetsRest = require('./routes/rest/signal-sets');
const signalsRest = require('./routes/rest/signals');
const templatesRest = require('./routes/rest/templates');
const workspacesRest = require('./routes/rest/workspaces');
const panelsRest = require('./routes/rest/panels');

const app = appCommon.createApp();

app.use(cookieParser());

app.use(session({
    secret: config.www.secret,
    saveUninitialized: false,
    resave: false
}));

passport.setupRegularAuth(app);

app.all('/api/*', passport.authBySSLCert);

appCommon.installPreRoutes(app);

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

app.use('/', routes);

appCommon.installErrorHandlers(app);

module.exports = app;