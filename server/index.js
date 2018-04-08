'use strict';

const em = require('./lib/extension-manager');
const config = require('./lib/config');
const knex = require('./lib/knex');
const log = require('npmlog');
const https = require('https');
const fs = require('fs');
const shares = require('./models/shares');
const templates = require('./models/templates');
const builder = require('./lib/builder');
const indexer = require('./lib/indexers/' + config.indexer);
const appBuilder = require('./app-builder');

const i18n = require('./lib/i18n');

log.level = config.log.level;

async function initAndStart() {
    function createServer(appType, host, port, certsConfig) {
        const app = appBuilder.createApp(appType);

        const options = {
            key: fs.readFileSync(certsConfig.serverKey),
            cert: fs.readFileSync(certsConfig.serverCert),
            ca: fs.readFileSync(certsConfig.caCert),
            crl: fs.readFileSync(certsConfig.crl),
            requestCert: true,
            rejectUnauthorized: false
        };

        app.set('port', port);

        const server = https.createServer(options, app);

        server.on('listening', () => {
            const addr = server.address();
            log.info('Express', `WWW server listening on HTTPS port ${addr.port}`);
        });

        server.listen(port, host);
    }


    await i18n.init();

    await knex.migrate.latest();

    await em.invokeAsync('knex.migrate');

    await shares.regenerateRoleNamesTable();
    await shares.rebuildPermissions();

    builder.startProcess();
    indexer.startProcess();
    await templates.compileAllPending();

    createServer(appBuilder.AppType.TRUSTED, config.www.host, config.www.port, config.certs.www);
    createServer(appBuilder.AppType.SANDBOX, config.www.host, config.www.sandboxPort, config.certs.www);
    createServer(appBuilder.AppType.API, config.www.host, config.www.apiPort, config.certs.api);
}

initAndStart().catch(err => {
    log.error(err);
    process.exit(1);
});