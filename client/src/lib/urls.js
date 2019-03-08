'use strict';

import {anonymousRestrictedAccessToken} from '../../../shared/urls';
import {AppType} from '../../../shared/app';
import ivisConfig
    from "ivisConfig";

let restrictedAccessToken = anonymousRestrictedAccessToken;

export function setRestrictedAccessToken(token) {
    restrictedAccessToken = token;
}

export function setRestrictedAccessTokenFromPath(path) {
    const locationElems = path.substring(ivisConfig.sandboxUrlBaseDir.length).split('/')
    if (locationElems.length > 0) {
        const restrictedAccessToken = locationElems[0];
        setRestrictedAccessToken(restrictedAccessToken);
    }
}

export function getTrustedUrl(path) {
    return ivisConfig.trustedUrlBase + (path || '');
}

export function getSandboxUrl(path, customRestrictedAccessToken) {
    const localRestrictedAccessToken = customRestrictedAccessToken || restrictedAccessToken;
    return ivisConfig.sandboxUrlBase + localRestrictedAccessToken + '/' + (path || '');
}

export function getUrl(path) {
    if (ivisConfig.appType === AppType.TRUSTED) {
        return getTrustedUrl(path);
    } else if (ivisConfig.appType === AppType.SANDBOXED) {
        return getSandboxUrl(path);
    }
}

export function getBaseDir() {
    if (ivisConfig.appType === AppType.TRUSTED) {
        return ivisConfig.trustedUrlBaseDir;
    } else if (ivisConfig.appType === AppType.SANDBOXED) {
        return ivisConfig.sandboxUrlBaseDir + restrictedAccessToken;
    }
}
