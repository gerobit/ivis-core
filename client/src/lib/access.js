'use strict';

export function getRestUrl(url) {
    const base = global.ivisPanelAccessToken ? `/rest/${global.ivisPanelAccessToken}` : '/rest';
    return base + url;
}
