'use strict';

import ivisConfig from "ivisConfig";

let restrictedAccessToken = 'ANONYMOUS';

function setRestrictedAccessToken(token) {
    restrictedAccessToken = token;
}

function getTrustedUrl(path) {
    return ivisConfig.trustedUrlBase + (path || '');
}

function getSandboxUrl(path) {
    return ivisConfig.sandboxUrlBase + restrictedAccessToken + '/' + (path || '');
}

function getUrl(path) {
    if (ivisConfig.trusted) {
        return getTrustedUrl(path);
    } else {
        return getSandboxUrl(path);
    }
}

function getBaseDir() {
    if (ivisConfig.trusted) {
        return ivisConfig.trustedUrlBaseDir;
    } else {
        return ivisConfig.sandboxUrlBaseDir + 'ANONYMOUS';
    }
}

export {
    getTrustedUrl,
    getSandboxUrl,
    getUrl,
    getBaseDir,
    setRestrictedAccessToken
}