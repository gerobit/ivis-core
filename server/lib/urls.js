'use strict';

const config = require('./config');
const urllib = require('url');
const {anonymousRestrictedAccessToken} = require('../../shared/urls');
const {getLangCodeFromExpressLocale} = require('./translate');

function getTrustedUrlBase() {
    return urllib.resolve(config.www.trustedUrlBase, '');
}

function getSandboxUrlBase() {
    return urllib.resolve(config.www.sandboxUrlBase, '');
}

function _getUrl(urlBase, path, opts) {
    const url = new URL(path || '', urlBase);

    if (opts && opts.locale) {
        url.searchParams.append('locale', getLangCodeFromExpressLocale(opts.locale));
    }

    if (opts && opts.searchParams) {
        for (const key in opts.searchParams) {
            url.searchParams.append(key, opts.searchParams[key]);
        }
    }

    return url.toString();
}

function getTrustedUrl(path, opts) {
    return _getUrl(config.www.trustedUrlBase, path || '', opts);
}

function getSandboxUrl(path, context, opts) {
    const restrictedAccessToken = (opts && opts.restrictedAccessToken) || (context && context.user && context.user.restrictedAccessToken);

    if (restrictedAccessToken) {
        return _getUrl(config.www.sandboxUrlBase, restrictedAccessToken + '/' + (path || ''), opts);
    } else {
        return _getUrl(config.www.sandboxUrlBase, anonymousRestrictedAccessToken + '/' + (path || ''), opts);
    }
}

function getTrustedUrlBaseDir() {
    const ivisUrl = urllib.parse(config.www.trustedUrlBase);
    return ivisUrl.pathname;
}

function getSandboxUrlBaseDir() {
    const ivisUrl = urllib.parse(config.www.sandboxUrlBase);
    return ivisUrl.pathname;
}

module.exports = {
    getTrustedUrl,
    getSandboxUrl,
    getTrustedUrlBase,
    getSandboxUrlBase,
    getTrustedUrlBaseDir,
    getSandboxUrlBaseDir
};