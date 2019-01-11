'use strict';

import {anonymousRestrictedAccessToken} from '../../../shared/urls';
import {AppType} from '../../../shared/app';
import ivisConfig
    from "ivisConfig";

let restrictedAccessToken = anonymousRestrictedAccessToken;

function setRestrictedAccessToken(token) {
    restrictedAccessToken = token;
}

function getTrustedUrl(path) {
    return ivisConfig.trustedUrlBase + (path || '');
}

function getSandboxUrl(path, customRestrictedAccessToken) {
    const localRestrictedAccessToken = customRestrictedAccessToken || restrictedAccessToken;
    return ivisConfig.sandboxUrlBase + localRestrictedAccessToken + '/' + (path || '');
}

function getUrl(path) {
    if (ivisConfig.appType === AppType.TRUSTED) {
        return getTrustedUrl(path);
    } else if (ivisConfig.appType === AppType.SANDBOXED) {
        return getSandboxUrl(path);
    }
}

function getBaseDir() {
    if (ivisConfig.appType === AppType.TRUSTED) {
        return ivisConfig.trustedUrlBaseDir;
    } else if (ivisConfig.appType === AppType.SANDBOXED) {
        return ivisConfig.sandboxUrlBaseDir + restrictedAccessToken;
    }
}

export {
    getTrustedUrl,
    getSandboxUrl,
    getUrl,
    getBaseDir,
    setRestrictedAccessToken
}