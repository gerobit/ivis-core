'use strict';

import lzString from "lz-string";

export function extractPermanentLinkConfigAndRedirect(location, history) {
    const searchParams = new URLSearchParams(location.search);

    if (searchParams.has('config')) {
        const permanentLinkConfig = JSON.parse(lzString.decompressFromEncodedURIComponent(searchParams.get('config')));

        searchParams.delete('config');
        history.replace(location.pathname + '?' + searchParams.toString(), { permanentLinkConfig });
    }
}

export function needsToExtractPermanentLinkAndRedirect(location) {
    const searchParams = new URLSearchParams(location.search);
    return searchParams.has('config');
}

export function createPermanentLink(url, config) {
    const configData = lzString.compressToEncodedURIComponent(JSON.stringify(config));

    const newUrl = new URL(url);
    newUrl.searchParams.append('config', configData);

    return newUrl.toString();
}

export function getPermanentLinkConfigFromLocationState(location) {
    return location.state && location.state.permanentLinkConfig;
}
