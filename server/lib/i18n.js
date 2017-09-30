'use strict';

const config = require('config');
const i18next = require('i18next');
const Backend = require('i18next-node-fs-backend');

module.exports.init = () => {
    return new Promise((resolve, reject) => {
        i18next
            .use(Backend)
            .init({
                lng: config.language,

                keySeparator: '>',
                nsSeparator: '|',

                // debug: true,
                backend: {
                    // path where resources get loaded from
                    loadPath: __dirname + '/../../shared/locales/{{lng}}/{{ns}}.json',

                    // path to post missing resources
                    addPath: __dirname + '/../../shared/locales/{{lng}}/{{ns}}.missing.json',

                    // jsonIndent to use when storing json files
                    jsonIndent: 2
                }
            }, (err, t) => {
                if (err && !t) {
                    reject(err);
                } else {
                    module.exports.t = t;
                    resolve();
                }
            });
    });
};

module.exports.t = () => null;