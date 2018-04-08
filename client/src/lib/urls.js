'use strict';

import ivisConfig from "ivisConfig";

let urlBase;
let sandboxUrlBase;

if (ivisConfig.urlBase.startsWith('/')) {
    urlBase = window.location.protocol + '//' + window.location.hostname + ':' + ivisConfig.port + ivisConfig.urlBase;
} else {
    urlBase = ivisConfig.urlBase
}

if (ivisConfig.sandboxUrlBase) {
    if (ivisConfig.urlBase.startsWith('/')) {
        sandboxUrlBase = window.location.protocol + '//' + window.location.hostname + ':' + ivisConfig.sandboxPort + ivisConfig.sandboxUrlBase;
    } else {
        sandboxUrlBase = ivisConfig.sandboxUrlBase
    }
} else {
    const loc = document.createElement("a");
    loc.href = urlBase;
    sandboxUrlBase = loc.protocol + '//' + loc.hostname + ':' + ivisConfig.sandboxPort + loc.pathname;
}

function getTrustedUrl(path) {
    return urlBase + path;
}

function getSandboxUrl(path) {
    return sandboxUrlBase + path;
}

function getUrl(path) {
    if (ivisConfig.isSandbox) {
        return getSandboxUrl(path);
    } else {
        return getTrustedUrl(path);
    }
}

export {
    getTrustedUrl,
    getSandboxUrl,
    getUrl
}