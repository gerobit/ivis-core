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

const app = require('./app');
const appUntrusted = require('./app-untrusted');

const i18n = require('./lib/i18n');

log.level = config.log.level;

async function initAndStart() {

    const options = {
        key: fs.readFileSync(config.www.serverKey),
        cert: fs.readFileSync(config.www.serverCert),
        ca: fs.readFileSync(config.www.caCert),
        crl: fs.readFileSync(config.www.crl),
        requestCert: true,
        rejectUnauthorized: false
    };

    function createServer(app, host, port) {
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

    await em.invokeAsync('knex.migrate', app);

    await shares.regenerateRoleNamesTable();
    await shares.rebuildPermissions();

    builder.start();
    await templates.compileAllPending();


    createServer(app, config.www.host, config.www.port)
    createServer(appUntrusted, config.www.hostUntrusted, config.www.portUntrusted)
}

initAndStart().catch(err => {
    log.error(err);
    process.exit(1);
});